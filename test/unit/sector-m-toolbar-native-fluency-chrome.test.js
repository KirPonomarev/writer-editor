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
  assert.ok(styles.includes('--toolbar-chrome-row-height: 48px;'));
  assert.ok(styles.includes('--toolbar-chrome-pad-x: 24px;'));
  assert.ok(styles.includes('--toolbar-chrome-item-gap: 10px;'));
  assert.ok(styles.includes('--toolbar-chrome-group-gap: 20px;'));
  assert.ok(styles.includes('--toolbar-chrome-separator-gap: 12px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-height: 28px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-height-large: 32px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-text-height: 32px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-pad-x: 12px;'));
  assert.ok(styles.includes('--toolbar-chrome-control-font-weight: 300;'));
  assert.ok(styles.includes('--toolbar-chrome-chevron-gap: 8px;'));
  assert.ok(styles.includes('--toolbar-chrome-slot-icon: 28px;'));
  assert.ok(styles.includes('--toolbar-chrome-radius-button: 10px;'));
  assert.ok(styles.includes('--toolbar-chrome-radius-control: 10px;'));
  assert.ok(styles.includes('--toolbar-chrome-ink: rgba(45, 39, 33, 0.82);'));
  assert.ok(styles.includes('--toolbar-chrome-ink-strong: rgba(31, 26, 21, 0.9);'));
  assert.ok(styles.includes('--toolbar-chrome-ink-muted: rgba(45, 39, 33, 0.72);'));
  assert.ok(styles.includes('--toolbar-chrome-field-bg: rgba(248, 246, 243, 0.72);'));
  assert.ok(styles.includes('--toolbar-chrome-quiet-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-hover-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-active-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-pressed-bg:'));
  assert.ok(styles.includes('--toolbar-chrome-focus-ring:'));

  assert.ok(styles.includes('gap: var(--toolbar-chrome-item-gap);'));
  assert.ok(styles.includes('gap: var(--toolbar-chrome-group-gap);'));
  assert.ok(styles.includes('column-gap: var(--toolbar-chrome-gap-sm);'));
  assert.ok(styles.includes('row-gap: var(--toolbar-chrome-gap-sm);'));
  assert.ok(styles.includes('margin-bottom: var(--toolbar-chrome-gap-sm);'));
  assert.ok(styles.includes('margin: 0 var(--toolbar-chrome-separator-gap);'));
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
  assert.ok(darkThemeSection.includes('--toolbar-chrome-ink: rgba(250, 247, 242, 0.78);'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-ink-strong: rgba(255, 253, 248, 0.92);'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-ink-muted: rgba(250, 247, 242, 0.62);'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-field-bg: #242630;'));
  assert.ok(darkThemeSection.includes('--toolbar-chrome-field-hover-bg: #2a2d38;'));
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

  assert.ok(styles.includes('width: calc(var(--toolbar-chrome-slot-long) * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('width: calc(var(--toolbar-chrome-slot-short) * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('width: calc(var(--toolbar-chrome-slot-medium) * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('line-height: 17px;'));
  assert.ok(styles.includes('calc(var(--toolbar-chrome-slot-icon) * var(--floating-toolbar-width-scale));'));
  assert.ok(sizeDisplaySection.includes('justify-content: space-between;'));
  assert.ok(sizeDisplaySection.includes('gap: var(--toolbar-chrome-gap-xxs);'));
  assert.ok(sizeDisplaySection.includes('padding: 0 var(--toolbar-chrome-gap-sm);'));
  assert.ok(sizeDisplayTextSection.includes('min-width: 2.4ch;'));
  assert.ok(sizeDisplayTextSection.includes('text-align: right;'));
  assert.ok(sizeDisplayTextSection.includes('font-weight: var(--toolbar-chrome-control-font-weight);'));
  assert.ok(sizeDisplayTextSection.includes('font-variant-numeric: tabular-nums;'));
  assert.ok(sizeDisplayTextSection.includes('font-feature-settings: "tnum" 1, "lnum" 1;'));
  assert.ok(sizeDisplayTextSection.includes('letter-spacing: 0;'));
  assert.ok(horizontalNumericQuietSection.includes('background: var(--toolbar-chrome-quiet-bg);'));
  assert.ok(horizontalNumericQuietSection.includes('background: var(--toolbar-chrome-hover-bg);'));
  assert.ok(styles.includes('font-variant-numeric: tabular-nums;'));
  assert.ok(styles.includes('--floating-toolbar-width-scale: 1;'));
  assert.ok(styles.includes('--left-toolbar-width-scale: 1;'));
});

test('sector-m toolbar native fluency chrome: control values share one light weight token', () => {
  const styles = readStylesSource();
  const displayTextSection = sliceSection(
    styles,
    '.floating-toolbar__display-text {',
    '.floating-toolbar__select-icon {'
  );
  const displayValueSection = sliceSection(
    styles,
    '.floating-toolbar__display-value {',
    '.floating-toolbar__caret--line-height {'
  );
  const horizontalDisplaySection = sliceSection(
    styles,
    '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__display-text {',
    '.floating-toolbar__shell:not(.is-vertical) .floating-toolbar__line-height-icon-wrap {'
  );
  const verticalLabelSection = sliceSection(
    styles,
    '.floating-toolbar__shell.is-vertical .floating-toolbar__button-label--paragraph,',
    '.floating-toolbar__shell.is-vertical .floating-toolbar__caret--list {'
  );

  for (const section of [displayTextSection, displayValueSection, horizontalDisplaySection, verticalLabelSection]) {
    assert.ok(section.includes('font-weight: var(--toolbar-chrome-control-font-weight);'));
    assert.equal(section.includes('font-weight: 400;'), false);
    assert.equal(section.includes('font-weight: 500;'), false);
  }
});

test('sector-m toolbar native fluency chrome: canonical slot classes own horizontal widths', () => {
  const styles = readStylesSource();

  for (const token of [
    '--toolbar-chrome-slot-icon: 28px;',
    '--toolbar-chrome-slot-icon-wide: 40px;',
    '--toolbar-chrome-slot-short: 56px;',
    '--toolbar-chrome-slot-medium: 72px;',
    '--toolbar-chrome-slot-long: 104px;',
    '--toolbar-chrome-slot-xlong: 136px;',
  ]) {
    assert.ok(styles.includes(token), `missing canonical slot token: ${token}`);
  }

  for (const legacyWidth of ['200px', '132px', '84px', '96px', '82px', '76px']) {
    const selectorSection = styles.slice(
      styles.indexOf('.floating-toolbar__select-wrap--font {'),
      styles.indexOf('.floating-toolbar__select {'),
    );
    assert.equal(selectorSection.includes(legacyWidth), false, `legacy toolbar width remains: ${legacyWidth}`);
  }
});

test('sector-m toolbar native fluency chrome: toolbar sections forbid fake-scale and blur readability tricks', () => {
  const styles = readStylesSource();
  const leftToolbarSection = sliceSection(styles, '.left-floating-toolbar__shell {', '.floating-toolbar {');
  const floatingToolbarSection = sliceSection(styles, '.floating-toolbar__shell {', '.floating-toolbar__paragraph-menu {');

  assert.equal(leftToolbarSection.includes('transform: scale('), false);
  assert.equal(floatingToolbarSection.includes('transform: scale('), false);
  assert.ok(floatingToolbarSection.includes('zoom: 1;'));
  assert.ok(floatingToolbarSection.includes('text-rendering: auto;'));
  assert.ok(floatingToolbarSection.includes('-webkit-font-smoothing: auto;'));
  assert.equal(floatingToolbarSection.includes('zoom: var(--floating-toolbar-scale);'), false);
  assert.equal(leftToolbarSection.includes('backdrop-filter:'), false);
  assert.equal(floatingToolbarSection.includes('backdrop-filter:'), false);
  assert.equal(leftToolbarSection.includes('filter: blur('), false);
  assert.equal(floatingToolbarSection.includes('filter: blur('), false);
  assert.ok(floatingToolbarSection.includes('color: var(--toolbar-chrome-ink);'));
  assert.ok(floatingToolbarSection.includes('color: var(--toolbar-chrome-ink-strong);'));
  assert.ok(floatingToolbarSection.includes('color: var(--toolbar-chrome-ink-muted);'));
  assert.equal(floatingToolbarSection.includes('color: #1f1a15;'), false);
  assert.equal(floatingToolbarSection.includes('color: #3a3a3a;'), false);
});
