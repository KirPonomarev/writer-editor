const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
const calendarAction = 'define-calendar';
const anchorAction = 'set-scene-time';

class Element {
  children = [];
  dataset = {};
  listeners = {};
  parentElement = null;

  append(...children) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
  }
  appendChild(child) { this.append(child); }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
  setAttribute() {}
  addEventListener(type, listener) { this.listeners[type] = listener; }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const result = child.find(predicate);
      if (result) return result;
    }
    return null;
  }
}

async function fixture() {
  const core = await import('../../src/core/runtime.mjs');
  const created = core.applyCoreSequence(core.createInitialCoreState(), [
    { type: core.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId: 'project-a', title: 'First', sceneId: 'scene-a' } },
    { type: core.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId: 'project-b', title: 'Second', sceneId: 'scene-a' } },
  ]);
  assert.equal(created.ok, true);
  let state = structuredClone(created.state);
  state.data.projects['project-a'].scenes['scene-b'] = { id: 'scene-b', title: 'Next scene', text: 'The second scene.' };
  const originalScenes = structuredClone(state.data.projects['project-a'].scenes);
  const requests = [];
  const statuses = [];
  const parent = new Element();
  const context = vm.createContext({
    document: { createElement: () => new Element() },
    currentProjectId: 'project-a',
    currentDocumentId: 'scene-a',
    currentDocumentKind: 'scene',
    currentTreeContentPublicationId: 'tree-a',
    currentRightTab: 'atlas',
    currentAtlasSurface: 'temporal',
    ATLAS_SURFACE_IDS: ['currentScene', 'temporal'],
    atlasTemporalLayoutHost: parent,
    atlasTemporalLayoutExplicitOpen: true,
    atlasCurrentSceneState: { sceneId: 'scene-a' },
    atlasStableUiIdSeq: 0,
    atlasPublicationEpoch: 0,
    atlasCommandPublicationSequence: 0,
    atlasJourneyDraftRevision: 0,
    manualMapDraftRevision: 0,
    manualMapDraftOwnership: null,
    localEditGeneration: 0,
    updateStatusText: (message, options) => statuses.push({ message, visible: options.visible }),
    async dispatchUiCommand(type, payload) {
      const command = { type, payload: structuredClone(payload) };
      requests.push(command);
      const result = core.reduceCoreState(state, command);
      state = result.state;
      return result;
    },
    refreshAtlasCurrentScene: async () => {},
    refreshAtlasProductSurfaces: async () => {},
  });
  const draft = source.match(/^let atlasTemporalAuthorDraft = \{[\s\S]*?^\};/m);
  assert.ok(draft, 'production draft declaration');
  const functions = [
    'captureAtlasPublication', 'normalizeAtlasSurface', 'isAtlasSurfaceActive', 'appendAtlasOverviewSection',
    'appendAtlasSurfaceField', 'appendAtlasSurfaceSelect', 'runAtlasSurfaceProductCommand', 'makeAtlasSurfaceCommandButton',
    'makeStableUiId', 'ensureAtlasSurfaceDraftId', 'exactAtlasCalendarRange', 'exactAtlasNarrativeRange',
    'readAtlasTemporalWholeDay', 'getAtlasTemporalCalendarPayload', 'getAtlasTemporalRangePayload', 'getAtlasTemporalAnchorPayload',
    'setAtlasTemporalDraftField', 'appendAtlasTemporalAuthorControls',
  ].flatMap((name) => source.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm')) || []);
  const render = vm.runInContext(`${draft[0]}\n${functions.join('\n')}\nappendAtlasTemporalAuthorControls`, context);
  function open(changes = {}) {
    Object.assign(context, changes);
    parent.children.length = 0;
    render(parent);
    const root = parent.children[0];
    const field = (key) => root.find((element) => element.dataset.atlasTemporalField === key);
    return {
      field,
      enter(values) {
        for (const [key, value] of Object.entries(values)) {
          const input = field(key);
          assert.ok(input, `visible field ${key}`);
          input.value = value;
          (input.listeners.input || input.listeners.change)();
        }
      },
      click(key) {
        const button = root.find((element) => element.dataset.atlasTemporalAction === key);
        assert.ok(button, `visible action ${key}`);
        button.listeners.click();
        return button;
      },
    };
  }
  return {
    open, context, requests, statuses, originalScenes,
    project: (id = 'project-a') => state.data.projects[id],
    calendar: (id) => state.data.projects['project-a'].atlas?.calendarDefinitions?.[id],
    anchor: (id) => state.data.projects['project-a'].atlas?.sceneTemporalAnchors?.[id],
  };
}

