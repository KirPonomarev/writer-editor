// Transient command input only. The editor revalidates identity and capability
// after awaiting this dialog; accepting an address never authorizes a write.
let activeDialog = null;

export function isLinkDialogOpen() { return activeDialog !== null; }
export function cancelLinkDialog() { activeDialog?.cancel(); }

export function openNodeNameDialog({ title, initialValue = '', rename = false }) {
  return openLinkDialog({
    title, initialValue, canRemove: false,
    fieldLabel: 'Название', inputMode: 'text', submitLabel: rename ? 'Переименовать' : 'Создать',
    cancelLabel: 'Отмена', errorMessage: 'Введите название от 1 до 80 символов без символов пути.',
    normalize: normalizeNodeName,
  });
}

export function normalizeNodeName(value) {
  return { ok: typeof value === 'string' && value.trim().length > 0
    && value.length <= 80 && !/[\\/<>:"|?*\u0000-\u001F\u007F]/u.test(value)
    && !/\.$/u.test(value.trim()) };
}

export function openLinkDialog({ title, initialValue, canRemove, normalize,
  fieldLabel = 'Link address', inputMode = 'url', submitLabel = 'Apply',
  cancelLabel = 'Cancel', errorMessage = 'Enter a valid http, https or mailto address.' }) {
  if (activeDialog) return Promise.resolve(null);
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'modal__content';
    dialog.style.width = 'min(360px, calc(100vw - 48px))';
    dialog.style.maxHeight = 'calc(100vh - 48px)';
    dialog.style.overflow = 'auto';
    dialog.style.border = '1px solid var(--toolbar-control-border)';
    dialog.setAttribute('aria-labelledby', 'link-dialog-title');
    const heading = document.createElement('h2');
    heading.id = 'link-dialog-title';
    heading.className = 'modal__title';
    heading.textContent = title;
    const label = document.createElement('label');
    label.className = 'modal__label';
    label.htmlFor = 'link-dialog-address';
    label.textContent = fieldLabel;
    const input = document.createElement('input');
    input.id = 'link-dialog-address';
    input.name = 'link-address';
    input.className = 'modal__input';
    input.type = 'text';
    input.inputMode = inputMode;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = initialValue;
    input.setAttribute('aria-describedby', 'link-dialog-error');
    const error = document.createElement('p');
    error.id = 'link-dialog-error';
    error.setAttribute('aria-live', 'polite');
    error.hidden = true;
    const actions = document.createElement('div');
    actions.className = 'modal__actions';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      activeDialog = null;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const button = (labelText, handler, primary = false) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `modal__button${primary ? ' modal__button--primary' : ''}`;
      node.textContent = labelText;
      node.addEventListener('click', handler);
      actions.append(node);
    };
    const submit = () => {
      if (!normalize(input.value).ok) {
        error.textContent = errorMessage;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus({ preventScroll: true });
        return;
      }
      finish(input.value);
    };
    button(cancelLabel, () => finish(null));
    if (canRemove) button('Remove link', () => finish(''));
    button(submitLabel, submit, true);
    dialog.append(heading, label, input, error, actions);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); }
    });
    activeDialog = { cancel: () => finish(null) };
    document.body.append(dialog);
    // Native modal top layer supplies background inertness and focus containment.
    try { dialog.showModal(); input.focus({ preventScroll: true }); input.select(); }
    catch (error) { finish(null); throw error; }
  });
}
