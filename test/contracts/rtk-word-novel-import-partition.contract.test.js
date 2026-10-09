const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const v8 = require('node:v8');
const { isDeepStrictEqual } = require('node:util');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createDocxImportLocalFilePreview, DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES } = require('../../src/utils/docxImportLocalFilePreview.js');
const REPO_ROOT = path.resolve(__dirname, '../..'), MAIN_PATH = path.join(REPO_ROOT, 'src/main.js');
const SECTION_START = '// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_START', SECTION_END = '// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_END';
const readSource = p => fs.readFileSync(p, 'utf8');
const cloneJsonSafe = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const isPlainObjectValue = x => !!x && typeof x === 'object' && !Array.isArray(x);
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const anchors = require('../../src/core/word-comment-anchor-save-v1.cjs');
const sections = require('../../src/core/word-sections-v1.cjs');
const tx = require('../../src/core/project-transaction-v1.cjs');
const safe = require('../../src/utils/docxImportSafeCreate.js');
const realAuthority = require('../fixtures/docx-import-real-authority.cjs');
const modelPromise = import('../../src/core/project-tree-cohort-v1.mjs');
function equal(actual,expected,message) { assert.ok(isDeepStrictEqual(cloneJsonSafe(actual),cloneJsonSafe(expected)),message); }
function typedFailure(fn,pattern) { assert.throws(fn,error=>typeof error.code==='string' && pattern.test(error.code)); }
function namedFunction(source,name) { const start=source.indexOf(`async function ${name}(`)>=0?source.indexOf(`async function ${name}(`):source.indexOf(`function ${name}(`);assert.ok(start>=0,`actual ${name}`);const next=source.slice(start+1).search(/\n(?:async )?function /);assert.ok(next>=0);return source.slice(start,start+1+next); }
function extractMarkedSection(s,a,b) { const start=s.indexOf(a), end=s.indexOf(b); assert.ok(start>=0 && end>start); return s.slice(start,end+b.length); }
function retain(name,value) { const root=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR; if(root) { fs.mkdirSync(root,{recursive:true}); fs.writeFileSync(path.join(root,name+'.v8'),v8.serialize(value)); } }
const W_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function novelBytes(count, options={}) {
  const O='http://schemas.openxmlformats.org/officeDocument/2006/relationships', P='http://schemas.openxmlformats.org/package/2006/relationships';
  const paragraphs=Array.from({length:count},(_,i)=>`<w:p>${i===0?'<w:commentRangeStart w:id="0"/>':''}<w:r><w:t>Paragraph ${i} Ж🧭</w:t></w:r>${i===0?'<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>':''}</w:p>`).join('');
  return buildStoredZip([
    {name:'[Content_Types].xml',data:`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>`},
    {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="d" Type="${O}/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}"><Relationship Id="c" Type="${O}/comments" Target="comments.xml"/></Relationships>`},
    {name:'word/document.xml',data:`<w:document xmlns:w="${W_NS}"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`},
    {name:'word/comments.xml',data:`<w:comments xmlns:w="${W_NS}"><w:comment w:id="0" w:author="Editor" w:date="2026-10-09T00:00:00Z"><w:p><w:r><w:t>Complete root discussion</w:t></w:r></w:p></w:comment></w:comments>`},
  ]);
}
function instantiateDocxImportLocalFilePreviewCommandPort(options = {}) {
  const section = extractMarkedSection(readSource(MAIN_PATH), SECTION_START, SECTION_END);
  const calls = {
    showOpenDialog: [],
    showMessageBox: [],
    stat: [],
    readFile: [],
    rememberAdmission: [],
  };
  const references = require('../../src/utils/docxImportPreviewReferences').createDocxImportPreviewReferences();
  const sandbox = {
    rememberDocxImportPreviewReference: (kind, value, context) => references.remember(kind, value, context),
    Buffer,
    crypto: require('node:crypto'), currentProjectName: 'Project', DEFAULT_PROJECT_NAME: 'Project',
    getProjectManifestPath: () => '/trusted/project.craftsman.json',
    captureDocxImportPreviewContext: options.captureContext || (() => 'project-context'),
    userBookmarkCapability: () => {},
    readDocxImportAttempt: options.readAttempt || (async () => ({ record: null, sha256: null })),
    calls,
    cloneJsonSafe,
    createDocxImportLocalFilePreview: Object.prototype.hasOwnProperty.call(
      options,
      'createDocxImportLocalFilePreview',
    )
      ? options.createDocxImportLocalFilePreview
      : createDocxImportLocalFilePreview,
    dialog: {
      showMessageBox: async (...args) => {
        calls.showMessageBox.push(cloneJsonSafe(args));
        return options.showMessageBox ? options.showMessageBox(...args) : { response: options.choice ?? 0 };
      },
      showOpenDialog: async (...args) => {
        calls.showOpenDialog.push(cloneJsonSafe(args));
        if (typeof options.showOpenDialog === 'function') {
          return options.showOpenDialog(...args);
        }
        return options.dialogResult || { canceled: true };
      },
    },
    DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    fileManager: {
      getDocumentsPath: () => (
        typeof options.documentsPath === 'string' ? options.documentsPath : os.tmpdir()
      ),
    },
    fs: {
      stat: async (filePath) => {
        calls.stat.push(filePath);
        if (typeof options.stat === 'function') return options.stat(filePath);
        return {
          size: Number.isInteger(options.size)
            ? options.size
            : Buffer.isBuffer(options.bytes)
              ? options.bytes.length
              : Buffer.byteLength(String(options.bytes || '')),
          isFile: () => options.isFile !== false,
        };
      },
      readFile: async (filePath) => {
        if (filePath === '/trusted/project.craftsman.json') return JSON.stringify({projectId:'project-a'});
        calls.readFile.push(filePath);
        if (typeof options.readFile === 'function') return options.readFile(filePath);
        return Buffer.from(options.bytes || '');
      },
    },
    getProjectRootPath: () => (
      typeof options.projectRoot === 'string'
        ? options.projectRoot
        : path.join(os.tmpdir(), 'docx-local-command-project-root')
    ),
    isPlainObjectValue,
    readExternalFileBounded: async (filePath, readOptions = {}) => {
      const bytes = await sandbox.fs.readFile(filePath);
      const byteLength = Buffer.isBuffer(bytes) ? bytes.length : Buffer.byteLength(String(bytes || ''));
      if (Number.isInteger(readOptions.maxBytes) && byteLength > readOptions.maxBytes) {
        const error = new Error('EXTERNAL_SOURCE_TOO_LARGE');
        error.code = 'E_EXTERNAL_FILE_AUTHORITY';
        error.reason = 'EXTERNAL_SOURCE_TOO_LARGE';
        error.details = { maxBytes: readOptions.maxBytes, actualBytes: byteLength };
        throw error;
      }
      if (Number.isInteger(readOptions.expectedBytes) && readOptions.expectedBytes !== byteLength) {
        const error = new Error('EXTERNAL_SOURCE_CHANGED_DURING_READ');
        error.code = 'E_EXTERNAL_FILE_AUTHORITY';
        error.reason = 'EXTERNAL_SOURCE_CHANGED_DURING_READ';
        throw error;
      }
      return { bytes: Buffer.from(bytes), byteLength };
    },
    rememberDocxImportPreviewPlanAdmission: typeof options.rememberAdmission === 'function'
      ? (plan) => {
          calls.rememberAdmission.push(cloneJsonSafe(plan));
          return options.rememberAdmission(plan);
        }
      : (plan) => {
          calls.rememberAdmission.push(cloneJsonSafe(plan));
          return 'admitted-preview-plan';
        },
    mainWindow: options.mainWindow || {},
    module: { exports: {} },
    exports: {},
    path,
  };

  vm.runInNewContext(
    `${section}
module.exports = {
  calls,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID,
  findDocxImportLocalFilePreviewForbiddenKey,
  pickDocxImportLocalFilePreviewFile,
  readDocxImportLocalFilePreviewBytes,
  validateDocxImportLocalFilePreviewSuccessResult,
  buildDocxImportLocalFilePreviewCommandResult,
  handleDocxImportLocalFilePreviewCommandSurface,
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}


test('novel import: actual Main local preview carries the finite parser profile beyond 5000 annotated paragraphs', async () => {
  const bridge=await import('../../src/io/revisionBridge/index.mjs'), bytes=novelBytes(5001);
  const defaultReport=bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const productReport=bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:{maxBlocks:50000}});
  const tighter=bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:{maxBlocks:5000}});
  const malformed=bridge.buildDocxContentPreviewFromZipBytes(Buffer.from('not a ZIP'));
  const port=instantiateDocxImportLocalFilePreviewCommandPort({bytes,dialogResult:{canceled:false,filePaths:['/trusted/novel.docx']}});
  const actual=await port.handleDocxImportLocalFilePreviewCommandSurface({requestId:'novel-profile'});
  retain('causal-profile',{bytes,defaultReport,productReport,tighter,malformed,actual,calls:port.calls});
  assert.equal(defaultReport.ok,false,'default5000 remains bounded');
  assert.equal(tighter.ok,false,'explicit5000 remains bounded');
  assert.equal(malformed.ok,false,'malformed ZIP remains refused');
  assert.equal(productReport.ok,true,'existing finite product blocks accept this complete source');
  assert.equal(actual.contentPreviewOk,true,`actual Main local preview: ${actual.code || actual.error?.code}`);
  assert.equal(actual.importPreviewOk,true,'complete novel candidate is ready');
  assert.ok(actual.docxImportPreviewPlan.candidateCreatePlan.entries.length>1,'large source becomes several scenes');
  assert.equal(port.calls.rememberAdmission.length,0,'local read publishes a content reference; admission belongs to previewImportPlan');
  assert.equal(typeof actual.docxContentPreviewRef,'string','Main retains the complete source in its context-bound reference');
});

