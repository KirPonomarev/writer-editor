#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase03PrepState } from './phase03-prep-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE03_USER_SHELL_STATE_FOUNDATION_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE03_USER_SHELL_STATE_FOUNDATION_UNEXPECTED';
const FOUNDATION_PACKET_PATH = 'docs/OPS/STATUS/PHASE03_USER_SHELL_STATE_FOUNDATION_V1.json';
const RENDERER_SOURCE_PATH = 'src/renderer/editor.js';
const MAIN_SOURCE_PATH = 'src/main.js';

const EXPECTED_BOUND_PREFERENCE_IDS = Object.freeze([
  'EDITOR_THEME',
  'EDITOR_FONT_FAMILY',
  'EDITOR_FONT_SIZE',
  'EDITOR_FONT_WEIGHT',
  'EDITOR_LINE_HEIGHT',
  'EDITOR_WORD_WRAP',
  'EDITOR_VIEW_MODE',
  'EDITOR_ZOOM',
  'FLOATING_TOOLBAR_LAYOUT',
  'LEFT_TOOLBAR_LAYOUT',
  'CONFIGURATOR_BUCKET_LAYOUT',
]);

const EXPECTED_BOUND_STORAGE_KEYS = Object.freeze([
  'editorTheme',
  'editorFont',
  'editorFontWeight',
  'editorLineHeight',
  'editorWordWrap',
  'editorViewMode',
  'editorZoom',
  'yalkenLiteralStageAToolbarState',
  'yalkenLiteralStageAToolbarItemOffsets',
  'yalkenLeftToolbarState',
  'yalkenLeftToolbarButtonOffsets',
  'yalkenConfiguratorBuckets',
]);

