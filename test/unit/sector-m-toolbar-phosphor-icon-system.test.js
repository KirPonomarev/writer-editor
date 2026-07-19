const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ICON_ROOT = path.join(ROOT, 'src', 'renderer', 'assets', 'icons', 'phosphor');
const REGULAR_ICON_ROOT = path.join(ICON_ROOT, 'regular');
const BOLD_ICON_ROOT = path.join(ICON_ROOT, 'bold');

const ICON_FILE_BY_CLASS = Object.freeze({
  'text-bold': 'text-b.svg',
  'text-italic': 'text-italic.svg',
  'text-underline': 'text-underline.svg',
  'paragraph-align': 'text-align-left.svg',
  'list-bullets': 'bold/list-bullets-bold.svg',
  link: 'regular/link-simple-horizontal.svg',
  comment: 'chat-text.svg',
  'paragraph-style': 'paragraph.svg',
  'character-style': 'text-aa.svg',
  undo: 'arrow-counter-clockwise.svg',
  redo: 'arrow-clockwise.svg',
  'line-height': 'arrows-out-line-vertical.svg',
  width: 'arrows-out-line-horizontal.svg',
  scale: 'arrows-out.svg',
  'caret-down': 'caret-down.svg',
  'dots-three': 'dots-three.svg',
  'dots-three-vertical': 'dots-three-vertical.svg',
});

const ICON_CLASS_BY_BIND_KEY = Object.freeze({
  'font-select': 'caret-down',
  'weight-select': 'caret-down',
  'size-select': 'caret-down',
  'line-height-select': 'line-height',
  'format-bold': 'text-bold',
  'format-italic': 'text-italic',
  'format-underline': 'text-underline',
  'paragraph-trigger': 'paragraph-align',
  'list-type': 'list-bullets',
  'insert-link': 'link',
  'review-comment': 'comment',
  'style-paragraph': 'paragraph-style',
  'style-character': 'character-style',
  'history-undo': 'undo',
  'history-redo': 'redo',
});

const SHARED_SHELL_ICON_FILES = Object.freeze([
  'regular/magnifying-glass.svg',
  'regular/plus.svg',
]);

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}

function getToolbarItemFragment(toolbarControls, bindKey) {
  const startToken = `data-toolbar-item-key="${bindKey}"`;
  const startIndex = toolbarControls.indexOf(startToken);
  assert.notEqual(startIndex, -1, `missing toolbar item: ${bindKey}`);
  const nextItemIndex = toolbarControls.indexOf('data-toolbar-item-key="', startIndex + startToken.length);
  return toolbarControls.slice(startIndex, nextItemIndex === -1 ? toolbarControls.length : nextItemIndex);
}

test('sector-m toolbar phosphor icons: bundled asset set is bounded, local, and licensed', () => {
  const expectedFiles = Object.values(ICON_FILE_BY_CLASS)
    .map((fileName) => fileName.includes('/') ? fileName : `regular/${fileName}`)
    .concat(SHARED_SHELL_ICON_FILES)
    .sort();
  const actualFiles = [
    ...fs.readdirSync(REGULAR_ICON_ROOT)
      .filter((name) => name.endsWith('.svg'))
      .map((name) => `regular/${name}`),
    ...fs.readdirSync(BOLD_ICON_ROOT)
      .filter((name) => name.endsWith('.svg'))
      .map((name) => `bold/${name}`),
  ].sort();

  assert.deepEqual(actualFiles, expectedFiles);
  assert.match(fs.readFileSync(path.join(ICON_ROOT, 'LICENSE'), 'utf8'), /MIT License/);

  for (const fileName of actualFiles) {
    const source = fs.readFileSync(path.join(ICON_ROOT, fileName), 'utf8');
    assert.match(source, /viewBox="0 0 256 256"/, `${fileName} keeps the canonical Phosphor canvas`);
    assert.match(source, /<(path|line|polyline|circle)\b/, `${fileName} contains a maskable icon shape`);
    assert.equal(source.includes('<script'), false, `${fileName} remains inert`);
  }
});

