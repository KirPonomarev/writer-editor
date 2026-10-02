// Transient command input only. The editor revalidates identity and capability
// after awaiting this dialog; accepting an address never authorizes a write.
let activeDialog = null;

export function isLinkDialogOpen() { return activeDialog !== null; }
export function cancelLinkDialog() { activeDialog?.cancel(); }

export function openNodeNameDialog({ title, initialValue = '', rename = false, submitLabel }) {
  return openLinkDialog({
    title, initialValue, canRemove: false,
    fieldLabel: 'Название', inputMode: 'text', submitLabel: submitLabel || (rename ? 'Переименовать' : 'Создать'),
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
  cancelLabel = 'Cancel', errorMessage = 'Enter a valid http, https or mailto address.',
  bookmarks = [], manageBookmarks = false }) {
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
    const targetLabel = document.createElement('label');
    targetLabel.className = 'modal__label'; targetLabel.htmlFor = 'link-dialog-target';
    targetLabel.textContent = manageBookmarks ? 'Закладка' : 'Цель ссылки';
    const targets = document.createElement('select');
    targets.id = 'link-dialog-target'; targets.className = 'modal__input';
    const option = (value, labelText) => {
      const item = document.createElement('option'); item.value = value; item.textContent = labelText; targets.append(item);
    };
    option('', manageBookmarks ? 'Новая закладка' : 'Внешний адрес');
    for (const record of bookmarks) option(record.id, record.name + (record.state === 'deleted' ? ' — цель удалена' : ''));
    const initialTarget = !manageBookmarks && bookmarks.find(record => initialValue === '#' + record.name);
    if (initialTarget) targets.value = initialTarget.id;
    const note = document.createElement('p'); note.id = 'link-dialog-target-note';
    note.setAttribute('aria-live', 'polite'); targets.setAttribute('aria-describedby', note.id);
    const selected = () => bookmarks.find(record => record.id === targets.value);
    const syncTarget = () => {
      const record = selected();
      if (manageBookmarks) input.value = record?.name || '';
      else input.hidden = Boolean(record);
      note.textContent = record?.state === 'deleted' ? 'Цель удалена. Подпись ссылки сохраняется; выберите существующую цель для перенаправления.'
        : manageBookmarks ? 'Имя: буквы, цифры и _. До 40 символов. Удаление цели сохраняет подписи ссылок.' : '';
      error.hidden = true; input.removeAttribute('aria-invalid');
    };
    targets.addEventListener('change', syncTarget);
    if (manageBookmarks || bookmarks.length) syncTarget();
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
      const record = selected();
      if (!manageBookmarks && record) {
        if (record.state !== 'active') { error.textContent = 'Выберите существующую цель.'; error.hidden = false; return; }
        finish({ bookmarkId: record.id }); return;
      }
      if (!normalize(input.value).ok) {
        error.textContent = errorMessage;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus({ preventScroll: true });
        return;
      }
      finish(manageBookmarks ? { action: record ? 'rename' : 'create', bookmarkId: record?.id, name: input.value }
        : input.value);
    };
    button(cancelLabel, () => finish(null));
    if (canRemove) button('Remove link', () => finish(''));
    if (manageBookmarks) button('Копировать', () => {
      const record = selected();
      if (record?.state !== 'active' || !normalize(input.value).ok || input.value.toLowerCase() === record.name.toLowerCase()) {
        error.textContent = 'Выберите закладку и введите отдельное имя копии.'; error.hidden = false; return;
      }
      finish({ action: 'copy', bookmarkId: record.id, name: input.value });
    });
    if (manageBookmarks) button('Удалить цель', () => {
      if (selected()?.state !== 'active') { error.textContent = 'Выберите существующую закладку.'; error.hidden = false; return; }
      finish({ action: 'delete', bookmarkId: selected().id });
    });
    button(submitLabel, submit, true);
    dialog.append(heading);
    if (manageBookmarks || bookmarks.length) dialog.append(targetLabel, targets, note);
    dialog.append(label, input, error, actions);
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