const EXPECTED_REMAINING_GAP_IDS = Object.freeze([]);

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function matchesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function evaluatePhase03UserShellStateFoundationState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase03PrepState = evaluatePhase03PrepState({});
    const packetExists = fs.existsSync(path.resolve(FOUNDATION_PACKET_PATH));
    const packet = packetExists ? readJson(FOUNDATION_PACKET_PATH) : null;
    const rendererSource = readText(RENDERER_SOURCE_PATH);
    const mainSource = readText(MAIN_SOURCE_PATH);

    const phase03PrepPass = phase03PrepState.overallStatus === 'PASS'
      && phase03PrepState.phase03ReadinessStatus === 'HOLD';
    const packetPass = packet?.status === 'PASS';
    const foundationPass = packet?.foundationStatus === 'PASS';
    const scopeFlagsValid = packet?.scope?.userLevelLocalOnly === true
      && packet?.scope?.projectWorkspaceStateIncluded === false
      && packet?.scope?.safeResetLastStableIncluded === false
      && packet?.scope?.stableProjectIdIncluded === false
      && packet?.scope?.terminologyMigrationIncluded === false;
    const boundPreferenceIdsMatch = arraysEqual(packet?.boundPreferenceIds || [], EXPECTED_BOUND_PREFERENCE_IDS);
    const boundStorageKeysMatch = arraysEqual(packet?.boundStorageKeys || [], EXPECTED_BOUND_STORAGE_KEYS);
    const remainingGapIdsMatch = arraysEqual(packet?.remainingPhase03GapIds || [], EXPECTED_REMAINING_GAP_IDS);

    const themePersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorTheme',\s*theme\)/,
      /localStorage\.getItem\('editorTheme'\)\s*\|\|\s*'light'/,
      /function loadSavedTheme\(\)/,
    ]);
    const fontFamilyPersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorFont',\s*fontFamily\)/,
      /const savedFont = localStorage\.getItem\('editorFont'\)/,
      /function loadSavedFont\(\)/,
    ]);
    const fontSizePersistedMainSettings = matchesAll(mainSource, [
      /function loadSavedFontSize\(\)/,
      /currentFontSize = clampFontSize\(settings\.fontSize\)/,
      /settings\.fontSize = currentFontSize/,
      /sendEditorFontSize\(currentFontSize\)/,
    ]);
    const fontWeightPersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorFontWeight',\s*presetId\)/,
      /const saved = localStorage\.getItem\('editorFontWeight'\)/,
    ]);
    const lineHeightPersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorLineHeight',\s*String\(value\)\)/,
      /const saved = localStorage\.getItem\('editorLineHeight'\)/,
    ]);
    const wordWrapPersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorWordWrap',\s*enabled \? 'on' : 'off'\)/,
      /const saved = localStorage\.getItem\('editorWordWrap'\)/,
    ]);
    const viewModePersisted = matchesAll(rendererSource, [
      /localStorage\.setItem\('editorViewMode',\s*mode\)/,
      /const saved = localStorage\.getItem\('editorViewMode'\)\s*\|\|\s*'default'/,
    ]);
    const zoomPersisted = matchesAll(rendererSource, [
      /const EDITOR_ZOOM_STORAGE_KEY = 'editorZoom';/,
      /localStorage\.setItem\(EDITOR_ZOOM_STORAGE_KEY,\s*String\(editorZoom\)\)/,
      /const saved = Number\(localStorage\.getItem\(EDITOR_ZOOM_STORAGE_KEY\)\)/,
    ]);
    const floatingToolbarPersisted = matchesAll(rendererSource, [
      /const FLOATING_TOOLBAR_STORAGE_KEY = 'yalkenLiteralStageAToolbarState';/,
      /const FLOATING_TOOLBAR_ITEM_OFFSETS_STORAGE_KEY = 'yalkenLiteralStageAToolbarItemOffsets';/,
      /function readFloatingToolbarState\(\)/,
      /function persistFloatingToolbarState\(\)/,
      /function readFloatingToolbarItemOffsets\(\)/,
      /function persistFloatingToolbarItemOffsets\(\)/,
    ]);
    const leftToolbarPersisted = matchesAll(rendererSource, [
      /const LEFT_FLOATING_TOOLBAR_STORAGE_KEY = 'yalkenLeftToolbarState';/,
      /const LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY = 'yalkenLeftToolbarButtonOffsets';/,
      /localStorage\.setItem\(LEFT_FLOATING_TOOLBAR_STORAGE_KEY,\s*JSON\.stringify\(leftFloatingToolbarState\)\)/,
      /localStorage\.setItem\(LEFT_TOOLBAR_BUTTON_OFFSETS_STORAGE_KEY,\s*JSON\.stringify\(leftToolbarButtonOffsets\)\)/,
    ]);
    const configuratorLayoutPersisted = matchesAll(rendererSource, [
      /const CONFIGURATOR_BUCKETS_STORAGE_KEY = 'yalkenConfiguratorBuckets';/,
      /localStorage\.setItem\(CONFIGURATOR_BUCKETS_STORAGE_KEY,\s*JSON\.stringify\(configuratorBucketState\)\)/,
      /const raw = localStorage\.getItem\(CONFIGURATOR_BUCKETS_STORAGE_KEY\)/,
    ]);

    const checkStatusById = {
      PHASE03_PREP_PASS: asCheck(phase03PrepPass ? 'GREEN' : 'OPEN_GAP', true, phase03PrepPass ? 'PHASE03_PREP_PASS' : 'PHASE03_PREP_NOT_PASS'),
      FOUNDATION_PACKET_PRESENT: asCheck(packetExists ? 'GREEN' : 'OPEN_GAP', true, packetExists ? 'FOUNDATION_PACKET_PRESENT' : 'FOUNDATION_PACKET_MISSING'),
      FOUNDATION_PACKET_PASS: asCheck(packetPass ? 'GREEN' : 'OPEN_GAP', true, packetPass ? 'FOUNDATION_PACKET_PASS' : 'FOUNDATION_PACKET_NOT_PASS'),
      FOUNDATION_STATUS_PASS: asCheck(foundationPass ? 'GREEN' : 'OPEN_GAP', true, foundationPass ? 'FOUNDATION_STATUS_PASS' : 'FOUNDATION_STATUS_NOT_PASS'),
      SCOPE_FLAGS_VALID: asCheck(scopeFlagsValid ? 'GREEN' : 'OPEN_GAP', true, scopeFlagsValid ? 'SCOPE_FLAGS_VALID' : 'SCOPE_FLAGS_DRIFT'),
      BOUND_PREFERENCE_IDS_MATCH: asCheck(boundPreferenceIdsMatch ? 'GREEN' : 'OPEN_GAP', true, boundPreferenceIdsMatch ? 'BOUND_PREFERENCE_IDS_MATCH' : 'BOUND_PREFERENCE_IDS_DRIFT'),
      BOUND_STORAGE_KEYS_MATCH: asCheck(boundStorageKeysMatch ? 'GREEN' : 'OPEN_GAP', true, boundStorageKeysMatch ? 'BOUND_STORAGE_KEYS_MATCH' : 'BOUND_STORAGE_KEYS_DRIFT'),
      REMAINING_GAP_IDS_MATCH: asCheck(remainingGapIdsMatch ? 'GREEN' : 'OPEN_GAP', true, remainingGapIdsMatch ? 'REMAINING_GAP_IDS_MATCH' : 'REMAINING_GAP_IDS_DRIFT'),
      THEME_PERSISTED: asCheck(themePersisted ? 'GREEN' : 'OPEN_GAP', true, themePersisted ? 'THEME_PERSISTED' : 'THEME_PERSISTENCE_MISSING'),
      FONT_FAMILY_PERSISTED: asCheck(fontFamilyPersisted ? 'GREEN' : 'OPEN_GAP', true, fontFamilyPersisted ? 'FONT_FAMILY_PERSISTED' : 'FONT_FAMILY_PERSISTENCE_MISSING'),
      FONT_SIZE_PERSISTED_MAIN_SETTINGS: asCheck(fontSizePersistedMainSettings ? 'GREEN' : 'OPEN_GAP', true, fontSizePersistedMainSettings ? 'FONT_SIZE_PERSISTED_MAIN_SETTINGS' : 'FONT_SIZE_MAIN_SETTINGS_MISSING'),
      FONT_WEIGHT_PERSISTED: asCheck(fontWeightPersisted ? 'GREEN' : 'OPEN_GAP', true, fontWeightPersisted ? 'FONT_WEIGHT_PERSISTED' : 'FONT_WEIGHT_PERSISTENCE_MISSING'),
      LINE_HEIGHT_PERSISTED: asCheck(lineHeightPersisted ? 'GREEN' : 'OPEN_GAP', true, lineHeightPersisted ? 'LINE_HEIGHT_PERSISTED' : 'LINE_HEIGHT_PERSISTENCE_MISSING'),
      WORD_WRAP_PERSISTED: asCheck(wordWrapPersisted ? 'GREEN' : 'OPEN_GAP', true, wordWrapPersisted ? 'WORD_WRAP_PERSISTED' : 'WORD_WRAP_PERSISTENCE_MISSING'),
      VIEW_MODE_PERSISTED: asCheck(viewModePersisted ? 'GREEN' : 'OPEN_GAP', true, viewModePersisted ? 'VIEW_MODE_PERSISTED' : 'VIEW_MODE_PERSISTENCE_MISSING'),
      ZOOM_PERSISTED: asCheck(zoomPersisted ? 'GREEN' : 'OPEN_GAP', true, zoomPersisted ? 'ZOOM_PERSISTED' : 'ZOOM_PERSISTENCE_MISSING'),
      FLOATING_TOOLBAR_PERSISTED: asCheck(floatingToolbarPersisted ? 'GREEN' : 'OPEN_GAP', true, floatingToolbarPersisted ? 'FLOATING_TOOLBAR_PERSISTED' : 'FLOATING_TOOLBAR_PERSISTENCE_MISSING'),
      LEFT_TOOLBAR_PERSISTED: asCheck(leftToolbarPersisted ? 'GREEN' : 'OPEN_GAP', true, leftToolbarPersisted ? 'LEFT_TOOLBAR_PERSISTED' : 'LEFT_TOOLBAR_PERSISTENCE_MISSING'),
      CONFIGURATOR_LAYOUT_PERSISTED: asCheck(configuratorLayoutPersisted ? 'GREEN' : 'OPEN_GAP', true, configuratorLayoutPersisted ? 'CONFIGURATOR_LAYOUT_PERSISTED' : 'CONFIGURATOR_LAYOUT_PERSISTENCE_MISSING'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        foundationStatus: foundationPass ? 'PASS' : 'UNKNOWN',
        phase03ReadinessStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        remainingPhase03GapIds: packet?.remainingPhase03GapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      foundationStatus: foundationPass ? 'PASS' : 'UNKNOWN',
      phase03ReadinessStatus: 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      remainingPhase03GapIds: packet?.remainingPhase03GapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      foundationStatus: 'UNKNOWN',
      phase03ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE03_USER_SHELL_STATE_FOUNDATION_EVALUATION_ERROR'],
      checkStatusById: {},
      remainingPhase03GapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase03UserShellStateFoundationState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE03_USER_SHELL_STATE_FOUNDATION_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE03_USER_SHELL_STATE_FOUNDATION_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE03_USER_SHELL_STATE_FOUNDATION_STATUS=${state.foundationStatus}`);
    console.log(`PHASE03_USER_SHELL_STATE_FOUNDATION_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE03_USER_SHELL_STATE_FOUNDATION_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase03UserShellStateFoundationState };