function richNovelBytes(count,{pendingText=false,notes=true,bookmark=false,spanningBookmark=false,crossLink=false,listChain=false,continuation=false,section='',story=false,inflate=0}={}) {
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships', P='http://schemas.openxmlformats.org/package/2006/relationships';
  const W14='http://schemas.microsoft.com/office/word/2010/wordml', W15='http://schemas.microsoft.com/office/word/2012/wordml';
  const body=Array.from({length:count},(_,i)=>{
    const heading=i>0 && i%6===0, list=!pendingText && (listChain?(i===0 || i===4):(i===7 || i===8));
    const properties=heading?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':list?(!listChain && continuation && i===8?'<w:pPr><w:pStyle w:val="ListContinuation"/></w:pPr>':'<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'):'';
    let run=i===3?'':`<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="he-IL"/>${i%2?'<w:b/>':'<w:i/>'}</w:rPr><w:t xml:space="preserve"> ${heading?'Chapter':'Body'} ${i} Ж🧭漢字 אב ${'я'.repeat(i>=6 && i<count-2?inflate:0)} </w:t>${i===4?'<w:br/><w:t>after hard break</w:t>':''}</w:r>`;
    if(pendingText && i===1) run+='<w:ins w:id="71" w:author="Writer" w:date="2026-10-09T00:00:01Z"><w:r><w:t>inserted🧭</w:t></w:r></w:ins>';
    if(pendingText && i===4) run+='<w:del w:id="72" w:author="Editor" w:date="2026-10-09T00:00:02Z"><w:r><w:delText>deletedЖ</w:delText></w:r></w:del>';
    if(pendingText && i===count-2) run+='<w:r><w:rPr><w:b/><w:rPrChange w:id="73" w:author="Corrector" w:date="2026-10-09T00:00:03Z"><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr><w:t>format change</w:t></w:r>';
    if(notes && i===1) run+='<w:r><w:footnoteReference w:id="7"/></w:r>';
    if(notes && i===count-2) run+='<w:r><w:endnoteReference w:id="8"/></w:r>';
    if(bookmark && i===count-1) run='<w:bookmarkStart w:id="9" w:name="FinalAnchor"/>'+run+'<w:bookmarkEnd w:id="9"/><w:hyperlink w:anchor="FinalAnchor"><w:r><w:t>local link</w:t></w:r></w:hyperlink>';
    if(spanningBookmark && i===1) run='<w:bookmarkStart w:id="10" w:name="SpanningAnchor"/>'+run;
    if(spanningBookmark && i===6) run+='<w:bookmarkEnd w:id="10"/>';
    if(crossLink && i===0) run+='<w:hyperlink w:anchor="FinalAnchor"><w:r><w:t>cross-scene link</w:t></w:r></w:hyperlink>';
    return `<w:p>${properties}${i===2?'<w:commentRangeStart w:id="0"/>':''}${i===count-1?'<w:commentRangeStart w:id="2"/>':''}${run}${i===5?'<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>':''}${i===count-1?'<w:commentRangeEnd w:id="2"/><w:r><w:commentReference w:id="2"/></w:r>':''}</w:p>`;
  }).join('');
  const types=['document','comments','commentsExtended','styles','numbering',...(notes?['footnotes','endnotes']:[]),...(story?['header1']:[])];
  const contentType=n=>n==='document'?'document.main':n==='commentsExtended'?'commentsExtended':n==='header1'?'header':n;
  const relation=n=>n==='commentsExtended'?'http://schemas.microsoft.com/office/2011/relationships/commentsExtended':R+'/'+(n==='header1'?'header':n);
  const note=(kind,id)=>`<w:${kind}s xmlns:w="${W_NS}"><w:${kind} w:id="${id}"><w:p><w:r><w:${kind}Ref/></w:r><w:r><w:rPr><w:b/><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="he-IL"/></w:rPr><w:t xml:space="preserve"> Note Ж🧭 </w:t><w:br/><w:t>second line</w:t></w:r></w:p><w:p/></w:${kind}></w:${kind}s>`;
  const comments=[['00000010','Editor','Root Ж🧭'],['00000011','Corrector','Reply 漢字'],['00000012','Writer','Last אב']].map(([id,author,txt],i)=>`<w:comment w:id="${i}" w:author="${author}" w:initials="${author[0]}" w:date="2026-10-09T00:00:0${i}.123Z"><w:p w14:paraId="${id}"><w:r><w:rPr><w:b/></w:rPr><w:t>${txt}</w:t></w:r></w:p></w:comment>`).join('');
  return buildStoredZip([
    {name:'[Content_Types].xml',data:`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${types.map(n=>`<Override PartName="/word/${n}.xml" ContentType="${n==='commentsExtended'?'application/vnd.ms-word.commentsExtended+xml':'application/vnd.openxmlformats-officedocument.wordprocessingml.'+contentType(n)+'+xml'}"/>`).join('')}</Types>`},
    {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="d" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}">${types.filter(n=>n!=='document').map(n=>`<Relationship Id="${n}" Type="${relation(n)}" Target="${n}.xml"/>`).join('')}</Relationships>`},
    {name:'word/document.xml',data:`<w:document xmlns:w="${W_NS}" xmlns:r="${R}"><w:body>${body}${pendingText?'':`<w:sectPr>${story?'<w:headerReference w:type="default" r:id="header1"/>':''}<w:pgSz w:w="11906" w:h="16838"/>${section}</w:sectPr>`}</w:body></w:document>`},
    {name:'word/comments.xml',data:`<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14}">${comments}</w:comments>`},
    {name:'word/commentsExtended.xml',data:`<w15:commentsEx xmlns:w15="${W15}"><w15:commentEx w15:paraId="00000010" w15:done="0"/><w15:commentEx w15:paraId="00000011" w15:paraIdParent="00000010" w15:done="0"/><w15:commentEx w15:paraId="00000012" w15:done="0"/></w15:commentsEx>`},
    {name:'word/styles.xml',data:`<w:styles xmlns:w="${W_NS}"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ListContinuation"><w:name w:val="Yalken List Continuation 0"/></w:style></w:styles>`},
    {name:'word/numbering.xml',data:`<w:numbering xmlns:w="${W_NS}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`},
    ...(notes?[{name:'word/footnotes.xml',data:note('footnote','7')},{name:'word/endnotes.xml',data:note('endnote','8')}]:[]),
    ...(story?[{name:'word/header1.xml',data:`<w:hdr xmlns:w="${W_NS}"><w:p><w:r><w:t>owned header</w:t></w:r></w:p></w:hdr>`}]:[]),
  ]);
}
async function tinyPlan(count,options={},policy={targetParagraphs:4}) {
  const bridge=await import('../../src/io/revisionBridge/index.mjs'), bytes=richNovelBytes(count,options);
  const report=bridge.buildDocxContentPreviewFromZipBytes({bytes,budgets:{maxBlocks:50000}});
  retain(`tiny-input-${count}-${options.pendingText?'pending':'ordinary'}`,{bytes,options,report});
  assert.equal(report.ok,true,`tiny real DOCX parse: ${report.reason || report.code}`);
  const combined=bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(combined.ok,true,`tiny combined plan: ${combined.reason || combined.code}`);
  const plan=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(report,policy);
  return Object.defineProperty({bytes,report,combined,plan},'bridge',{value:bridge});
}
function assertConserved(f) {
  const candidate=f.plan.candidateCreatePlan, source=envelope.parseObservablePayload(candidate.sourceCandidate.content).doc;
  const sourceLedger=pending.readLedger(source), sourceRoots=(sourceLedger?.source || source).content;
  const docs=candidate.entries.map(e=>envelope.parseObservablePayload(e.content).doc);
  const outputRoots=docs.flatMap(d=>(pending.readLedger(d)?.source || d).content);
  equal(outputRoots,sourceRoots,'every complete rich root is preserved once in source order');
  for(let i=0;i<candidate.entries.length;i++) {
    const e=candidate.entries[i], p=e.partition;
    assert.equal(e.candidateContentSha256,sha(e.content));
    assert.equal(p.rootFrom,i?candidate.entries[i-1].partition.rootTo:0);
    assert.equal(p.leafFrom,i?candidate.entries[i-1].partition.leafTo:0);
    assert.equal(!!sections.read(docs[i]),!!sections.read(source) && i===docs.length-1,'only real final registry belongs to last scene');
    const expectedNotes=(candidate.sourceCandidate.notes || []).filter(n=>n.paragraphIndex>=p.leafFrom && n.paragraphIndex<p.leafTo)
      .map(n=>({...cloneJsonSafe(n),paragraphIndex:n.paragraphIndex-p.leafFrom}));
    equal(e.notes || [],expectedNotes,'full rich note bodies and points conserve ownership');
    if(sourceLedger) {
      const expected=sourceLedger.revisions.filter(r=>r.paragraphIndex>=p.leafFrom&&r.paragraphIndex<p.leafTo).map(r=>{
        const row=cloneJsonSafe(r);row.paragraphIndex-=p.leafFrom;
        if(row.structure)row.structure.tableIndex-=sourceRoots.slice(0,p.rootFrom).filter(n=>n.type==='table').length;
        return row;
      });
      equal(pending.readLedger(docs[i]).revisions,expected,'complete pending identities, author/date/group/format/boundary fields are rebased exactly');
    }
    const expectedComments=(candidate.sourceCandidate.comments || []).filter(c=>c.paragraphIndex>=p.leafFrom && c.paragraphIndex<p.leafTo)
      .map(c=>{const x=cloneJsonSafe(c);x.paragraphIndex-=p.leafFrom;if(x.endParagraphIndex!==undefined)x.endParagraphIndex-=p.leafFrom;delete x.pendingUnionLocator;return x;});
    equal((e.comments || []).map(c=>{const x=cloneJsonSafe(c);delete x.pendingUnionLocator;return x;}),expectedComments,'full roots/replies/formatting/provenance and rebased ranges conserve ownership');
    for(const c of e.comments || []) assert.ok((c.endParagraphIndex ?? c.paragraphIndex)<p.leafTo-p.leafFrom,'protected complete range stays inside its scene');
    for(const c of e.comments || []) if(c.pendingUnionLocator) {
      const binding=pending.buildCommentExportBinding({document:docs[i]}),ranges=require('../../src/core/word-comment-ranges-v1.cjs');
      const input={paragraphIndex:c.paragraphIndex,startUtf16:c.startUtf16,selectedText:c.selectedText,
        ...(c.kind===ranges.MULTI?{kind:c.kind,endParagraphIndex:c.endParagraphIndex,endUtf16:c.endUtf16}:c.kind==='point'?{kind:'point',affinity:'right'}:{})};
      const anchor=ranges.deriveCommentAnchor({sceneId:'generic-preview',paragraphs:anchors.paragraphs(e.content),input});
      const checked=pending.validateCommentUnionLocator({projection:binding.projection,anchor,locator:c.pendingUnionLocator});
      equal(checked,c.pendingUnionLocator,'actual local pending export binding validates the full regenerated union locator');
      const forged={...c.pendingUnionLocator,geometrySha256:'f'.repeat(64)};
      typedFailure(()=>pending.validateCommentUnionLocator({projection:binding.projection,anchor,locator:forged}),/^PENDING_COMMENT_LOCATOR_STALE$/);
    }
  }
  if(sourceLedger) for(const mode of ['current','original']) assert.equal(docs.map(d=>pending.projection(d)[mode]).join('\n'),pending.projection(source)[mode],`complete pending ${mode} view`);
  else equal(docs.flatMap(bookmarks.paragraphs).map(bookmarks.textOf),bookmarks.paragraphs(source).map(bookmarks.textOf),'full visible paragraph/hardBreak/empty/Unicode corpus');
}
test('novel import: tiny10/20/40 rich DOCX conserves all roots, ranges, replies, notes and local links',async()=>{
  const outcomes=[];
  for(const count of [10,20,40]) {
    const f=await tinyPlan(count,{bookmark:true}), before=cloneJsonSafe(f.report);
    assert.equal(f.plan.ok,true,`novel partition ${count}: ${f.plan.reason || f.plan.code}`);
    assert.ok(f.plan.candidateCreatePlan.entries.length>1);
    assertConserved(f);
    equal(f.report,before,'actual source report remains immutable');
    const docs=f.plan.candidateCreatePlan.entries.map(e=>envelope.parseObservablePayload(e.content).doc);
    assert.equal(docs.filter(d=>bookmarks.readRegistry(d)?.bookmarks.length).length,1,'bookmark and link kept together');
    outcomes.push(f);
  }
  const span=await tinyPlan(20,{spanningBookmark:true});assert.equal(span.plan.ok,true);assertConserved(span);
  const owner=span.plan.candidateCreatePlan.entries.find(e=>bookmarks.readRegistry(envelope.parseObservablePayload(e.content).doc)?.bookmarks.length);
  assert.ok(owner.partition.leafFrom<=1 && owner.partition.leafTo>6,'overlapping comment and bookmark intervals move the cut to closure');
  outcomes.push(span);
  const continued=await tinyPlan(20,{continuation:true,notes:false});assert.equal(continued.plan.ok,true);assertConserved(continued);outcomes.push(continued);
  retain('rich10-20-40',outcomes);
});
test('novel import: supported absent-section pending insert/delete/format preserves independent Current and Original',async()=>{
  const outcomes=[];
  for(const count of [10,20,40]) {
    const f=await tinyPlan(count,{pendingText:true,notes:false});
    assert.equal(f.plan.ok,true,`pending partition ${count}: ${f.plan.reason || f.plan.code}`);
    assertConserved(f);
    const docs=f.plan.candidateCreatePlan.entries.map(e=>envelope.parseObservablePayload(e.content).doc);
    assert.notEqual(docs.map(d=>pending.projection(d).current).join('\n'),docs.map(d=>pending.projection(d).original).join('\n'));
    assert.equal(docs.flatMap(d=>pending.readLedger(d).revisions).length,3,'all insert/delete/format identities remain');
    outcomes.push(f);
  }
  retain('pending10-20-40',outcomes);
  const bridge=await import('../../src/io/revisionBridge/index.mjs'), bytes=richNovelBytes(10,{pendingText:true,notes:true});
  const report=bridge.buildDocxContentPreviewFromZipBytes(bytes), refused=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(report,{targetParagraphs:4});
  retain('pending-plus-notes-refusal',{bytes,report,refused});
  assert.equal(refused.ok,false,'source-wide pending+notes remains refused');
});
test('novel import: bounded or unsupported section/story/link/span/source inputs refuse without altering the source',async()=>{
  const m=await modelPromise, f=await tinyPlan(20,{notes:false}), c=f.combined.candidateCreatePlan, artifact=f.combined.source.sourceArtifactSha256;
  const cases=[];
  for(const opts of [{section:'<w:pgMar w:left="1800"/>'},{section:'<w:docGrid w:type="lines" w:linePitch="360"/>'},{story:true},{bookmark:true,crossLink:true}]) {
    const bytes=richNovelBytes(20,{...opts,notes:false}), report=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);
    const plan=f.bridge.buildDocxNovelImportPreviewPlanFromContentPreview(report,{targetParagraphs:4});
    assert.equal(plan.ok,false,'nondefault/grid/story is typed blocked');cases.push({bytes,report,plan});
  }
  for(const [candidate,hash,policy] of [[c,'f'.repeat(64),{targetParagraphs:4,maxScenes:1}], [c,artifact,{targetParagraphs:4,maxSceneUtf16:20}], [c,artifact,{targetParagraphs:4,maxSceneBytes:20}], [c,artifact,{targetParagraphs:0}]])
    typedFailure(()=>m.partitionDocxImportCandidate(candidate,hash,policy),/^E_DOCX_NOVEL_/);
  const forged=cloneJsonSafe(c);forged.entries[0].candidateContentSha256='a'.repeat(64);
  typedFailure(()=>m.partitionDocxImportCandidate(forged,artifact,{targetParagraphs:4}),/^E_DOCX_NOVEL_SOURCE_SHA$/);
  const overlap=cloneJsonSafe(c);overlap.entries[0].comments[0].endParagraphIndex=999;
  typedFailure(()=>m.partitionDocxImportCandidate(overlap,artifact,{targetParagraphs:4}),/^E_DOCX_NOVEL_RANGE$/);
  const sourceBefore=cloneJsonSafe(c);m.partitionDocxImportCandidate(c,artifact,{targetParagraphs:4});equal(c,sourceBefore,'negative/positive calls cannot mutate input');
  const small=await tinyPlan(10,{notes:false}), optional=cloneJsonSafe(small.combined.candidateCreatePlan);
  delete optional.entries[0].candidateContentSha256;
  assert.equal(m.partitionDocxImportCandidate(optional,undefined),optional,'legacy small optional artifact/content SHA remains untouched');
  equal(small.bridge.buildDocxNovelImportPreviewPlanFromContentPreview(small.report),small.combined,'small Main opt-in and default combined plan stay equal');
  retain('refusal-corpus',{f,cases,forged,overlap,optional});
});

