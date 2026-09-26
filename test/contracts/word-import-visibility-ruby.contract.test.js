'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const bridge = import('../../src/io/revisionBridge/index.mjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function pack(body, styles = '', prefix = 'w') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>` },
    ...(styles ? [{ name: 'word/styles.xml', data: `<w:styles xmlns:w="${W}">${styles}</w:styles>` }] : []),
  ]);
}
const run = (properties = '', text = 'PRIVATE_MARKER') => `<w:r><w:rPr>${properties}</w:rPr><w:t>${text}</w:t></w:r>`;
const style = (id, properties, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}">${extra}<w:rPr>${properties}</w:rPr></w:style>`;
async function inspect(bytes) {
  const b = await bridge;
  const preview = b.buildDocxContentPreviewFromZipBytes(bytes);
  return { preview, plan: b.buildDocxImportPreviewPlanFromContentPreview(preview) };
}
async function blocked(bytes, reason) {
  const result = await inspect(bytes);
  assert.equal(result.preview.ok, false, JSON.stringify(result.preview));
  assert.equal(result.preview.code, 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_FEATURE');
  assert.equal(result.preview.reason, reason);
  assert.equal(result.plan.ok, false);
  assert.equal(JSON.stringify(result.preview).includes('PRIVATE_MARKER'), false);
  return result;
}

for (const property of ['vanish', 'webHidden']) {
  test(`P0a ${property}: direct true forms block even with bold; false forms stay visible`, async () => {
    const reason = property === 'vanish' ? 'DOCX_HIDDEN_TEXT_UNSUPPORTED' : 'DOCX_WEB_HIDDEN_TEXT_UNSUPPORTED';
    for (const val of ['', '1', 'true', 'on']) {
      await blocked(pack(`<w:p>${run(`<w:b/><w:${property}${val ? ` w:val="${val}"` : ''}/>` )}</w:p>`), reason);
    }
    for (const val of ['0', 'false', 'off']) {
      const { preview, plan } = await inspect(pack(`<w:p>${run(`<w:${property} w:val="${val}"/>`)}</w:p>`));
      assert.equal(preview.ok, true, JSON.stringify(preview));
      assert.equal(plan.ok, true);
      assert.equal(preview.contentPreview.paragraphs[0].text, 'PRIVATE_MARKER');
    }
  });
  test(`P0a ${property}: namespace alias and source occurrence remain identifiable`, async () => {
    const reason = property === 'vanish' ? 'DOCX_HIDDEN_TEXT_UNSUPPORTED' : 'DOCX_WEB_HIDDEN_TEXT_UNSUPPORTED';
    const { preview } = await blocked(pack(`<q:p/><q:p><q:r><q:rPr><q:${property}/></q:rPr><q:t>PRIVATE_MARKER</q:t></q:r></q:p>`, '', 'q'), reason);
    assert.equal(preview.diagnostics[0].paragraphIndex, 1);
    assert.equal(preview.diagnostics[0].tagName, `w:${property}`);
    assert.equal(preview.diagnostics[0].sourcePart, 'word/document.xml');
  });
  test(`P0a ${property}: defaults, inherited style, direct override and unused style`, async () => {
    const reason = property === 'vanish' ? 'DOCX_HIDDEN_TEXT_UNSUPPORTED' : 'DOCX_WEB_HIDDEN_TEXT_UNSUPPORTED';
    const defaults = `<w:docDefaults><w:rPrDefault><w:rPr><w:${property}/></w:rPr></w:rPrDefault></w:docDefaults>`;
    await blocked(pack(`<w:p>${run()}</w:p>`, defaults), reason);
    const styles = style('Hidden', `<w:${property}/>`)+style('Child', '', '<w:basedOn w:val="Hidden"/>');
    await blocked(pack(`<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr>${run()}</w:p>`, styles), reason);
    const override = await inspect(pack(`<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr>${run(`<w:${property} w:val="0"/>`)}</w:p>`, styles));
    assert.equal(override.plan.ok, true, JSON.stringify(override.preview));
    assert.equal((await inspect(pack(`<w:p>${run()}</w:p>`, styles))).plan.ok, true, 'unused style is inert');
  });
}

test('P0a style cascade distinguishes vanish toggling from webHidden replacement', async () => {
  const body = `<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr>${run()}</w:p>`;
  assert.equal((await inspect(pack(body, style('Base','<w:vanish/>')+style('Child','<w:vanish/>','<w:basedOn w:val="Base"/>')))).plan.ok, true);
  await blocked(pack(body, style('Base','<w:webHidden/>')+style('Child','<w:webHidden/>','<w:basedOn w:val="Base"/>')), 'DOCX_WEB_HIDDEN_TEXT_UNSUPPORTED');
});

test('P0a invalid values, duplicate properties, spoofing and style cycles never become an import plan', async () => {
  for (const property of ['vanish','webHidden']) {
    for (const props of [`<w:${property} w:val="maybe"/>`, `<w:${property}/><w:${property} w:val="0"/>`, `<w:${property} xmlns:w="urn:foreign"/>`]) {
      const result = await inspect(pack(`<w:p>${run(props)}</w:p>`));
      assert.equal(result.plan.ok, false, JSON.stringify(result.preview));
    }
  }
  const cycle = style('A','<w:vanish/>','<w:basedOn w:val="A"/>');
  assert.equal((await inspect(pack(`<w:p><w:pPr><w:pStyle w:val="A"/></w:pPr>${run()}</w:p>`, cycle))).plan.ok, false);
});

test('P0a Ruby base and phonetic annotation cannot flatten into successful import', async () => {
  for (const prefix of ['w','q']) {
    const body = '<w:p><w:r><w:ruby><w:rubyPr/><w:rt><w:r><w:t>ふりがな</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>振り仮名</w:t></w:r></w:rubyBase></w:ruby></w:r></w:p>'.replaceAll('w:', `${prefix}:`);
    const { preview } = await blocked(pack(body, '', prefix), 'DOCX_RUBY_UNSUPPORTED');
    assert.equal(preview.diagnostics[0].paragraphIndex, 0);
    assert.equal(preview.diagnostics[0].tagName, 'w:ruby');
  }
});

test('P0a rejected plan cannot write through real fenced import persistence', async t => {
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-p0a-no-write-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'protected.txt'),'original');
  const { plan } = await inspect(pack(`<w:p>${run('<w:vanish/>')}</w:p>`));
  // Even accidental main-owned admission cannot make a rejected projection
  // into a valid writable plan. The vulnerable parser produced a valid plan.
  rememberDocxImportPreviewPlanAdmission(plan);
  const result = await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},{projectRoot:root,romanRoot:path.join(root,'roman'),projectId:'p0a-owned-synthetic'});
  assert.equal(result.ok,false);
  assert.deepEqual(fs.readdirSync(root),['protected.txt']);
  assert.equal(fs.readFileSync(path.join(root,'protected.txt'),'utf8'),'original');
});

