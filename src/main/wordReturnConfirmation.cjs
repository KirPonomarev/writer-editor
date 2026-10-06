'use strict';

const { createHash, randomBytes } = require('node:crypto');

const MAX_DETAIL_LENGTH = 32000;
const CHOICE_SCHEME = 'word-return-choice';
const CHOICE_TARGET = 'word-return-choice://confirm';
const STYLE = `
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
body { background: #f8f5ef; color: #6d6861; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: light; }
main { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 16px; gap: 12px; }
header { flex: 0 1 auto; min-height: 0; max-height: 30%; overflow: auto; overflow-wrap: anywhere; }
h1 { margin: 0 0 8px; font-size: 17px; line-height: 1.35; font-weight: 600; }
p { margin: 0; white-space: pre-wrap; }
#detail { flex: 1 1 0; min-height: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #fffdf8; border: 1px solid #d6d1c9; border-radius: 6px; padding: 12px; }
form { flex: 0 0 auto; display: flex; justify-content: flex-end; gap: 12px; margin: 0; }
button { min-width: 100px; min-height: 44px; padding: 8px 16px; font: inherit; color: #4c4842; background: #fffdf8; border: 1px solid #aaa49b; border-radius: 6px; cursor: pointer; }
button:hover { border-color: #6d6861; color: #302d28; }
button:active { background: #e9e4dc; }
:focus-visible { outline: 2px solid #4c4842; outline-offset: 2px; }
`;
const STYLE_HASH = createHash('sha256').update(STYLE).digest('base64');
// Fixed trusted source: no document text is interpolated into executable code.
// Native submission is prevented; trusted buttons request an owned local
// protocol navigation. Special about: URLs can bypass Electron's will events.
const CHOICE_SCRIPT = `'use strict';
(() => {
  const form = document.querySelector('form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (event.isTrusted !== true) return;
    const response = event.submitter?.value;
    const token = form.elements.namedItem('token')?.value;
    if ((response !== 'cancel' && response !== 'apply') || !/^[a-f0-9]{64}$/.test(token)) return;
    window.location.assign('word-return-choice://confirm?token=' + token + '&response=' + response);
  });
})();`;
const CHOICE_HASH = createHash('sha256').update(CHOICE_SCRIPT).digest('base64');

function escapeText(value) {
  // Character references also preserve CR, which literal HTML would normalize.
  return value.replace(/[&<>"'\r]/gu, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;',
  })[character]);
}

function readDisplayText(request) {
  if (!request || typeof request !== 'object') throw Error('PENDING_RETURN_PREVIEW_INVALID');
  const result = {};
  for (const [key, limit] of [['title', 256], ['message', 1024], ['detail', MAX_DETAIL_LENGTH]]) {
    const field = Object.getOwnPropertyDescriptor(request, key);
    if (!field || !Object.hasOwn(field, 'value') || typeof field.value !== 'string'
      || !field.value.length || field.value.includes('\0') || !field.value.isWellFormed()) {
      throw Error('PENDING_RETURN_PREVIEW_INVALID');
    }
    if (field.value.length > limit) throw Error('PENDING_RETURN_PREVIEW_BUDGET');
    result[key] = field.value;
  }
  return result;
}

function confirmationBounds(parent, screen) {
  const parentBounds = parent.getBounds();
  const area = screen.getDisplayMatching(parentBounds)?.workArea;
  if (!area || ![area.x, area.y, area.width, area.height,
    parentBounds.x, parentBounds.y, parentBounds.width, parentBounds.height].every(Number.isFinite)) return null;
  const width = Math.min(760, Math.floor(area.width) - 32);
  const height = Math.min(640, Math.floor(area.height) - 32);
  if (width < 320 || height < 240) return null;
  const x = Math.round(Math.max(area.x + 16, Math.min(area.x + area.width - width - 16,
    parentBounds.x + (parentBounds.width - width) / 2)));
  const y = Math.round(Math.max(area.y + 16, Math.min(area.y + area.height - height - 16,
    parentBounds.y + (parentBounds.height - height) / 2)));
  return { x, y, width, height };
}

function confirmationHtml({ title, message, detail }, token) {
  const csp = `default-src 'none'; script-src 'sha256-${CHOICE_HASH}'; style-src 'sha256-${STYLE_HASH}'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeText(title)}</title><style>${STYLE}</style></head><body><main role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="message"><header><h1 id="title">${escapeText(title)}</h1><p id="message">${escapeText(message)}</p></header><div id="detail" role="region" aria-label="Перечень изменений" tabindex="0">${escapeText(detail)}</div><form action="${CHOICE_TARGET}" method="get"><input type="hidden" name="token" value="${token}"><button type="submit" name="response" value="cancel" autofocus>Отмена</button><button type="submit" name="response" value="apply">Применить</button></form></main><script>${CHOICE_SCRIPT}</script></body></html>`;
}