test('Atlas Time begins blank and clearing author inputs cannot dispatch a calendar or scene anchor', async () => {
  const f = await fixture();
  const form = f.open();
  const fields = ['calendarId', 'calendarName', 'storyDate', 'narrativeDay', 'note'];
  const initial = fields.map((key) => form.field(key).value);
  form.enter(Object.fromEntries(fields.map((key) => [key, ''])));
  form.click(calendarAction);
  form.click(anchorAction);
  assert.deepEqual(f.requests, [], 'no command for either blank submission');
  assert.deepEqual(initial, ['', '', '', '', '']);
  assert.deepEqual(f.statuses.map(({ visible }) => visible), [true, true]);
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

test('Atlas Time uses only the named calendar and records absent conversion as unsupported', async () => {
  const f = await fixture();
  const form = f.open();
  form.enter({ calendarId: '  calendar-dawn  ', calendarName: '  Лунный рассвет  ' });
  form.click(calendarAction);
  const calendar = f.calendar('calendar-dawn');
  assert.equal(calendar.name, 'Лунный рассвет');
  assert.equal(calendar.dayZeroLabel, '');
  assert.equal(calendar.conversionRules[0].ruleKind, 'unsupported');
  assert.equal(calendar.conversionRules[0].precision, 'unsupported');
  assert.equal(calendar.conversionRules[0].canConvert, false);
  assert.match(calendar.conversionRules[0].reason, /.+/u);
  assert.equal(form.field('offsetDays').value, '');
  assert.deepEqual(Object.keys(f.project().atlas.calendarDefinitions), ['calendar-dawn']);
});

test('Atlas Time preserves explicit zero and signed offsets and refuses malformed or unsafe offsets', async () => {
  const f = await fixture();
  const form = f.open();
  form.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn' });
  for (const [raw, expected] of [['0', 0], [' -7 ', -7], ['+12', 12]]) {
    form.enter({ offsetDays: raw });
    form.click(calendarAction);
    const rule = f.calendar('calendar-dawn').conversionRules[0];
    assert.equal(rule.ruleKind, 'dayOffset');
    assert.equal(rule.precision, 'approximate');
    assert.equal(rule.offsetDays, expected);
  }
  const last = f.calendar('calendar-dawn');
  for (const raw of ['12 days', '1.5', '1e3', '9007199254740992']) {
    form.enter({ offsetDays: raw });
    form.click(calendarAction);
  }
  assert.equal(f.requests.length, 3);
  assert.deepEqual(f.calendar('calendar-dawn'), last);
});

test('Atlas Time stores author date and day zero exactly, with no fabricated optional note', async () => {
  const f = await fixture();
  const form = f.open();
  form.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn' });
  form.click(calendarAction);
  form.enter({ storyCalendarId: 'calendar-dawn', storyDate: '  Пятый рассвет  ', narrativeDay: ' 0 ', note: '' });
  form.click(anchorAction);
  const anchor = f.anchor('scene-a');
  assert.equal(anchor.source, 'author');
  assert.equal(anchor.storyRange.rangeKind, 'exact');
  assert.equal(anchor.storyRange.start.calendarId, 'calendar-dawn');
  assert.equal(anchor.storyRange.start.value, 'Пятый рассвет');
  assert.deepEqual(anchor.storyRange.start, anchor.storyRange.end);
  assert.equal(anchor.narrativeRange.start.dayIndex, 0);
  assert.deepEqual(anchor.narrativeRange.start, anchor.narrativeRange.end);
  assert.equal(anchor.note, '');
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

test('Atlas Time records one dimension as unknown and refuses a missing calendar or an invalid whole day', async () => {
  const f = await fixture();
  const form = f.open();
  form.enter({ storyDate: 'Dawn', narrativeDay: '' });
  form.click(anchorAction);
  form.enter({ storyDate: '' });
  for (const raw of ['12 days', '1.5', '1e3', '9007199254740992']) {
    form.enter({ narrativeDay: raw });
    form.click(anchorAction);
  }
  assert.equal(f.requests.length, 0);
  assert.equal(f.statuses.length, 5);
  assert.ok(f.statuses.every(({ visible }) => visible));
  form.enter({ narrativeDay: '-2', note: '  Return  ' });
  form.click(anchorAction);
  const anchor = f.anchor('scene-a');
  assert.equal(anchor.storyRange.rangeKind, 'unknown');
  assert.equal(anchor.storyRange.start, null);
  assert.match(anchor.storyRange.precisionNote, /.+/u);
  assert.equal(anchor.narrativeRange.start.dayIndex, -2);
  assert.equal(anchor.note, 'Return');
  form.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn' });
  form.click(calendarAction);
  form.enter({ storyCalendarId: 'calendar-dawn', storyDate: 'Dawn', narrativeDay: '' });
  form.click(anchorAction);
  const dateOnly = f.anchor('scene-a');
  assert.equal(dateOnly.storyRange.start.value, 'Dawn');
  assert.equal(dateOnly.narrativeRange.rangeKind, 'unknown');
  assert.equal(dateOnly.narrativeRange.start, null);
});

test('Atlas Time isolates scene drafts and ignores stale scene projections and detached or foreign controls', async () => {
  const f = await fixture();
  const first = f.open();
  first.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn', narrativeDay: '0', note: 'First note' });
  first.click(calendarAction);
  first.click(anchorAction);
  const savedFirst = f.anchor('scene-a');
  first.enter({ note: 'Unsent first draft' });
  const second = f.open({ currentDocumentId: 'scene-b', currentDocumentKind: 'chapter-file' });
  const untouched = ['storyDate', 'narrativeDay', 'note'].map((key) => second.field(key).value);
  first.enter({ calendarId: 'detached', note: 'detached' });
  first.click(anchorAction);
  second.enter({ narrativeDay: '17', note: 'Second note' });
  second.click(anchorAction);
  assert.deepEqual(f.requests.map(({ payload }) => payload.sceneId).filter(Boolean), ['scene-a', 'scene-b']);
  assert.deepEqual(untouched, ['', '', '']);
  assert.deepEqual(f.anchor('scene-a'), savedFirst);
  const savedSecond = f.anchor('scene-b');
  assert.equal(savedSecond.narrativeRange.start.dayIndex, 17);
  assert.notEqual(savedFirst.id, savedSecond.id);
  assert.equal(savedSecond.note, 'Second note');
  const reopened = f.open({ currentDocumentId: 'scene-a', currentDocumentKind: 'scene' });
  assert.equal(reopened.field('note').value, 'Unsent first draft');
  assert.equal(reopened.field('calendarId').value, 'calendar-dawn');
  f.context.currentRightTab = 'project';
  reopened.click(anchorAction);
  f.context.currentRightTab = 'atlas';
  f.context.currentProjectId = 'project-b';
  reopened.click(calendarAction);
  reopened.click(anchorAction);
  const foreign = f.open();
  assert.equal(foreign.field('calendarId').value, '');
  assert.equal(foreign.field('narrativeDay').value, '');
  assert.equal(Object.keys(f.project('project-b').atlas?.sceneTemporalAnchors || {}).length, 0);
  assert.equal(Object.keys(f.project('project-b').atlas?.calendarDefinitions || {}).length, 0);
  assert.equal(f.requests.length, 3);
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

test('Atlas Time keeps the calendar of a story date separate from the project calendar being defined', async () => {
  const f = await fixture();
  const first = f.open();
  first.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn' });
  first.click(calendarAction);
  first.enter({ storyDate: 'First dawn' });
  first.click(anchorAction);
  assert.equal(f.requests.length, 1, 'the calendar definition does not select a scene calendar');
  first.enter({ storyCalendarId: 'calendar-dawn' });
  const second = f.open({ currentDocumentId: 'scene-b' });
  second.enter({ calendarId: 'calendar-dusk', calendarName: 'Dusk' });
  second.click(calendarAction);
  assert.equal(second.field('storyCalendarId').value, '');
  second.enter({ storyCalendarId: 'calendar-dusk', storyDate: 'Last light' });
  second.click(anchorAction);
  const reopened = f.open({ currentDocumentId: 'scene-a' });
  assert.equal(reopened.field('calendarId').value, 'calendar-dusk');
  assert.equal(reopened.field('storyCalendarId').value, 'calendar-dawn');
  reopened.click(anchorAction);
  assert.equal(f.anchor('scene-a').storyRange.start.calendarId, 'calendar-dawn');
  assert.equal(f.anchor('scene-b').storyRange.start.calendarId, 'calendar-dusk');
});

test('Atlas Time authors an exact narrative interval with explicit negative and zero bounds', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ narrativeRangeKind: 'exact', narrativeDay: '-2', narrativeEndDay: '0' });
  form.click(anchorAction);
  const range = f.anchor('scene-a').narrativeRange;
  assert.equal(range.rangeKind, 'exact');
  assert.equal(range.start.dayIndex, -2);
  assert.equal(range.end.dayIndex, 0);
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

test('Atlas Time authors an approximate narrative interval with the author precision note', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ narrativeRangeKind: 'approximate', narrativeDay: '-2', narrativeEndDay: '0',
    narrativePrecisionNote: '  Около рассвета e\u0301 🧭  ' });
  form.click(anchorAction);
  const range = f.anchor('scene-a').narrativeRange;
  assert.equal(range.rangeKind, 'approximate');
  assert.equal(range.start.dayIndex, -2);
  assert.equal(range.end.dayIndex, 0);
  assert.equal(range.precisionNote, 'Около рассвета e\u0301 🧭');
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

for (const direction of ['from', 'until']) {
  test(`Atlas Time authors an open narrative ${direction} zero without inventing the missing side`, async () => {
    const f = await fixture(), form = f.open();
    form.enter({ narrativeRangeKind: direction, narrativeDay: direction === 'from' ? '0' : '',
      narrativeEndDay: direction === 'until' ? '0' : '', narrativePrecisionNote: 'Other bound is not known' });
    form.click(anchorAction);
    const range = f.anchor('scene-a').narrativeRange;
    assert.equal(range.rangeKind, 'open');
    assert.equal(range.start?.dayIndex ?? null, direction === 'from' ? 0 : null);
    assert.equal(range.end?.dayIndex ?? null, direction === 'until' ? 0 : null);
    assert.equal(range.precisionNote, 'Other bound is not known');
    assert.deepEqual(f.project().scenes, f.originalScenes);
  });
}

test('Atlas Time can explicitly record unknown narrative time with an author reason', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ narrativeRangeKind: 'unknown', narrativePrecisionNote: 'Narrator cannot date this scene' });
  form.click(anchorAction);
  const range = f.anchor('scene-a').narrativeRange;
  assert.equal(range.rangeKind, 'unknown');
  assert.equal(range.start, null);
  assert.equal(range.end, null);
  assert.equal(range.precisionNote, 'Narrator cannot date this scene');
  assert.equal(range.explicitUnknown, true);
});

test('Atlas Time sends calendar intervals and both open directions without converting their dates', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ calendarId: 'calendar-dawn', calendarName: 'Dawn' });
  form.click(calendarAction);
  for (const [kind, start, end] of [['exact', 'Первый рассвет', 'Последний рассвет'],
    ['approximate', 'Первый рассвет', 'Последний рассвет'], ['from', 'Первый рассвет', ''],
    ['until', '', 'Последний рассвет']]) {
    form.enter({ storyCalendarId: 'calendar-dawn', storyRangeKind: kind, storyDate: start,
      storyEndDate: end, storyPrecisionNote: kind === 'exact' ? '' : 'Авторская граница' });
    form.click(anchorAction);
    const range = f.anchor('scene-a').storyRange;
    assert.equal(range.rangeKind, kind === 'from' || kind === 'until' ? 'open' : kind);
    assert.equal(range.start?.value ?? '', start);
    assert.equal(range.end?.value ?? '', end);
    for (const point of [range.start, range.end].filter(Boolean)) {
      assert.equal(point.pointKind, 'calendarDate');
      assert.equal(point.calendarId, 'calendar-dawn');
    }
    assert.deepEqual(f.project().scenes, f.originalScenes);
  }
});

