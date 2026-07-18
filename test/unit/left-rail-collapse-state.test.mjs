import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LEFT_RAIL_COLLAPSED_WIDTH,
  buildLayoutPatchFromSpatialState,
  buildSidebarLayoutModel,
  buildSpatialStateFromLayoutSnapshot,
} from '../../src/renderer/design-os/designOsShellController.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('left rail collapse preserves the expanded width in the Design OS projection', () => {
  const collapsed = buildSidebarLayoutModel(
    { leftSidebarWidth: 360, rightSidebarWidth: 310, leftCollapsed: true },
    { viewportWidth: 1440 },
  );

  assert.equal(collapsed.leftCollapsed, true);
  assert.equal(collapsed.leftSidebarWidth, LEFT_RAIL_COLLAPSED_WIDTH);
  assert.equal(collapsed.leftExpandedWidth, 360);
  assert.equal(collapsed.rightSidebarWidth, 310);

  const patch = buildLayoutPatchFromSpatialState(
    { leftSidebarWidth: 360, rightSidebarWidth: 310, leftCollapsed: true },
    { viewportWidth: 1440, viewportHeight: 900, leftCollapsed: true },
  );
  assert.equal(patch.left_width, LEFT_RAIL_COLLAPSED_WIDTH);

  const restored = buildSpatialStateFromLayoutSnapshot(
    { left_width: 360, right_width: 310, viewport_width: 1440 },
    { leftCollapsed: true },
  );
  assert.deepEqual(
    { width: restored.leftSidebarWidth, collapsed: restored.leftCollapsed },
    { width: 360, collapsed: true },
  );

  const expanded = buildSidebarLayoutModel(restored, { viewportWidth: 1440, leftCollapsed: false });
  assert.equal(expanded.leftSidebarWidth, 360);
  assert.equal(expanded.leftRailMode, 'docked');
});

test('narrow view derives a transient overlay without changing stored collapse truth', () => {
  const model = buildSidebarLayoutModel(
    { leftSidebarWidth: 360, rightSidebarWidth: 310, leftCollapsed: false },
    { viewportWidth: 820 },
  );

  assert.equal(model.leftRailMode, 'overlay');
  assert.equal(model.constraints.leftRailMode, 'overlay');
  assert.equal(model.leftCollapsed, false);
  assert.equal(model.leftExpandedWidth, 240);
  assert.equal(model.rightVisible, false);
});

test('collapsed left rail increases editor budget without changing right rail truth', () => {
  const model = buildSidebarLayoutModel(
    { leftSidebarWidth: 320, rightSidebarWidth: 320, leftCollapsed: true },
    { viewportWidth: 1020 },
  );

  assert.equal(model.layoutVariant, 'dual');
  assert.equal(model.leftSidebarWidth, LEFT_RAIL_COLLAPSED_WIDTH);
  assert.equal(model.leftExpandedWidth, 320);
  assert.equal(model.rightSidebarWidth, 320);
});

test('renderer owns collapse through project-bound spatial state and safe reset', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');
  const styles = read('src/renderer/styles.css');

  assert.match(html, /data-action="toggle-left-rail"/u);
  assert.match(html, /data-left-rail-collapse/u);
  assert.match(html, /data-left-rail-overlay-backdrop/u);
  assert.match(editor, /leftCollapsed: state\?\.leftCollapsed === true/u);
  assert.match(editor, /appLayout\.dataset\.leftRailCollapsed/u);
  assert.match(editor, /function toggleLeftRailCollapsed\(\)/u);
  assert.match(editor, /case 'toggle-left-rail':/u);
  assert.match(editor, /case 'close-left-rail-overlay':/u);
  assert.match(editor, /function setLeftRailOverlayOpen\(open/u);
  assert.match(editor, /const legacyKey = normalizeProjectId\(projectId\) \? storageKey : 'spatialLayout'/u);
  assert.match(editor, /applySpatialLayoutState\(getSpatialLayoutBaselineForViewport\(\), \{/u);
  assert.match(editor, /restoreSpatialLayoutState\(currentProjectId\)/u);
  assert.match(
    editor,
    /if \(nextProjectId !== currentProjectId\) \{[\s\S]*?currentProjectId = nextProjectId;[\s\S]*?restoreSpatialLayoutState\(currentProjectId\);/u,
  );
  assert.match(styles, /data-left-rail-collapsed="true"/u);
  assert.match(styles, /data-left-rail-mode="overlay"/u);
  assert.match(styles, /prefers-reduced-motion: reduce/u);
  assert.match(styles, /assets\/icons\/navigation\/phosphor-caret-left\.svg/u);
});
