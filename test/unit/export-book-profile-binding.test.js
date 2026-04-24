const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModules() {
  const root = process.cwd();
  const registry = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runner = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const project = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  const bookProfile = await import(pathToFileURL(path.join(root, 'src', 'core', 'bookProfile.mjs')).href);
  const docxPageSetupBind = await import(pathToFileURL(path.join(root, 'src', 'docxPageSetupBind.mjs')).href);
  return {
    createCommandRegistry: registry.createCommandRegistry,
    createCommandRunner: runner.createCommandRunner,
    COMMAND_IDS: project.COMMAND_IDS,
    registerProjectCommands: project.registerProjectCommands,
    bookProfile,
    docxPageSetupBind,
  };
}

test('export book profile binding: command forwards canonical bookProfile options to backend intact', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const bookProfile = {
    schemaVersion: 'book-profile.v1',
    profileId: 'persisted-project-profile',
    formatId: 'A5',
    widthMm: 148,
    heightMm: 210,
    orientation: 'portrait',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
    chapterStartRule: 'next-page',
    allowExplicitPageBreaks: true,
  };
  const pageLayoutMetrics = {
    pageWidthMm: 148,
    pageHeightMm: 210,
    contentWidthMm: 112,
    contentHeightMm: 168,
  };
  let capturedPayload = null;
  const electronAPI = {
    exportDocxMin: async (payload) => {
      capturedPayload = payload;
      return { ok: 1, outPath: payload.outPath, bytesWritten: 321 };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, {
    requestId: 'book-profile-export',
    outPath: '/tmp/book-profile-export.docx',
    bufferSource: 'First line\nSecond line',
    options: {
      bookProfile,
      pageLayoutMetrics,
      source: 'project-manifest',
    },
  });

  assert.deepEqual(capturedPayload, {
    requestId: 'book-profile-export',
    outPath: '/tmp/book-profile-export.docx',
    outDir: '',
    bufferSource: 'First line\nSecond line',
    options: {
      bookProfile,
      pageLayoutMetrics,
      source: 'project-manifest',
    },
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      exported: true,
      outPath: '/tmp/book-profile-export.docx',
      bytesWritten: 321,
    },
  });
});

test('export book profile binding: canonical normalized bookProfile drives distinct DOCX page setup outputs', async () => {
  const { bookProfile, docxPageSetupBind } = await loadModules();

  const portraitProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage04-export-proof-portrait',
    formatId: 'A5',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const portraitNormalized = bookProfile.normalizeBookProfile(portraitProfile);
  assert.equal(portraitNormalized.ok, true);
  assert.deepEqual(portraitNormalized.value, portraitProfile);

  const portraitSetup = docxPageSetupBind.buildDocxPageSetup(portraitNormalized.value);
  assert.deepEqual(portraitSetup, {
    orientation: 'portrait',
    pageWidthTwips: 8391,
    pageHeightTwips: 11906,
    marginTopTwips: 1134,
    marginRightTwips: 1020,
    marginBottomTwips: 1247,
    marginLeftTwips: 1020,
    headerTwips: 720,
    footerTwips: 720,
    gutterTwips: 0,
  });
  assert.equal(
    docxPageSetupBind.buildDocxSectionPropertiesXml(portraitNormalized.value),
    '<w:sectPr><w:pgSz w:w="8391" w:h="11906"/><w:pgMar w:top="1134" w:right="1020" w:bottom="1247" w:left="1020" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  );

  const landscapeProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage04-export-proof-landscape',
    formatId: 'A5',
    orientation: 'landscape',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const landscapeNormalized = bookProfile.normalizeBookProfile(landscapeProfile);
  assert.equal(landscapeNormalized.ok, true);
  assert.deepEqual(landscapeNormalized.value, landscapeProfile);

  const landscapeSetup = docxPageSetupBind.buildDocxPageSetup(landscapeNormalized.value);
  assert.deepEqual(landscapeSetup, {
    orientation: 'landscape',
    pageWidthTwips: 11906,
    pageHeightTwips: 8391,
    marginTopTwips: 1134,
    marginRightTwips: 1020,
    marginBottomTwips: 1247,
    marginLeftTwips: 1020,
    headerTwips: 720,
    footerTwips: 720,
    gutterTwips: 0,
  });
  assert.equal(
    docxPageSetupBind.buildDocxSectionPropertiesXml(landscapeNormalized.value),
    '<w:sectPr><w:pgSz w:w="11906" w:h="8391" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1020" w:bottom="1247" w:left="1020" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  );
});

test('export book profile binding: invalid bookProfile fails closed instead of falling back to A4', async () => {
  const { docxPageSetupBind } = await loadModules();

  assert.throws(
    () => docxPageSetupBind.buildDocxPageSetup(null),
    /E_DOCX_BOOK_PROFILE_INVALID:E_BOOK_PROFILE_OBJECT/u,
  );
  assert.throws(
    () => docxPageSetupBind.buildDocxSectionPropertiesXml({ formatId: 'UNKNOWN' }),
    /E_DOCX_BOOK_PROFILE_INVALID:E_PAGE_FORMAT_ID/u,
  );
});

test('export book profile binding: backend delegates section setup to the fail-closed bind layer', () => {
  const builderSource = read('src/export/docx/docxMinBuilder.js');
  const bindSource = read('src/docxPageSetupBind.mjs');

  assert.equal(
    builderSource.includes('deps.docxPageSetupBindModule.buildDocxSectionPropertiesXml(snapshot.bookProfile)'),
    true,
  );
  assert.equal(bindSource.includes('roundTwips(210)'), false);
  assert.equal(bindSource.includes('roundTwips(297)'), false);
});
