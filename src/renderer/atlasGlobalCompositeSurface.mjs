const FAMILY = Object.freeze({ 'atlas.localGraph': 'Atlas', 'atlas.temporalContinuity': 'Время',
  'plot.projection': 'Plot', 'idea.projection': 'Idea', 'meaning.projection': 'Meaning',
  'manualMap.graph': 'Ручная карта', 'crossProjection.impactPreview': 'Общий источник' });
const TRUST = Object.freeze({ AUTHOR_CONFIRMED: 'Авторская запись', ALGORITHMIC_OBSERVATION: 'Вычисленное представление', UNKNOWN: 'Происхождение не определено' });
const EDGES = Object.freeze({ atlasCooccurrence: 'Совместное появление', temporalCooccurrence: 'Временное пересечение',
  manualMapEdge: 'Связь ручной карты', plotEdge: 'Структура Plot', crossProjectionLink: 'Между проекциями', manualTargetRef: 'Источник карты' });
const HASH = /^[a-f0-9]{64}$/u;
const count = n => Number.isSafeInteger(n) && n >= 0;
const text = value => typeof value === 'string' ? value.slice(0, 320) : '';

export function validateAtlasGlobalCompositeProjection(value, projectId) {
  if (!value || value.schemaVersion !== 'atlas.globalCompositeSurface.v1' || value.projectId !== projectId
    || !['ready', 'empty'].includes(value.state) || !HASH.test(value.sourceRevision) || !HASH.test(value.compositeHash)
    || !Array.isArray(value.graph?.nodes) || value.graph.nodes.length > 120
    || !Array.isArray(value.graph?.edges) || value.graph.edges.length > 240
    || !Array.isArray(value.list?.rows) || value.list.rows.length > 24 || value.list.pageSize !== 24
    || !count(value.list.offset) || !count(value.list.total) || value.list.offset + value.list.rows.length > value.list.total
    || !Array.isArray(value.sourceRefs) || value.sourceRefs.length > 160
    || value.authority?.readModelOnly !== true || value.authority?.projectTruthMutation !== false
    || value.authority?.manuscriptMutation !== false || value.authority?.storageMutation !== false
    || value.authority?.sourceProjectionWriteBack !== false) return null;
  const nodes = value.graph.nodes, rows = value.list.rows;
  const ids = new Set(nodes.map(node => node.nodeId));
  if (ids.size !== nodes.length || new Set(rows.map(row => row.nodeId)).size !== rows.length
    || [...nodes, ...rows].some(node => typeof node.nodeId !== 'string' || !node.nodeId || node.nodeId.length > 512
      || typeof node.label !== 'string' || !Object.hasOwn(FAMILY, node.sourceProjection) || !Object.hasOwn(TRUST, node.trustState))
    || nodes.some(node => !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)
      || Math.abs(node.position.x) > 1_000_000 || Math.abs(node.position.y) > 1_000_000 || !count(node.listOffset))
    || value.graph.edges.some(edge => !ids.has(edge.fromNodeId) || !ids.has(edge.toNodeId))
    || value.sourceRefs.some(ref => ref.readOnly !== true || ref.sourceWriteBack !== false || !HASH.test(ref.sourceHash))
    || !count(value.summary?.omittedGraphNodes) || !count(value.summary?.omittedGraphEdges)) return null;
  if (value.selection && (!value.selection.node || !Object.hasOwn(FAMILY, value.selection.node.sourceProjection)
    || !Object.hasOwn(TRUST, value.selection.node.trustState) || !Array.isArray(value.selection.edges)
    || value.selection.edges.length > 24 || !count(value.selection.edgeTotal))) return null;
  return value;
}