function captureActualInventory(root) {
  const source=readSource(MAIN_PATH), sandbox={fs:fsp,path,computeHash:sha,
    treeCohortError:code=>Object.assign(Error(code),{code}),module:{exports:{}}};
  vm.runInNewContext(namedFunction(source,'readTreeCohortPath')+'\n'+namedFunction(source,'captureTreeCohortInventory')+'\nmodule.exports=captureTreeCohortInventory;',sandbox);
  return sandbox.module.exports(root);
}
function snapshotFiles(root) {
  const out={};const walk=p=>{for(const name of fs.readdirSync(p).sort()){const full=path.join(p,name),s=fs.lstatSync(full);if(s.isDirectory())walk(full);else if(s.isFile())out[path.relative(root,full).split(path.sep).join('/')]=fs.readFileSync(full);else out[path.relative(root,full)]={symlink:fs.readlinkSync(full)};}};walk(root);return out;
}
async function projectFixture(t,name='project',fixtureOptions={}) {
  const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;
  const root=fs.mkdtempSync(path.join(evidence || os.tmpdir(),name+'-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const romanRoot=path.join(root,'roman');fs.mkdirSync(romanRoot);
  const manifestPath=path.join(root,'project.craftsman.json'), projectId='novel-test-project';
  const manifest={schemaVersion:'yalken.projectManifest.v1',projectId,projectName:'Novel',createdAtUtc:'2026-10-09T00:00:00.000Z',lastCommandId:0,
    treeIdentity:{schemaVersion:1,nodes:{'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa':{bindingKey:'file:roman/Old.txt',kind:'scene',present:true}}}};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest));fs.writeFileSync(path.join(romanRoot,'Old.txt'),'Old protected🧭');
  let privateDocument={schemaVersion:1,projectId,notes:[{id:'private-note',scope:'manuscript',title:'PRIVATE',body:'private exact Ж'},{id:'deleted-private',scope:'manuscript',title:'DELETED',body:'deleted exact',deleted:true}]};
  if(fixtureOptions.canonicalNotes) {
    privateDocument.notes.forEach(note=>{note.scope='project';});
    privateDocument=(await import('../../src/core/notesStorage.mjs')).normalizeNotesDocument(privateDocument,{projectId,now:()=> '2026-10-09T00:00:00.000Z'}).value;
  }
  fs.writeFileSync(path.join(root,'notes.craftsman.json'),JSON.stringify(privateDocument));
  const options=await realAuthority.withRealDocxImportAuthority({projectRoot:root,romanRoot,manifestPath,projectId,captureTreeCohortInventory:captureActualInventory});
  return {...options,root,original:snapshotFiles(root)};
}
async function mainProjectPort(f,options={}) {
  const source=readSource(MAIN_PATH), bridge=await import('../../src/io/revisionBridge/index.mjs');
  const createDocxImportPreviewReferences=require('../../src/utils/docxImportPreviewReferences.js').createDocxImportPreviewReferences;
  const calls={admissions:[],queues:[],continuity:0,capabilities:[],manifestPublication:[],helper:[],transactions:[]};
  const safePath=path.join(REPO_ROOT,'src/utils/docxImportSafeCreate.js'), {Module,createRequire}=require('node:module'), realRequire=createRequire(safePath);
  const observedModule=new Module(safePath);observedModule.filename=safePath;observedModule.paths=Module._nodeModulePaths(path.dirname(safePath));
  const observedRequire=name=>name==='../core/project-transaction-v1.cjs'?{...tx,commitProjectTransaction:async args=>{
    calls.transactions.push({manifestPath:args.manifestPath,revision:args.revision,treeCohort:args.treeCohort});retain('actual-cohort-before-commit',calls.transactions);
    return tx.commitProjectTransaction(args);
  }}:realRequire(name);
  observedModule.require=observedRequire;observedModule._compile(readSource(safePath),safePath);
  const intake=observedModule.exports;
  const sandbox={Buffer,crypto,path,fs:fsp,cloneJsonSafe,isPlainObjectValue,module:{exports:{}},currentProjectName:'Novel',DEFAULT_PROJECT_NAME:'Novel',
    currentFilePath:'',mainWindow:{id:'owned-window'},activeStage10ApplicationBootstrap:{id:'owned-bootstrap'},commentAuthoringSessionId:'owned-session',lastSignaledEditGeneration:0,
    isDirty:false,activePendingRecording:false,autoSaveInProgress:false,
    currentLifecycleSubjectId:()=> 'owned-subject',createDocxImportPreviewReferences,
    createDocxImportLocalFilePreview,DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    readExternalFileBounded:require('../../src/utils/externalFileAuthority.js').readExternalFileBounded,
    getProjectManifestPath:()=>f.manifestPath,fileManager:{getDocumentsPath:()=>f.root},
    dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[options.localPath]}),showMessageBox:async()=>({response:0})},
    readVerifiedProjectDocxNovelCohort:tx.readVerifiedProjectDocxNovelCohort,
    copyValidatedDocxUserBookmarkInventory:require('../../src/utils/docxImportLocalFilePreview.js').copyValidatedDocxUserBookmarkInventory,
    loadRevisionBridgeModule:async()=>bridge,loadDocumentContentEnvelopeModule:async()=>envelope,
    loadRtkNonTextReturnModule:()=>import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),userBookmarkModel:bookmarks,pendingTextRevisions:pending,
    rememberDocxImportPreviewPlanAdmission:plan=>{calls.admissions.push(cloneJsonSafe(plan));return intake.rememberDocxImportPreviewPlanAdmission(plan);},
    isDocxImportPreviewPlanAdmitted:intake.isDocxImportPreviewPlanAdmitted,applyDocxImportSafeCreate:async(...args)=>{const result=await intake.applyDocxImportSafeCreate(...args);calls.helper.push(cloneJsonSafe(result));return result;},
    readDocxImportAttempt:async args=>{const result=await intake.readDocxImportAttempt(args);if(options.afterAttempt)await options.afterAttempt(result,sandbox);return result;},acknowledgeDocxImportAttempt:intake.acknowledgeDocxImportAttempt,
    getProjectRootPath:()=>f.root,getProjectSectionPath:name=>path.join(f.root,name),
    ensureProjectStructure:async()=>{await fsp.mkdir(f.romanRoot,{recursive:true});if(options.afterAwait)await options.afterAwait(sandbox);},
    resolveProjectBindingForFile:async()=>({projectId:f.projectId,manifestPath:f.manifestPath,manifestRaw:await fsp.readFile(f.manifestPath,'utf8')}),
    recoverPendingWriterProjectTransaction:async()=>{const b=await tx.readPendingProjectTransactionBinding({manifestPath:f.manifestPath});assert.equal(b.pending,false,'no unresolved transaction bypass');},
    getMainProjectManifestAuthority:async()=>f.transactionAuthority,
    queueDiskOperation:async(op,label)=>{calls.queues.push(label);return op();},
    userBookmarkCapability:command=>{calls.capabilities.push(command);if(options.denyCapability)throw Error('DENIED');},
    computeHash:sha,treeCohortError:code=>Object.assign(Error(code),{code}),
    resolveProjectTreeNodeIdentity:async nodeId=>{const manifest=JSON.parse(await fsp.readFile(f.manifestPath,'utf8'));const node=manifest.treeIdentity.nodes[nodeId];return {filePath:path.join(f.root,node.bindingKey.slice(5))};},
    getResolvedTreeDocumentTarget:resolved=>resolved,
    requestEditorSnapshot:async()=>{const manifest=JSON.parse(await fsp.readFile(f.manifestPath,'utf8'));const nodeId=Object.keys(manifest.treeIdentity.nodes).find(k=>manifest.treeIdentity.nodes[k].bindingKey==='file:'+path.relative(f.root,sandbox.currentFilePath).split(path.sep).join('/'));
      const parsed=envelope.parseObservablePayload(await fsp.readFile(sandbox.currentFilePath,'utf8'));return {projectId:f.projectId,documentId:nodeId,generation:sandbox.lastSignaledEditGeneration,content:envelope.composeObservablePayload({...parsed,metaEnabled:true})};},
    saveLastFile:async args=>{args.beforeWrite();calls.continuity++;return {ok:true};},
  };
  const sectionsText=[['DOCX_IMPORT_PREVIEW_REFERENCES'],['DOCX_IMPORT_PREVIEW_COMMAND_SURFACE'],['DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE'],['DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE']].map(([s])=>extractMarkedSection(source,'// '+s+'_START','// '+s+'_END')).join('\n');
  vm.runInNewContext(sectionsText+'\n'+namedFunction(source,'readTreeCohortPath')+'\n'+namedFunction(source,'captureTreeCohortInventory')+'\n'+namedFunction(source,'treeSceneSnapshotsEqual')+'\nmodule.exports={handleDocxImportLocalFilePreviewCommandSurface,handleDocxImportPreviewCommandSurface,handleDocxImportSafeCreateCommandSurface,references:docxImportPreviewReferences};',sandbox,{filename:MAIN_PATH});
  return {...sandbox.module.exports,sandbox,calls,bridge};
}
test('novel import: actual Main admission, real lease/cohort and verified all-sibling open acknowledgement',async t=>{
  const f=await projectFixture(t,'main-chain'), port=await mainProjectPort(f), bytes=richNovelBytes(20,{inflate:10000});
  const report=port.bridge.buildDocxContentPreviewFromZipBytes(bytes), reportBefore=cloneJsonSafe(report);
  retain('main-source',{bytes,report});assert.equal(report.ok,true,`complete Main source: ${report.reason || report.code}`);
  const preview=await port.handleDocxImportPreviewCommandSurface({requestId:'preview-chain',docxContentPreviewReport:report});
  retain('main-preview',{bytes,report,preview,calls:port.calls});
  assert.equal(preview.importPreviewOk,true,`actual Main preview: ${preview.reason || preview.code}`);
  assert.equal(preview.docxImportPreviewPlan.candidateCreatePlan.sceneStrategy,'word-novel-root-partitions');
  assert.equal(port.calls.admissions.length,1,'actual Main explicit preview admits exactly its complete plan');
  assert.ok(port.calls.admissions[0].candidateCreatePlan.entries.some(e=>e.content.includes('listItem')),'multi-paragraph list container survives Main');
  equal(report,reportBefore,'Main cannot mutate the actual parser report');
  const accepted=await port.handleDocxImportSafeCreateCommandSurface({requestId:'main-chain',docxImportPreviewRef:preview.docxImportPreviewRef});
  retain('main-accepted',{accepted,files:snapshotFiles(f.root),calls:port.calls});
  assert.equal(accepted.ok,true,`actual Main create: ${accepted.reason || accepted.error?.reason || accepted.code}`);
  assert.ok(accepted.createdSceneIds.length>1);equal(accepted.publicSceneLocator,accepted.publicSceneLocators[0],'explicit first alias');
  const record=(await safe.readDocxImportAttempt(f)).record;assert.equal(record.requestId,'main-chain');
  const beforeAck=snapshotFiles(f.root), siblings=accepted.receipt.createdScenes;
  port.sandbox.currentFilePath=path.join(f.root,siblings[0].relativeFile);
  const ack=await port.handleDocxImportSafeCreateCommandSurface({action:'acknowledge-open',requestId:'main-chain',projectId:f.projectId,nodeId:accepted.publicSceneLocator.nodeId});
  retain('main-ack',{ack,beforeAck,afterAck:snapshotFiles(f.root),calls:port.calls});
  assert.equal(ack.ok,true,`actual Main ack: ${ack.reason || ack.code}`);assert.equal(ack.cleared,true);assert.equal(port.calls.continuity,1);
  assert.equal((await safe.readDocxImportAttempt(f)).record,null,'recoverable attempt clears only after all siblings and open snapshot');
  assert.equal(fs.readFileSync(path.join(f.romanRoot,'Old.txt'),'utf8'),'Old protected🧭');
  const actualNotes=JSON.parse(fs.readFileSync(path.join(f.root,'notes.craftsman.json'),'utf8'));
  equal(actualNotes.notes.slice(0,2),JSON.parse(f.original['notes.craftsman.json']).notes,'private/deleted notes remain exact');
  const mutation=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath,projectId:f.projectId});
  assert.equal(mutation.lastMutation.canUndo,false,'new import has no unproven whole-cohort inverse');
  const m=await modelPromise,currentInventory=(await captureActualInventory(f.root)).inventory;
  typedFailure(()=>m.planProjectTreeUndo({projectId:f.projectId,operationId:'undo-import',expectedTreeRevision:mutation.treeRevision,lastMutation:mutation.lastMutation.id,
    receipt:mutation.receipt,retainedPacket:mutation.retainedPacket,currentManifestText:fs.readFileSync(f.manifestPath,'utf8'),currentInventory}),/^E_TREE_UNDO_UNAVAILABLE$/);
  const actualPlan=port.calls.transactions[0].treeCohort;
  equal(m.planProjectDocxImportCohort(actualPlan.input),actualPlan,'retained journal input regenerates every exact file byte');
  equal(Object.keys(actualPlan.input.candidate).sort(),['cohortDigest','policy','sourceCandidate'],'retained candidate has only its closed complete-source proof');
  equal(actualPlan.input.candidate.sourceCandidate,preview.docxImportPreviewPlan.candidateCreatePlan.sourceCandidate,'retained source has no pruned fields');
  const rejected=[];
  for(const [label,mutate] of [
    ['missing',p=>{delete p.input.candidate.policy;}],['extra',p=>{p.input.candidate.entries=[];}],
    ['source-sha',p=>{p.input.candidate.sourceCandidate.candidateContentSha256='f'.repeat(64);}],
    ['policy',p=>{p.input.candidate.policy.targetParagraphs=1;}],['digest',p=>{p.input.candidate.cohortDigest='f'.repeat(64);}],
    ['derived',p=>{p.entries.find(e=>e.role==='scene'&&e.beforeBase64===null).afterBase64=Buffer.from('forged').toString('base64');}],
    ['initial-full-derived',p=>{p.input.candidate=cloneJsonSafe(preview.docxImportPreviewPlan.candidateCreatePlan);p.input.candidate.entries[0].content+='forged';}],
  ]) {
    const operand=cloneJsonSafe(actualPlan);mutate(operand);let error;
    try{m.validateProjectTreeCohort(operand);}catch(e){error={code:e.code,message:e.message};}
    rejected.push({label,operand,error});retain('compact-source-proof-rejections',rejected);
    assert.match(error?.code||'',/^E_(DOCX_NOVEL|TREE_COHORT)_/,'complete independent regeneration refuses '+label);
  }
});
test('novel import: complete numbering chains remain one indivisible meaning across storage cuts',async()=>{
  const m=await modelPromise,f=await tinyPlan(10,{notes:false,listChain:true});assert.equal(f.plan.ok,true);assertConserved(f);
  const source=envelope.parseObservablePayload(f.combined.candidateCreatePlan.entries[0].content).doc;
  const listNodes=doc=>{const out=[];const visit=n=>{if(n.type==='orderedList')out.push(n);for(const c of n.content||[])visit(c);};visit(doc);return out;};
  assert.equal(listNodes(source).length,2);equal(listNodes(source).map(n=>n.attrs.start),[1,2],'real DOCX retains its continued numbering');
  const docs=f.plan.candidateCreatePlan.entries.map(e=>envelope.parseObservablePayload(e.content).doc);
  assert.equal(docs.filter(d=>listNodes(d).length).length,1,'complete chain cannot restart in a second scene');
  const prototype={schemaVersion:1,instanceId:'numbering-a',level:0,levels:[{format:'1',start:1,text:'%1.',restartAfterLevel:null}]};
  const patterned=cloneJsonSafe(source), roots=listNodes(patterned);roots.forEach((n,i)=>{delete n.attrs.wordListId;delete n.attrs.wordListStart;n.attrs.wordNumbering={...prototype,instanceId:'numbering-'+i,lineageId:'lineage-one'};});
  const candidate=cloneJsonSafe(f.combined.candidateCreatePlan), content=envelope.composeObservablePayload({doc:patterned});
  candidate.entries[0].content=content;candidate.entries[0].candidateContentSha256=sha(content);
  const result=m.partitionDocxImportCandidate(candidate,f.combined.source.sourceArtifactSha256,{targetParagraphs:4});
  equal(result.entries.flatMap(e=>listNodes(envelope.parseObservablePayload(e.content).doc)).map(n=>n.attrs),listNodes(envelope.parseObservablePayload(content).doc).map(n=>n.attrs),'all instance/lineage counters and definitions stay exact');
  typedFailure(()=>m.partitionDocxImportCandidate(candidate,f.combined.source.sourceArtifactSha256,{targetParagraphs:4,maxSceneUtf16:50}),/^E_DOCX_NOVEL_INDIVISIBLE_BUDGET$/);
  retain('numbering-chain',{f,source,docs,patterned,candidate,result});
});

