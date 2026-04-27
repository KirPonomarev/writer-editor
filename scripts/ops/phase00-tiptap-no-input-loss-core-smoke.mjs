#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const localRequire = createRequire(import.meta.url);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');

function hasTiptapInstall(nodeModulesRoot) {
  if (typeof nodeModulesRoot !== 'string' || !nodeModulesRoot) {
    return false;
  }
  return fs.existsSync(path.join(nodeModulesRoot, '@tiptap', 'core', 'dist', 'index.cjs'))
    && fs.existsSync(path.join(nodeModulesRoot, '@tiptap', 'starter-kit', 'dist', 'index.cjs'))
    && fs.existsSync(path.join(nodeModulesRoot, '@tiptap', 'pm', 'dist', 'state', 'index.cjs'))
    && fs.existsSync(path.join(nodeModulesRoot, '@tiptap', 'pm', 'dist', 'history', 'index.cjs'));
}

function collectWorktreeNodeModulesRoots() {
  const roots = [];
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return roots;
  }
  for (const line of String(result.stdout || '').split('\n')) {
    if (!line.startsWith('worktree ')) {
      continue;
    }
    const worktreePath = line.slice('worktree '.length).trim();
    if (!worktreePath) {
      continue;
    }
    roots.push(path.join(worktreePath, 'node_modules'));
  }
  return roots;
}

function resolveTiptapNodeModulesRoot() {
  const candidates = [
    process.env.PHASE00_TIPTAP_NODE_MODULES_ROOT || '',
    path.join(repoRoot, 'node_modules'),
    ...collectWorktreeNodeModulesRoots(),
  ];
  for (const candidate of candidates) {
    if (hasTiptapInstall(candidate)) {
      return candidate;
    }
  }
  throw new Error('E_PHASE00_TIPTAP_NODE_MODULES_UNAVAILABLE');
}

function readModuleExport(moduleValue, key) {
  if (moduleValue && Object.prototype.hasOwnProperty.call(moduleValue, key)) {
    return moduleValue[key];
  }
  if (moduleValue && moduleValue.default && Object.prototype.hasOwnProperty.call(moduleValue.default, key)) {
    return moduleValue.default[key];
  }
  return undefined;
}

const tiptapNodeModulesRoot = resolveTiptapNodeModulesRoot();
const coreModule = localRequire(path.join(tiptapNodeModulesRoot, '@tiptap', 'core', 'dist', 'index.cjs'));
const starterKitModule = localRequire(path.join(tiptapNodeModulesRoot, '@tiptap', 'starter-kit', 'dist', 'index.cjs'));
const pmStateModule = localRequire(path.join(tiptapNodeModulesRoot, '@tiptap', 'pm', 'dist', 'state', 'index.cjs'));
const pmHistoryModule = localRequire(path.join(tiptapNodeModulesRoot, '@tiptap', 'pm', 'dist', 'history', 'index.cjs'));

const getSchema = readModuleExport(coreModule, 'getSchema');
const StarterKit = starterKitModule && starterKitModule.default ? starterKitModule.default : starterKitModule;
const EditorState = readModuleExport(pmStateModule, 'EditorState');
const TextSelection = readModuleExport(pmStateModule, 'TextSelection');
const history = readModuleExport(pmHistoryModule, 'history');
const undo = readModuleExport(pmHistoryModule, 'undo');
const redo = readModuleExport(pmHistoryModule, 'redo');

const PATH_UNDER_TEST = 'TIPTAP_PRIMARY_PATH_MODEL_LAYER';
const COVERED_CASE_IDS = Object.freeze([
  'basic-typing-exact-text',
  'paste-plain-text-exact-text',
  'selection-targeted-edit-no-bleed',
  'replace-over-selection-exact-result',
  'undo-restores-pre-edit-oracle',
  'redo-restores-post-edit-oracle',
]);

const FAIL_REASON_FORCED_NEGATIVE = 'E_TIPTAP_NO_INPUT_LOSS_CORE_FORCED_NEGATIVE';
const FAIL_REASON_CASE = 'E_TIPTAP_NO_INPUT_LOSS_CORE_CASE_FAIL';
const FAIL_REASON_UNEXPECTED = 'E_TIPTAP_NO_INPUT_LOSS_CORE_UNEXPECTED';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function createModelHarness() {
  const schema = getSchema([StarterKit]);
  const plugins = [history()];
  let state = EditorState.create({ schema, plugins });

  function dispatch(tr) {
    state = state.apply(tr);
  }

  function text() {
    return state.doc.textBetween(0, state.doc.content.size, '\n', '\n');
  }

  function setText(nextText) {
    const paragraph = schema.nodes.paragraph.create(
      null,
      nextText && nextText.length > 0 ? schema.text(nextText) : null,
    );
    const doc = schema.topNodeType.createChecked(null, [paragraph]);
    state = EditorState.create({ schema, plugins, doc });
  }

  function getEndOfTextPos() {
    const firstChild = state.doc.firstChild;
    if (!firstChild) {
      return 1;
    }
    return 1 + firstChild.content.size;
  }

  function replaceBySubstring(search, replacement) {
    const current = text();
    const index = current.indexOf(search);
    if (index < 0) return false;
    const from = 1 + index;
    const to = from + search.length;
    let tr = state.tr.setSelection(TextSelection.create(state.doc, from, to));
    dispatch(tr);
    tr = state.tr.insertText(replacement);
    dispatch(tr);
    return true;
  }

  function insertText(value) {
    const endPos = getEndOfTextPos();
    const tr = state.tr.insertText(value, endPos, endPos);
    dispatch(tr);
  }

  function runUndo() {
    return undo(state, dispatch);
  }

  function runRedo() {
    return redo(state, dispatch);
  }

  return {
    text,
    setText,
    insertText,
    replaceBySubstring,
    runUndo,
    runRedo,
  };
}