test('Atlas Time accepts a one-sided approximate range but never fills its absent bound', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ narrativeRangeKind: 'approximate', narrativeDay: '', narrativeEndDay: '0',
    narrativePrecisionNote: 'Approximately until the opening day' });
  form.click(anchorAction);
  const range = f.anchor('scene-a').narrativeRange;
  assert.equal(range.rangeKind, 'approximate');
  assert.equal(range.start, null);
  assert.equal(range.end.dayIndex, 0);
});

test('Atlas Time refuses incomplete, ambiguous and unexplained range choices without dispatch or draft loss', async () => {
  const f = await fixture(), form = f.open();
  const cases = [
    { narrativeRangeKind: 'approximate', narrativeDay: '0', narrativeEndDay: '2', narrativePrecisionNote: '' },
    { narrativeRangeKind: 'approximate', narrativeDay: '', narrativeEndDay: '', narrativePrecisionNote: 'No bounds' },
    { narrativeRangeKind: 'from', narrativeDay: '', narrativeEndDay: '2', narrativePrecisionNote: 'Wrong side' },
    { narrativeRangeKind: 'until', narrativeDay: '0', narrativeEndDay: '', narrativePrecisionNote: 'Wrong side' },
    { narrativeRangeKind: 'from', narrativeDay: '0', narrativeEndDay: '2', narrativePrecisionNote: 'Two sides' },
    { narrativeRangeKind: 'until', narrativeDay: '0', narrativeEndDay: '2', narrativePrecisionNote: 'Two sides' },
    { narrativeRangeKind: 'from', narrativeDay: '0', narrativeEndDay: '', narrativePrecisionNote: '' },
    { narrativeRangeKind: 'unknown', narrativeDay: '', narrativeEndDay: '', narrativePrecisionNote: '' },
    { narrativeRangeKind: 'unknown', narrativeDay: '0', narrativeEndDay: '', narrativePrecisionNote: 'A supplied bound must not disappear' },
    { narrativeRangeKind: 'exact', narrativeDay: '', narrativeEndDay: '0', narrativePrecisionNote: '' },
    { narrativeRangeKind: 'invented-kind', narrativeDay: '0', narrativeEndDay: '', narrativePrecisionNote: '' },
  ];
  for (const values of cases) {
    form.enter(values);
    form.click(anchorAction);
    for (const [key, value] of Object.entries(values)) assert.equal(form.field(key).value, value);
  }
  assert.deepEqual(f.requests, []);
  assert.equal(f.statuses.length, cases.length);
  assert.ok(f.statuses.every(({ visible }) => visible));
  assert.deepEqual(f.project().scenes, f.originalScenes);
});