const textFile=p=>fs.readFileSync(p,'utf8');
const commentPath=f=>path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
function productFiles(f) { return Object.fromEntries(Object.entries(snapshotFiles(f.root)).filter(([p])=>!p.startsWith('.test-authority/'))); }
async function applyPlan(f,plan,nonce) {
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  return safe.applyDocxImportSafeCreate({docxImportPreviewPlan:plan},{...f,manifestRaw:textFile(f.manifestPath),importRequestNonce:nonce});
}
async function importedTiny(t,name='imported',fixtureOptions={}) {
  const f=await projectFixture(t,name,fixtureOptions), source=await tinyPlan(20), result=await applyPlan(f,source.plan,name);
  retain(name+'-initial',{source,result,files:snapshotFiles(f.root)});
  assert.equal(result.ok,true,`real tiny cohort ${result.error?.messageCode || result.error?.code}`);
  return {...f,source,result,scenes:result.value.receipt.createdScenes};
}
test('novel import: actual local and Main sanitizers retain list continuation; active note combination remains typed unsupported',async t=>{
  const bytes=richNovelBytes(20,{continuation:true,notes:false,inflate:10000});
  const local=instantiateDocxImportLocalFilePreviewCommandPort({bytes,dialogResult:{canceled:false,filePaths:['/trusted/list-novel.docx']}});
  const picked=await local.handleDocxImportLocalFilePreviewCommandSurface({requestId:'continuation-local'});
  const f=await projectFixture(t,'continuation-main'),port=await mainProjectPort(f),report=port.bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const preview=await port.handleDocxImportPreviewCommandSurface({requestId:'continuation-main',docxContentPreviewReport:report});
  const continuationItems=plan=>plan.candidateCreatePlan.entries.flatMap(e=>{
    const out=[],visit=n=>{if(n.type==='listItem'&&(n.content||[]).filter(c=>c.type==='paragraph').length>1)out.push(n);for(const c of n.content||[])visit(c);};
    visit(envelope.parseObservablePayload(e.content).doc);return out;
  });
  retain('continuation-sanitizers',{bytes,picked,report,preview});
  assert.equal(picked.contentPreviewOk,true);assert.equal(preview.importPreviewOk,true);
  assert.equal(report.contentPreview.paragraphs[8].listContinuationLevel,0,'real parser emits the source continuation field');
  assert.equal(continuationItems(picked.docxImportPreviewPlan).length,1,'local sanitizer consumes that field into one complete multi-paragraph item');
  equal(continuationItems(picked.docxImportPreviewPlan),continuationItems(preview.docxImportPreviewPlan),'actual Main retains the complete same list item');
  const unsupportedBytes=richNovelBytes(10,{continuation:true}),unsupported=port.bridge.buildDocxContentPreviewFromZipBytes(unsupportedBytes);
  const plan=port.bridge.buildDocxNovelImportPreviewPlanFromContentPreview(unsupported,{targetParagraphs:4});
  const unsupportedEntry=plan.candidateCreatePlan.entries.find(e=>e.notes?.length&&continuationItems({candidateCreatePlan:{entries:[e]}}).length);
  assert.ok(unsupportedEntry,'the active note and continuation actually share a scene');
  let refusal;try {notes.materializeImportedNotes({candidates:unsupportedEntry.notes,
    sceneContent:unsupportedEntry.content,projectId:f.projectId,sceneId:'roman/Unsupported.txt',importOperationId:'unsupported',beforeText:null,createdAt:'2026-10-09T00:00:00.000Z'});}catch(error){refusal={code:error.code,message:error.message};}
  retain('notes-continuation-typed-gap',{unsupportedBytes,unsupported,plan,refusal});
  assert.equal(refusal?.code,'NOTE_SCENE_STRUCTURE_UNSUPPORTED','the existing note structure boundary is explicit, never flattened');
});
test('novel import: actual Main revalidates lifecycle, generation, dirty state and capability after async work',async t=>{
  const rows=[];
  for(const [label,options] of [
    ['window',{afterAwait:s=>{s.mainWindow={id:'replacement'};}}],
    ['generation',{afterAwait:s=>{s.lastSignaledEditGeneration++;}}],
    ['dirty',{afterAwait:s=>{s.isDirty=true;}}],['capability',{denyCapability:true}],
  ]) {
    const f=await projectFixture(t,'stale-'+label),port=await mainProjectPort(f,options);
    const report=port.bridge.buildDocxContentPreviewFromZipBytes(richNovelBytes(20,{inflate:10000}));
    const preview=await port.handleDocxImportPreviewCommandSurface({requestId:'preview-'+label,docxContentPreviewReport:report});
    const before=productFiles(f),result=preview.importPreviewOk?await port.handleDocxImportSafeCreateCommandSurface({requestId:'apply-'+label,docxImportPreviewRef:preview.docxImportPreviewRef}):preview;
    rows.push({label,preview,result,before,after:productFiles(f),calls:port.calls});retain('stale-boundaries',rows);
    assert.equal(result.ok,false,`stale ${label} cannot publish`);equal(productFiles(f),before,`stale ${label} leaves every product file exact`);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false,'no stale journal');
  }
});
test('novel import: full sibling replay is idempotent, tampering refuses, and a new nonce forks every owned identity',async t=>{
  const f=await importedTiny(t,'replay'),before=productFiles(f),again=await applyPlan(f,f.source.plan,'replay');
  retain('replay-identical',{before,again,after:productFiles(f)});
  assert.equal(again.ok,true);assert.equal(again.value.idempotent,true);equal(productFiles(f),before,'same nonce performs no product write');
  const receipt=f.result.value.receipt,last=f.scenes.at(-1),scenePath=path.join(f.root,last.relativeFile);
  const targets=[
    ['last-scene',scenePath,old=>old+'tampered'],
    ['notes',path.join(f.root,'notes.craftsman.json'),old=>{const d=JSON.parse(old);d.notes.find(n=>n.manuscript).body+='forged';return JSON.stringify(d);}],
    ['comments',commentPath(f),old=>{const d=JSON.parse(old);d.threads[0].messages[0].body+='forged';return JSON.stringify(d);}],
    ['identity',f.manifestPath,old=>{const d=JSON.parse(old);d.treeIdentity.nodes[last.treeNodeId].bindingKey='file:roman/Old.txt';return JSON.stringify(d);}],
    ['receipt',path.join(f.root,'.yalken/docx-import/receipts',receipt.importOperationId+'.json'),old=>{const d=JSON.parse(old);d.publicSceneLocators.reverse();return JSON.stringify(d);}],
  ];const outcomes=[];
  for(const [label,p,mutate] of targets) {
    const original=fs.readFileSync(p);fs.writeFileSync(p,mutate(original.toString()));
    const mutated=productFiles(f),result=await applyPlan(f,f.source.plan,'replay');outcomes.push({label,result,mutated,after:productFiles(f)});
    assert.equal(result.ok,false,`complete replay refuses ${label}`);equal(productFiles(f),mutated,`refusal cannot overwrite ${label}`);fs.writeFileSync(p,original);
  }
  retain('replay-tamper',outcomes);equal(productFiles(f),before,'all fault operands were restored exactly');
  const next=await applyPlan(f,f.source.plan,'independent-nonce');retain('new-nonce',{next,before,after:productFiles(f)});
  assert.equal(next.ok,true,`new nonce ${next.error?.messageCode}`);
  const second=next.value.receipt.createdScenes,existingIds=new Set(f.scenes.map(s=>s.treeNodeId)),existingFiles=new Set(f.scenes.map(s=>s.relativeFile));
  assert.ok(second.every(s=>!existingIds.has(s.treeNodeId)&&!existingFiles.has(s.relativeFile)),'new node and file identity for every partition');
  for(const s of f.scenes) assert.equal(sha(fs.readFileSync(path.join(f.root,s.relativeFile))),s.outputHash,'first cohort bodies remain exact');
  const doc=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),threads=JSON.parse(textFile(commentPath(f))).threads;
  assert.equal(new Set(doc.notes.map(n=>n.id)).size,doc.notes.length);assert.equal(new Set(threads.map(x=>x.threadId)).size,threads.length);
  equal(doc.notes.slice(0,2),JSON.parse(f.original['notes.craftsman.json']).notes,'private/deleted annotation preservation across both cohorts');
});
async function saveOrdinaryScene(f,scene,label) {
  const scenePath=path.join(f.root,scene.relativeFile),before=textFile(scenePath),parsed=envelope.parseObservablePayload(before),doc=cloneJsonSafe(parsed.doc);
  const leaf=bookmarks.paragraphs(doc).find(p=>(p.content||[]).some(n=>n.type==='text'));
  leaf.content.find(n=>n.type==='text').text+=' '+label;
  const after=envelope.composeObservablePayload({...parsed,doc}),notesBefore=textFile(path.join(f.root,'notes.craftsman.json')),commentsBefore=textFile(commentPath(f));
  const noteState=notes.planManuscriptNoteAnchorSave({beforeText:notesBefore,projectId:f.projectId,sceneId:scene.relativeFile,beforeContent:before,afterContent:after,includeUnchanged:true});
  const commentState=anchors.planCommentAnchorSave({beforeText:commentsBefore,projectId:f.projectId,sceneId:scene.relativeFile,beforeContent:before,afterContent:after,includeUnchanged:true});
  const record=await f.transactionAuthority.withProjectLease(f.projectId,lease=>lease.publish(async proof=>{
    const manifestBefore=textFile(f.manifestPath),manifest=JSON.parse(manifestBefore);manifest.lastCommandId++;
    const request={scenePath,sceneContent:after,expectedSceneContent:before,manifestPath:f.manifestPath,
      manifestContent:JSON.stringify(manifest),expectedManifestContent:manifestBefore,revision:lease.fencingGeneration,noteState,commentState,
      verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId}),
      publishManifest:async({manifestPath,expectedText,nextText})=>{await proof.assertOwned();const result=await f.transactionAuthority.commitManifestText({projectId:f.projectId,targetPath:manifestPath,expectedText,nextText,lease});assert.equal(result.readbackVerified,true);}};
    const result=await tx.commitProjectTransaction(request);return {before,after,notesBefore,commentsBefore,noteState,commentState,result,manifestBefore,manifestAfter:textFile(f.manifestPath)};
  }));
  record.verified=await tx.readVerifiedProjectTransaction({scenePath,manifestPath:f.manifestPath,
    verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});
  const afterNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),beforeNotes=JSON.parse(notesBefore);
  const outside=d=>d.notes.filter(note=>note.manuscript?.reference.sceneId!==scene.relativeFile);
  equal(outside(afterNotes),outside(beforeNotes),'ordinary Save preserves full private/foreign/deleted notes');
  equal(afterNotes.wordNoteReturnReceipts,beforeNotes.wordNoteReturnReceipts,'ordinary Save preserves full receipt rows');
  const afterComments=JSON.parse(textFile(commentPath(f))),beforeComments=JSON.parse(commentsBefore);
  equal(afterComments.threads.filter(t=>t.sceneId!==scene.relativeFile),beforeComments.threads.filter(t=>t.sceneId!==scene.relativeFile),'ordinary Save preserves complete foreign threads');
  record.notesAfter=afterNotes;record.commentsAfter=afterComments;
  return record;
}
test('novel import: independent Save 2 and both note-owning ends survive a fresh authority/reopen and repeated saves',async t=>{
  const f=await importedTiny(t,'ordinary-save'),before=productFiles(f),states=[];
  for(const [index,label] of [[1,'SECOND'],[0,'FIRST'],[f.scenes.length-1,'LAST_NOTE']]) {
    const siblings=f.scenes.filter((_,i)=>i!==index).map(s=>[s.relativeFile,fs.readFileSync(path.join(f.root,s.relativeFile))]);
    const state=await saveOrdinaryScene(f,f.scenes[index],label);states.push(state);retain('ordinary-saves',states);
    assert.equal(state.result.success,true);assert.equal(state.verified.sceneDigest,sha(state.after));
    for(const [file,bytes] of siblings) assert.ok(fs.readFileSync(path.join(f.root,file)).equals(bytes),'saving one scene does not pin or change its siblings');
  }
  const reopened=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined});
  for(const s of f.scenes) await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,s.relativeFile),manifestPath:f.manifestPath,
    verifyManifestContinuation:args=>reopened.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});
  for(const [index,label] of [[1,'REOPENED_SECOND'],[0,'REOPENED_FIRST_NOTE'],[f.scenes.length-1,'REOPENED_LAST_NOTE']]) {
    states.push(await saveOrdinaryScene({...f,...reopened},f.scenes[index],label));
    retain('ordinary-reopened-save',{states,before,after:productFiles(f)});
    for(const s of f.scenes) await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,s.relativeFile),manifestPath:f.manifestPath,
      verifyManifestContinuation:args=>reopened.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});
  }
  assert.ok(states.every(s=>s.result.success));assert.ok(textFile(path.join(f.root,f.scenes[1].relativeFile)).includes('SECOND REOPENED_SECOND'));
  equal(JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.slice(0,2),JSON.parse(f.original['notes.craftsman.json']).notes,'private and deleted notes exact after all saves');
  assert.ok(fs.readFileSync(path.join(f.romanRoot,'Old.txt')).equals(f.original['roman/Old.txt']));
  assert.equal((await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath})).lastMutation.canUndo,false,'ordinary scene save does not offer a stale import inverse');
});

async function plannedTiny(f,source,nonce='fault') {
  const m=await modelPromise,plan=source.plan,entry=plan.candidateCreatePlan.entries[0];
  const operationId=safe.buildImportOperationId({projectId:f.projectId,sourceArtifactSha256:plan.source.sourceArtifactSha256,
    candidateContentSha256:plan.candidateCreatePlan.cohortDigest,previewHash:plan.previewHash,sceneId:entry.sceneId,operationNonce:nonce});
  return m.planProjectDocxImportCohort({operation:'word-generic-import',projectId:f.projectId,operationId,operationNonce:nonce,
    manifestPath:f.manifestPath,beforeManifestText:textFile(f.manifestPath),expectedTreeRevision:0,fencingGeneration:1,
    candidate:plan.candidateCreatePlan,artifactSha256:plan.source.sourceArtifactSha256,previewPlanHash:safe.hashDocxImportPreviewPlanForAdmission(plan),previewHash:plan.previewHash,
    lossReport:plan.lossReport,carrierIgnored:plan.carrierIgnored,now:'2026-10-09T00:00:00.000Z',...await captureActualInventory(f.root),mediaBindings:[]});
}
function directPublisher() {return async({manifestPath,expectedText,nextText,revision})=>{
  assert.equal(textFile(manifestPath),expectedText,'actual manifest byte CAS');
  return require('../../src/core/save-coordinator-v1.cjs').durableSaveTransaction({filePath:manifestPath,content:nextText,revision});
};}
test('novel import: regenerated original packet above ordinary resource capacity is durable and remains readable',async t=>{
  const f=await projectFixture(t,'packet-capacity'),source=await tinyPlan(20);
  fs.writeFileSync(path.join(f.romanRoot,'Old.txt'),'Old valid paragraph '.repeat(173016));
  const plan=await plannedTiny(f,source,'packet-capacity'),revision=1,transactionId=sha(`${plan.projectId}\n${plan.planDigest}\n${revision}`);
  const filename=require.resolve('../../src/core/project-transaction-v1.cjs'),{Module,createRequire}=require('node:module');
  const observer=new Module(filename);observer.filename=filename;observer.paths=Module._nodeModulePaths(path.dirname(filename));observer.require=createRequire(filename);
  observer._compile(readSource(filename)+'\nmodule.exports={buildTreeEntries,canonicalBytes};',filename);
  const packet={schemaVersion:'yalken.project-transaction.journal.v7',projectId:plan.projectId,manifestPath:f.manifestPath,transactionId,revision,plan,
    entries:observer.exports.buildTreeEntries(plan,f.manifestPath,revision,transactionId)};
  const packetText=observer.exports.canonicalBytes(packet),packetBytes=Buffer.byteLength(packetText),before=snapshotFiles(f.root),writes=[];
  const adapter={...fsp};for(const method of ['mkdir','writeFile','rename','unlink'])adapter[method]=async(...args)=>{writes.push({method,args});return fsp[method](...args);};
  let result,error;try{result=await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision,treeCohort:plan,publishManifest:directPublisher(),fsAdapter:adapter,revalidate:async()=>{}});}
  catch(e){error={code:e.code,phase:e.phase,message:e.message,stack:e.stack};}
  const after=snapshotFiles(f.root);retain('original-packet-capacity-durable',{source,plan,packet,packetText,packetBytes,before,result,error,writes,after});
  assert.ok(packetBytes>20*1024*1024&&packetBytes<32*1024*1024,'actual novel packet crosses ordinary resource capacity but not artifact capacity');
  assert.equal(error,undefined);assert.equal(result.success,true);assert.ok(writes.length>0);
  const scenes=plan.importReceipt.createdScenes;
  const verified=await tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,
    scenePaths:scenes.map(scene=>path.join(f.root,scene.relativeFile)),verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});
  equal(verified.records.map(record=>record.sceneDigest),scenes.map(scene=>scene.outputHash),'every actual durable scene verified independently');
  assert.ok(fs.readFileSync(path.join(f.romanRoot,'Old.txt')).equals(before['roman/Old.txt']),'pre-existing full scene unchanged');
  for(const [name,bytes] of Object.entries(before).filter(([name])=>!['project.craftsman.json','notes.craftsman.json'].includes(name)))assert.ok(after[name]?.equals(bytes),'every unrelated original byte preserved');
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
});
test('novel import: one journal rolls back each interrupted member and rolls forward only after the durable marker',async t=>{
  const source=await tinyPlan(20),outcomes=[];
  for(const stage of ['manifest','first-scene','nth-scene','notes','comments','filesComplete','commitMarker','cleanup']) {
    const f=await projectFixture(t,'fault-'+stage),plan=await plannedTiny(f,source),before=productFiles(f),publisher=directPublisher();let fired=false,error;
    const scenePaths=plan.entries.filter(e=>e.role==='scene'&&e.beforeBase64===null).map(e=>path.join(f.root,e.relativePath));
    const adapter={...fsp,rename:async(a,b)=>{const match=stage==='first-scene'&&b===scenePaths[0]||stage==='nth-scene'&&b===scenePaths.at(-1)
      ||stage==='notes'&&b===path.join(f.root,'notes.craftsman.json')||stage==='comments'&&b===commentPath(f)||stage==='commitMarker'&&b===tx.treeCommitPathFor(f.manifestPath);
      if(!fired&&match){fired=true;throw Error('owned injected '+stage);}return fsp.rename(a,b);},
      unlink:async p=>{if(!fired&&stage==='cleanup'&&p===tx.journalPathFor(f.manifestPath)){fired=true;throw Error('owned cleanup');}return fsp.unlink(p);}};
    const publishManifest=async args=>{if(!fired&&stage==='manifest'){fired=true;throw Error('owned manifest');}return publisher(args);};
    try {await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest,fsAdapter:adapter,revalidate:async()=>{},
      afterTreeFilesPublish:()=>{if(stage==='filesComplete'){fired=true;throw Error('owned filesComplete');}}});}catch(e){error={code:e.code,message:e.message};}
    const interrupted=productFiles(f),binding=await tx.readPendingProjectTransactionBinding({manifestPath:f.manifestPath});
    assert.equal(fired,true,`injection actually reached ${stage}`);assert.ok(error);assert.equal(binding.pending,true);assert.equal(binding.mode,'tree');
    const recovered=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:publisher,revalidate:async()=>{}}),after=productFiles(f);
    outcomes.push({stage,plan,before,error,interrupted,binding,recovered,after});retain('cohort-recovery',outcomes);
    assert.equal(recovered.outcome,stage==='cleanup'?'COMMITTED_ROLLED_FORWARD':'UNCOMMITTED_ROLLED_BACK');
    if(stage!=='cleanup') {
      const retained=Object.keys(after).filter(p=>!Object.hasOwn(before,p));
      assert.ok(retained.every(p=>/^\.yalken-recovery\/wp201-[a-f0-9]{64}\.json$/.test(p)),'only a readable recovery packet may survive rollback');
      for(const p of retained){const packet=JSON.parse(after[p]);assert.equal(packet.schemaVersion,'yalken.project-transaction.journal.v7');equal(packet.plan,plan,'retained recovery packet binds this exact full plan');}
      equal(Object.fromEntries(Object.entries(after).filter(([p])=>!retained.includes(p))),before,`complete ${stage} business-byte rollback`);
    }
    else {for(const s of plan.importReceipt.createdScenes)assert.equal(sha(fs.readFileSync(path.join(f.root,s.relativeFile))),s.outputHash);
      for(const s of plan.importReceipt.createdScenes)await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,s.relativeFile),manifestPath:f.manifestPath});}
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  }
});