test('P0a character styles and empty hidden runs cannot bypass validation', async () => {
  const styles = '<w:style w:type="character" w:styleId="Secret" w:default="1"><w:rPr><w:vanish/></w:rPr></w:style>';
  await blocked(pack(`<w:p>${run()}</w:p>`, styles), 'DOCX_HIDDEN_TEXT_UNSUPPORTED');
  await blocked(pack(`<w:p>${run('<w:rStyle w:val="Secret"/>')}</w:p>`, styles), 'DOCX_HIDDEN_TEXT_UNSUPPORTED');
  await blocked(pack('<w:p><w:r><w:rPr><w:vanish/></w:rPr></w:r></w:p>'), 'DOCX_HIDDEN_TEXT_UNSUPPORTED');
});


test('P0a actual main preview command never admits hidden or Ruby plans', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = source.indexOf('// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_START');
  const end = source.indexOf('// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_END');
  assert.ok(start >= 0 && end > start);
  const admissions = [];
  const sandbox = {
    module: { exports: {} },
    cloneJsonSafe: value => value === undefined ? undefined : JSON.parse(JSON.stringify(value)),
    isPlainObjectValue: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    loadRevisionBridgeModule: () => bridge,
    rememberDocxImportPreviewPlanAdmission: plan => admissions.push(plan),
  };
  vm.runInNewContext(source.slice(start, end) + '\nmodule.exports = handleDocxImportPreviewCommandSurface;', sandbox);
  for (const body of [
    `<w:p>${run('<w:vanish/>')}</w:p>`,
    `<w:p>${run('<w:webHidden/>')}</w:p>`,
    '<w:p><w:r><w:ruby><w:rt><w:r><w:t>reading</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>base</w:t></w:r></w:rubyBase></w:ruby></w:r></w:p>',
  ]) {
    const { preview } = await inspect(pack(body));
    const result = await sandbox.module.exports({ requestId: 'p0a', docxContentPreviewReport: preview });
    assert.equal(result.importPreviewOk, false, JSON.stringify(result));
    assert.equal(result.docxImportPreviewPlan.candidateCreatePlan, null);
    assert.equal(admissions.length, 0);
  }
  const { preview } = await inspect(pack(`<w:p>${run('', 'visible control')}</w:p>`));
  const control = await sandbox.module.exports({ requestId: 'control', docxContentPreviewReport: preview });
  assert.equal(control.importPreviewOk, true, JSON.stringify(control));
  assert.equal(admissions.length, 1);
});
