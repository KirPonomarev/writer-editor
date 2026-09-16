const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs')]);
const run = (text, properties = '') => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
const themed = token => `<w:rFonts w:asciiTheme="${token}" w:hAnsiTheme="${token}" w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/>`;
const literal = font => `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>`;
const defaults = properties => `<w:docDefaults><w:rPrDefault><w:rPr>${properties}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>`;
const themeXml = (extra = '') => `<a:theme xmlns:a="${A}" name="Bounded fixture"><a:themeElements><a:fontScheme name="Test"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/>${extra}</a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
function pack({ text = 'Latin Шрифт Ω', body = `<w:p>${run(text)}</w:p>`, styles = defaults(themed('minorHAnsi')), theme = themeXml(), settings = '', target = 'theme/theme1.xml', relationshipPrefix = '', transformParts = parts => parts } = {}) {
  const parts = [{ name: 'word/document.xml', data: `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>` }];
  const references = [];
  if (styles) { parts.push({ name: 'word/styles.xml', data: `<w:styles xmlns:w="${W}">${styles}</w:styles>` }); references.push({ id: 's', type: 'styles', target: 'styles.xml' }); }
  if (theme) { parts.push({ name: `word/${target}`, data: theme }); references.push({ id: 't', type: 'theme', target }); }
  if (settings) { parts.push({ name: 'word/settings.xml', data: `<w:settings xmlns:w="${W}">${settings}</w:settings>` }); references.push({ id: 'o', type: 'settings', target: 'settings.xml' }); }
  const p = relationshipPrefix ? `${relationshipPrefix}:` : '';
  const ns = relationshipPrefix ? `xmlns:${relationshipPrefix}` : 'xmlns';
  parts.push({ name: 'word/_rels/document.xml.rels', data: `<${p}Relationships ${ns}="${REL}">${references.map(r => `<${p}Relationship Id="${r.id}" Type="${OFFICE}/${r.type}" Target="${r.target}"/>`).join('')}</${p}Relationships>` });
  const type = name => name.endsWith('document.xml') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' : name.endsWith('styles.xml') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml' : name.endsWith('settings.xml') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml' : name.endsWith('.rels') ? 'application/vnd.openxmlformats-package.relationships+xml' : 'application/vnd.openxmlformats-officedocument.theme+xml';
  parts.push({ name: '[Content_Types].xml', data: `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${parts.filter(p => !p.name.endsWith('.rels')).map(p => `<Override PartName="/${p.name}" ContentType="${type(p.name)}"/>`).join('')}</Types>` });
  parts.push({ name: '_rels/.rels', data: `<Relationships xmlns="${REL}"><Relationship Id="r" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>` });
  return buildStoredZip(transformParts(parts));
}
async function preview(bytes) {
  const [bridge, envelope] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const payload = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  assert.equal(payload.issue, null);
  const doc = payload.doc;
  // Plain text is the canonical result when no supported formatting remains.
  const nodes = doc ? doc.content.flatMap(p => p.content || []) : [{ type: 'text', text: payload.text }];
  return { report, plan, doc, nodes, families: nodes.map(n => n.marks?.find(m => m.type === 'textStyle')?.attrs.fontFamily ?? null) };
}
const hasLoss = plan => plan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_TYPOGRAPHY_NOT_IMPORTED');

test('C1 theme fonts: Word defaults resolve for actual Latin Cyrillic and Greek text', async () => {
  const value = await preview(pack());
  assert.deepEqual(value.families, ['Aptos']);
  assert.equal(value.nodes.map(n => n.text).join(''), 'Latin Шрифт Ω');
  assert.equal(value.nodes[0].marks.find(m => m.type === 'textStyle').attrs.fontSize, '12pt');
  assert.equal(hasLoss(value.plan), false);
});

test('C1 theme fonts: DrawingML alias resolves inside the admitted theme part', async () => {
  const value = await preview(pack({ theme: themeXml().replaceAll('a:', 'd:').replace('xmlns:a=', 'xmlns:d=') }));
  assert.deepEqual(value.families, ['Aptos']);
});

test('C1 theme fonts: same-element theme and later literal override have distinct precedence', async () => {
  const sameElement = literal('Georgia').replace('/>', ' w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi"/>');
  const body = `<w:p>${run('one', sameElement)}${run('two', literal('Courier New'))}${run('three', '<w:rFonts w:ascii="Georgia"/>')}</w:p>`;
  const value = await preview(pack({ body }));
  assert.deepEqual(value.families, ['Aptos Display', 'Courier New', 'Georgia']);
  assert.equal(hasLoss(value.plan), false);
});

test('C1 theme fonts: unresolved East Asian face retains text and explicit loss', async () => {
  const value = await preview(pack({ text: '漢字' }));
  assert.deepEqual(value.families, [null]);
  assert.equal(value.nodes.map(n => n.text).join(''), '漢字');
  assert.equal(hasLoss(value.plan), true);
});

test('C1 theme fonts: missing theme does not guess a font', async () => {
  const value = await preview(pack({ theme: '' }));
  assert.deepEqual(value.families, [null]);
  assert.equal(hasLoss(value.plan), true);
});


test('C1 theme fonts: existing intake quarantines unadmitted theme locations', async () => {
  const [bridge] = await modules;
  for (const target of ['fonts/chosen.xml', 'theme/theme2.xml']) {
    const report = bridge.buildDocxContentPreviewFromZipBytes(pack({ target }));
    assert.equal(report.ok, false);
    assert.equal(report.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
    assert.equal(report.parse.attempted, false);
  }
});

test('C1 theme fonts: unresolved unused script does not erase a known actual Latin selection', async () => {
  const properties = literal('Georgia').replace('/>', ' w:cstheme="minorBidi"/>');
  const latin = await preview(pack({ body: `<w:p>${run('Latin', properties)}</w:p>`, theme: '', styles: '' }));
  assert.deepEqual(latin.families, ['Georgia']);
  assert.equal(hasLoss(latin.plan), false);
  const complex = await preview(pack({ body: `<w:p>${run('Latin', properties + '<w:cs/>')}</w:p>`, theme: '', styles: '' }));
  assert.deepEqual(complex.families, [null]);
  assert.equal(hasLoss(complex.plan), true);
});

test('C1 theme fonts: all eight tokens select their own major/minor script face', async () => {
  const theme = themeXml().replace('<a:ea typeface=""/>', '<a:ea typeface="MS Mincho"/>')
    .replace('<a:cs typeface=""/>', '<a:cs typeface="Times New Roman"/>')
    .replace('<a:ea typeface=""/>', '<a:ea typeface="Yu Mincho"/>')
    .replace('<a:cs typeface=""/>', '<a:cs typeface="Arial"/>');
  for (const [token, font] of Object.entries({ majorAscii: 'Aptos Display', majorHAnsi: 'Aptos Display', majorEastAsia: 'MS Mincho', majorBidi: 'Times New Roman', minorAscii: 'Aptos', minorHAnsi: 'Aptos', minorEastAsia: 'Yu Mincho', minorBidi: 'Arial' })) {
    const value = await preview(pack({ text: 'ASCII', styles: defaults(themed(token)), theme }));
    assert.deepEqual(value.families, [font], token);
    assert.equal(hasLoss(value.plan), false, token);
  }
});

test('C1 theme fonts: settings language selects a supplemental script, not the text language', async () => {
  const theme = themeXml('<a:font script="Cyrl" typeface="Cambria"/><a:font script="Grek" typeface="Georgia"/><a:font script="Jpan" typeface="Yu Mincho"/><a:font script="Arab" typeface="Arial"/>');
  for (const [text, properties, settings, font] of [
    ['Latin', '', '<w:themeFontLang w:val="ru-FI"/>', 'Cambria'],
    ['Шрифт', '', '<w:themeFontLang w:val="en-Grek"/>', 'Georgia'],
    ['漢字', '', '<w:themeFontLang w:eastAsia="ja-JP"/>', 'Yu Mincho'],
    ['Latin', '<w:cs/>', '<w:themeFontLang w:bidi="ar-SA"/>', 'Arial'],
  ]) {
    const value = await preview(pack({ body: `<w:p>${run(text, properties)}</w:p>`, theme, settings }));
    assert.deepEqual(value.families, [font]);
    assert.equal(hasLoss(value.plan), false);
  }
  for (const language of ['zz-ZZ', 'zh']) {
    const value = await preview(pack({ theme, settings: `<w:themeFontLang w:val="${language}"/>` }));
    assert.deepEqual(value.families, [null]);
    assert.equal(hasLoss(value.plan), true);
  }
});

test('C1 theme fonts: mixed runs inspect every character and retain unresolved emoji and CJK losses', async () => {
  for (const text of ['Latin漢字', 'Latin😀', '😀Latin', 'Latin👩‍💻']) {
    const value = await preview(pack({ text }));
    assert.equal(value.nodes.map(n => n.text).join(''), text);
    assert.deepEqual(value.families, [null], text);
    assert.equal(hasLoss(value.plan), true, text);
  }
  const theme = themeXml().replaceAll('<a:ea typeface=""/>', '<a:ea typeface="Aptos"/>');
  const value = await preview(pack({ text: 'Latin漢字😀', theme }));
  assert.deepEqual(value.families, ['Aptos']);
  assert.equal(hasLoss(value.plan), false);
});

test('C1 theme fonts: forced script flags cascade with explicit off and hints stay conservative', async () => {
  const theme = themeXml().replaceAll('<a:cs typeface=""/>', '<a:cs typeface="Arial"/>');
  for (const flag of ['cs', 'rtl']) {
    const value = await preview(pack({ theme, styles: defaults(themed('minorHAnsi') + `<w:${flag}/>`), body: `<w:p>${run('a')}${run('b', `<w:${flag} w:val="0"/>`)}</w:p>` }));
    assert.deepEqual(value.families, ['Arial', 'Aptos']);
  }
  for (const hint of ['eastAsia', 'cs']) {
    const value = await preview(pack({ body: `<w:p>${run('Latin', `<w:rFonts w:hint="${hint}"/>`)}</w:p>` }));
    assert.deepEqual(value.families, [null]);
    assert.equal(hasLoss(value.plan), true);
  }
});

test('C1 theme fonts: themed defaults respect paragraph and character style inheritance', async () => {
  const styles = defaults(themed('minorHAnsi'))
    + `<w:style w:type="paragraph" w:styleId="P"><w:rPr>${themed('majorHAnsi')}</w:rPr></w:style>`
    + '<w:style w:type="paragraph" w:styleId="Child"><w:basedOn w:val="P"/></w:style>'
    + `<w:style w:type="character" w:styleId="C"><w:rPr>${literal('Georgia')}</w:rPr></w:style>`;
  const body = `<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr>${run('one')}${run('two', '<w:rStyle w:val="C"/>')}${run('three', `<w:rStyle w:val="C"/>${themed('minorHAnsi')}`)}</w:p>`;
  const value = await preview(pack({ styles, body }));
  assert.deepEqual(value.families, ['Aptos Display', 'Georgia', 'Aptos']);
});

test('C1 theme fonts: absent relationship does not confer authority on an orphan theme part', async () => {
  const value = await preview(pack({ transformParts: parts => parts.map(p => p.name === 'word/_rels/document.xml.rels'
    ? { ...p, data: p.data.replace(/<Relationship Id="t"[^>]*\/>/u, '') } : p) }));
  assert.deepEqual(value.families, [null]);
  assert.equal(hasLoss(value.plan), true);
});

test('C1 theme fonts: unqualified diagnostic-only relationships never select a theme', async () => {
  const value = await preview(pack({ transformParts: parts => parts.map(p => p.name === 'word/_rels/document.xml.rels'
    ? { ...p, data: p.data.replace(` xmlns="${REL}"`, '') } : p) }));
  assert.deepEqual(value.families, [null]);
  assert.equal(hasLoss(value.plan), true);
});

test('C1 theme fonts: malformed, duplicate and hostile theme values block preview', async () => {
  const [bridge] = await modules;
  const themes = [
    themeXml().replace('typeface="Aptos"', 'typeface="Arial; color:red"'),
    themeXml().replace('typeface="Aptos"', 'typeface="url(x)"'),
    themeXml().replace('<a:latin typeface="Aptos"/>', '<a:latin/>'),
    themeXml().replace('<a:latin typeface="Aptos"/>', '<a:latin typeface="Aptos"/><a:latin typeface="Georgia"/>'),
    themeXml('<a:font script="Cyrl" typeface="Georgia"/><a:font script="Cyrl" typeface="Arial"/>'),
    themeXml('<a:font script="invalid" typeface="Georgia"/>'),
    themeXml().replace('</a:minorFont>', '</a:majorFont>'),
    themeXml().replace(`xmlns:a="${A}"`, 'xmlns:a="urn:foreign"'),
    '<!DOCTYPE x [<!ENTITY face "Georgia">]>' + themeXml(),
    themeXml() + themeXml(),
  ];
  for (const theme of themes) assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack({ theme })).ok, false, theme);
  for (const properties of ['<w:rFonts w:asciiTheme="unknown"/>', '<w:rFonts w:asciiTheme=""/>', '<w:rFonts w:hint="unknown"/>', '<w:cs w:val="yes"/>']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack({ body: `<w:p>${run('Latin', properties)}</w:p>` })).ok, false, properties);
  }
});

test('C1 theme fonts: ambiguous or external selected relationships cannot grant part access', async () => {
  const [bridge] = await modules;
  for (const change of [
    xml => xml.replace('</Relationships>', `<Relationship Id="t2" Type="${OFFICE}/theme" Target="theme/theme1.xml"/></Relationships>`),
    xml => xml.replace('Target="theme/theme1.xml"', 'Target="https://example.invalid/theme.xml" TargetMode="External"'),
    xml => xml.replace('Target="theme/theme1.xml"', 'Target="../../../theme.xml"'),
    xml => xml.replace('Target="theme/theme1.xml"', 'Target="theme/theme1.xml#fragment"'),
    xml => xml.replace('Target="theme/theme1.xml"', 'Target="theme/missing.xml"'),
  ]) {
    const bytes = pack({ transformParts: parts => parts.map(p => p.name === 'word/_rels/document.xml.rels' ? { ...p, data: change(p.data) } : p) });
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bytes).ok, false);
  }
});

test('C1 theme fonts: malformed and duplicate language settings block while namespace aliases resolve', async () => {
  const [bridge] = await modules;
  for (const settings of ['<w:themeFontLang w:val="../ru"/>', '<w:themeFontLang w:val="ru"/><w:themeFontLang w:val="en"/>']) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack({ settings })).ok, false, settings);
  }
  const value = await preview(pack({ settings: `<v:themeFontLang xmlns:v="${W}" v:val="ru-FI"/>`, relationshipPrefix: 'r' }));
  assert.deepEqual(value.families, ['Aptos']);
});