function evaluateCoreCases() {
  const results = {};

  {
    const model = createModelHarness();
    model.insertText('alpha');
    model.insertText(' beta');
    results['basic-typing-exact-text'] = model.text() === 'alpha beta';
  }

  {
    const model = createModelHarness();
    model.insertText('before');
    model.insertText('\nPLAIN_PASTE\nafter');
    results['paste-plain-text-exact-text'] = model.text() === 'before\nPLAIN_PASTE\nafter';
  }

  {
    const model = createModelHarness();
    model.setText('left target right');
    const replaced = model.replaceBySubstring('target', 'X');
    results['selection-targeted-edit-no-bleed'] = replaced && model.text() === 'left X right';
  }

  {
    const model = createModelHarness();
    model.setText('prefix OLD suffix');
    const replaced = model.replaceBySubstring('OLD', 'NEW_CONTENT');
    results['replace-over-selection-exact-result'] = replaced && model.text() === 'prefix NEW_CONTENT suffix';
  }

  {
    const model = createModelHarness();
    model.setText('undo base');
    const preOracle = model.text();
    model.insertText(' + delta');
    const postOracle = model.text();
    const undoOk = model.runUndo();
    results['undo-restores-pre-edit-oracle'] = Boolean(
      undoOk
      && postOracle === 'undo base + delta'
      && model.text() === preOracle
    );
  }

  {
    const model = createModelHarness();
    model.setText('redo base');
    model.insertText(' + delta');
    const postOracle = model.text();
    const undoOk = model.runUndo();
    const redoOk = model.runRedo();
    results['redo-restores-post-edit-oracle'] = Boolean(
      undoOk
      && redoOk
      && postOracle === 'redo base + delta'
      && model.text() === postOracle
    );
  }

  return results;
}

export function evaluatePhase00NoInputLossCore(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const caseResults = evaluateCoreCases();
  const failedCase = COVERED_CASE_IDS.find((id) => caseResults[id] !== true) || '';

  if (forceNegative) {
    return {
      ok: false,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      pathUnderTest: PATH_UNDER_TEST,
      coveredCaseIds: [...COVERED_CASE_IDS],
      caseResults,
      falsePassGuard: 'FORCED_NEGATIVE_PATH_PRESENT',
      scope: 'MODEL_LAYER_ONLY_NOT_FULL_PRIMARY_EDITOR_CLOSURE',
      forcedNegative: true,
    };
  }

  if (failedCase) {
    return {
      ok: false,
      failReason: `${FAIL_REASON_CASE}:${failedCase}`,
      pathUnderTest: PATH_UNDER_TEST,
      coveredCaseIds: [...COVERED_CASE_IDS],
      caseResults,
      falsePassGuard: 'FORCED_NEGATIVE_PATH_PRESENT',
      scope: 'MODEL_LAYER_ONLY_NOT_FULL_PRIMARY_EDITOR_CLOSURE',
      forcedNegative: false,
    };
  }

  return {
    ok: true,
    failReason: '',
    pathUnderTest: PATH_UNDER_TEST,
    coveredCaseIds: [...COVERED_CASE_IDS],
    caseResults,
    falsePassGuard: 'FORCED_NEGATIVE_PATH_PRESENT',
    scope: 'MODEL_LAYER_ONLY_NOT_FULL_PRIMARY_EDITOR_CLOSURE',
    forcedNegative: false,
  };
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_TIPTAP_NO_INPUT_LOSS_CORE_FORCE_NEGATIVE === '1';

  let state;
  try {
    state = evaluatePhase00NoInputLossCore({ forceNegative });
  } catch (error) {
    state = {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      pathUnderTest: PATH_UNDER_TEST,
      coveredCaseIds: [...COVERED_CASE_IDS],
      caseResults: {},
      falsePassGuard: 'FORCED_NEGATIVE_PATH_PRESENT',
      scope: 'MODEL_LAYER_ONLY_NOT_FULL_PRIMARY_EDITOR_CLOSURE',
      forcedNegative: forceNegative,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_TIPTAP_NO_INPUT_LOSS_CORE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_TIPTAP_NO_INPUT_LOSS_CORE_FAIL_REASON=${state.failReason}`);
    console.log(`PHASE00_TIPTAP_NO_INPUT_LOSS_CORE_COVERED_CASE_IDS=${state.coveredCaseIds.join(',')}`);
    console.log(`PHASE00_TIPTAP_NO_INPUT_LOSS_CORE_PATH_UNDER_TEST=${state.pathUnderTest}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}