function actualCryptoPort() {
  const s=readSource(MAIN_PATH),context={crypto,Buffer,isPlainObjectValue,module:{exports:{}}};
  vm.runInNewContext(namedFunction(s,'stableRtkReviewTransportJson')+'\n'+namedFunction(s,'createRtkReviewTransportCryptoPort')+'\nmodule.exports=createRtkReviewTransportCryptoPort();',context);
  return context.module.exports;
}
async function exportImported(f, selected=f.scenes) {
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),cryptoPort=actualCryptoPort();
  const scenes=selected.map((s,order)=>{const raw=textFile(path.join(f.root,s.relativeFile)),parsed=envelope.parseObservablePayload(raw);
    return {sceneId:s.relativeFile,scenePath:path.join(f.root,s.relativeFile),text:parsed.text,doc:parsed.doc,observableContent:raw,order};});
  const completeCommentState=JSON.parse(textFile(commentPath(f))),selectedIds=new Set(scenes.map(s=>s.sceneId));
  const selectedCommentState={...cloneJsonSafe(completeCommentState),threads:completeCommentState.threads.filter(t=>selectedIds.has(t.sceneId))};
  equal(selectedCommentState.threads,completeCommentState.threads.filter(t=>selectedIds.has(t.sceneId)),'standalone read-only projection preserves every complete selected thread');
  const input={projectId:f.projectId,projectName:'Novel',projectCreatedAtUtc:'2026-10-09T00:00:00.000Z',projectRoot:f.root,manifestPath:f.manifestPath,
    scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId),notesDocument:JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),
    nonTextReturnState:selectedCommentState};
  const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource(input,
    {revisionBridge:bridge,cryptoPort,createdAtUtc:'2026-10-09T00:00:00.000Z',roundIdHex:'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'owned-tiny-import-export-test'});
  const bytes=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer(source);
  const phases=[['provisional',source.provisionalSelfParseArtifact.bytes],['final',bytes]].map(([phase,data])=>({phase,bytes:data,
    analysis:bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:data},{cryptoPort})}));
  return {input,completeCommentState,source,bytes,phases,bridge};
}
test('novel import: full and standalone real DOCX reexports conserve complete body, rich notes, replies and one effective default section',async t=>{
  const f=await importedTiny(t,'reexport'),before=productFiles(f),all=await exportImported(f);
  const first=await exportImported(f,[f.scenes[0]]),last=await exportImported(f,[f.scenes.at(-1)]);
  const typography=require('../../src/core/word-review-typography-v1.cjs'),noteDelta=require('../../src/core/word-note-return-delta-v1.cjs');
  const noteDocument=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json')));
  const compareComments=require('../../src/export/docx/docxReviewPacketComments.js').compareCommentExportReadback;
  const artifacts=[all,first,last];
  for(const [which,x] of artifacts.entries()) {
    retain('reexport-'+which,{input:x.input,completeCommentState:x.completeCommentState,source:x.source,bytes:x.bytes,phases:x.phases});
    const literal=x.input.scenes.flatMap(s=>bookmarks.paragraphs(s.doc).map(bookmarks.textOf));
    for(const phase of x.phases) {
      const a=phase.analysis;assert.equal(a.ok,true,`actual ${which}/${phase.phase} parser ${a.code}`);
      equal(a.reviewIr.formattingParagraphs.map(p=>p.paragraphText),literal,'all paragraphs, Unicode, spaces, empty paragraphs and breaks remain');
      assert.equal(a.reviewIr.formattingParagraphs.length,x.source.blocks.length);
      x.source.blocks.forEach((block,i)=>assert.equal(typography.readback(block.formatIr,a.reviewIr.formattingParagraphs[i],x.source.exportTypography),true,`complete authored/effective format ${which}/${phase.phase}/${i}`));
      if(x.source.commentExport)assert.equal(compareComments(x.source.commentExport,a.reviewIr.commentThreads).ok,true,'full root/reply, identities, bodies, authors, dates and anchors');
      if(x.source.documentNotes) {
        const returnedNotes=x.bridge.parseDocumentNotesRichReturn(phase.bytes,a.reviewIr.documentNotes,{includeBreakProjection:true});
        const result=noteDelta.planNoteReturnDelta({document:noteDocument,projectId:f.projectId,roundId:'partition-reexport-'+which,
          artifactSha256:sha(phase.bytes),baseline:x.source.documentNotes,exportMap:x.source.localAuthorityCapsule.exportMap,
          returnedNotes,returnedParagraphs:a.reviewIr.formattingParagraphs,now:'2026-10-09T00:00:00.000Z'});
        retain(`reexport-note-${which}-${phase.phase}`,{returnedNotes,result});
        equal(result.changes,[],'complete rich note/body/empty/hardBreak/reference readback causes no update');
      }
      const sectionCheck=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').validateFullManuscriptDocumentSectionsReturn({
        expected:x.source.documentSections,returned:a.reviewIr.documentSections,signedDigest:x.source.documentSections.protectedDigest});
      retain(`reexport-sections-${which}-${phase.phase}`,sectionCheck);assert.equal(sectionCheck.ok,true,'existing full effective section oracle');
    }
  }
  equal(first.source.documentSections.protectedSections[0].properties,last.source.documentSections.protectedSections[0].properties,'standalone first/last effective context agrees');
  assert.equal(all.source.documentSections.protectedSections.length,1,'storage partitions invent no real Word section end');
  equal(productFiles(f),before,'all exports are read-only for canonical files');
});

async function actualNotesAuthoring(f,scene,kind,action='update',targetId,options={}) {
  const source=readSource(MAIN_PATH),storage=await import('../../src/product/notesStoragePersistence.mjs');
  const raw=textFile(path.join(f.root,scene.relativeFile)),parsed=envelope.parseObservablePayload(raw),filePath=path.join(f.root,scene.relativeFile);
  const context={ok:true,projectRoot:f.root,projectId:f.projectId,notesStorage:storage},subjectId='owned:session';
  const sandbox={Buffer,path,fs:fsp,crypto,JSON,computeHash:sha,isPlainObjectValue,manuscriptNoteModel:notes,
    currentFilePath:filePath,currentProjectName:'Novel',DEFAULT_PROJECT_NAME:'Novel',commentAuthoringSessionId:'session',
    currentLifecycleSubjectId:()=> 'owned',isDirty:false,autoSaveInProgress:false,lastSignaledEditGeneration:0,
    getProjectNotesContext:async()=>context,queueDiskOperation:op=>op(),getMainProjectManifestAuthority:async()=>f.transactionAuthority,
    getProjectManifestPath:()=>f.manifestPath,readVerifiedNovelAnnotationLineage:tx.readVerifiedNovelAnnotationLineage,
    commitProjectTransaction:options.commit || tx.commitProjectTransaction,
    readCommentAuthoringContext:async()=>({projectId:f.projectId,projectRoot:f.root,sceneId:scene.relativeFile,filePath,subjectId,sceneSha256:sha(raw),raw,parsed}),
    requestEditorSnapshot:async()=>({generation:0,content:raw}),loadDocumentContentEnvelopeModule:async()=>envelope,
    loadRtkNonTextReturnModule:()=>import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),
    prepareWordMediaReturnResources:async doc=>{assert.equal(require('../../src/io/documentMedia.js').documentMedia(doc).assets.length,0);return [];},
    backupManager:{ATOMIC_RECEIPT_BACKUP_TARGET_ROLES:{NOTES_RECOVERY_SNAPSHOT:'NOTES_RECOVERY_SNAPSHOT'},
      writeReceiptOrBackupThroughAtomicGateway:({targetPath,content})=>require('../../src/core/save-coordinator-v1.cjs').durableSaveTransaction({filePath:targetPath,content,revision:0})},
    ATOMIC_SINGLE_FILE_TARGET_ROLES:{NOTES_PRIMARY:'NOTES_PRIMARY'},
    writeNotesOrSettingsThroughAtomicGateway:async args=>{if(args.beforeWrite)await args.beforeWrite();return require('../../src/core/save-coordinator-v1.cjs').durableSaveTransaction({filePath:args.filePath,content:args.content,revision:0});},
    module:{exports:{}},makeNotesCommandError:(commandId,code)=>({ok:false,code,commandId})};
  const names=['readProjectNotesDocument','writeProjectNotesDocument','buildNotesMutationReceipt','runNotesMutationCommand','runManuscriptNotesMutation'];
  vm.runInNewContext(names.map(n=>namedFunction(source,n)).join('\n')+'\nmodule.exports={runNotesMutationCommand,writeProjectNotesDocument};',sandbox,{filename:MAIN_PATH});
  const now=()=> '2026-10-09T00:00:01.000Z';
  const defaultClockRead=await storage.readNotesStorage({projectRoot:f.root,projectId:f.projectId});
  const current=await storage.readNotesStorage({projectRoot:f.root,projectId:f.projectId,now});assert.equal(current.ok,true);
  retain('canonical-notes-read-'+kind,{rawNotes:textFile(path.join(f.root,'notes.craftsman.json')),defaultClockRead,pinnedClockRead:current});
  const note=current.document.notes.find(n=>targetId?n.id===targetId:kind==='private'?n.id==='private-note':n.manuscript?.reference.sceneId===scene.relativeFile);
  assert.ok(note);const payload={projectId:f.projectId,subjectId,expectedSceneSha256:sha(raw),expectedDocumentHash:current.hash,noteId:action==='create'?'created-owned-note':note.id};
  let mutation={op:action,...(action==='update'?{body:'Private canonical authored Ж'}:{})};
  if(kind!=='private' && ['create','update'].includes(action)) {
    const body=cloneJsonSafe(note.manuscript.body);body.content[0].content.find(n=>n.type==='text').text+=' authored';
    mutation={op:action,manuscriptRequest:{kind:note.manuscript.kind,bodyJson:JSON.stringify(body),offsetUtf16:note.manuscript.reference.offsetUtf16}};
  }
  const before=productFiles(f),sceneRaw=textFile(filePath),manifestRaw=textFile(f.manifestPath),commitRaw=textFile(tx.commitPathFor(filePath));
  let result,error;
  try {
    result=options.document?await f.transactionAuthority.withProjectLease(f.projectId,lease=>lease.publish(()=>sandbox.module.exports.writeProjectNotesDocument(context,current,options.document,'notes.update',
      {now,inDiskOperation:true,mediaCohort:{lease,scenePath:filePath,revision:0},beforeWrite:async()=>{await lease.assertOwned();assert.equal(textFile(filePath),raw);assert.equal(textFile(path.join(f.root,'notes.craftsman.json')),current.sourceText);}})))
      :await sandbox.module.exports.runNotesMutationCommand('notes.'+action,payload,mutation,{now});
  } catch(e) {error={code:e.code,message:e.message};}

  const operand={kind,action,current,payload,mutation,now:now(),sceneRaw,manifestRaw,commitRaw,before,result,error,proposedDocument:options.document,after:productFiles(f)};
  retain('canonical-notes-authoring-'+kind+'-'+action,operand);return operand;
}
async function actualCommentAuthoring(f,scene,action,extra={},options={}) {
  const filePath=path.join(f.root,scene.relativeFile),raw=textFile(filePath),source=readSource(MAIN_PATH);
  const state=textFile(commentPath(f)),runtime=await import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs');
  const now='2026-10-09T00:00:01.000Z',binding={ok:true,manifestPath:f.manifestPath,projectId:f.projectId,projectRoot:f.root};
  const requests=[];class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
  const sandbox={crypto,path,fs:fsp,JSON,Buffer,Date:Clock,isDirty:false,autoSaveInProgress:false,activePendingRecording:null,
    currentFilePath:filePath,lastSignaledEditGeneration:0,currentLifecycleSubjectId:()=> 'owned',commentAuthoringSessionId:'session',
    isAllowedFilePath:p=>p===filePath,getDocumentContextFromPath:()=>({kind:'scene'}),readReviewExactTextApplyProjectBinding:async()=>binding,
    computeHash:sha,userBookmarkModel:bookmarks,commentSceneParagraphs:anchors.paragraphs,loadDocumentContentEnvelopeModule:async()=>envelope,
    loadRtkNonTextReturnModule:async()=>runtime,queueDiskOperation:op=>op(),getMainProjectManifestAuthority:async()=>f.transactionAuthority,
    readVerifiedNovelAnnotationLineage:tx.readVerifiedNovelAnnotationLineage,loadMarkdownIoModule:()=>import('../../src/io/markdown/index.mjs'),
    commitProjectTransaction:async args=>{requests.push(cloneJsonSafe(args));return (options.commit||tx.commitProjectTransaction)(args);},
    requestEditorSnapshot:async()=>({generation:0,content:raw}),module:{exports:{}}};
  vm.runInNewContext(['readCommentAuthoringContext','handleCommentAuthoringCommand'].map(n=>namedFunction(source,n)).join('\n')+'\nmodule.exports=handleCommentAuthoringCommand;',sandbox,{filename:MAIN_PATH});
  const input=options.input || {requestId:'owned-'+action,action,projectId:f.projectId,sceneId:scene.relativeFile,subjectId:'owned:session',
    expectedStateSha256:sha(state),expectedSceneSha256:sha(raw),...extra};
  const before=productFiles(f),manifestRaw=textFile(f.manifestPath),commitRaw=textFile(tx.commitPathFor(filePath));
  const kernel=require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({'cmd.project.review.editComment':sandbox.module.exports});
  const result=await kernel.dispatch('cmd.project.review.editComment',input);
  return {action,input,now,sceneRaw:raw,manifestRaw,commitRaw,before,result,requests,after:productFiles(f)};
}
async function verifyAllSiblings(f) {
  const states=[];
  for(const scene of f.scenes)states.push(await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,scene.relativeFile),manifestPath:f.manifestPath,
    verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})}));
  return states;
}
test('novel import: actual Main seven comment actions, manuscript create/update/delete/restore and private edits preserve independent Save/restart',async t=>{
  const outcomes=[],f=await importedTiny(t,'authored-main',{canonicalNotes:true}),scene=f.scenes[0],scenePath=path.join(f.root,scene.relativeFile);
  let threadId,rootId,lastId;
  for(const action of ['create','reply','edit','resolve','reopen','reanchor','delete']) {
    const paragraph=anchors.paragraphs(textFile(scenePath))[0].text;
    const extra=action==='create'?{body:'Canonical root Ж',anchor:{paragraphIndex:0,startUtf16:0,selectedText:paragraph.slice(0,2)}}:
      {threadId,...(['reply','edit'].includes(action)?{body:'Canonical '+action+' 漢字'}:{}),...(action==='edit'?{commentId:rootId}:{}),
        ...(action==='reanchor'?{anchor:{paragraphIndex:0,startUtf16:0,selectedText:paragraph.slice(0,2)}}:{})};
    const authored=await actualCommentAuthoring(f,scene,action,extra);outcomes.push(authored);retain('canonical-main-authoring',outcomes);
    assert.equal(authored.result.ok,true,`actual Main ${action}: ${authored.result.error?.reason}`);
    const state=JSON.parse(textFile(commentPath(f)));threadId=authored.result.value?.threadId || state.threads.at(-1).threadId;
    rootId=state.threads.find(thread=>thread.threadId===threadId).rootCommentId;
    const commit=JSON.parse(textFile(tx.commitPathFor(scenePath)));
    assert.equal(commit.revision,0,'actual editor generation remains unchanged across annotation-only writes');
    if(lastId)assert.notEqual(commit.transactionId,lastId,'distinct after-state must not hit scene-only idempotency');lastId=commit.transactionId;
    const replay=await actualCommentAuthoring(f,scene,action,extra,{input:authored.input});outcomes.push(replay);
    assert.equal(replay.result.ok,true);equal(replay.after,replay.before,'exact request replay performs no product write');
    if(action==='create')continue; // create+reply are sequential at exactly the same generation and scene bytes.
    const beforeSave=productFiles(f),saved=await saveOrdinaryScene(f,scene,'AFTER_'+action);
    const ownComment=textFile(commentPath(f)),ownNote=textFile(path.join(f.root,'notes.craftsman.json'));
    const reopened=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined});
    const siblings=await verifyAllSiblings({...f,...reopened});outcomes.push({action,beforeSave,saved,siblings,ownComment,ownNote,after:productFiles(f)});
    retain('canonical-main-authoring',outcomes);assert.equal(saved.result.success,true);
  }
  for(const [kind,actions] of [['manuscript',['create','update','delete','restore']],['private',['update']]]) {
    let id;
    for(const action of actions) {
      const authored=await actualNotesAuthoring(f,scene,kind,action,id);outcomes.push(authored);retain('canonical-main-authoring',outcomes);
      assert.equal(authored.result.ok,true,`actual Main ${kind}/${action}: ${authored.result.code}`);
      id=authored.result.receipt.noteId;
      const afterAuthoring=productFiles(f),saved=await saveOrdinaryScene(f,action==='delete'?f.scenes.at(-1):scene,'AFTER_'+kind+'_'+action);
      const reopened=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined});
      const siblings=await verifyAllSiblings({...f,...reopened});
      const savedOther=await saveOrdinaryScene({...f,...reopened},f.scenes.at(-1),'FOREIGN_AFTER_'+action);
      outcomes.push({kind,action,afterAuthoring,saved,siblings,savedOther,after:productFiles(f)});retain('canonical-main-authoring',outcomes);
      assert.equal(saved.result.success,true);assert.equal(savedOther.result.success,true);
      if(kind==='private')assert.equal(JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.find(n=>n.id==='private-note').body,'Private canonical authored Ж');
    }
  }
});

function queryNovel(f,scene) {return tx.readVerifiedNovelAnnotationLineage({scenePath:path.join(f.root,scene.relativeFile),manifestPath:f.manifestPath,
  verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});}
