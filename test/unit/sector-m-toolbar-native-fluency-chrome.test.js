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

test('sector-m toolbar native fluency chrome: tokenized spacing ladder and quiet chrome contract is present', () => {
  const styles = readStylesSource();

  assert.ok(styles.includes('--toolbar-chrome-gap-xxs: 4px;'));
  assert.ok(styles.includes('--toolbar-chrome-gap-xs: 6px;'));
  assert.ok(styles.includes('--toolbar-chrome-gap-sm: 8px;'));
  assert.ok(styles.includes('--toolbar-chrome-gap-md: 12px;'));
  assert.ok(styles.includes('--toolbar-chrome-gap-lg: 16px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-height: 28px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-height-large: 32px;'));
  assert.ok(styles.includes('--toolbar-chrome-radius-button: 6px;'));
  assert.ok(styles.includes('--toolbar-chrome-radius-control: 8px;'));
  assert.ok(styles.includes('--toolbar-chrome-quiet-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-hover-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-active-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-pressed-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-focus-ring:'));

  assert.ok(styles.includes('gap: var(--toolbar-chrome-gap-xs);'));
  assert.ok(styles.includes('gap: var(--toolbar-chrome-gap-md);'));
  assert.ok(styles.includes('gap: var(--toolbar-chrome-gap-lg);'));
  assert.ok(styles.includes('margin: 0 var(--toolbar-chrome-gap-md);'));
  assert.ok(styles.includes('background: var(--toolbar-chrome-quiet-bg);'));
  assert.ok(styles.includes('background: var(--toolbar-chrome-hover-bg);'));
  assert.ok(styles.includes('background: var(--toolbar-chrome-active-bg);'));
  assert.ok(styles.includes('background: var(--toolbar-chrome-pressed-bg);'));
  assert.ok(styles.includes('height: var(--toolbar-chrome-control-height);'));
  assert.ok(styles.includes('height: var(--toolbar-chrome-control-height-large);'));
});

test('sector-m toolbar native fluency chrome: dark theme keeps chrome token parity for quiet controls', () => {
  const styles = readStylesSource();
  const darkThemeSection = sliceSection(styles, 'body.dark-theme {', '*,');

  assert.ok(darkThemeSection.includes('--toolbar-chrome-quiet-bg:'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-hover-bg:'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-active-bg:'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-pressed-bg:'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-focus-ring:'));
});

test('sector-m toolbar native fluency chrome: numeric controls remain readable and width-scale tuning stays intact', () => {
  const styles = readStylesSource();
  const sizeDisplaySection = sliceSection(
    styles,
    '.floating-toolbar__select-wrap--size .floating-toolbar__display {',
    '.floating-toolbar__select-wrap--size .floating-toolbar__display-text {'
  );
  const sizeDisplayTextSection = sliceSection(
    styles,
    '.floating-toolbar__select-wrap--size .floating-toolbar__display-text {',
    '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__select-wrap--size,'
  );
  const horizontalNumericQuietSection = sliceSection(
    styles,
    '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__select-wrap--size,',
    '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__button:hover {'
  );

  assert.ok(styles.includes('width: calc(132px * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('width: calc(84px * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('width: calc(96px * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('line-height: 17px;'));
  assert.ok(styles.includes('calc(var(--toolbar-chrome-control-height) * var(--floating-toolbar-width-scale));'));
  assert.ok(sizeDisplaySection.includes('justify-content: space-between;'));
  assert.ok(sizeDisplaySection.includes('gap: var(--toolbar-chrome-gap-sm);'));
  assert.ok(sizeDisplaySection.includes('padding: 0 var(--toolbar-chrome-gap-sm);'));
  assert.ok(sizeDisplayTextSection.includes('min-width: 2.4ch;'));
  assert.ok(sizeDisplayTextSection.includes('text-align: right;'));
  assert.ok(sizeDisplayTextSection.includes('font-variant-numeric: tabular-nums;'));
  assert.ok(sizeDisplayTextSection.includes('font-feature-settings: "tnum" 1, "lnum" 1;'));
  assert.ok(horizontalNumericQuietSection.includes('background: var(--toolbar-chrome-quiet-bg);'));
  assert.ok(horizontalNumericQuietSection.includes('background: var(--toolbar-chrome-hover-bg);'));
  assert.ok(styles.includes('font-variant-numeric: tabular-nums;'));
  assert.ok(styles.includes('--floating-toolbar-width-scale: 1;'));
  assert.ok(styles.includes('--left-toolbar-width-scale: 1;'));
});

test('sector-m toolbar native fluency chrome: toolbar sections forbid fake-scale and blur readability tricks', () => {
  const styles = readStylesSource();
  const leftToolbarSection = sliceSection(styles, '.left-floating-toolbar__shell {', '.floating-toolbar {');
  const floatingToolbarSection = sliceSection(styles, '.floating-toolbar__shell {', '.floating-toolbar__paragraph-menu {');

  assert.equal(leftToolbarSection.includes('transform: scale('), false);
  assert.equal(floatingToolbarSection.includes('transform: scale('), false);
  assert.equal(leftToolbarSection.includes('backdrop-filter:'), false);
  assert.equal(floatingToolbarSection.includes('backdrop-filter:'), false);
  assert.equal(leftToolbarSection.includes('filter: blur('), false);
  assert.equal(floatingToolbarSection.includes('filter: blur('), false);
});