test('sector-m toolbar phosphor icons: each live visual belongs to its function node', () => {
  const html = read(['src', 'renderer', 'index.html']);
  const controlsMatch = html.match(/<div class="floating-toolbar__controls">([\s\S]*?)<div class="floating-toolbar__paragraph-menu"/);
  assert.ok(controlsMatch, 'main floating toolbar controls block must exist');
  const toolbarControls = controlsMatch[1];

  for (const [bindKey, iconClass] of Object.entries(ICON_CLASS_BY_BIND_KEY)) {
    const itemFragment = getToolbarItemFragment(toolbarControls, bindKey);
    assert.ok(
      itemFragment.includes(`floating-toolbar__phosphor-icon--${iconClass}`),
      `${bindKey} owns its ${iconClass} representation`,
    );
  }

  for (const bindKey of ['color-text', 'color-highlight']) {
    assert.ok(getToolbarItemFragment(toolbarControls, bindKey).includes('floating-toolbar__button-swatch'));
  }

  const scaleHandleMatch = html.match(/<div class="floating-toolbar__transform-handle floating-toolbar__transform-handle--scale"[\s\S]*?<\/div>/);
  assert.ok(scaleHandleMatch, 'main toolbar scale handle must exist');
  assert.ok(scaleHandleMatch[0].includes('floating-toolbar__phosphor-icon--scale'));

  assert.equal(toolbarControls.includes('<svg'), false);
  assert.equal(toolbarControls.includes('floating-toolbar__format-glyph'), false);
  assert.equal(toolbarControls.includes('floating-toolbar__styles-glyph'), false);
});

test('sector-m toolbar phosphor icons: CSS uses one currentColor mask protocol without positional coupling', () => {
  const styles = read(['src', 'renderer', 'styles.css']);
  const iconSectionStart = styles.indexOf('.floating-toolbar__phosphor-icon {');
  const iconSectionEnd = styles.indexOf('.floating-toolbar__line-height-icon-wrap {', iconSectionStart);
  assert.ok(iconSectionStart > -1 && iconSectionEnd > iconSectionStart);
  const iconSection = styles.slice(iconSectionStart, iconSectionEnd);

  assert.ok(iconSection.includes('background-color: currentColor;'));
  assert.ok(iconSection.includes('-webkit-mask-image: var(--floating-toolbar-icon-source);'));
  assert.ok(iconSection.includes('mask-image: var(--floating-toolbar-icon-source);'));
  assert.equal(iconSection.includes(':nth-child'), false);
  assert.ok(styles.includes('min-width: var(--toolbar-chrome-slot-icon);'));
  assert.ok(styles.includes('min-width: var(--toolbar-chrome-slot-icon-wide);'));

  for (const [iconClass, fileName] of Object.entries(ICON_FILE_BY_CLASS)) {
    const relativeFileName = fileName.includes('/') ? fileName : `regular/${fileName}`;
    assert.ok(iconSection.includes(`.floating-toolbar__phosphor-icon--${iconClass} {`));
    assert.ok(iconSection.includes(`url('./assets/icons/phosphor/${relativeFileName}')`));
  }
});

test('sector-m toolbar phosphor icons: list and link keep dedicated micro-toolbar optics', () => {
  const styles = read(['src', 'renderer', 'styles.css']);

  assert.ok(styles.includes("url('./assets/icons/phosphor/bold/list-bullets-bold.svg')"));
  assert.ok(styles.includes("url('./assets/icons/phosphor/regular/link-simple-horizontal.svg')"));
  assert.match(styles, /\.floating-toolbar__button--list \{[\s\S]*?gap: var\(--toolbar-chrome-gap-xxs\);/);
  assert.match(
    styles,
    /\.floating-toolbar__caret--list \{[\s\S]*?width: var\(--floating-toolbar-list-caret-size\);[\s\S]*?height: var\(--floating-toolbar-list-caret-size\);/,
  );
});

test('sector-m toolbar phosphor icons: top-toolbar optical scale follows the Yalken micro master', () => {
  const styles = read(['src', 'renderer', 'styles.css']);
  const transformStart = styles.indexOf('.floating-toolbar__transform-control {');
  const transformEnd = styles.indexOf('.floating-toolbar__transform-control:hover {', transformStart);
  assert.ok(transformStart > -1 && transformEnd > transformStart);
  const transformControl = styles.slice(transformStart, transformEnd);

  assert.ok(styles.includes('--toolbar-chrome-icon-size: 16px;'));
  assert.ok(styles.includes('--toolbar-chrome-utility-icon-size: 14px;'));
  assert.ok(styles.includes('--toolbar-chrome-caret-size: 10px;'));
  assert.ok(styles.includes('.floating-toolbar__button--color .floating-toolbar__button-swatch::before {'));
  assert.ok(transformControl.includes('background: transparent;'));
  assert.ok(transformControl.includes('color: var(--toolbar-chrome-ink);'));
  assert.ok(transformControl.includes('box-shadow: none;'));
  assert.equal(styles.includes('--toolbar-chrome-icon-size: 18px;'), false);
});
