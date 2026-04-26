const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const REFERENCE_PACKET_PATH = path.join(
  REPO_ROOT,
  'docs',
  'references',
  'native-fluency-typographic-sharpness.md',
);
const STYLES_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'styles.css');
const EDITOR_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'editor.js');
const TIPTAP_SOURCE_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'tiptap', 'index.js');

const REQUIRED_REFERENCE_TOKENS = Object.freeze([
  'DOCUMENT_CLASS: ADVISORY_QUALITY_GUARD_WITH_VIEWPORT_APPENDIX',
  'STRICT_STATUS: NOT_SECOND_CANON_NOT_EXECUTION_MASTER',
  'BLOCKING_SOURCE: ACTIVE_CANON_ONLY',
  'TRUTH_ORDER_RULE_01: THIS_DOCUMENT_CANNOT_OVERRIDE_ACTIVE_CANON',
  'TRUTH_ORDER_RULE_02: THIS_DOCUMENT_CANNOT_OPEN_WRITE_CONTOUR_BY_ITSELF',
  'SECTION_03_VIEWPORT: VIEWPORT_TEXT_SHARPNESS_ONLY_FOR_PRIMARY_TEXT_SURFACE',
  'SECTION_03_TOOLBAR: TOOLBAR_NATIVE_FLUENCY_IS_A_SEPARATE_CHROME_CONTOUR',
  'SECTION_04_RUNTIME_LAYER: INPUT_PATH_RENDER_PATH_HOT_PATH_PAGE_MAP_RECALC',
  'SECTION_08_VIEWPORT_APPENDIX: VIEWPORT_USES_THIS_DOCUMENT_ONLY_AS_QUALITY_GUARD',
  'SECTION_09_TOOLBAR_APPENDIX: TOOLBAR_IS_NOT_PART_OF_VIEWPORT_MVP',
  'ADOPTION_05: DO_NOT_USE_THIS_PACKET_AS_WRITE_AUTHORITY',
  'FINAL_FORMULA_06: ACTIVE_CANON_REMAINS_THE_ONLY_BLOCKING_SOURCE',
]);

const PRIMARY_TEXT_SURFACE_SELECTORS = Object.freeze([
  '#editor.tiptap-host',
  '.tiptap-editor',
  '.ProseMirror',
]);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function findMissingTokens(text, tokens) {
  return tokens.filter((token) => !text.includes(token));
}

function evaluateReferencePacketContract(text) {
  const missingTokens = findMissingTokens(text, REQUIRED_REFERENCE_TOKENS);
  const strictStatus = text.match(/^STRICT_STATUS:\s*(.+)$/m)?.[1]?.trim() || '';
  const documentClass = text.match(/^DOCUMENT_CLASS:\s*(.+)$/m)?.[1]?.trim() || '';
  const blockingSource = text.match(/^BLOCKING_SOURCE:\s*(.+)$/m)?.[1]?.trim() || '';
  const documentStatus = text.match(/^DOCUMENT_STATUS:\s*(.+)$/m)?.[1]?.trim() || '';
  const claimsExecutionMaster = documentClass.includes('EXECUTION_MASTER')
    || (strictStatus.includes('EXECUTION_MASTER') && strictStatus !== 'NOT_SECOND_CANON_NOT_EXECUTION_MASTER');
  const claimsActiveCanon = (blockingSource.length > 0 && blockingSource !== 'ACTIVE_CANON_ONLY')
    || documentStatus === 'ACTIVE_CANON';

  return {
    ok: missingTokens.length === 0 && !claimsExecutionMaster && !claimsActiveCanon,
    missingTokens,
    claimsExecutionMaster,
    claimsActiveCanon,
  };
}

function parseCssRules(css) {
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = null;
  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();
    if (selector.length > 0 && body.length > 0 && !selector.startsWith('@')) {
      rules.push({ selector, body });
    }
  }
  return rules;
}

