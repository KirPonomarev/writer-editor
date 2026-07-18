const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readStylesSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8');
}

function readHtmlSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
}

function sliceSection(source, startToken, endToken) {
  const startIndex = source.indexOf(startToken);
  const endIndex = source.indexOf(endToken, startIndex);
  assert.ok(startIndex > -1, `missing start token: ${startToken}`);
  assert.ok(endIndex > startIndex, `missing end token: ${endToken}`);
  return source.slice(startIndex, endIndex);
}

test('sector-m toolbar vertical rail: orientation owns one bounded rail width', () => {
  const styles = readStylesSource();
  const shellSection = sliceSection(
    styles,
    '.floating-toolbar__shell {',
    '.floating-toolbar__shell::before {'
  );
  const verticalSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical {',
    '.floating-toolbar__shell.is-snapped {'
  );

  assert.ok(shellSection.includes('--floating-toolbar-vertical-rail-width: min('));
  assert.ok(shellSection.includes('var(--toolbar-chrome-vertical-panel-width)'));
  assert.ok(verticalSection.includes('width: var(--floating-toolbar-vertical-rail-width);'));
  assert.ok(verticalSection.includes('padding: var(--toolbar-chrome-vertical-pad);'));
  assert.ok(styles.includes('--toolbar-chrome-vertical-panel-width: 160px;'));
  assert.ok(styles.includes('--toolbar-chrome-slot-xlong: 136px;'));
});

test('sector-m toolbar vertical rail: major controls and action matrix share the canonical 136px rail', () => {
  const styles = readStylesSource();
  const compositionSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__group {',
    '.floating-toolbar__separator {'
  );
  const controlSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__select-wrap,',
    '.floating-toolbar__shell.is-vertical .floating-toolbar__display {'
  );

  assert.ok(compositionSection.includes('align-items: stretch;'));
  assert.ok(compositionSection.includes('width: 100%;'));
  assert.ok(compositionSection.includes('grid-template-columns: repeat(4, minmax(var(--toolbar-chrome-control-height), 1fr));'));
  assert.ok(compositionSection.includes('column-gap: var(--toolbar-chrome-gap-sm);'));
  assert.ok(compositionSection.includes('row-gap: var(--toolbar-chrome-gap-sm);'));
  assert.ok(compositionSection.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'));
  assert.ok(compositionSection.includes('display: contents;'));
  assert.ok(compositionSection.includes('width: var(--toolbar-chrome-control-height);'));
  assert.equal(compositionSection.includes(':nth-child'), false);
  assert.ok(controlSection.includes('align-self: stretch;'));
  assert.ok(controlSection.includes('width: 100%;'));
  assert.ok(controlSection.includes('min-width: 0;'));
});

test('sector-m toolbar vertical rail: paragraph and list remain matching bounded three-part fields', () => {
  const styles = readStylesSource();
  const html = readHtmlSource();
  const paragraphSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__button--paragraph,',
    '.floating-toolbar__shell.is-vertical .floating-toolbar__select-wrap {'
  );

  assert.ok(paragraphSection.includes('grid-template-columns: var(--toolbar-chrome-icon-size) minmax(0, 1fr) var(--toolbar-chrome-caret-size);'));
  assert.ok(paragraphSection.includes('text-overflow: ellipsis;'));
  assert.ok(paragraphSection.includes('white-space: nowrap;'));
  assert.ok(paragraphSection.includes('.floating-toolbar__button-label--list'));
  assert.ok(paragraphSection.includes('.floating-toolbar__caret--list'));
  assert.ok(html.includes('floating-toolbar__button-label--list">Список</span>'));
  assert.ok(styles.includes('.floating-toolbar__button:not(.floating-toolbar__button--paragraph):not(.floating-toolbar__button--list)'));
});

test('sector-m toolbar vertical rail: short viewports scroll content without shrinking action hit zones', () => {
  const styles = readStylesSource();
  const shellSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical {',
    '.floating-toolbar__shell.is-snapped {'
  );
  const compositionSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__group {',
    '.floating-toolbar__separator {'
  );

  assert.ok(shellSection.includes('max-height: calc(100vh - 24px);'));
  assert.ok(compositionSection.includes('overflow-y: auto;'));
  assert.ok(compositionSection.includes('overscroll-behavior: contain;'));
  assert.ok(compositionSection.includes('scrollbar-width: none;'));
  assert.ok(compositionSection.includes('height: var(--toolbar-chrome-control-height);'));
});

test('sector-m toolbar vertical rail: viewport rules do not introduce ad hoc toolbar slot widths', () => {
  const styles = readStylesSource();
  const compactSection = sliceSection(
    styles,
    '@media (max-width: 1279px) {',
    '@media (max-width: 899px) {'
  );
  const narrowSection = styles.slice(styles.indexOf('@media (max-width: 899px) {'));
  const horizontalFontSelector = '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__select-wrap--font {';
  const horizontalLineHeightSelector = '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__select-wrap--line-height {';

  assert.equal(compactSection.includes(horizontalFontSelector), false);
  assert.equal(compactSection.includes(horizontalLineHeightSelector), false);
  assert.equal(narrowSection.includes(horizontalFontSelector), false);
  assert.equal(narrowSection.includes(horizontalLineHeightSelector), false);
});