async function runCapturedAuthoring(f,request,transform=x=>x) {
  return f.transactionAuthority.withProjectLease(f.projectId,lease=>lease.publish(async()=> {
    const args={...cloneJsonSafe(request),revalidate:async()=>{await lease.assertOwned();assert.equal(textFile(request.scenePath),request.expectedSceneContent);},
      publishManifest:({manifestPath:targetPath,expectedText,nextText})=>f.transactionAuthority.commitManifestText({projectId:f.projectId,lease,targetPath,expectedText,nextText}),
      verifyManifestContinuation:q=>f.transactionAuthority.verifyManifestContinuation({...q,projectId:f.projectId})};
    return tx.commitProjectTransaction(transform(args));
  }));
}
test('novel import: canonical authoring rejects forged transitions, own/unknown receipts and unproven persisted lineage without laundering',async t=>{
  const f=await importedTiny(t,'authoring-negative',{canonicalNotes:true}),scene=f.scenes[0],scenePath=path.join(f.root,scene.relativeFile),observed=[];
  const capture=await actualCommentAuthoring(f,scene,'create',{body:'Actual captured root',anchor:{paragraphIndex:0,startUtf16:0,selectedText:anchors.paragraphs(textFile(scenePath))[0].text.slice(0,2)}},
    {commit:async()=>{throw Object.assign(Error('owned stop before transaction'),{code:'OWNED_BEFORE_TRANSACTION_OBSERVATION'});}});
  assert.equal(capture.requests.length,1);const request=capture.requests[0];retain('authoring-captured-real-main-request',capture);
  const noteText=textFile(path.join(f.root,'notes.craftsman.json')),doc=JSON.parse(noteText);
  const mutations=[
    ['after-state',args=>{const d=JSON.parse(args.commentState.afterText);d.threads.at(-1).messages[0].body+='forged';args.commentState.afterText=JSON.stringify(d);}],
    ['clock',args=>{const p=JSON.parse(args.commentState.authoringProofJson);p.now='invalid';args.commentState.authoringProofJson=JSON.stringify(p);}],
    ['input',args=>{const p=JSON.parse(args.commentState.authoringProofJson);p.input.paragraphs=['caller authority'];args.commentState.authoringProofJson=JSON.stringify(p);}],
    ['scene',args=>{args.sceneContent+='forged';}],
    ['no-publication-revalidation',args=>{delete args.revalidate;}],
    ...['foreign','private','receipts'].map(kind=>[kind,args=>{const d=cloneJsonSafe(doc),n=d.notes.find(n=>kind==='private'?!n.manuscript:n.manuscript?.reference.sceneId!==scene.relativeFile&&n.manuscript);
      if(kind==='receipts')d.wordNoteReturnReceipts=[{untrusted:'row'}];else {n.body+=' forged';if(n.manuscript)n.manuscript.body.content[0].content.find(n=>n.type==='text').text+=' forged';}
      args.noteState={mode:'MANUSCRIPT_BODY_UPDATE_V1',beforeText:noteText,afterText:JSON.stringify(d)};}]),
  ];
  for(const [label,mutate] of mutations) {
    const before=productFiles(f);let error,operand;
    try {await runCapturedAuthoring(f,request,args=>{mutate(args);operand=cloneJsonSafe(args);return args;});}catch(e){error={code:e.code,message:e.message};}
    observed.push({label,operand,before,error,after:productFiles(f)});retain('authoring-rejections',observed);
    assert.match(error?.code||'',/^E_PROJECT_TRANSACTION_/);equal(productFiles(f),before,'rejected '+label+' performs no business write');
  }
  const notePath=path.join(f.root,'notes.craftsman.json'),foreign=doc.notes.find(n=>n.manuscript?.reference.sceneId!==scene.relativeFile&&n.manuscript),own=doc.notes.find(n=>n.manuscript?.reference.sceneId===scene.relativeFile);
  const row=(note,operation='delete')=>({operationId:'word-note-return-'+sha('owned-receipt-control'+'\n'+'c'.repeat(64)),inputDigest:'a'.repeat(64),resultDigest:'b'.repeat(64),roundId:'owned-receipt-control',artifactSha256:'c'.repeat(64),
    changes:[{noteId:note.id,operation,before:cloneJsonSafe(note.manuscript),after:null}]});
  for(const [label,receipt,allowed] of [['foreign-deleted',row(foreign),true],['own-deleted',row(own),false],
    ['foreign-null-null',{...row(foreign),changes:[{noteId:foreign.id,operation:'delete',before:null,after:null}]},false],
    ['foreign-unknown-operation',{...row(foreign),changes:[{...row(foreign).changes[0],operation:'invented'}]},false],['unknown-row',{opaque:true},false]]) {
    const d=cloneJsonSafe(doc);d.wordNoteReturnReceipts=[receipt];if(label.endsWith('deleted'))d.notes.find(n=>n.id===(allowed?foreign:own).id).deleted=true;
    fs.writeFileSync(notePath,JSON.stringify(d));const before=productFiles(f);let result,error;
    try{result=await queryNovel(f,scene);}catch(e){error={code:e.code,message:e.message};}
    observed.push({label,receipt,document:d,before,result,error,after:productFiles(f)});retain('authoring-rejections',observed);
    assert.equal(!!result,allowed,'scoped receipt '+label);if(!allowed)assert.match(error?.code||'',/^E_PROJECT_TRANSACTION_NOTE_READBACK$/);
    equal(productFiles(f),before,'receipt observation is read-only');fs.writeFileSync(notePath,noteText);
  }
  const commitPath=tx.commitPathFor(scenePath),original=fs.readFileSync(commitPath);
  for(const [label,bytes] of [['missing-commit',null],['legacy-commit',JSON.stringify({...JSON.parse(original),schemaVersion:tx.COMMIT_SCHEMA_VERSION,resources:undefined,noteState:undefined,commentState:undefined})]]) {
    if(bytes===null)fs.unlinkSync(commitPath);else fs.writeFileSync(commitPath,bytes);
    const before=productFiles(f);let error;try{await queryNovel(f,scene);}catch(e){error={code:e.code,message:e.message};}
    observed.push({label,before,error,after:productFiles(f)});retain('authoring-rejections',observed);
    assert.equal(error?.code,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');equal(productFiles(f),before,'selected but unproven cannot fall back');fs.writeFileSync(commitPath,original);
  }
  const committed=await runCapturedAuthoring(f,request);assert.equal(committed.success,true);
  const foreignScene=f.scenes.at(-1),foreignRaw=textFile(path.join(f.root,foreignScene.relativeFile));
  const foreignAuthored=await actualCommentAuthoring(f,foreignScene,'create',{requestId:'foreign-owned-create',body:'Foreign canonical root',
    anchor:{paragraphIndex:0,startUtf16:0,selectedText:anchors.paragraphs(foreignRaw)[0].text.slice(0,2)}});
  assert.equal(foreignAuthored.result.ok,true,'real canonical foreign action is allowed');
  const firstProjection=await queryNovel(f,scene);observed.push({label:'actual-foreign-comment',foreignAuthored,firstProjection});retain('authoring-rejections',observed);
  const latest=JSON.parse(textFile(commitPath)),origin=latest.resources.find(r=>r.path.includes('.yalken-recovery'));
  const latestPath=tx.recoveryPacketPathFor(f.manifestPath,latest.transactionId);
  for(const [label,target,mutate] of [
    ['missing-origin',origin.path,()=>null],['oversize-origin',origin.path,()=>Buffer.alloc(20*1024*1024+1,32)],
    ['missing-latest',latestPath,()=>null],['stale-latest',latestPath,()=>fs.readFileSync(origin.path)],
    ['oversize-latest',latestPath,()=>Buffer.alloc(32*1024*1024+1,32)],
    ['tampered-manifest',f.manifestPath,old=>{const d=JSON.parse(old);d.uncommitted='foreign';return JSON.stringify(d);}],
    ['own-note-metadata',notePath,old=>{const d=JSON.parse(old);d.notes.find(n=>n.manuscript?.reference.sceneId===scene.relativeFile).untrustedHistory=['invented'];return JSON.stringify(d);}],
    ['own-comment-body',commentPath(f),old=>{const d=JSON.parse(old);d.threads.find(t=>t.sceneId===scene.relativeFile && t.threadId.startsWith('local-comment-')).messages[0].body+='forged';return JSON.stringify(d);}],
    ['own-comment-event',commentPath(f),old=>{const d=JSON.parse(old);d.events.find(e=>e.operationId==='owned-create').action='resolve';return JSON.stringify(d);}],
    ['unknown-foreign-comment-event',commentPath(f),old=>{const d=JSON.parse(old);d.events.at(-1).unknown=true;return JSON.stringify(d);}],
  ]) {
    const original=fs.readFileSync(target),replacement=mutate(original);if(replacement===null)fs.unlinkSync(target);else fs.writeFileSync(target,replacement);
    const before=productFiles(f);let error;try {await queryNovel(f,scene);}catch(e){error={code:e.code,message:e.message};}
    observed.push({label,target,before,error,after:productFiles(f)});retain('authoring-rejections',observed);
    assert.match(error?.code||'',/^E_PROJECT_/,'unproven '+label+' refuses');equal(productFiles(f),before,'query cannot rewrite '+label);fs.writeFileSync(target,original);
  }
  const legacy=await projectFixture(t,'legacy-new-mode',{canonicalNotes:true}),legacyScene={relativeFile:'roman/Old.txt'},legacyPath=path.join(legacy.root,legacyScene.relativeFile);
  const fake={schemaVersion:'yalken.project-transaction.commit.v7',transactionId:'d'.repeat(64),revision:0,scenePath:legacyPath,manifestPath:legacy.manifestPath,
    sceneDigest:sha(textFile(legacyPath)),manifestDigest:sha(textFile(legacy.manifestPath)),commentState:{mode:'COMMENT_AUTHORING_V1',beforeDigest:'e'.repeat(64),afterDigest:'f'.repeat(64)}};
  fs.writeFileSync(tx.commitPathFor(legacyPath),JSON.stringify(fake));
  for(const read of [()=>queryNovel(legacy,legacyScene),()=>tx.readVerifiedProjectTransaction({scenePath:legacyPath,manifestPath:legacy.manifestPath})]) {
    const before=productFiles(legacy);let error;try{await read();}catch(e){error={code:e.code,message:e.message};}
    observed.push({label:'persisted-legacy-new-mode',fake,before,error,after:productFiles(legacy)});retain('authoring-rejections',observed);
    assert.equal(error?.code,'E_PROJECT_TRANSACTION_NOVEL_ORIGIN');equal(productFiles(legacy),before,'persisted mode is not authority');
  }
});
test('novel import: actual Main annotation publication revalidates late and recovers exact before/after states with direct origin',async t=>{
  const outcomes=[];
  for(const stage of ['stale-before-journal','stale-before-publish','comment-publish','commit-marker','cleanup']) {
    const f=await importedTiny(t,'authoring-fault-'+stage,{canonicalNotes:true}),scene=f.scenes[0],scenePath=path.join(f.root,scene.relativeFile),before=productFiles(f);
    let calls=0,fired=false;
    const adapter={...fsp,rename:async(a,b)=>{if(!fired&&(stage==='comment-publish'&&b===commentPath(f)||stage==='commit-marker'&&b===tx.commitPathFor(scenePath))){fired=true;throw Error('owned fault '+stage);}return fsp.rename(a,b);},
      unlink:async p=>{if(!fired&&stage==='cleanup'&&p===tx.journalPathFor(f.manifestPath)){fired=true;throw Error('owned fault cleanup');}return fsp.unlink(p);}};
    const authored=await actualCommentAuthoring(f,scene,'create',{body:'Fault-bound root',anchor:{paragraphIndex:0,startUtf16:0,selectedText:anchors.paragraphs(textFile(scenePath))[0].text.slice(0,2)}},
      {commit:args=>tx.commitProjectTransaction({...args,fsAdapter:adapter,revalidate:async()=>{await args.revalidate();calls++;
        if(!fired&&(stage==='stale-before-journal'&&calls===1||stage==='stale-before-publish'&&calls===3)){fired=true;throw Object.assign(Error('owned lifecycle changed'),{code:'OWNED_LIFECYCLE_CHANGED'});}}})});
    const interrupted=productFiles(f),journal=fs.existsSync(tx.journalPathFor(f.manifestPath))?textFile(tx.journalPathFor(f.manifestPath)):null;
    assert.equal(authored.result.ok,false,'real Main reports failed '+stage);assert.equal(fired,true);
    let recovered;
    if(journal) recovered=await f.transactionAuthority.withProjectLease(f.projectId,lease=>lease.publish(()=>tx.recoverProjectTransaction({scenePath,manifestPath:f.manifestPath,
      verifyManifestContinuation:q=>f.transactionAuthority.verifyManifestContinuation({...q,projectId:f.projectId}),
      publishManifest:({manifestPath:targetPath,expectedText,nextText})=>f.transactionAuthority.commitManifestText({projectId:f.projectId,lease,targetPath,expectedText,nextText})})));
    const after=productFiles(f),reopened=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined}),verified=await verifyAllSiblings({...f,...reopened});
    outcomes.push({stage,calls,before,authored,interrupted,journal,recovered,after,verified});retain('authoring-recovery',outcomes);
    if(stage==='cleanup') {assert.equal(recovered.outcome,'COMMITTED_CONVERGED');assert.notEqual(textFile(commentPath(f)),before[path.relative(f.root,commentPath(f))].toString());}
    else {if(journal)assert.equal(recovered.outcome,'UNCOMMITTED_ROLLED_BACK');for(const [name,bytes] of Object.entries(before))assert.ok(after[name]?.equals(bytes),'exact preexisting business rollback '+name);}
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
    const saved=await saveOrdinaryScene({...f,...reopened},scene,'AFTER_RECOVERY');outcomes.at(-1).saved=saved;retain('authoring-recovery',outcomes);assert.equal(saved.result.success,true);
  }
});

test('novel import: genuine changed-note plan has an explicit typed Apply gap and cannot bypass canonical-authoring scope',async t=>{
  const f=await importedTiny(t,'changed-note-return',{canonicalNotes:true}),scene=f.scenes[0],x=await exportImported(f);
  const extracted=x.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(x.bytes);assert.equal(extracted.ok,true);
  const original=extracted.parts['word/footnotes.xml'];assert.ok(original.includes('second line'));
  const parts={...extracted.parts,'word/footnotes.xml':original.replace('second line','second line changed in Word')};
  const returnedBytes=buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data})));
  const analysis=x.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:returnedBytes},{cryptoPort:actualCryptoPort()});assert.equal(analysis.ok,true);
  const returnedNotes=x.bridge.parseDocumentNotesRichReturn(returnedBytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true});
  const document=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json')));
  const plan=require('../../src/core/word-note-return-delta-v1.cjs').planNoteReturnDelta({document,projectId:f.projectId,roundId:'actual-changed-return-gap',
    artifactSha256:sha(returnedBytes),baseline:x.source.documentNotes,exportMap:x.source.localAuthorityCapsule.exportMap,returnedNotes,
    returnedParagraphs:analysis.reviewIr.formattingParagraphs,now:'2026-10-09T00:00:01.000Z'});
  assert.equal(plan.changes.length,1,'complete existing Core return plan observes the real rich XML edit');
  const outcome=await actualNotesAuthoring(f,scene,'manuscript','update',undefined,{document:plan.document});
  retain('changed-return-typed-gap',{sourceInput:x.input,source:x.source,originalBytes:x.bytes,returnedBytes,analysis,returnedNotes,plan,outcome});
  assert.equal(outcome.error?.code,'E_PROJECT_TRANSACTION_NOTE_STATE','changed authenticated return has no canonical-authoring bypass');
  for(const [name,bytes] of Object.entries(outcome.before))assert.ok(outcome.after[name]?.equals(bytes),'typed refusal preserves every existing business byte');
});