function selectorTouchesPrimaryTextSurface(selector) {
  return PRIMARY_TEXT_SURFACE_SELECTORS.some((primarySelector) => selector.includes(primarySelector));
}

function findPrimaryTextSurfaceScaleRules(css) {
  return parseCssRules(css)
    .filter((rule) => selectorTouchesPrimaryTextSurface(rule.selector))
    .filter((rule) => /\btransform\s*:[^;]*\bscale(?:3d|X|Y|Z)?\s*\(/.test(rule.body));
}

function evaluatePrimaryTextSurfaceScaleContract(css) {
  const primaryRules = parseCssRules(css).filter((rule) => selectorTouchesPrimaryTextSurface(rule.selector));
  const scaleRules = findPrimaryTextSurfaceScaleRules(css);
  return {
    ok: primaryRules.length > 0 && scaleRules.length === 0,
    selectorBound: primaryRules.length > 0,
    primaryRuleCount: primaryRules.length,
    scaleRules,
  };
}

test('typographic sharpness static guard: reference packet stays reference-only and non-canonical', () => {
  const referencePacket = read(REFERENCE_PACKET_PATH);
  const state = evaluateReferencePacketContract(referencePacket);

  assert.equal(state.ok, true, `reference packet contract failed: ${JSON.stringify(state, null, 2)}`);
});

test('typographic sharpness static guard: reference packet negative cases are not accepted', () => {
  const referencePacket = read(REFERENCE_PACKET_PATH);

  const missingActiveCanonOnly = referencePacket.replace('BLOCKING_SOURCE: ACTIVE_CANON_ONLY', '');
  assert.equal(evaluateReferencePacketContract(missingActiveCanonOnly).ok, false);

  const executionMasterClaim = referencePacket.replace(
    'STRICT_STATUS: NOT_SECOND_CANON_NOT_EXECUTION_MASTER',
    'STRICT_STATUS: ACTIVE_EXECUTION_MASTER',
  );
  const executionMasterState = evaluateReferencePacketContract(executionMasterClaim);
  assert.equal(executionMasterState.ok, false);
  assert.equal(executionMasterState.claimsExecutionMaster, true);
});

test('typographic sharpness static guard: primary text surface selector is statically bound', () => {
  const styles = read(STYLES_PATH);
  const editorSource = read(EDITOR_SOURCE_PATH);
  const tiptapSource = read(TIPTAP_SOURCE_PATH);
  const state = evaluatePrimaryTextSurfaceScaleContract(styles);

  assert.equal(state.selectorBound, true, 'primary text surface selectors must be present in static CSS');
  assert.ok(editorSource.includes("editor.querySelector('.tiptap-editor')"));
  assert.ok(editorSource.includes("editor.querySelector('.ProseMirror')"));
  assert.ok(tiptapSource.includes("mountEl.classList.add('tiptap-host')"));
  assert.ok(tiptapSource.includes("contentEl.className = 'tiptap-editor'"));
  assert.equal(tiptapSource.includes("document.createElement('canvas')"), false);
  assert.equal(tiptapSource.includes('document.createElement("canvas")'), false);
});

test('typographic sharpness static guard: primary text surface source has no transform scale zoom', () => {
  const styles = read(STYLES_PATH);
  const state = evaluatePrimaryTextSurfaceScaleContract(styles);

  assert.equal(state.ok, true, `primary text surface scale contract failed: ${JSON.stringify(state, null, 2)}`);
});

test('typographic sharpness static guard: in-memory primary text surface scale is rejected', () => {
  const fixture = `
    .main-content--editor #editor.tiptap-host .ProseMirror {
      transform: scale(var(--editor-zoom));
    }
  `;
  const state = evaluatePrimaryTextSurfaceScaleContract(fixture);

  assert.equal(state.selectorBound, true);
  assert.equal(state.ok, false);
  assert.equal(state.scaleRules.length, 1);
});