test('Atlas Time rejects malformed and unsafe end days and a missing calendar for end-only story time', async () => {
  const f = await fixture(), form = f.open();
  for (const narrativeEndDay of ['1.5', '1e3', '12 days', '9007199254740992', 'Infinity']) {
    form.enter({ narrativeRangeKind: 'exact', narrativeDay: '0', narrativeEndDay });
    form.click(anchorAction);
  }
  assert.deepEqual(f.requests, []);
  const second = f.open({ currentDocumentId: 'scene-b' });
  second.enter({ storyRangeKind: 'until', storyEndDate: 'Last light', storyPrecisionNote: 'Unknown beginning' });
  second.click(anchorAction);
  assert.deepEqual(f.requests, []);
  assert.equal(f.statuses.length, 6);
});

test('Atlas Time marks only explicitly edited range dimensions for the existing Main preservation route', async () => {
  const f = await fixture(), form = f.open();
  form.enter({ narrativeRangeKind: 'until', narrativeEndDay: '0', narrativePrecisionNote: 'Unknown start' });
  form.click(anchorAction);
  assert.deepEqual(Array.from(f.requests[0].payload.preserveUntouchedTemporalFields), ['storyRange', 'note']);
  const second = f.open({ currentDocumentId: 'scene-b' });
  second.enter({ storyRangeKind: 'unknown', storyPrecisionNote: 'No dated evidence' });
  second.click(anchorAction);
  assert.deepEqual(Array.from(f.requests[1].payload.preserveUntouchedTemporalFields), ['narrativeRange', 'note']);
});

test('Atlas Time keeps advanced drafts scene-owned and refuses detached and foreign range submissions', async () => {
  const f = await fixture(), first = f.open();
  first.enter({ narrativeRangeKind: 'approximate', narrativeDay: '-2', narrativeEndDay: '0',
    narrativePrecisionNote: 'Saved only on an explicit command' });
  const second = f.open({ currentDocumentId: 'scene-b' });
  first.enter({ narrativeEndDay: '7' });
  first.click(anchorAction);
  assert.deepEqual(f.requests, []);
  assert.equal(second.field('narrativeRangeKind').value, '');
  assert.equal(second.field('narrativeEndDay').value, '');
  const returned = f.open({ currentDocumentId: 'scene-a' });
  assert.equal(returned.field('narrativeEndDay').value, '0');
  assert.equal(returned.field('narrativeRangeKind').value, 'approximate');
  f.context.currentProjectId = 'project-b';
  returned.click(anchorAction);
  assert.deepEqual(f.requests, []);
  const foreign = f.open();
  assert.equal(foreign.field('narrativeRangeKind').value, '');
  assert.equal(foreign.field('narrativePrecisionNote').value, '');
  assert.deepEqual(f.project().scenes, f.originalScenes);
});