function element(document, tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = text(label);
  return node;
}
function button(document, label, key, run, actions) {
  const node = element(document, 'button', 'right-rail-atlas-action', label);
  node.type = 'button'; node.dataset.compositeFocus = key;
  node.addEventListener('click', () => {
    if (!node.isConnected || node.disabled) return;
    if (!actions.isCurrent()) { actions.onStale?.(); return; }
    run();
  });
  return node;
}
function select(document, label, values, selected, key, actions) {
  const wrapper = element(document, 'label', 'right-rail-atlas-matrix-list', label);
  const input = element(document, 'select', 'right-rail-atlas-input');
  input.setAttribute('aria-label', label); input.dataset.compositeFocus = key;
  for (const [value, name] of values) {
    const option = element(document, 'option', '', name); option.value = value; input.appendChild(option);
  }
  input.value = selected;
  input.addEventListener('change', () => {
    if (!input.isConnected) return;
    if (!actions.isCurrent()) { actions.onStale?.(); return; }
    actions.onRequest({ [key]: input.value, offset: 0, selectedNodeId: '' }, key);
  });
  wrapper.appendChild(input); return wrapper;
}
function section(document, parent, title) {
  const root = element(document, 'section', 'right-rail-atlas-matrix-list');
  root.appendChild(element(document, 'strong', 'right-rail-atlas-matrices-title', title)); parent.appendChild(root); return root;
}
function focusKeys(event, items) {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = items.indexOf(event.currentTarget);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : Math.max(0, Math.min(items.length - 1, index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1)));
  event.preventDefault(); event.stopPropagation();
  items.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; }); items[next]?.focus();
}
function graph(document, parent, state, actions) {
  const container = element(document, 'div', 'atlas-workspace__graph');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-320 -320 640 640'); svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Общий граф. Все действия доступны в списке узлов ниже.');
  const positions = new Map(state.graph.nodes.map(node => [node.nodeId, node.position]));
  for (const edge of state.graph.edges) {
    const from = positions.get(edge.fromNodeId), to = positions.get(edge.toNodeId);
    const line = document.createElementNS(svg.namespaceURI, 'line'); line.setAttribute('class', 'atlas-workspace__graph-line');
    for (const [key, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(key, String(value));
    line.setAttribute('aria-hidden', 'true'); svg.appendChild(line);
  }
  const controls = [];
  for (const node of state.graph.nodes) {
    const selected = node.nodeId === state.selection?.node.nodeId;
    const group = document.createElementNS(svg.namespaceURI, 'g'); group.setAttribute('class', 'atlas-workspace__graph-node');
    group.setAttribute('role', 'button'); group.setAttribute('aria-label', `${text(node.label)}. ${FAMILY[node.sourceProjection]}`);
    group.setAttribute('aria-pressed', String(selected));
    const hasSelection = state.graph.nodes.some(item => item.nodeId === state.selection?.node.nodeId);
    group.setAttribute('tabindex', selected || !hasSelection && controls.length === 0 ? '0' : '-1');
    group.dataset.compositeFocus = 'graph:' + node.nodeId;
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', String(node.position.x)); circle.setAttribute('cy', String(node.position.y)); circle.setAttribute('r', selected ? '10' : '6'); group.appendChild(circle);
    if (node.labelVisible || selected) {
      const label = document.createElementNS(svg.namespaceURI, 'text'); label.setAttribute('x', String(node.position.x + 12));
      label.setAttribute('y', String(node.position.y + 4)); label.textContent = text(node.label).slice(0, 24); group.appendChild(label);
    }
    const choose = () => {
      if (!group.isConnected) return;
      if (!actions.isCurrent()) { actions.onStale?.(); return; }
      actions.onRequest({ selectedNodeId: node.nodeId, offset: node.listOffset }, 'graph:' + node.nodeId);
    };
    group.addEventListener('click', choose);
    group.addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); choose(); }
      else focusKeys(event, controls);
    });
    controls.push(group); svg.appendChild(group);
  }
  container.appendChild(svg); parent.appendChild(container);
}

