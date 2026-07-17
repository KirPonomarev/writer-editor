const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readStylesSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8');
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

test('sector-m toolbar vertical rail: groups and controls stretch inside the rail without component minima', () => {
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
  assert.ok(compositionSection.includes('flex: 1 1 0;'));
  assert.ok(controlSection.includes('align-self: stretch;'));
  assert.ok(controlSection.includes('width: 100%;'));
  assert.ok(controlSection.includes('min-width: 0;'));
});

test('sector-m toolbar vertical rail: paragraph content remains a bounded three-part grid', () => {
  const styles = readStylesSource();
  const paragraphSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__button--paragraph {',
    '.floating-toolbar__shell.is-vertical .floating-toolbar__select-wrap {'
  );

  assert.ok(paragraphSection.includes('grid-template-columns: var(--toolbar-chrome-icon-size) minmax(0, 1fr) var(--toolbar-chrome-caret-size);'));
  assert.ok(paragraphSection.includes('text-overflow: ellipsis;'));
  assert.ok(paragraphSection.includes('white-space: nowrap;'));
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