// Product confirmation effect only: a boolean choice is not Apply authority.
// Electron41's will-frame-navigate carries the frame/initiator identities. All
// choices are prevented locally; a rejecting private protocol is the backstop.
async function confirmWordReturn(request, { BrowserWindow, screen } = {}) {
  const displayText = readDisplayText(request); // Bound before any window exists.
  const parent = Object.getOwnPropertyDescriptor(request, 'parent')?.value;
  let bounds;
  try {
    if (!parent || parent.isDestroyed() || parent.webContents.isDestroyed()
      || typeof BrowserWindow !== 'function' || !screen) return false;
    bounds = confirmationBounds(parent, screen);
  } catch { return false; }
  if (!bounds) return false;

  const token = randomBytes(32).toString('hex');
  const html = confirmationHtml(displayText, token);
  const documentUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  const applyUrl = `${CHOICE_TARGET}?token=${token}&response=apply`;
  const cancelUrl = `${CHOICE_TARGET}?token=${token}&response=cancel`;

  return new Promise(resolve => {
    let child, contents, privateSession, choiceProtocol, sourceFrame;
    let settled = false, loaded = false, protocolInstalled = false, loadTimer;
    const parentContents = parent.webContents;
    const parentListeners = [];
    const finish = confirmed => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      for (const [target, event, listener] of parentListeners) target.removeListener(event, listener);
      try { if (child && !child.isDestroyed()) child.destroy(); } catch { confirmed = false; }
      try { if (protocolInstalled) choiceProtocol.unhandle(CHOICE_SCHEME); } catch { confirmed = false; }
      resolve(confirmed === true);
    };
    const cancel = () => finish(false);
    const current = () => {
      try {
        return !settled && !parent.isDestroyed() && parent.webContents === parentContents
          && !parentContents.isDestroyed() && child && !child.isDestroyed()
          && child.getParentWindow() === parent && child.webContents === contents && !contents.isDestroyed()
          && contents.session === privateSession;
      } catch { return false; }
    };
    const block = event => { event.preventDefault(); cancel(); };
    try {
      child = new BrowserWindow({ ...bounds, parent, modal: true, show: false, title: displayText.title,
        backgroundColor: '#f8f5ef', resizable: false, maximizable: false, minimizable: false,
        fullscreenable: false, autoHideMenuBar: true, useContentSize: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false,
          nodeIntegrationInSubFrames: false, webviewTag: false, javascript: true,
          devTools: false, webSecurity: true, allowRunningInsecureContent: false,
          navigateOnDragDrop: false, partition: 'word-return-confirmation-' + token },
      });
      contents = child.webContents;
      privateSession = contents.session;
      choiceProtocol = privateSession?.protocol;
      if (typeof choiceProtocol?.handle !== 'function' || typeof choiceProtocol?.unhandle !== 'function') return cancel();
      choiceProtocol.handle(CHOICE_SCHEME, () => {
        // A missed interception never becomes a response or an external launch.
        cancel();
        return new Response('', { status: 403 });
      });
      protocolInstalled = true;
      child.removeMenu();
      for (const [target, event] of [[parent, 'close'], [parent, 'closed'],
        [parentContents, 'destroyed'], [parentContents, 'render-process-gone']]) {
        target.on(event, cancel);
        parentListeners.push([target, event, cancel]);
      }
      child.on('close', cancel);
      child.on('closed', cancel);
      child.on('unresponsive', cancel);
      contents.on('destroyed', cancel);
      contents.on('render-process-gone', cancel);
      contents.on('did-fail-load', cancel);
      contents.on('will-redirect', block);
      contents.on('will-attach-webview', block);
      contents.on('did-navigate-in-page', cancel);
      contents.on('did-start-navigation', event => {
        try {
          if (!current() || event.isMainFrame !== true || event.isSameDocument !== false) return cancel();
          if (!loaded && event.url === documentUrl) return;
          // Electron starts navigation before the cancellable will event. This
          // observation grants no authority; the private protocol still rejects.
          if (loaded && contents.getURL() === documentUrl && contents.mainFrame === sourceFrame
            && (event.url === applyUrl || event.url === cancelUrl)) return;
          cancel();
        } catch { cancel(); }
      });
      contents.on('did-navigate', (_event, url) => {
        if (!current() || loaded || url !== documentUrl) cancel();
      });
      contents.setWindowOpenHandler(() => { cancel(); return { action: 'deny' }; });
      contents.on('will-frame-navigate', event => {
        event.preventDefault();
        try {
          if (!current() || !loaded || contents.getURL() !== documentUrl
            || contents.mainFrame !== sourceFrame || event.isMainFrame !== true || event.isSameDocument !== false
            || event.frame !== sourceFrame || event.initiator !== sourceFrame) return cancel();
          if (event.url === applyUrl) finish(true);
          else cancel(); // Cancel URL and every other navigation fail closed.
        } catch { cancel(); }
      });
      // Any navigation not stopped by the frame guard is denied as well.
      contents.on('will-navigate', block);
      contents.on('before-input-event', (event, input) => {
        if (input?.key === 'Escape') { event.preventDefault(); cancel(); }
      });
      contents.once('did-finish-load', () => {
        try {
          if (!current() || contents.getURL() !== documentUrl || !contents.mainFrame) return cancel();
          clearTimeout(loadTimer);
          sourceFrame = contents.mainFrame;
          loaded = true;
          // Native autofocus is on Cancel; the fixed handler never changes focus.
          child.show();
          child.focus();
        } catch { cancel(); }
      });
      loadTimer = setTimeout(cancel, 15000);
      loadTimer.unref?.();
      if (!current()) return cancel();
      Promise.resolve(child.loadURL(documentUrl)).catch(cancel);
    } catch { cancel(); }
  });
}

module.exports = { confirmWordReturn };