export function renderAtlasGlobalCompositeSurface(host, state, actions) {
  const document = host.ownerDocument;
  const focus = actions.focusKey || (host.contains(document.activeElement) ? document.activeElement?.dataset?.compositeFocus : '');
  host.replaceChildren(); host.dataset.atlasGlobalCompositeStatus = state.state;
  host.setAttribute('aria-busy', String(state.state === 'loading'));
  host.appendChild(element(document, 'strong', 'right-rail-atlas-matrices-title', 'Общий граф'));
  host.appendChild(element(document, 'p', 'right-rail-atlas-state', 'По сохранённым данным проекта. У каждой проекции остаются свои источники.'));
  const refresh = button(document, 'Обновить граф', 'refresh', () => actions.onRequest({}, 'refresh'),
    { ...actions, isCurrent: actions.canRefresh });
  refresh.disabled = state.state === 'loading'; host.appendChild(refresh);
  if (!['ready', 'empty'].includes(state.state)) {
    const status = element(document, 'p', 'right-rail-atlas-state', state.state === 'loading' ? 'Граф обновляется.'
      : state.message || 'Граф недоступен. Обновите его, когда проект будет доступен.');
    status.setAttribute('role', 'status'); host.appendChild(status);
  } else {
    const controls = section(document, host, 'Показать');
    controls.appendChild(select(document, 'Проекция', [['all', 'Все проекции'], ['atlas', 'Atlas и время'], ['plot', 'Plot'],
      ['idea', 'Idea'], ['meaning', 'Meaning'], ['map', 'Ручные карты'], ['source', 'Общие источники']], state.projection, 'projection', actions));
    controls.appendChild(select(document, 'Происхождение', [['ALL', 'Все записи'], ['AUTHOR_CONFIRMED', TRUST.AUTHOR_CONFIRMED],
      ['ALGORITHMIC_OBSERVATION', TRUST.ALGORITHMIC_OBSERVATION], ['UNKNOWN', TRUST.UNKNOWN]], state.trust, 'trust', actions));
    const summary = element(document, 'p', 'right-rail-atlas-state', `${state.list.total} узлов. На графе ${state.graph.nodes.length} узлов и ${state.graph.edges.length} связей.`);
    summary.setAttribute('role', 'status'); host.appendChild(summary);
    if (state.graph.nodes.length) graph(document, host, state, actions);
    if (state.summary.omittedGraphNodes || state.summary.omittedGraphEdges) host.appendChild(element(document, 'p', 'right-rail-atlas-state',
      `Вне графа: ${state.summary.omittedGraphNodes} узлов и ${state.summary.omittedGraphEdges} связей. Узлы доступны по страницам списка.`));
    const listSection = section(document, host, 'Узлы');
    if (!state.list.total) listSection.appendChild(element(document, 'p', 'right-rail-atlas-state', 'Для выбранных проекции и происхождения узлов нет.'));
    const list = element(document, 'ul', 'atlas-workspace__list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Узлы общего графа');
    const rows = [];
    for (const row of state.list.rows) {
      const item = element(document, 'li'); item.setAttribute('role', 'presentation');
      const b = button(document, '', 'node:' + row.nodeId, () => actions.onRequest({ selectedNodeId: row.nodeId }, 'node:' + row.nodeId), actions);
      b.className = 'atlas-workspace__row'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(row.nodeId === state.selection?.node.nodeId));
      const hasSelection = state.list.rows.some(item => item.nodeId === state.selection?.node.nodeId);
      b.tabIndex = row.nodeId === state.selection?.node.nodeId || !hasSelection && rows.length === 0 ? 0 : -1;
      const title = element(document, 'span', 'atlas-workspace__row-main');
      title.appendChild(element(document, 'span', 'atlas-workspace__row-title', row.label));
      title.appendChild(element(document, 'span', 'atlas-workspace__row-meta', `${FAMILY[row.sourceProjection]} · ${TRUST[row.trustState]}`));
      b.appendChild(title); b.addEventListener('keydown', event => focusKeys(event, rows)); rows.push(b);
      item.appendChild(b); list.appendChild(item);
    }
    listSection.appendChild(list);
    listSection.appendChild(element(document, 'span', 'right-rail-atlas-state', `${state.list.total ? state.list.offset + 1 : 0}–${state.list.offset + state.list.rows.length} из ${state.list.total}`));
    for (const [name, offset, disabled, key] of [['Назад', Math.max(0, state.list.offset - 24), state.list.offset === 0, 'previous'],
      ['Далее', state.list.offset + 24, !state.list.hasMore, 'next']]) {
      const b = button(document, name, key, () => actions.onRequest({ offset, selectedNodeId: '' }, key), actions);
      b.disabled = disabled; listSection.appendChild(b);
    }
    if (state.selection) {
      const detail = section(document, host, state.selection.node.label);
      detail.appendChild(element(document, 'p', 'right-rail-atlas-state', `${FAMILY[state.selection.node.sourceProjection]} · ${TRUST[state.selection.node.trustState]}`));
      detail.appendChild(button(document, 'Открыть источник: ' + FAMILY[state.selection.node.sourceProjection], 'source',
        () => actions.onSource(state.selection.node), actions));
      detail.appendChild(element(document, 'span', 'right-rail-atlas-state', `Связей у узла: ${state.selection.edgeTotal}. Показано: ${state.selection.edges.length}.`));
      for (const edge of state.selection.edges) detail.appendChild(element(document, 'p', 'right-rail-atlas-state',
        `${text(edge.fromLabel)} → ${text(edge.toLabel)} · ${EDGES[edge.edgeKind] || 'Связь'}`));
    }
  }
  if (focus) Array.from(host.querySelectorAll('[data-composite-focus]')).find(node => node.dataset.compositeFocus === focus && !node.disabled)?.focus({ preventScroll: true });
}