function portableFullNovelBytes(paragraphs) {
  const O='http://schemas.openxmlformats.org/officeDocument/2006/relationships', P='http://schemas.openxmlformats.org/package/2006/relationships';
  const W14='http://schemas.microsoft.com/office/word/2010/wordml',W15='http://schemas.microsoft.com/office/word/2012/wordml';
  const xml=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const body=paragraphs.map((text,i)=>{
    const root=i<200?i*2:null, note=i===0?'<w:r><w:footnoteReference w:id="7"/></w:r>':i===Math.floor(paragraphs.length/2)?'<w:r><w:endnoteReference w:id="8"/></w:r>':i===paragraphs.length-1?'<w:r><w:footnoteReference w:id="9"/></w:r>':'';
    return `<w:p>${root===null?'':`<w:commentRangeStart w:id="${root}"/>`}<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU"/>${i%2?'<w:b/>':'<w:i/>'}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>${root===null?'':`<w:commentRangeEnd w:id="${root}"/><w:r><w:commentReference w:id="${root}"/></w:r>`}${note}</w:p>`;
  }).join('');
  const comments=Array.from({length:400},(_,i)=>`<w:comment w:id="${i}" w:author="${i%2?'Corrector':'Editor'}" w:date="2026-10-09T00:00:00Z"><w:p w14:paraId="${(i+1).toString(16).padStart(8,'0')}"><w:r><w:rPr><w:b/></w:rPr><w:t>${i%2?'Complete reply 漢字':'Complete root Ж🧭'} ${i}</w:t></w:r></w:p></w:comment>`).join('');
  const commentEx=Array.from({length:400},(_,i)=>`<w15:commentEx w15:paraId="${(i+1).toString(16).padStart(8,'0')}"${i%2?` w15:paraIdParent="${i.toString(16).padStart(8,'0')}"`:''} w15:done="0"/>`).join('');
  const note=(kind,id)=>`<w:${kind} w:id="${id}"><w:p><w:r><w:${kind}Ref/></w:r><w:r><w:rPr><w:b/><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU"/></w:rPr><w:t xml:space="preserve"> Complete note ${id} Ж🧭 </w:t><w:br/><w:t>second line 漢字</w:t></w:r></w:p><w:p/></w:${kind}>`;
  const types=['document','comments','commentsExtended','footnotes','endnotes'];
  return buildStoredZip([
    {name:'[Content_Types].xml',data:`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${types.map(n=>`<Override PartName="/word/${n}.xml" ContentType="${n==='commentsExtended'?'application/vnd.ms-word.commentsExtended+xml':'application/vnd.openxmlformats-officedocument.wordprocessingml.'+(n==='document'?'document.main':n)+'+xml'}"/>`).join('')}</Types>`},
    {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="d" Type="${O}/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}">${types.filter(n=>n!=='document').map(n=>`<Relationship Id="${n}" Type="${n==='commentsExtended'?'http://schemas.microsoft.com/office/2011/relationships/commentsExtended':O+'/'+n}" Target="${n}.xml"/>`).join('')}</Relationships>`},
    {name:'word/document.xml',data:`<w:document xmlns:w="${W_NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`},
    {name:'word/comments.xml',data:`<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14}">${comments}</w:comments>`},
    {name:'word/commentsExtended.xml',data:`<w15:commentsEx xmlns:w15="${W15}">${commentEx}</w15:commentsEx>`},
    {name:'word/footnotes.xml',data:`<w:footnotes xmlns:w="${W_NS}">${note('footnote',7)}${note('footnote',9)}</w:footnotes>`},
    {name:'word/endnotes.xml',data:`<w:endnotes xmlns:w="${W_NS}">${note('endnote',8)}</w:endnotes>`},
  ]);
}
function retainDirectory(name,files) {
  const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;if(!evidence)return null;
  const root=path.join(evidence,name);assert.equal(fs.existsSync(root),false,'fresh physical evidence directory');
  fs.mkdirSync(root,{recursive:true});
  for(const [relative,bytes] of Object.entries(files))if(Buffer.isBuffer(bytes)) {
    const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  }
  return root;
}
async function runFullNovelImportProof(t,{bytes,label}) {
  const f=await projectFixture(t,'full500k-'+label,{canonicalNotes:true}),evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;
  const inputDir=evidence||f.root,sourcePath=path.join(inputDir,label+'-input.docx');assert.equal(fs.existsSync(sourcePath),false);fs.mkdirSync(inputDir,{recursive:true});fs.writeFileSync(sourcePath,bytes);
  const port=await mainProjectPort(f,{localPath:sourcePath}),handlers={
    'cmd.project.docx.previewLocalFile':port.handleDocxImportLocalFilePreviewCommandSurface,
    'cmd.project.docx.previewImportPlan':port.handleDocxImportPreviewCommandSurface,
    'cmd.project.docx.importSafeCreate':port.handleDocxImportSafeCreateCommandSurface};
  const timings=[];
  const dispatch=async(id,payload)=>{const start=process.hrtime.bigint(),result=await handlers[id](payload);const seconds=Number(process.hrtime.bigint()-start)/1e9;timings.push({id,seconds});retain(label+'-timings',timings);assert.ok(seconds<120,'actual public handler remains below existing120s: '+id);return result;};
  const local=await dispatch('cmd.project.docx.previewLocalFile',{requestId:label+'-local'});
  retain(label+'-local',{bytes,local,timings});assert.equal(local.contentPreviewOk,true,`complete local parser: ${local.reason||local.code}`);
  assert.match(local.docxContentPreviewRef,/^[a-f0-9]{64}$/);
  const beforePlan=productFiles(f),preview=await dispatch('cmd.project.docx.previewImportPlan',{requestId:label+'-plan',docxContentPreviewRef:local.docxContentPreviewRef});
  assert.equal(preview.importPreviewOk,true,`full preview: ${preview.reason||preview.code}`);equal(productFiles(f),beforePlan,'local/plan preview never writes canonical product files');
  const candidate=preview.docxImportPreviewPlan.candidateCreatePlan;
  assert.equal(candidate.entries.length,42);assert.equal(candidate.sceneStrategy,'word-novel-root-partitions');
  const expectedParagraphs=envelope.parseObservablePayload(candidate.sourceCandidate.content).doc.content;
  assert.equal(expectedParagraphs.length,8391);assert.equal(bookmarks.paragraphs({type:'doc',content:expectedParagraphs}).map(bookmarks.textOf).join(' ').trim().split(/\s+/u).length,500108);
  assert.equal(candidate.sourceCandidate.notes.length,3);assert.equal(candidate.sourceCandidate.comments.length,200);
  assert.equal(candidate.sourceCandidate.comments.reduce((sum,c)=>sum+c.messages.length,0),400);
  const accepted=await dispatch('cmd.project.docx.importSafeCreate',{requestId:label+'-import',docxImportPreviewRef:preview.docxImportPreviewRef});
  retain(label+'-accepted',{accepted,preview,timings,calls:port.calls});assert.equal(accepted.ok,true,`full public SafeCreate: ${accepted.error?.reason||accepted.reason||accepted.code}`);
  f.scenes=accepted.receipt.createdScenes;assert.equal(f.scenes.length,42);
  const initial=productFiles(f),initialRoot=retainDirectory(label+'-initial',initial);
  const expectedPath=evidence?path.join(evidence,label+'-expected-canonical-paragraphs.json'):null;
  if(expectedPath)fs.writeFileSync(expectedPath,JSON.stringify(expectedParagraphs));
  const actual=f.scenes.flatMap(scene=>envelope.parseObservablePayload(textFile(path.join(f.root,scene.relativeFile))).doc.content);
  equal(actual,expectedParagraphs,'complete durable paragraph structures, attributes and marks');
  const m=await modelPromise,expected=m.materializeDocxNovelCandidate({candidate,artifactSha256:preview.docxImportPreviewPlan.source.sourceArtifactSha256,
    projectId:f.projectId,operationId:accepted.receipt.importOperationId,operationNonce:label+'-import',now:accepted.receipt.createdAt,
    notesText:f.original['notes.craftsman.json'].toString(),commentsText:null});
  equal(JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),JSON.parse(expected.notesAfter),'all complete rich note bodies, points, private/deleted notes and document metadata');
  equal(JSON.parse(textFile(commentPath(f))),JSON.parse(expected.commentsAfter),'all200 root/reply threads,400 messages, author/date/format/range/provenance and state');
  const query=authority=>tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths:f.scenes.map(scene=>path.join(f.root,scene.relativeFile)),verifyManifestContinuation:args=>authority.verifyManifestContinuation({...args,projectId:f.projectId})});
  const records=(await query(f.transactionAuthority)).records;equal(records.map(r=>r.sceneDigest),f.scenes.map(scene=>scene.outputHash),'all42 current commit digests');
  const origin=tx.recoveryPacketPathFor(f.manifestPath,records[0].transactionId),originBytes=fs.readFileSync(origin);
  assert.ok(originBytes.length>0 && originBytes.length<=48*1024*1024,'actual full canonical novel packet fits finite48');
  if(label==='genuine500k')assert.ok(originBytes.length>32*1024*1024,'genuine SOURCE65 packet exercises capacity above ordinary32');
  const beforeReplay=productFiles(f),replay=await dispatch('cmd.project.docx.importSafeCreate',{requestId:label+'-import',docxImportPreviewRef:preview.docxImportPreviewRef});
  assert.equal(replay.ok,true);equal(productFiles(f),beforeReplay,'fresh same-nonce replay creates no duplicate and changes no file');
  port.sandbox.currentFilePath=path.join(f.root,f.scenes[0].relativeFile);
  const ack=await dispatch('cmd.project.docx.importSafeCreate',{action:'acknowledge-open',requestId:label+'-import',projectId:f.projectId,nodeId:accepted.publicSceneLocator.nodeId});
  assert.equal(ack.ok,true,JSON.stringify(ack));assert.equal(ack.cleared,true);assert.equal((await safe.readDocxImportAttempt(f)).record,null);
  let current=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined});
  await query(current.transactionAuthority);const saves=[];
  for(let round=0;round<2;round++) {
    if(round)current=await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined});
    for(const index of [0,21,41]) {
      const siblings=f.scenes.filter((_,i)=>i!==index).map(scene=>[scene.relativeFile,fs.readFileSync(path.join(f.root,scene.relativeFile))]);
      const save=await saveOrdinaryScene({...f,...current},f.scenes[index],label+'-SAVE-'+round+'-'+index);saves.push(save);
      assert.equal(save.result.success,true);assert.equal(save.verified.sceneDigest,sha(save.after));
      for(const [relative,prior] of siblings)assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(prior),'all41 sibling scene bodies remain exact after every Save');
    }
    const verified=await query(current.transactionAuthority);assert.equal(verified.records.length,42);
    for(const record of verified.records)assert.equal(record.sceneDigest,sha(fs.readFileSync(record.scenePath)),'every current chapter commit after reopen/Save');
  }
  const final=productFiles(f),finalRoot=retainDirectory(label+'-after-six-saves',final);
  for(const scene of f.scenes.filter((_,i)=>![0,21,41].includes(i)))assert.ok(final[scene.relativeFile].equals(initial[scene.relativeFile]),'all39 unedited chapters exact');
  for(const [name,prior] of Object.entries(f.original).filter(([name])=>!['project.craftsman.json','notes.craftsman.json'].includes(name)&&!name.startsWith('.test-authority/')))assert.ok(final[name]?.equals(prior),'all old/foreign files remain exact');
  equal(JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.slice(0,2),JSON.parse(f.original['notes.craftsman.json']).notes,'private/deleted notes exact after all six Saves');
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  const summary={label,projectId:f.projectId,paragraphs:8391,words:500108,chapters:42,notes:3,threads:200,messages:400,originBytes:originBytes.length,
    sourcePath,liveProjectRoot:f.root,initialRoot,expectedPath,finalRoot,importReceiptRelative:path.relative(f.root,path.join(f.root,'.yalken/docx-import/receipts',accepted.receipt.importOperationId+'.json')),
    sceneFiles:f.scenes.map(scene=>scene.relativeFile),timings,saves:saves.length};
  retain(label+'-complete',{summary,local,preview,accepted,replay,expected,initial,saves,final});
  if(evidence)fs.writeFileSync(path.join(evidence,label+'-summary.json'),JSON.stringify(summary,null,2)+'\n');
  return summary;
}
test('novel import: complete portable500108-word rich source uses actual public Main, real lease, reopen and six independent chapter Saves',async t=>{
  const {buildWordVolumeFixture}=await import('../../scripts/ops/rtk-interop-word-volume-fixtures.mjs');
  const corpus=buildWordVolumeFixture('LARGE_DOCUMENT');
  await runFullNovelImportProof(t,{bytes:portableFullNovelBytes(corpus.sourceParagraphs),label:'portable500k'});
});


test('novel import: private complete query regenerates once per call and refuses incomplete, foreign or stale cohorts',async t=>{
 const f=await importedTiny(t,'complete-query'),scenePaths=f.scenes.map(scene=>path.join(f.root,scene.relativeFile));
 const filename=require.resolve('../../src/core/project-transaction-v1.cjs'),{Module,createRequire}=require('node:module');
 const observed=new Module(filename);observed.filename=filename;observed.paths=Module._nodeModulePaths(path.dirname(filename));observed.require=createRequire(filename);
 const source=readSource(filename),needle='  model.validateProjectTreeCohort(packet.plan);';assert.equal(source.split(needle).length,2);
 observed._compile('let actualOriginRegenerations=0;\n'+source.replace(needle,needle+'\n  if(isNovelTreePacket(packet))actualOriginRegenerations++;')+'\nmodule.exports={...module.exports,actualOriginRegenerations:()=>actualOriginRegenerations};',filename);
 const request={manifestPath:f.manifestPath,projectId:f.projectId,scenePaths,verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})};
 const first=await observed.exports.readVerifiedProjectDocxNovelCohort(request);
 assert.equal(observed.exports.actualOriginRegenerations(),1,'actual complete semantic origin regeneration occurs once across all siblings');
 equal(first.records.map(record=>record.sceneDigest),f.scenes.map(scene=>scene.outputHash),'each member has its own original record');
 assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.records)&&first.records.every(Object.isFrozen));
 await observed.exports.readVerifiedProjectDocxNovelCohort(request);assert.equal(observed.exports.actualOriginRegenerations(),2,'fresh next invocation does not reuse a prior verification');
 for(const scenePath of [scenePaths[0],scenePaths.at(-1)])await observed.exports.readVerifiedProjectTransaction({...request,scenePath});
 assert.equal(observed.exports.actualOriginRegenerations(),4,'standalone selected reads remain independently regenerated');
 const outcomes=[];
 for(const [label,change] of [
  ['missing',{scenePaths:scenePaths.slice(0,-1)}],['extra',{scenePaths:[...scenePaths,path.join(f.romanRoot,'Old.txt')]}],
  ['duplicate',{scenePaths:[...scenePaths,scenePaths[0]]}],['reordered',{scenePaths:[...scenePaths].reverse()}],
  ['project',{projectId:'foreign'}],['caller-origin',{origin:{packet:'trusted'}}],['caller-invocation',{invocation:{origin:{}}}],
 ]) {
  const before=productFiles(f);let error;try{await tx.readVerifiedProjectDocxNovelCohort({...request,...change});}catch(e){error={code:e.code,message:e.message};}
  outcomes.push({label,error,before,after:productFiles(f)});retain('complete-query-negatives',outcomes);
  assert.match(error?.code||'',/^E_PROJECT_TRANSACTION_/);equal(productFiles(f),before,'query has no write authority for '+label);
 }
 const origin=tx.recoveryPacketPathFor(f.manifestPath,first.records[0].transactionId),receipt=path.join(f.root,'.yalken/docx-import/receipts',f.result.value.receipt.importOperationId+'.json');
 for(const [label,target] of [['early-scene',scenePaths[0]],['early-commit',tx.commitPathFor(scenePaths[0])],['origin',origin],['receipt',receipt],
  ['notes',path.join(f.root,'notes.craftsman.json')],['comments',commentPath(f)]]) {
  const original=fs.readFileSync(target);let fired=false,error;
  const adapter={...fsp,readFile:async(p,...args)=>{const value=await fsp.readFile(p,...args);if(!fired&&p===scenePaths.at(-1)){fired=true;fs.writeFileSync(target,Buffer.concat([original,Buffer.from(' changed')]));}return value;}};
  try{await tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:adapter});}catch(e){error={code:e.code,message:e.message};}
  const after=productFiles(f);outcomes.push({label,target,fired,error,after});retain('complete-query-negatives',outcomes);
  assert.equal(fired,true);assert.match(error?.code||'',/^E_PROJECT_TRANSACTION_/,'late '+label+' cannot publish a stale complete result');
  assert.ok(fs.readFileSync(target).equals(Buffer.concat([original,Buffer.from(' changed')])),'query never overwrites foreign bytes');fs.writeFileSync(target,original);
 }
 let afterLast=false,finalTargetReads=0,oversizeStats=0;
 const bounded={...fsp,readFile:async(p,...args)=>{if(afterLast&&p===scenePaths[0])finalTargetReads++;const value=await fsp.readFile(p,...args);if(p===scenePaths.at(-1))afterLast=true;return value;},
  stat:async p=>{const stat=await fsp.stat(p);if(afterLast&&p===scenePaths[0]){oversizeStats++;return {isFile:()=>true,size:stat.size+1};}return stat;}};
 await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:bounded}),e=>e.code==='E_PROJECT_TRANSACTION_NOVEL_STALE');
 assert.equal(oversizeStats,1);assert.equal(finalTargetReads,0,'a changed oversize stat refuses before final allocation, using only tiny ordinary bytes');
 retain('complete-query-bounded-final-read',{afterLast,oversizeStats,finalTargetReads});
 const initialBounds=[];
 for(const [kind,target] of [['journal',tx.journalPathFor(f.manifestPath)],['scene',scenePaths[0]],['manifest',f.manifestPath]]) {
  let reads=0,stats=0;const adapter={...fsp,stat:async p=>{if(p===target){stats++;return {size:32*1024*1024+1,isFile:()=>true};}return fsp.stat(p);},
   readFile:async(p,...args)=>{if(p===target)reads++;return fsp.readFile(p,...args);}};
  await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:adapter}),e=>e.code==='E_PROJECT_TRANSACTION_RESOURCE_BUDGET');
  assert.equal(stats,1);assert.equal(reads,0,'initial '+kind+' oversize refuses before allocation');initialBounds.push({kind,stats,reads});
 }
 for(const size of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
  let reads=0;const adapter={...fsp,stat:async p=>p===scenePaths[0]?{size,isFile:()=>true}:fsp.stat(p),readFile:async(p,...args)=>{if(p===scenePaths[0])reads++;return fsp.readFile(p,...args);}};
  await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:adapter}),e=>e.code==='E_PROJECT_TRANSACTION_RESOURCE_BUDGET');assert.equal(reads,0,'invalid stat size never allocates');
 }
 let grewReads=0;const grew={...fsp,stat:async p=>p===scenePaths[0]?{size:0,isFile:()=>true}:fsp.stat(p),readFile:async(p,...args)=>{if(p===scenePaths[0]){grewReads++;return Buffer.from('tiny grew');}return fsp.readFile(p,...args);}};
 await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:grew}),e=>e.code==='E_PROJECT_TRANSACTION_NOVEL_STALE');assert.equal(grewReads,1,'post-read length detects growth with only9 actual bytes');
 retain('complete-query-bounded-initial-read',{initialBounds,grewReads});
});

