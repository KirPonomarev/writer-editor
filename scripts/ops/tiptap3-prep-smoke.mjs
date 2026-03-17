import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const listeners = [];
const responses = [];
const setTextListeners = [];

const sourcePath = path.resolve('src/renderer/tiptap/ipc.js');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const evalSource = sourceText
  .replace(/export function /g, 'function ')
  .concat('\nmodule.exports = { attachTiptapIpc, detachTiptapIpc, getTiptapIpcDebugState, parseObservablePayload, composeObservablePayload };');

const context = {
  window: {
    electronAPI: {
      onEditorTextRequest(callback) {
        listeners.push(callback);
      },
      onEditorSetText(callback) {
        setTextListeners.push(callback);
      },
      sendEditorTextResponse(requestId, text) {
        responses.push({ requestId, text });
      },
    },
  },
  module: { exports: {} },
  exports: {},
  console,
};

vm.createContext(context);
new vm.Script(evalSource, { filename: sourcePath }).runInContext(context);

const {
  attachTiptapIpc,
  detachTiptapIpc,
  getTiptapIpcDebugState,
  parseObservablePayload,
  composeObservablePayload,
} = context.module.exports;

const receivedPayloads = []
const sessionA = {
  readObservablePayload: () => 'alpha',
  applyIncomingPayload(payload) {
    receivedPayloads.push({ lane: 'A', payload })
  },
}
const sessionB = {
  readObservablePayload: () => 'bravo',
  applyIncomingPayload(payload) {
    receivedPayloads.push({ lane: 'B', payload })
  },
}
const sessionC = {
  readObservablePayload: () => 'charlie',
  applyIncomingPayload(payload) {
    receivedPayloads.push({ lane: 'C', payload })
  },
}

attachTiptapIpc(sessionA);
attachTiptapIpc(sessionA);

if (listeners.length !== 1 || setTextListeners.length !== 1) {
  throw new Error(`Expected one listener for each IPC channel, got text=${listeners.length} setText=${setTextListeners.length}`);
}

listeners[0]({ requestId: 'req-a' });
if (responses.at(-1)?.text !== 'alpha') {
  throw new Error('Listener did not read from initial session ref');
}

setTextListeners[0]({ content: 'seed-a' })
if (receivedPayloads.at(-1)?.lane !== 'A') {
  throw new Error('SetText listener did not route payload to current session')
}

attachTiptapIpc(sessionB);
listeners[0]({ requestId: 'req-b' });
if (responses.at(-1)?.text !== 'bravo') {
  throw new Error('Listener did not switch to current session ref after re-attach');
}

detachTiptapIpc(sessionA);
listeners[0]({ requestId: 'req-ignore' });
if (responses.at(-1)?.text !== 'bravo') {
  throw new Error('Detaching stale session ref should not clear current session');
}

detachTiptapIpc(sessionB);
listeners[0]({ requestId: 'req-empty' });
if (responses.at(-1)?.text !== '') {
  throw new Error('Detaching current session ref should clear observable payload');
}

attachTiptapIpc(sessionC);
listeners[0]({ requestId: 'req-c' });
if (responses.at(-1)?.text !== 'charlie') {
  throw new Error('Listener did not read from re-initialized session ref');
}

const parsed = parseObservablePayload(`[meta]
status: draft
tags: POV=Alice; линия=Main; место=Paris
synopsis: First line
  second line
[/meta]

Hello

[cards]
[card]
title: Card 1
text: Body
  more
tags: t1
[/card]
[/cards]`)

const recomposed = composeObservablePayload({
  text: parsed.text,
  metaEnabled: true,
  meta: parsed.meta,
  cards: parsed.cards,
})

if (!recomposed.includes('[meta]') || !recomposed.includes('[cards]') || !recomposed.includes('Hello')) {
  throw new Error('Observable payload builder did not preserve legacy shape markers')
}

const emptyParsed = parseObservablePayload('')
if (
  emptyParsed.text !== ''
  || emptyParsed.meta?.synopsis !== ''
  || emptyParsed.meta?.status !== 'черновик'
  || emptyParsed.meta?.tags?.pov !== ''
  || emptyParsed.meta?.tags?.line !== ''
  || emptyParsed.meta?.tags?.place !== ''
  || !Array.isArray(emptyParsed.cards)
  || emptyParsed.cards.length !== 0
) {
  throw new Error(`Empty payload parse edge-case drift: ${JSON.stringify(emptyParsed)}`)
}

const metaOnlyParsed = parseObservablePayload(`[meta]
status: черновик
tags: POV=; линия=; место=
synopsis:
[/meta]`)
if (metaOnlyParsed.text !== '' || metaOnlyParsed.cards.length !== 0) {
  throw new Error(`Meta-only parse edge-case drift: ${JSON.stringify(metaOnlyParsed)}`)
}

const cardsOnlyParsed = parseObservablePayload(`[cards]
[card]
title: Card edge
text: Body
tags: t1
[/card]
[/cards]`)
if (cardsOnlyParsed.text !== '' || cardsOnlyParsed.meta?.status !== 'черновик' || cardsOnlyParsed.cards.length !== 1) {
  throw new Error(`Cards-only parse edge-case drift: ${JSON.stringify(cardsOnlyParsed)}`)
}

const normalizedNewlines = parseObservablePayload('\n\nHello\n\n\n')
if (normalizedNewlines.text !== 'Hello') {
  throw new Error(`Parse newline normalization drift: ${JSON.stringify(normalizedNewlines)}`)
}

const composedEmpty = composeObservablePayload({
  text: '',
  metaEnabled: false,
  meta: { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } },
  cards: [],
})
if (composedEmpty !== '') {
  throw new Error(`Compose empty edge-case drift: ${JSON.stringify({ composedEmpty })}`)
}

const composedMetaOnly = composeObservablePayload({
  text: '',
  metaEnabled: true,
  meta: { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } },
  cards: [],
})
const expectedMetaOnly = `[meta]
status: черновик
tags: POV=; линия=; место=
synopsis: 
[/meta]`
if (composedMetaOnly !== expectedMetaOnly) {
  throw new Error(`Compose meta-only edge-case drift: ${JSON.stringify({ composedMetaOnly, expectedMetaOnly })}`)
}

const composedTrailingNewline = composeObservablePayload({
  text: 'Hello\n',
  metaEnabled: false,
  meta: { synopsis: '', status: 'черновик', tags: { pov: '', line: '', place: '' } },
  cards: [],
})
if (composedTrailingNewline !== 'Hello\n') {
  throw new Error(`Compose trailing-newline edge-case drift: ${JSON.stringify({ composedTrailingNewline })}`)
}

const state = getTiptapIpcDebugState();
if (!state.textRequestListenerAttached || !state.setTextListenerAttached || state.listenerCount !== 2 || !state.hasCurrentSessionRef) {
  throw new Error(`Unexpected IPC debug state: ${JSON.stringify(state)}`);
}

console.log(JSON.stringify({
  textRequestListenerCount: listeners.length,
  setTextListenerCount: setTextListeners.length,
  observedResponses: responses,
  observedPayloads: receivedPayloads,
  recomposedPayload: recomposed,
  debugState: state,
  verdict: 'PREP_SMOKE_OK',
}, null, 2));