test('novel import: Main refuses early member changes during its post-SafeCreate attempt await before publishing open acknowledgement',async t=>{
 const f=await projectFixture(t,'main-final-await'),source=await tinyPlan(20,{inflate:10000});let fired=false,foreign;
 const port=await mainProjectPort(f,{afterAttempt:async result=>{
  if(fired||!result.record)return;const receipt=JSON.parse(textFile(path.join(f.root,'.yalken/docx-import/receipts',result.record.importOperationId+'.json')));
  const target=path.join(f.root,receipt.createdScenes[0].relativeFile),before=fs.readFileSync(target);foreign={target,before,after:Buffer.concat([before,Buffer.from(' foreign late')] )};fired=true;fs.writeFileSync(target,foreign.after);
 }});
 const preview=await port.handleDocxImportPreviewCommandSurface({requestId:'late-plan',docxContentPreviewReport:source.report});assert.equal(preview.importPreviewOk,true);
 const result=await port.handleDocxImportSafeCreateCommandSurface({requestId:'late-final-await',docxImportPreviewRef:preview.docxImportPreviewRef});
 retain('main-post-helper-await-refusal',{result,fired,foreign,files:productFiles(f),calls:port.calls});
 assert.equal(fired,true);assert.equal(result.ok,false);assert.equal(result.error?.code,'E_DOCX_IMPORT_ACK_PREPARATION_FAILED');
 assert.ok(fs.readFileSync(foreign.target).equals(foreign.after),'final refusal does not overwrite changed authored state');assert.ok((await safe.readDocxImportAttempt(f)).record,'attempt remains recoverable');
});


test('novel import: one protected indivisible partition remains a complete supported cohort and existing512 admission is preserved',async t=>{
 const bridge=await import('../../src/io/revisionBridge/index.mjs'),original=richNovelBytes(40,{notes:false});
 const extracted=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(original);assert.equal(extracted.ok,true);
 const parts={...extracted.parts};let xml=parts['word/document.xml'];
 xml=xml.replace('<w:commentRangeStart w:id="0"/>','').replace('<w:commentRangeEnd w:id="0"/>','').replace('<w:r><w:commentReference w:id="0"/></w:r>','');
 xml=xml.replace('<w:p>','<w:p><w:commentRangeStart w:id="0"/>');
 const last=xml.lastIndexOf('</w:p>');xml=xml.slice(0,last)+'<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>'+xml.slice(last);parts['word/document.xml']=xml;
 const bytes=buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data}))),report=bridge.buildDocxContentPreviewFromZipBytes(bytes);
 const plan=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(report,{targetParagraphs:4});assert.equal(plan.ok,true);
 assert.equal(plan.candidateCreatePlan.sceneStrategy,'word-novel-root-partitions');assert.equal(plan.candidateCreatePlan.entries.length,1);
 const f=await projectFixture(t,'one-protected-partition'),applied=await applyPlan(f,plan,'one-protected');assert.equal(applied.ok,true,JSON.stringify(applied.error));
 const scenePaths=applied.value.receipt.createdScenes.map(scene=>path.join(f.root,scene.relativeFile));
 const verified=await tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths});assert.equal(verified.records.length,1);
 const many=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(novelBytes(512)),{targetParagraphs:1});
 assert.equal(many.ok,true);assert.equal(many.candidateCreatePlan.entries.length,512,'unchanged model512 exact supported membership');
 let reads=0;const deniedFs={...fsp,readFile:async()=>{reads++;throw Object.assign(Error('owned absent source'),{code:'ENOENT'});}};
 const request={manifestPath:f.manifestPath,projectId:f.projectId,scenePaths:Array.from({length:512},(_,i)=>path.join(f.romanRoot,'selected-'+i+'.txt')),fsAdapter:deniedFs};
 await assert.rejects(tx.readVerifiedProjectDocxNovelCohort(request),/COMMIT_READBACK/);assert.ok(reads>0,'512 metadata reaches independent readback; no arbitrary256 restriction');
 reads=0;await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,scenePaths:[...request.scenePaths,path.join(f.romanRoot,'selected-512.txt')]}),/NOVEL_COHORT/);assert.equal(reads,0,'513 refuses before reads');
 retain('one-and512-supported',{bytes,report,plan,applied,verified,many});
});

function actualTreePacketObserver() {
 const filename=require.resolve('../../src/core/project-transaction-v1.cjs'),{Module,createRequire}=require('node:module');
 const observer=new Module(filename);observer.filename=filename;observer.paths=Module._nodeModulePaths(path.dirname(filename));observer.require=createRequire(filename);
 observer._compile(readSource(filename)+'\nmodule.exports={buildTreeEntries,canonicalBytes,validateTreePacket,parseTreeJournal};',filename);return observer.exports;
}
async function novelPacketFactory(f,source) {
 const base=await plannedTiny(f,source,'finite-boundary'),m=await modelPromise,core=actualTreePacketObserver();
 const make=(oldBytes,metadataBytes=0)=>{
  const input=cloneJsonSafe(base.input);input.beforeManifestText=JSON.stringify({...JSON.parse(input.beforeManifestText),privateMetadata:'x'.repeat(metadataBytes)});
  input.inventory.find(entry=>entry.relativePath==='roman/Old.txt').contentBase64=Buffer.from('O'.repeat(oldBytes)).toString('base64');
  const plan=m.planProjectDocxImportCohort(input),revision=1,transactionId=sha(`${plan.projectId}\n${plan.planDigest}\n${revision}`);
  const packet={schemaVersion:'yalken.project-transaction.journal.v7',projectId:plan.projectId,manifestPath:f.manifestPath,transactionId,revision,plan,
   entries:core.buildTreeEntries(plan,f.manifestPath,revision,transactionId)};
  return {packet,bytes:Buffer.byteLength(core.canonicalBytes(packet)),oldBytes,metadataBytes};
 };
 const zero=make(0),three=make(3),metadata=make(0,1);
 assert.equal(three.bytes-zero.bytes,20,'five real base64 before/after bindings grow20B for3 literal bytes');
 assert.equal(metadata.bytes-zero.bytes,3,'three protected real manifest snapshots grow3B per metadata byte');
 const exact=target=>{const residual=(target-zero.bytes)%20,metadataBytes=(residual*7)%20;
  const oldBytes=((target-zero.bytes-3*metadataBytes)/20)*3;assert.ok(Number.isSafeInteger(oldBytes)&&oldBytes>0);
  const built=make(oldBytes,metadataBytes);assert.equal(built.bytes,target,'exact semantic canonical packet bytes');return built;};
 return {core,m,make,exact};
}
test('novel import: semantic origin and wrapped journal enforce exact48MiB and genuine plus1 without padding the packet',async t=>{
 const f=await projectFixture(t,'semantic48'),source=await tinyPlan(20),factory=await novelPacketFactory(f,source),limit=48*1024*1024,before=productFiles(f);
 const admitted=factory.exact(limit);assert.ok(Buffer.byteLength(factory.core.canonicalBytes(admitted.packet.plan))<32*1024*1024,'unchanged pure candidate32 bound');
 assert.equal(await factory.core.validateTreePacket(admitted.packet,f.manifestPath),admitted.packet,'full independent model regeneration accepts exact48');
 const refused=factory.exact(limit+1);await assert.rejects(factory.core.validateTreePacket(refused.packet,f.manifestPath),e=>e.code==='E_TREE_COHORT_BUDGET');
 const compact=factory.make(0),packet=compact.packet,receipt={schemaVersion:'yalken.project-transaction.tree-receipt.v1',projectId:f.projectId,
  transactionId:packet.transactionId,packetDigest:factory.m.projectTreeCohortDigest(packet),treeRevision:1,kind:packet.plan.kind};
 const journal={schemaVersion:packet.schemaVersion,manifestPath:f.manifestPath,transactionId:packet.transactionId,packet,
  previousReceiptText:'',receiptText:factory.core.canonicalBytes(receipt)};
 const overhead=Buffer.byteLength(factory.core.canonicalBytes(journal));journal.previousReceiptText='p'.repeat(limit-overhead);
 const exactJournal=factory.core.canonicalBytes(journal);assert.equal(Buffer.byteLength(exactJournal),limit);
 assert.equal((await factory.core.parseTreeJournal(exactJournal,f.manifestPath)).packet.transactionId,packet.transactionId,'complete wrapped exact48 semantic parser acceptance');
 await assert.rejects(factory.core.parseTreeJournal(exactJournal+' ',f.manifestPath),e=>e.code==='E_TREE_COHORT_BUDGET','genuine wrapped plus1');
 const negatives=[];
 for(const [label,mutate,code] of [
  ['project',j=>{j.packet.projectId='foreign';},'E_TREE_COHORT_JOURNAL'],
  ['shape',j=>{delete j.packet.plan.input.candidate.policy;},'E_DOCX_NOVEL_STRATEGY'],
  ['recipe',j=>{j.packet.plan.input.candidate.policy.targetParagraphs=1;},'E_DOCX_NOVEL_PLAN_MISMATCH'],
  ['entries',j=>{j.packet.entries[0].afterBase64='Zm9yZ2Vk';},'E_TREE_COHORT_JOURNAL_BINDING'],
  ['envelope',j=>{j.transactionId='f'.repeat(64);},'E_TREE_COHORT_JOURNAL'],
  ['receipt-digest',j=>{j.receiptText=JSON.stringify({...receipt,packetDigest:'f'.repeat(64)});},'E_TREE_COHORT_RECEIPT'],
  ['receipt-kind',j=>{j.receiptText=JSON.stringify({...receipt,kind:'rename'});},'E_TREE_COHORT_RECEIPT'],
 ]) {const j=cloneJsonSafe({...journal,previousReceiptText:null});mutate(j);let error;try{await factory.core.parseTreeJournal(factory.core.canonicalBytes(j),f.manifestPath);}catch(e){error={code:e.code,message:e.message};}
  negatives.push({label,error});assert.equal(error?.code,code,'exact typed '+label+' refusal');}
 equal(productFiles(f),before,'all parser/boundary probes remain read-only');
 retain('semantic48-boundaries',{source,admitted,refused,exactJournal,negatives,before,after:productFiles(f)});
});
test('novel import: caller-plan mutation across revalidation cannot change the privately verified publication',async t=>{
 const f=await projectFixture(t,'caller-plan-await'),source=await tinyPlan(20),original=await plannedTiny(f,source),plan=cloneJsonSafe(original);let changed=false;
 const result=await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:directPublisher(),revalidate:async()=>{
  if(!changed){changed=true;plan.input.candidate.sourceCandidate.content+=' caller invented text';plan.entries.find(e=>e.role==='scene'&&e.beforeBase64===null).afterBase64=Buffer.from('caller invented text').toString('base64');}
 }});
 assert.equal(changed,true);assert.equal(result.success,true);const packet=JSON.parse(textFile(tx.recoveryPacketPathFor(f.manifestPath,result.transactionId)));
 equal(packet.plan,original,'only complete admitted immutable meaning is published');
 const query=await tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths:original.importReceipt.createdScenes.map(scene=>path.join(f.root,scene.relativeFile))});
 equal(query.records.map(r=>r.sceneDigest),original.importReceipt.createdScenes.map(scene=>scene.outputHash),'all durable chapter bytes ignore mutable caller replacements');
 retain('caller-plan-await-sealed',{source,original,changedPlan:plan,result,packet,query,files:productFiles(f)});
 const immediate=await projectFixture(t,'caller-initial-microtask'),immediateOriginal=await plannedTiny(immediate,source,'original-admitted'),replacement=await plannedTiny(immediate,source,'foreign-microtask'),mutable=cloneJsonSafe(immediateOriginal);let fired=false;
 const pending=tx.commitProjectTransaction({manifestPath:immediate.manifestPath,revision:1,treeCohort:mutable,publishManifest:directPublisher(),revalidate:async()=>{}});
 queueMicrotask(()=>{for(const key of Object.keys(mutable))delete mutable[key];Object.assign(mutable,cloneJsonSafe(replacement));fired=true;});
 const complete=await pending;assert.equal(fired,true);assert.equal(complete.success,true);
 const sealed=JSON.parse(textFile(tx.recoveryPacketPathFor(immediate.manifestPath,complete.transactionId)));
 equal(sealed.plan,immediateOriginal,'even an independently valid replacement in the first microtask cannot change admitted source or operation identity');
 retain('caller-initial-microtask-sealed',{source,immediateOriginal,replacement,mutable,fired,complete,sealed,files:productFiles(immediate)});
});
test('novel import: typed original and journal above32MiB recover before and after commit without weakening corruption or symlink refusal',async t=>{
 const source=await tinyPlan(20),outcomes=[];
 for(const stage of ['before-marker','after-marker']) {
  const f=await projectFixture(t,'large-journal-'+stage),factory=await novelPacketFactory(f,source),built=factory.exact(40*1024*1024),plan=built.packet.plan;
  fs.writeFileSync(path.join(f.romanRoot,'Old.txt'),'O'.repeat(built.oldBytes));fs.writeFileSync(f.manifestPath,plan.beforeManifestText);
  const before=productFiles(f);let fired=false,error;
  const adapter={...fsp,unlink:async p=>{if(stage==='after-marker'&&!fired&&p===tx.journalPathFor(f.manifestPath)){fired=true;throw Error('owned large cleanup');}return fsp.unlink(p);}};
  try{await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:directPublisher(),revalidate:async()=>{},fsAdapter:adapter,
   afterTreeFilesPublish:()=>{if(stage==='before-marker'){fired=true;throw Error('owned large pre-marker');}}});}catch(e){error={code:e.code,message:e.message};}
  assert.equal(fired,true);assert.ok(error);const journalPath=tx.journalPathFor(f.manifestPath),journal=fs.readFileSync(journalPath);
  assert.ok(journal.length>32*1024*1024&&journal.length<=48*1024*1024,'actual complete wrapped journal uses only typed48');
  const corrupted=JSON.parse(journal);corrupted.packet.entries[0].afterBase64='Zm9yZ2Vk';fs.writeFileSync(journalPath,JSON.stringify(corrupted));const foreign=productFiles(f);
  await assert.rejects(tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:directPublisher(),revalidate:async()=>{}}),e=>e.code==='E_TREE_COHORT_JOURNAL_BINDING');
  equal(productFiles(f),foreign,'corrupt journal refusal preserves every foreign byte');fs.writeFileSync(journalPath,journal);
  const recovered=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:directPublisher(),revalidate:async()=>{}}),after=productFiles(f);
  assert.equal(recovered.outcome,stage==='before-marker'?'UNCOMMITTED_ROLLED_BACK':'COMMITTED_ROLLED_FORWARD');
  if(stage==='before-marker')equal(Object.fromEntries(Object.entries(after).filter(([p])=>!p.startsWith('.yalken-recovery/'))),before,'all original business bytes roll back exactly');
  else {
   const scenePaths=plan.importReceipt.createdScenes.map(scene=>path.join(f.root,scene.relativeFile)),query=await tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths});
   equal(query.records.map(r=>r.sceneDigest),plan.importReceipt.createdScenes.map(scene=>scene.outputHash),'complete fresh recovered membership');
   const origin=tx.recoveryPacketPathFor(f.manifestPath,query.records[0].transactionId),originBytes=fs.readFileSync(origin),foreignPath=path.join(f.root,'foreign-original.json');
   fs.renameSync(origin,foreignPath);fs.symlinkSync(foreignPath,origin);const linked=productFiles(f);
   await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths}),/RESOURCE_BOUNDARY/);
   equal(productFiles(f),linked,'large origin symlink never grants read/publication or write authority');fs.unlinkSync(origin);fs.renameSync(foreignPath,origin);assert.ok(fs.readFileSync(origin).equals(originBytes));
  }
  assert.equal(fs.existsSync(journalPath),false);outcomes.push({stage,built,before,error,journal,recovered,after});retain('large-origin-journal-recovery',outcomes);
 }
});
