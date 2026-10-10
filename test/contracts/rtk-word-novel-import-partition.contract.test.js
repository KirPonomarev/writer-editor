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

function richNovelBytes(count,{pendingText=false,notes=true,bookmark=false,spanningBookmark=false,crossLink=false,listChain=false,continuation=false,section='',story=false,inflate=0,emptyParagraphIndex=-1}={}) {
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships', P='http://schemas.openxmlformats.org/package/2006/relationships';
  const W14='http://schemas.microsoft.com/office/word/2010/wordml', W15='http://schemas.microsoft.com/office/word/2012/wordml';
  const body=Array.from({length:count},(_,i)=>{
    const heading=i>0 && i%6===0, list=!pendingText && (listChain?(i===0 || i===4):(i===7 || i===8));
    const properties=i===emptyParagraphIndex?'<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:lang w:val="en-US"/></w:rPr></w:pPr>':heading?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':list?(!listChain && continuation && i===8?'<w:pPr><w:pStyle w:val="ListContinuation"/></w:pPr>':'<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'):'';
    let run=i===3||i===emptyParagraphIndex?'':`<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="he-IL"/>${i%2?'<w:b/>':'<w:i/>'}</w:rPr><w:t xml:space="preserve"> ${heading?'Chapter':'Body'} ${i} Ж🧭漢字 אב ${'я'.repeat(i>=6 && i<count-2?inflate:0)} </w:t>${i===4?'<w:br/><w:t>after hard break</w:t>':''}</w:r>`;
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
  const f=await projectFixture(t,name,fixtureOptions), source=await tinyPlan(20,fixtureOptions.sourceOptions), result=await applyPlan(f,source.plan,name);
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
function fullManuscriptProductBudgets() {
  const source=readSource(MAIN_PATH),context={isPlainObjectValue,module:{exports:{}}};
  const start=source.indexOf('const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS ='),end=source.indexOf('// Resolve the effective budget object',start);
  assert.ok(start>=0&&end>start);
  vm.runInNewContext(source.slice(start,end)+'\nmodule.exports=docxReviewReturnIntakeProductBudgets;',context);
  return cloneJsonSafe(context.module.exports());
}
async function exportImported(f, selected=f.scenes, options={}) {
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),cryptoPort=actualCryptoPort(),budgets=fullManuscriptProductBudgets();
  if(options.actualScene) {
    assert.equal(selected.length,1);
    const {sandbox}=await actualNotesAuthoring(f,selected[0],'manuscript','update',undefined,{prepareOnly:true});
    const main=readSource(MAIN_PATH),factory=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource'),builder=require('../../src/export/docx/docxReviewPacketBuilder');
    Object.assign(sandbox,{require:require('node:module').createRequire(MAIN_PATH),getProjectRootPath:()=>f.root,
      activeStage10ApplicationBootstrap:{},userBookmarkCapability:()=>{},getDocumentContextFromPath:()=>({kind:'scene'}),
      DOCX_REVIEW_PREVIEW_SESSION_ALLOWED_CONTEXT_KINDS:new Set(['scene']),REVIEW_EXPORT_DOCX_PACKET_COMMAND_ID:'cmd.project.review.exportDocxReviewPacket',
      isAllowedFilePath:target=>target===path.join(f.root,selected[0].relativeFile),isPathInside:(root,target)=>path.relative(root,target)!==''&&!path.relative(root,target).startsWith('..'),
      readReviewExactTextApplyProjectBinding:async()=>({ok:true,projectId:f.projectId,projectRoot:f.root,manifestPath:f.manifestPath}),
      getProjectRelativeFilePath:target=>path.relative(f.root,target),loadRevisionBridgeModule:async()=>bridge,createRtkReviewTransportCryptoPort:actualCryptoPort,
      ...require('../../src/export/docx/docxReviewPacketComments'),...require('../../src/export/docx/docxReviewPacketNotes'),
      buildFormatIrParagraphs:factory.buildFormatIrParagraphs,buildFullManuscriptDocumentSections:factory.buildFullManuscriptDocumentSections,
      buildDocxReviewPacketBufferCore:builder.buildDocxReviewPacketBuffer,deriveWordBookmarkNameV1Cjs:builder.deriveWordBookmarkNameV1,
      REVIEW_DOCX_TYPOGRAPHY_DEFAULTS:builder.REVIEW_DOCX_TYPOGRAPHY_DEFAULTS,pendingTextRevisions:pending,
      loadNotesStorageModule:()=>import('../../src/product/notesStoragePersistence.mjs'),docxReviewSecretStore:()=>undefined});
    require('../helpers/main-docx-round-authority').installMainDocxRoundAuthority(sandbox,{projectRoot:f.root,projectId:f.projectId});
    const a=main.indexOf('const REVIEW_DOCX_PACKET_PROFILE_ID ='),b=main.indexOf('function makeTypedReviewDocxExportError',a);
    vm.runInContext(main.slice(a,b)+['base64UrlEncodeReviewDocxPacketText','buildReviewDocxPacketAuthorityEnvelope','buildReviewDocxPacketBlocks',
      'buildReviewDocxPacketHashTree','readSceneDocxExportCohort','assertSceneDocxExportCohort','readCanonicalNotesForDocxExport',
      'readDocxReviewPacketExportSource','importDocxReviewRoundKey','readActiveDocxReviewReturnAuthorityStore','readDurableDocxReviewReturnAuthorityStore'].map(n=>namedFunction(main,n)).join('\n'),sandbox);
    const source=await sandbox.readDocxReviewPacketExportSource(),bytes=builder.buildDocxReviewPacketBuffer(source);
    equal(source.commentExport.stateDigest,require('../../src/export/docx/docxReviewPacketComments').commentStateDigest(JSON.parse(textFile(commentPath(f)))));
    return {source,bytes,bridge,phases:[{phase:'final',bytes,analysis:bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,budgets},{cryptoPort})}]};
  }
  const scenes=selected.map((s,order)=>{const raw=textFile(path.join(f.root,s.relativeFile)),parsed=envelope.parseObservablePayload(raw);
    return {sceneId:s.relativeFile,scenePath:path.join(f.root,s.relativeFile),text:parsed.text,doc:parsed.doc,observableContent:raw,order};});
  const completeCommentState=JSON.parse(textFile(commentPath(f))),selectedIds=new Set(scenes.map(s=>s.sceneId));
  const selectedCommentState={...cloneJsonSafe(completeCommentState),threads:completeCommentState.threads.filter(t=>selectedIds.has(t.sceneId))};
  equal(selectedCommentState.threads,completeCommentState.threads.filter(t=>selectedIds.has(t.sceneId)),'standalone read-only projection preserves every complete selected thread');
  const input={projectId:f.projectId,projectName:'Novel',projectCreatedAtUtc:'2026-10-09T00:00:00.000Z',projectRoot:f.root,manifestPath:f.manifestPath,
    scenes,expectedOrderedSceneIds:scenes.map(s=>s.sceneId),notesDocument:JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),
    nonTextReturnState:selectedCommentState};
  const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource(input,
    {revisionBridge:bridge,cryptoPort,createdAtUtc:'2026-10-09T00:00:00.000Z',roundIdHex:options.roundIdHex||'a'.repeat(32),keyIdHex:'b'.repeat(32),hmacSecret:'owned-tiny-import-export-test'});
  const bytes=require('../../src/export/docx/docxReviewPacketBuilder.js').buildDocxReviewPacketBuffer(source);
  const phases=[['provisional',source.provisionalSelfParseArtifact.bytes],['final',bytes]].map(([phase,data])=>({phase,bytes:data,
    analysis:bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:data,budgets},{cryptoPort})}));
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
  if(options.prepareOnly)return {sandbox,context,current,storage};
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
async function governedNotesAuthoring(f,scene,operation,options={}) {
  const owned=await actualNotesAuthoring(f,scene,'manuscript','update',operation.noteId,{prepareOnly:true});
  const {sandbox,current}=owned,source=readSource(MAIN_PATH),note=current.document.notes.find(n=>n.id===operation.noteId);
  if(operation.action==='update')assert.ok(note?.manuscript && !note.deleted,'existing live manuscript owner');
  const body=operation.body || note?.manuscript.body,kind=operation.kind || note?.manuscript.kind;
  const offsetUtf16=operation.offsetUtf16 ?? note?.manuscript.reference.offsetUtf16,raw=textFile(path.join(f.root,scene.relativeFile));
  assert.equal(notes.boundary(notes.sceneText(raw),offsetUtf16),true,'valid bounded current UTF16 anchor');notes.validateNoteBody(body);
  const payload={projectId:f.projectId,subjectId:'owned:session',expectedSceneSha256:sha(raw),expectedDocumentHash:current.hash,
    noteId:operation.noteId,scope:'manuscript',title:note?.title || operation.title || '',manuscript:{kind,bodyJson:JSON.stringify(body),offsetUtf16},...options.payload};
  Object.assign(sandbox,{NOTES_CREATE_COMMAND_ID:'cmd.project.notes.create',NOTES_UPDATE_COMMAND_ID:'cmd.project.notes.update',COMMAND_BUS_ROUTE:'command.bus',
    ...require('../../src/core/entitlement-law-v1.cjs'),...require('../../src/core/writer-local-profile-v1.cjs'),
    getProductCommandRecord:require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    resolveMenuCommandId:require('../../src/menu/command-namespace-canon.js').resolveMenuCommandId,app:{isPackaged:true},process:{platform:'darwin'},
    MENU_LOCAL_CUSTOMIZATION_COMMAND_IDS:new Set(['cmd.project.view.resetMenuCustomization','cmd.project.view.toggleMenuSectionVisibility','cmd.project.view.moveMenuSectionEarlier','cmd.project.view.moveMenuSectionLater'])});
  vm.runInContext(['handleNotesCreateCommand','handleNotesUpdateCommand','getWriterLocalRuntimeProfile','isMenuLocalCustomizationCommandId','dispatchMenuCommand'].map(n=>namedFunction(source,n)).join('\n'),sandbox);
  sandbox.MENU_COMMAND_HANDLERS={'cmd.project.notes.create':sandbox.handleNotesCreateCommand,'cmd.project.notes.update':sandbox.handleNotesUpdateCommand};
  if(options.dispatchOnly)return {sandbox,payload};
  const start=process.hrtime.bigint(),result=await sandbox.dispatchMenuCommand('cmd.project.notes.'+operation.action,payload,{route:'command.bus'});
  const seconds=Number(process.hrtime.bigint()-start)/1e9;return {payload,result,seconds,beforeDocument:current.document};
}
async function noteAuthoringFilePins(root) {
  const rows=[],walk=async directory=>{for(const name of (await fsp.readdir(directory)).sort()){
    const target=path.join(directory,name),stat=await fsp.lstat(target);assert.equal(stat.isSymbolicLink(),false);
    if(stat.isDirectory())await walk(target);else {assert.equal(stat.isFile(),true);assert.equal(stat.nlink,1);
      assert.ok(Number.isSafeInteger(stat.size)&&stat.size>=0&&stat.size<=256*1024*1024);
      const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(target))hash.update(bytes);
      rows.push({path:path.relative(root,target).split(path.sep).join('/'),bytes:stat.size,sha256:hash.digest('hex')});}
  }};await walk(root);return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
test('novel import: governed manuscript note restoration and multi-owner creation',async t=>{
  let f,operations,initialPins,request;
  const requestPath=process.env.YALKEN_NOVEL_NOTES_AUTHORING_REQUEST;
  if(requestPath) {
    const stat=fs.lstatSync(requestPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=4*1024*1024);
    assert.ok(/^[a-f0-9]{64}$/u.test(process.env.YALKEN_NOVEL_NOTES_AUTHORING_REQUEST_SHA256||''));
    const raw=fs.readFileSync(requestPath);assert.equal(sha(raw),process.env.YALKEN_NOVEL_NOTES_AUTHORING_REQUEST_SHA256);request=JSON.parse(raw);
    const keys=['schemaVersion','stage','projectRoot','receiptPath','restorationNotesPath','bindings','businessFiles','authorityFiles','creates'];
    assert.ok(isPlainObjectValue(request)&&Object.keys(request).length===keys.length&&Object.keys(request).every(k=>keys.includes(k)));
    assert.equal(request.schemaVersion,'novel-notes-authoring-proof.v1');assert.ok(['restore','create'].includes(request.stage));
    for(const key of ['projectRoot','receiptPath','restorationNotesPath'])assert.ok(typeof request[key]==='string'&&request[key].length<4096&&path.isAbsolute(request[key]));
    for(const key of ['bindings','businessFiles','authorityFiles']) {
      assert.ok(Array.isArray(request[key])&&request[key].length>0&&request[key].length<=5000);
      for(const row of request[key])assert.ok(isPlainObjectValue(row)&&Object.keys(row).length===3&&typeof row.path==='string'&&row.path.length<4096
        &&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=256*1024*1024&&/^[a-f0-9]{64}$/u.test(row.sha256));
    }
    assert.ok(Array.isArray(request.creates)&&request.creates.length===2&&new Set(request.creates.map(x=>x.noteId)).size===2);
    equal(request.creates.map(row=>row.sceneIndex).sort((a,b)=>a-b),[21,41],'both different full-book owners');
    for(const row of request.creates)assert.ok(isPlainObjectValue(row)&&Object.keys(row).length===4&&typeof row.noteId==='string'&&/^[A-Za-z0-9._:-]{1,128}$/u.test(row.noteId)
      &&[21,41].includes(row.sceneIndex)&&['footnote','endnote'].includes(row.kind)&&typeof row.bodyJson==='string'&&Buffer.byteLength(row.bodyJson)<=notes.LIMITS.bytes);
    for(const row of request.creates)notes.validateNoteBody(JSON.parse(row.bodyJson));
    const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;assert.ok(evidence&&path.isAbsolute(evidence));
    const lane=path.resolve(evidence,'../..');assert.ok(request.projectRoot.startsWith(lane+path.sep));assert.equal(fs.realpathSync(request.projectRoot),request.projectRoot);
    for(const row of request.bindings){assert.ok(path.isAbsolute(row.path)&&fs.realpathSync(row.path)===row.path);const st=fs.lstatSync(row.path);
      assert.ok(st.isFile()&&st.nlink===1&&st.size===row.bytes);const b=fs.readFileSync(row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
    for(const name of ['receiptPath','restorationNotesPath'])assert.ok(request.bindings.some(row=>row.path===request[name]));
    initialPins=await noteAuthoringFilePins(request.projectRoot);
    equal(initialPins,[...request.businessFiles,...request.authorityFiles].sort((a,b)=>a.path.localeCompare(b.path)),'complete current business/authority checkpoint');
    const receipt=JSON.parse(textFile(request.receiptPath));assert.equal(receipt.createdScenes.length,42);assert.ok(typeof receipt.projectId==='string');
    assert.equal(receipt.schemaVersion,'revision-bridge.docx-import-receipt.v3');assert.ok(/^docx-import-op-[a-f0-9]+$/u.test(receipt.importOperationId));
    assert.equal(request.receiptPath,path.join(request.projectRoot,'.yalken/docx-import/receipts',receipt.importOperationId+'.json'));
    for(const scene of receipt.createdScenes)assert.ok(typeof scene.relativeFile==='string'&&scene.relativeFile.startsWith('roman/')&&scene.relativeFile.endsWith('.txt')
      &&scene.relativeFile.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\0')&&!p.includes('\\')));
    assert.equal(new Set(receipt.createdScenes.map(s=>s.relativeFile)).size,42);
    f={...await realAuthority.withRealDocxImportAuthority({projectRoot:request.projectRoot,root:request.projectRoot,romanRoot:path.join(request.projectRoot,'roman'),
      manifestPath:path.join(request.projectRoot,'project.craftsman.json'),projectId:receipt.projectId,captureTreeCohortInventory:captureActualInventory}),scenes:receipt.createdScenes};
    const current=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),restored=JSON.parse(textFile(request.restorationNotesPath));
    const storage=await import('../../src/core/notesStorage.mjs');
    for(const document of [current,restored]){assert.equal(document.projectId,receipt.projectId);const checked=storage.normalizeNotesDocument(document,{projectId:receipt.projectId});
      equal(checked.value,document,'complete canonical same-project notes document');}
    const originals=restored.notes.filter(n=>n.manuscript);assert.equal(originals.length,3);
    assert.equal(new Set(originals.map(n=>n.id)).size,3);for(const n of originals){const live=current.notes.find(row=>row.id===n.id);assert.ok(live?.manuscript&&!live.deleted);
      assert.equal(live.manuscript.kind,n.manuscript.kind);assert.equal(live.manuscript.reference.sceneId,n.manuscript.reference.sceneId);notes.validateManuscriptPayload(n.manuscript);}
    operations=request.stage==='restore'?originals.map(n=>{const live=current.notes.find(row=>row.id===n.id);
      return {action:'update',noteId:n.id,sceneId:live.manuscript.reference.sceneId,body:n.manuscript.body};}):request.creates.map(row=>({action:'create',
        noteId:row.noteId,sceneId:f.scenes[row.sceneIndex].relativeFile,kind:row.kind,offsetUtf16:0,body:JSON.parse(row.bodyJson)}));
  } else {
    f=await importedTiny(t,'governed-notes',{canonicalNotes:true});
    const current=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json')));
    operations=current.notes.filter(n=>n.manuscript).map(n=>{const body=cloneJsonSafe(n.manuscript.body),p=body.content[0];
      const br=p.content.find(node=>node.type==='hardBreak');br.marks=cloneJsonSafe(p.content.find(node=>node.type==='text').marks);
      p.content.push(cloneJsonSafe(br),{type:'text',text:'Restored supported line'});
      return {action:'update',noteId:n.id,sceneId:n.manuscript.reference.sceneId,body};});
    operations.push(...[Math.floor(f.scenes.length/2),f.scenes.length-1].map((index,i)=>({action:'create',noteId:'governed-'+crypto.randomUUID(),sceneId:f.scenes[index].relativeFile,
      kind:i?'endnote':'footnote',offsetUtf16:0,body:cloneJsonSafe(operations[0].body)})));
    const target=f.scenes.find(s=>s.relativeFile===operations[0].sceneId);
    const guard=await governedNotesAuthoring(f,target,operations[0],{dispatchOnly:true}),beforeGuards=await noteAuthoringFilePins(f.root);
    const denied=await guard.sandbox.dispatchMenuCommand('cmd.project.review.importLocalPacket',guard.payload,{route:'command.bus'});
    assert.equal(denied.code,'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
    assert.throws(()=>guard.sandbox.dispatchMenuCommand('cmd.project.notes.update',guard.payload,{route:'not-command-bus'}),/Unsupported menu command route/u);
    const unknown=await guard.sandbox.dispatchMenuCommand('unregistered-note-namespace',guard.payload,{route:'command.bus'});
    assert.equal(unknown.code,'E_COMMAND_DISABLED_FOR_ENTITLEMENT');
    const namespace=require('../../src/menu/command-namespace-canon.js');
    assert.equal(namespace.resolveMenuCommandId(namespace.getCommandNamespaceCanon().deprecatedPrefixes[0]+'unregistered-note').ok,false);
    equal(await noteAuthoringFilePins(f.root),beforeGuards,'actual policy/route/namespace guards cannot reach mutation');
    for(const payload of [{expectedDocumentHash:'f'.repeat(64)},{expectedSceneSha256:'e'.repeat(64)}]) {
      const before=await noteAuthoringFilePins(f.root),refused=await governedNotesAuthoring(f,target,operations[0],{payload});
      const after=await noteAuthoringFilePins(f.root);retain('governed-note-stale-'+Object.keys(payload)[0],{...refused,before,after});
      assert.equal(refused.result.ok,false);assert.match(refused.result.code,/^(NOTES_REVISION_STALE|NOTE_SOURCE_IDENTITY_STALE)$/u);
      equal(after.filter(r=>!r.path.startsWith('.test-authority/')),before.filter(r=>!r.path.startsWith('.test-authority/')),'stale public note command cannot write business or recovery files');
    }
    initialPins=await noteAuthoringFilePins(f.root);
  }
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);const outcomes=[],sloFailures=[];
  for(const operation of operations) {
    const scene=f.scenes.find(s=>s.relativeFile===operation.sceneId);assert.ok(scene);
    const before=await noteAuthoringFilePins(f.root),beforeNotesText=textFile(path.join(f.root,'notes.craftsman.json')),beforeNotes=JSON.parse(beforeNotesText);
    if(operation.action==='create')assert.equal(beforeNotes.notes.some(n=>n.id===operation.noteId),false,'pinned new ID cannot silently duplicate');
    const observed=await governedNotesAuthoring(f,scene,operation);outcomes.push({operation,observed});retain('governed-note-authoring-outcomes',outcomes);
    assert.equal(observed.result.ok,true,JSON.stringify(observed.result));assert.equal(observed.result.receipt.noteId,operation.noteId);
    const afterNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),note=afterNotes.notes.find(n=>n.id===operation.noteId);
    equal({...afterNotes,notes:[]},{...beforeNotes,notes:[]},'full existing project-level notes receipts and metadata');
    equal(note.manuscript.body,operation.body,'complete supported source body including every marked LINE break');
    assert.equal(note.manuscript.reference.sceneId,scene.relativeFile);assert.equal(note.manuscript.reference.offsetUtf16,observed.payload.manuscript.offsetUtf16);
    for(const prior of beforeNotes.notes.filter(n=>n.id!==operation.noteId))equal(afterNotes.notes.find(n=>n.id===prior.id),prior,'complete foreign/private/deleted note');
    if(operation.action==='update') {
      const prior=beforeNotes.notes.find(n=>n.id===operation.noteId),expected=cloneJsonSafe(prior);expected.body=notes.validateNoteBody(operation.body).text;
      expected.manuscript.body=operation.body;expected.updatedAtUtc=note.updatedAtUtc;equal(note,expected,'only authored body/derived literal/clock changes');
    } else assert.equal(afterNotes.notes.length,beforeNotes.notes.length+1);
    const after=await noteAuthoringFilePins(f.root),allowed=new Set(['notes.craftsman.json',path.relative(f.root,f.manifestPath).split(path.sep).join('/'),
      path.relative(f.root,tx.commitPathFor(path.join(f.root,scene.relativeFile))).split(path.sep).join('/')]);
    for(const prior of before.filter(r=>!r.path.startsWith('.test-authority/')&&!allowed.has(r.path)))equal(after.find(r=>r.path===prior.path),prior,'protected existing business bytes '+prior.path);
    const commit=JSON.parse(textFile(tx.commitPathFor(path.join(f.root,scene.relativeFile)))),packetPath=tx.recoveryPacketPathFor(f.manifestPath,commit.transactionId);
    const added=after.filter(row=>!before.some(old=>old.path===row.path)&&!row.path.startsWith('.test-authority/'));
    assert.equal(added.length,2,'one real Core recovery packet and one readable notes snapshot');
    for(const row of added) {
      const target=path.join(f.root,row.path);
      if(target===packetPath) {const packet=JSON.parse(textFile(target));assert.equal(packet.binding.transactionId,commit.transactionId);
        assert.equal(packet.noteState.beforeText,beforeNotesText);assert.equal(packet.noteState.afterText,textFile(path.join(f.root,'notes.craftsman.json')));}
      else {assert.match(row.path,/^backups\/notes-recovery\/notes\.craftsman\.json\.[0-9T.Z-]+\.recovery\.json$/u);
        assert.equal(textFile(target),beforeNotesText);assert.equal(row.sha256,observed.result.receipt.recovery.sourceHash);}
    }
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);retain('governed-note-authoring-checkpoint',{projectRoot:f.root,initialPins,after,operations,outcomes});
    for(const row of after.filter(r=>!before.some(old=>old.path===r.path&&old.sha256===r.sha256)&&!r.path.startsWith('.test-authority/')))
      retain('governed-note-authored-file-'+outcomes.length+'-'+sha(row.path),{...row,bytes:fs.readFileSync(path.join(f.root,row.path))});
    console.log(JSON.stringify({phase:'governed-note-command',action:operation.action,noteId:operation.noteId,sceneId:operation.sceneId,seconds:observed.seconds,result:observed.result}));
    if(observed.seconds>120)sloFailures.push({noteId:operation.noteId,seconds:observed.seconds});
  }
  retain('governed-note-authoring-terminal',{projectRoot:f.root,request,operations,outcomes,sloFailures,files:await noteAuthoringFilePins(f.root)});
  for(const row of request?.bindings || []){const st=fs.lstatSync(row.path);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size===row.bytes);assert.equal(sha(fs.readFileSync(row.path)),row.sha256,'terminal exact input '+row.path);}
  assert.equal(sloFailures.length,0,'actual public note command 120s SLO');
});
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

async function authenticatedBookNoteReturn(t,f,x,returnedBytes,options={}) {
  const source=readSource(MAIN_PATH),scene=options.scene||f.scenes[0],budgetContext={isPlainObjectValue,module:{exports:{}}};
  const budgetStart=source.indexOf('const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS ='),budgetEnd=source.indexOf('// Resolve the effective budget object',budgetStart);
  assert.ok(budgetStart>=0&&budgetEnd>budgetStart);
  vm.runInNewContext(source.slice(budgetStart,budgetEnd)+'\nmodule.exports=docxReviewReturnIntakeProductBudgets;',budgetContext);
  const productBudgets=budgetContext.module.exports;
  const analysis=options.historyOnly?null:x.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:returnedBytes,budgets:cloneJsonSafe(productBudgets())},{cryptoPort:actualCryptoPort()});
  if(!options.historyOnly) {
    retain('book-note-return-analysis-'+(options.label||'tiny'),{returnedBytes,analysis});
    assert.equal(analysis.ok,true,JSON.stringify({code:analysis.code,reasons:analysis.reasons}));
  }
  const {sandbox,context}=await actualNotesAuthoring(f,scene,'manuscript','update',undefined,{prepareOnly:true});
  const {createRequire}=require('node:module'),profile=require('../../src/core/writer-local-profile-v1.cjs');
  const publications=[],requests=[],kernelCalls=[],commitErrors=[];
  let editorContent=textFile(path.join(f.root,scene.relativeFile));
  Object.assign(sandbox,{require:createRequire(MAIN_PATH),activeStage10ApplicationBootstrap:{},getProjectRootPath:()=>f.root,
    notesStateDigest:require('../../src/export/docx/docxReviewPacketNotes.js').notesStateDigest,
    NOTES_UPDATE_COMMAND_ID:'cmd.project.notes.update',COMMAND_BUS_ROUTE:'command.bus',
    getWriterLocalRuntimeProfile:()=>profile.createWriterLocalProfileProjection({platform:'darwin'}),evaluateWriterLocalCommandAccess:profile.evaluateWriterLocalCommandAccess,
    getProductCommandRecord:require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    ...require('../../src/core/entitlement-law-v1.cjs'),resolveMenuCommandId:require('../../src/menu/command-namespace-canon.js').resolveMenuCommandId,
    isMenuLocalCustomizationCommandId:()=>false,userBookmarkCapability:()=>{},pendingTextRevisions:pending,
    activePendingRecording:null,pendingRecordingModel:require('../../src/core/word-pending-recording-v1.cjs'),userBookmarkModel:bookmarks,
    authenticatedPendingReturnAdmissions:new WeakMap(),
    isAllowedFilePath:target=>f.scenes.some(scene=>path.join(f.root,scene.relativeFile)===target),
    readReviewExactTextApplyProjectBinding:async()=>({ok:true,projectRoot:f.root,projectId:f.projectId,manifestPath:f.manifestPath,manifest:JSON.parse(textFile(f.manifestPath))}),
    commentSceneParagraphs:anchors.paragraphs,requestEditorSnapshot:async()=>({generation:0,content:editorContent}),
    loadNotesStorageModule:()=>import('../../src/product/notesStoragePersistence.mjs'),
    createRtkReviewTransportCryptoPort:actualCryptoPort,normalizeRtkSignedSha256:v=>v?.startsWith('sha256:')?v:'sha256:'+v,
    stableRtkReviewTransportJson: v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),
    docxReviewReturnIntakeProductBudgets:productBudgets,
    loadProjectTreeCohortModule:()=>modelPromise,readVerifiedProjectTreeMutation:tx.readVerifiedProjectTreeMutation,
    readVerifiedProjectDocxNovelCohort:tx.readVerifiedProjectDocxNovelCohort,recoverProjectTransaction:tx.recoverProjectTransaction,
    commitProjectTransaction:async args=>{requests.push(cloneJsonSafe(args));try{return await (options.commit||tx.commitProjectTransaction)(args);}catch(e){commitErrors.push({code:e.code,message:e.message,stack:e.stack});throw e;}},
    getProjectDocumentIdentityPayload:async()=>({}),getDocumentContextFromPath:()=>({kind:'scene',metaEnabled:true}),
    attachProjectIdToEditorPayload:async value=>{if(options.beforePublication)await options.beforePublication();return value;},
    sendEditorText:value=>{editorContent=value.content;publications.push(cloneJsonSafe(value));},backupHashes:new Map(),resetActiveReviewSessionStore:()=>{},updateStatus:()=>{},
  });
  let round,roundRecord;
  if(!options.historyOnly) {
  context.reviewTransportAuthorityCapsule={...x.source.localAuthorityCapsule,
    exportMapAuthority:'main-owned-active-export-authority-store-after-return-authentication',returnedArtifactExportMapAccepted:false};
  context.reviewTransportReturnIntake={authenticated:true,returnedArtifactSha256:'sha256:'+sha(returnedBytes),parserResult:analysis};
  const priorRounds=Object.values(options.priorAuthorityRecord?.roundsById||{}).map(cloneJsonSafe);
  assert.ok(priorRounds.every(row=>row.roundId!==context.reviewTransportAuthorityCapsule.roundId),'a genuinely new round does not replace prior authority');
  round=require('../helpers/main-docx-round-authority').installMainDocxRoundAuthority(sandbox,{projectRoot:f.root,projectId:f.projectId,references:[...priorRounds,context.reviewTransportAuthorityCapsule],publishAllocated:true,t});
  roundRecord=sandbox.buildDocxReviewReturnAuthorityStoreRecord({lastRoundId:context.reviewTransportAuthorityCapsule.roundId,roundsById:round.roundsById});
  retain('book-note-return-round-admission-'+(options.label||'tiny'),roundRecord);
  sandbox.validateDocxReviewAuthorityRoundBindings(roundRecord,f.root);
  const encodedRound=sandbox.reviewAuthorityCodec.encode(cloneJsonSafe(roundRecord));
  fs.writeFileSync(round.storePath,encodedRound);
  const strictRound=sandbox.readStrictDocxReviewAuthorityStore(f.root);
  equal(strictRound.record,roundRecord,'actual strict codec reopen binds every complete round field');
  for(const prior of priorRounds)equal(strictRound.record.roundsById[prior.roundId],options.priorAuthorityRecord.roundsById[prior.roundId],'prior complete fixture round is unchanged');
  assert.equal(strictRound.record.lastRoundId,context.reviewTransportAuthorityCapsule.roundId);
  retainDirectory('book-note-return-round-'+(options.label||'tiny'),{'return-authority-store.v4.json':fs.readFileSync(round.storePath)});
  retain('book-note-return-round-'+(options.label||'tiny'),{record:roundRecord,encoded:encodedRound,decoded:strictRound.record,
    decodedBytes:Buffer.byteLength(JSON.stringify(roundRecord)),encodedBytes:Buffer.byteLength(encodedRound),limits:{decoded:sandbox.reviewAuthorityCodec.DECODED_MAX_BYTES,encoded:sandbox.reviewAuthorityCodec.ENCODED_MAX_BYTES}});
  }
  vm.runInContext(
    ['readCommentAuthoringContext','pendingRecordingCapability','assertPendingRecordingAnnotations','readPendingRevisionProjection','handlePendingRevisionCommand',
      'readDocxReviewAuthorityStoreText','createDocxReviewRoundAuthorityGuard','prepareAuthenticatedBookPendingReturn','prepareAuthenticatedNoteDelta','handleNotesUpdateCommand','dispatchMenuCommand','handleRtkCommentLifecycleReturnCommandSurface']
      .map(n=>namedFunction(source,n)).join('\n'),sandbox,{filename:MAIN_PATH});
  sandbox.MENU_COMMAND_HANDLERS={'cmd.project.notes.update':sandbox.handleNotesUpdateCommand};
  const kernel=require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({'cmd.rtk.review.applyCommentLifecycleReturn':sandbox.handleRtkCommentLifecycleReturnCommandSurface,
    'cmd.project.review.decidePendingRevision':sandbox.handlePendingRevisionCommand});
  sandbox.dispatchCommandSurfaceKernel=async(id,payload)=>{const result=await kernel.dispatch(id,payload);kernelCalls.push({id,result:cloneJsonSafe(result)});return result;};
  if(options.historyOnly)return {sandbox,context,kernel,publications,requests};
  let prepared;
  const input={context,requestId:'actual-book-note-return',isCurrent:()=>options.isCurrent?.()!==false,docxBytes:returnedBytes,revisionBridge:x.bridge,onPrepared:value=>{prepared=value;}};
  if(options.beforeApply)await options.beforeApply(f);
  const observedFiles=()=>options.boundedPhysicalCheckpoint?Object.fromEntries(f.scenes.flatMap(s=>[s.relativeFile,path.relative(f.root,tx.commitPathFor(path.join(f.root,s.relativeFile)))])
    .concat(['notes.craftsman.json',path.relative(f.root,commentPath(f)),path.relative(f.root,f.manifestPath),path.relative(f.root,tx.treeCommitPathFor(f.manifestPath))])
    .filter(relative=>fs.existsSync(path.join(f.root,relative))).map(relative=>[relative,fs.readFileSync(path.join(f.root,relative))])):productFiles(f);
  const before=observedFiles();
  const prepareStart=performance.now();
  let result=await sandbox.prepareAuthenticatedBookPendingReturn(input);
  if(!result)result=await sandbox.prepareAuthenticatedNoteDelta(input);
  const timings={prepareSeconds:(performance.now()-prepareStart)/1000};
  let applied,error;
  if(prepared&&options.afterPrepared)await options.afterPrepared({f,sandbox,context,prepared,round});
  if(prepared&&!options.cancel){const applyStart=performance.now();try{applied=await prepared.apply();}catch(e){error={code:e.code,message:e.message};}timings.applySeconds=(performance.now()-applyStart)/1000;}
  const operand={before,result,changes:prepared?.changes,applied,error,requests,kernelCalls,commitErrors,publications,after:observedFiles(),originalBytes:x.bytes,returnedBytes,analysis,timings,authorityRecord:roundRecord};
  retain('authenticated-book-note-return-'+(options.label||'tiny'),operand);
  return {...operand,sandbox,context,prepared,kernel};
}
function changedNotesZip(x,label,joint=false,mutation={}) {
  const extracted=x.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(x.bytes);assert.equal(extracted.ok,true);
  const parts={...extracted.parts};let changed=0;
  for(const name of ['word/footnotes.xml','word/endnotes.xml'])if(parts[name]) {
    assert.match(label,/^[a-zA-Z0-9-]+$/);
    parts[name]=parts[name].replace(/<w:(footnote|endnote)\b([^>]*)>([\s\S]*?)<\/w:\1>/g,(whole,kind,attrs,body)=>{
      if(/w:type=/.test(attrs))return whole;
      assert.ok(/<w:t(?:\s[^>]*)?>[^<]+<\/w:t>/.test(body),'actual existing note has editable literal text');
      changed++;return `<w:${kind}${attrs}>${body.replace(/(<w:t(?:\s[^>]*)?>)([^<]+)(<\/w:t>)/,(_m,open,text,close)=>open+text+' '+label+close)}</w:${kind}>`;
    });
  }
  assert.ok(changed>0);
  if(joint) {
    let deletion=false;const activeComments=new Set(),oldRevisionIds=new Set(Array.from(parts['word/document.xml'].matchAll(/<w:(?:ins|del|moveFrom|moveTo)\b[^>]*\bw:id="([^"]+)"/g),m=>m[1]));
    let id=1;while(oldRevisionIds.has(String(id)))id++;const insertId=String(id++);while(oldRevisionIds.has(String(id)))id++;const deleteId=String(id);
    mutation.oldRevisionIds=[...oldRevisionIds];mutation.insertId=insertId;mutation.deleteId=deleteId;
    parts['word/document.xml']=parts['word/document.xml'].replace(/<w:p\b[\s\S]*?<\/w:p>/g,paragraph=>{
      const occupied=activeComments.size>0||/<w:comment(?:RangeStart|RangeEnd|Reference)\b|<w:(?:footnote|endnote)Reference\b|<w:(?:ins|del|moveFrom|moveTo)\b/.test(paragraph);
      for(const match of paragraph.matchAll(/<w:commentRangeStart\b[^>]*w:id="([^"]+)"/g))activeComments.add(match[1]);
      if(!deletion&&!occupied)paragraph=paragraph.replace(/<w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t([^>]*)>([^<]+)<\/w:t><\/w:r>/g,(whole,style='',attrs,text)=>{
        const at=text.search(/[A-Za-z0-9]/);if(deletion||at<0||text.slice(0,at).includes('&'))return whole;
        deletion=true;mutation.deletedLiteral=text[at];mutation.sourceParagraph=paragraph;mutation.runText=text;mutation.runOffset=at;
        return `<w:r>${style}<w:t${attrs}>${text.slice(0,at)}</w:t></w:r><w:del w:id="${deleteId}" w:author="Corrector" w:date="2026-10-09T01:00:01Z"><w:r>${style}<w:delText>${text[at]}</w:delText></w:r></w:del><w:r>${style}<w:t${attrs}>${text.slice(at+1)}</w:t></w:r><w:ins w:id="${insertId}" w:author="Editor" w:date="2026-10-09T01:00:00Z"><w:r><w:t>${label}</w:t></w:r></w:ins>`;
      });
      for(const match of paragraph.matchAll(/<w:commentRangeEnd\b[^>]*w:id="([^"]+)"/g))activeComments.delete(match[1]);
      return paragraph;
    });
    assert.equal(deletion,true,'joint input has one supported tracked deletion and insertion outside comment/note anchors');
    assert.ok(parts['word/comments.xml']);
    parts['word/comments.xml']=parts['word/comments.xml'].replace(/(<w:t(?:\s[^>]*)?>)([^<]+)(<\/w:t>)/,(_m,open,text,close)=>open+text+' discussion-'+label+close);
  }
  return buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data})));
}
test('novel authenticated atomic notes: governed fresh joint preserves three owners and prior pending history',async t=>{
  let f,request,priorAuthorityRecord,roundIdHex=crypto.randomBytes(16).toString('hex'),label='fresh-joint',initialPins;
  const requestPath=process.env.YALKEN_NOVEL_ATOMIC_RETURN_REQUEST;
  if(requestPath) {
    const st=fs.lstatSync(requestPath);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size<=4*1024*1024);
    const raw=fs.readFileSync(requestPath);assert.match(process.env.YALKEN_NOVEL_ATOMIC_RETURN_REQUEST_SHA256||'',/^[a-f0-9]{64}$/);
    assert.equal(sha(raw),process.env.YALKEN_NOVEL_ATOMIC_RETURN_REQUEST_SHA256);request=JSON.parse(raw);
    const keys=['schemaVersion','projectRoot','receiptPath','bindings','businessFiles','authorityFiles','roundIdHex','priorAuthorityPath','priorAuthorityCarrierPath','label'];
    assert.ok(isPlainObjectValue(request)&&Object.keys(request).length===keys.length&&Object.keys(request).every(k=>keys.includes(k)));
    assert.equal(request.schemaVersion,'novel-atomic-fresh-joint-proof.v1');assert.match(request.roundIdHex,/^[a-f0-9]{32}$/);assert.match(request.label,/^[a-zA-Z0-9-]{1,64}$/);
    for(const k of ['projectRoot','receiptPath','priorAuthorityPath','priorAuthorityCarrierPath'])assert.ok(typeof request[k]==='string'&&path.isAbsolute(request[k])&&request[k].length<4096);
    for(const k of ['bindings','businessFiles','authorityFiles']) {
      assert.ok(Array.isArray(request[k])&&request[k].length>0&&request[k].length<=5000);
      for(const row of request[k])assert.ok(isPlainObjectValue(row)&&Object.keys(row).length===3&&typeof row.path==='string'&&row.path.length<4096
        &&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=256*1024*1024&&/^[a-f0-9]{64}$/.test(row.sha256));
    }
    const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;assert.ok(evidence&&path.isAbsolute(evidence));
    assert.ok(request.projectRoot.startsWith(path.resolve(evidence,'../..')+path.sep));assert.equal(fs.realpathSync(request.projectRoot),request.projectRoot);
    for(const row of request.bindings){assert.ok(path.isAbsolute(row.path)&&fs.realpathSync(row.path)===row.path);const st=fs.lstatSync(row.path);
      assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size===row.bytes);const bytes=fs.readFileSync(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);}
    for(const name of ['receiptPath','priorAuthorityPath','priorAuthorityCarrierPath'])assert.ok(request.bindings.some(row=>row.path===request[name]));
    initialPins=await noteAuthoringFilePins(request.projectRoot);
    equal(initialPins,[...request.businessFiles,...request.authorityFiles].sort((a,b)=>a.path.localeCompare(b.path)),'exact complete current full-book checkpoint');
    const receipt=JSON.parse(textFile(request.receiptPath));assert.equal(receipt.schemaVersion,'revision-bridge.docx-import-receipt.v3');assert.equal(receipt.createdScenes.length,42);
    assert.ok(typeof receipt.projectId==='string'&&/^docx-import-op-[a-f0-9]+$/.test(receipt.importOperationId));
    assert.equal(request.receiptPath,path.join(request.projectRoot,'.yalken/docx-import/receipts',receipt.importOperationId+'.json'));
    assert.equal(new Set(receipt.createdScenes.map(row=>row.relativeFile)).size,42);
    for(const row of receipt.createdScenes)assert.ok(typeof row.relativeFile==='string'&&row.relativeFile.startsWith('roman/')&&row.relativeFile.endsWith('.txt')
      &&row.relativeFile.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0')));
    const codec=require('../../src/core/word-review-authority-codec-v1.cjs'),carrier=v8.deserialize(fs.readFileSync(request.priorAuthorityCarrierPath));
    assert.ok(fs.statSync(request.priorAuthorityPath).size<=codec.ENCODED_MAX_BYTES);
    priorAuthorityRecord=codec.decode(textFile(request.priorAuthorityPath));equal(priorAuthorityRecord,carrier.record);equal(priorAuthorityRecord,carrier.decoded);
    const validation={module:{exports:{}},isPlainObjectValue,cloneJsonSafe,createRtkReviewTransportCryptoPort:actualCryptoPort,
      REVIEW_DOCX_RETURN_AUTHORITY_STORE_SCHEMA:'yalken.rtk.word.product-review-docx-export.authority-store.v2'};
    vm.runInNewContext(['docxReviewPreviewSessionDetailString','buildDocxReviewReturnAuthorityStoreRecord','validateDocxReviewReturnAuthorityStoreRecord','validateDocxReviewAuthorityRoundBindings']
      .map(n=>namedFunction(readSource(MAIN_PATH),n)).join('\n')+'\nmodule.exports={validateDocxReviewReturnAuthorityStoreRecord,validateDocxReviewAuthorityRoundBindings};',validation);
    equal(validation.module.exports.validateDocxReviewReturnAuthorityStoreRecord(priorAuthorityRecord),priorAuthorityRecord);
    validation.module.exports.validateDocxReviewAuthorityRoundBindings(priorAuthorityRecord,request.projectRoot);
    for(const row of Object.values(priorAuthorityRecord.roundsById)) {
      assert.equal(row.manifestPath,path.join(request.projectRoot,'project.craftsman.json'));
      assert.equal(row.documentMetadata.protectedProperties.projectId,receipt.projectId);
      assert.equal(row.documentMetadata.coreProperties.identifier,receipt.projectId);
      assert.equal(row.expectedAuthority.documentMetadataDigest,row.documentMetadata.protectedDigest);
    }
    assert.equal(Object.hasOwn(priorAuthorityRecord.roundsById,'round-'+request.roundIdHex),false,'new round ID is absent in actual strict prior fixture');
    f={...await realAuthority.withRealDocxImportAuthority({projectRoot:request.projectRoot,root:request.projectRoot,romanRoot:path.join(request.projectRoot,'roman'),
      manifestPath:path.join(request.projectRoot,'project.craftsman.json'),projectId:receipt.projectId,captureTreeCohortInventory:captureActualInventory}),scenes:receipt.createdScenes};
    roundIdHex=request.roundIdHex;label=request.label;
  } else {
    f=await importedTiny(t,'fresh-three-owner',{canonicalNotes:true});assert.ok(f.scenes.length>=3);
    const originalNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.filter(n=>n.manuscript);
    for(const note of originalNotes){const body=cloneJsonSafe(note.manuscript.body);for(const p of body.content)for(const node of p.content||[])if(node.type==='hardBreak')
      node.marks=cloneJsonSafe(p.content.find(row=>row.type==='text')?.marks||[]);
      const updated=await governedNotesAuthoring(f,f.scenes.find(s=>s.relativeFile===note.manuscript.reference.sceneId),{action:'update',noteId:note.id,body});assert.equal(updated.result.ok,true);}
    const updatedBody=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.find(n=>n.id===originalNotes[0].id).manuscript.body;
    const created=await governedNotesAuthoring(f,f.scenes[Math.floor(f.scenes.length/2)],{action:'create',noteId:'fresh-middle-'+crypto.randomUUID(),kind:'footnote',offsetUtf16:0,body:cloneJsonSafe(updatedBody)});
    assert.equal(created.result.ok,true);
    const prime=await exportImported(f,f.scenes,{roundIdHex:crypto.randomBytes(16).toString('hex')});
    const first=await authenticatedBookNoteReturn(t,f,prime,changedNotesZip(prime,'prior-joint',true),{label:'fresh-prior'});
    assert.equal(first.applied?.ok,true,JSON.stringify(first.error||first.result));priorAuthorityRecord=first.authorityRecord;
  }
  const notePath=path.join(f.root,'notes.craftsman.json'),beforeNotes=JSON.parse(textFile(notePath)),activeNotes=beforeNotes.notes.filter(n=>n.manuscript&&!n.deleted);
  assert.equal(new Set(activeNotes.map(n=>n.manuscript.reference.sceneId)).size,3);
  if(request)assert.equal(activeNotes.length,5);
  const parseDoc=relative=>envelope.parseObservablePayload(textFile(path.join(f.root,relative))).doc;
  const beforeDocs=f.scenes.map(s=>cloneJsonSafe(parseDoc(s.relativeFile))),oldLedgers=beforeDocs.map(doc=>pending.readLedger(doc));
  assert.equal(oldLedgers.flatMap(l=>l?.revisions||[]).length,2,'two prior pending revisions are genuinely durable');
  const view=(doc,which)=>pending.projection(doc)?.[which]??envelope.deriveVisibleTextFromDocument(doc);
  const beforeCurrent=f.scenes.map(s=>view(parseDoc(s.relativeFile),'current')).join('\n'),beforeOriginal=f.scenes.map(s=>view(parseDoc(s.relativeFile),'original')).join('\n');
  const exported=await exportImported(f,f.scenes,{roundIdHex});assert.ok(exported.phases.every(p=>p.analysis.ok));
  retain('fresh-joint-export',{source:exported.source,bytes:exported.bytes,phases:exported.phases,priorAuthorityRecord});
  const mutation={},returnedBytes=changedNotesZip(exported,label,true,mutation);
  assert.ok(mutation.oldRevisionIds.length>=2);assert.equal(new Set([...mutation.oldRevisionIds,mutation.insertId,mutation.deleteId]).size,mutation.oldRevisionIds.length+2);
  assert.doesNotMatch(mutation.sourceParagraph,/<w:(?:ins|del|moveFrom|moveTo|commentRangeStart|commentRangeEnd|commentReference|footnoteReference|endnoteReference)\b/);
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));
  const run=decode(mutation.runText),at=decode(mutation.runText.slice(0,mutation.runOffset)).length,index=beforeCurrent.indexOf(run);
  assert.ok(index>=0&&beforeCurrent.indexOf(run,index+run.length)<0,'one exact supported source run in complete Current');
  const expectedCurrent=beforeCurrent.slice(0,index)+run.slice(0,at)+run.slice(at+1)+label+beforeCurrent.slice(index+run.length);
  const beforeReferenceTexts=beforeDocs.map(doc=>bookmarks.paragraphs(doc).map(bookmarks.textOf).join('\n'));
  const expectedSources=beforeDocs.map((doc,i)=>{const out=cloneJsonSafe(oldLedgers[i]?.source||doc);
    if(out.attrs&&Object.keys(out.attrs).length===0)delete out.attrs;return out;});
  const candidates=[];
  for(let i=0;i<expectedSources.length;i++)pending.paragraphs(expectedSources[i]).forEach((p,paragraphIndex)=>{
    for(let runIndex=0;runIndex<(p.content||[]).length;runIndex++)if(p.content[runIndex].type==='text'&&p.content[runIndex].text===run)
      candidates.push({sceneIndex:i,paragraphIndex,runIndex,p});});
  assert.equal(candidates.length,1,'one complete canonical source run owns the new tracked edits');
  const owner=candidates[0];assert.ok(!(oldLedgers[owner.sceneIndex]?.revisions||[]).some(r=>r.paragraphIndex===owner.paragraphIndex));
  const sourceOffset=owner.p.content.slice(0,owner.runIndex).reduce((n,node)=>n+(node.type==='hardBreak'?1:node.text.length),0);
  const referenceAt=beforeReferenceTexts[owner.sceneIndex].indexOf(run);assert.ok(referenceAt>=0);
  const expectedOwnerReferenceText=beforeReferenceTexts[owner.sceneIndex].slice(0,referenceAt)+run.slice(0,at)+run.slice(at+1)+label
    +beforeReferenceTexts[owner.sceneIndex].slice(referenceAt+run.length);
  // The fixture emits an unstyled inserted w:r; the closed export recipe supplies 12pt.
  owner.p.content.splice(owner.runIndex+1,0,{type:'text',text:label,marks:[{type:'textStyle',attrs:{fontSize:'12pt'}}]});
  for(let i=1;i<owner.p.content.length;i++) {const left=owner.p.content[i-1],right=owner.p.content[i];
    if(left.type==='text'&&right.type==='text'&&isDeepStrictEqual(left.marks||[],right.marks||[])){left.text+=right.text;owner.p.content.splice(i--,1);}}
  retain('fresh-joint-expected',{request,initialPins,beforeNotes,beforeDocs,expectedSources,oldLedgers,beforeCurrent,beforeOriginal,expectedCurrent,
    beforeReferenceTexts,expectedOwnerReferenceText,mutation:{...mutation,sceneIndex:owner.sceneIndex,paragraphIndex:owner.paragraphIndex,sourceOffset},returnedBytes});
  const beforePins=await noteAuthoringFilePins(f.root),value=await authenticatedBookNoteReturn(t,f,exported,returnedBytes,{label,priorAuthorityRecord,boundedPhysicalCheckpoint:!!request});
  console.log(JSON.stringify({phase:'fresh-joint-main',timings:value.timings,result:value.result,applied:value.applied,error:value.error,transactions:value.requests.length,publications:value.publications.length}));
  const afterNotes=JSON.parse(textFile(notePath)),current=f.scenes.map(s=>view(parseDoc(s.relativeFile),'current')).join('\n'),original=f.scenes.map(s=>view(parseDoc(s.relativeFile),'original')).join('\n');
  const pins=await noteAuthoringFilePins(f.root);retain('fresh-joint-terminal',{request,root:f.root,projectId:f.projectId,scenePaths:f.scenes.map(s=>path.join(f.root,s.relativeFile)),pins,afterNotes,current,original,timings:value.timings,applied:value.applied,error:value.error});
  assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));assert.equal(value.requests.length,1);assert.equal(value.publications.length,1);
  assert.equal(current,expectedCurrent);assert.equal(original,beforeOriginal);
  const plan=value.requests[0].treeCohort,allowed=new Set(plan.entries.map(row=>row.relativePath));
  for(const row of plan.entries.filter(row=>row.role==='scene'))allowed.add(row.relativePath+'.wp201-commit.json');
  allowed.add(path.relative(f.root,f.manifestPath));allowed.add(path.relative(f.root,tx.treeCommitPathFor(f.manifestPath)));
  const afterByPath=new Map(pins.map(row=>[row.path,row]));
  for(const row of beforePins)if(!row.path.startsWith('.test-authority/')&&!allowed.has(row.path))equal(afterByPath.get(row.path),row,'every unrelated complete physical byte remains exact');
  const receipt=JSON.parse(textFile(tx.treeCommitPathFor(f.manifestPath))),packetPath=path.relative(f.root,tx.recoveryPacketPathFor(f.manifestPath,receipt.transactionId));
  const added=pins.filter(row=>!beforePins.some(before=>before.path===row.path)&&!row.path.startsWith('.test-authority/'));
  equal(added.map(row=>row.path),[packetPath],'only actual Core recovery packet is added');
  const changed=pins.filter(row=>!row.path.startsWith('.test-authority/')&&(!beforePins.some(before=>before.path===row.path&&before.sha256===row.sha256)));
  retainDirectory('fresh-joint-changed-physical',Object.fromEntries(changed.map(row=>[row.path,fs.readFileSync(path.join(f.root,row.path))])));
  for(let i=0;i<f.scenes.length;i++) {
    const relative=f.scenes[i].relativeFile,afterDoc=parseDoc(relative),ledger=pending.readLedger(afterDoc);
    if(ledger)equal(ledger.source,expectedSources[i],'complete canonical ledger source preserves all old attributes, marks and paragraph order');
    else equal(afterDoc,beforeDocs[i],'complete untouched canonical rich document remains exact');
    if(i!==owner.sceneIndex)assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(value.before[relative]),'every uninvolved scene retains exact raw bytes');
    for(const revision of oldLedgers[i]?.revisions||[])equal(ledger.revisions.find(r=>r.id===revision.id),revision,'complete prior pending revision remains exact');
  }
  const fresh=pending.readLedger(parseDoc(f.scenes[owner.sceneIndex].relativeFile)).revisions.filter(r=>!(oldLedgers[owner.sceneIndex]?.revisions||[]).some(old=>old.id===r.id));
  assert.equal(fresh.length,2);
  for(const [nativeId,operation,author,date,from,to]of [[mutation.deleteId,'delete','Corrector','2026-10-09T01:00:01Z',sourceOffset+at,sourceOffset+at+1],
    [mutation.insertId,'insert','Editor','2026-10-09T01:00:00Z',sourceOffset+run.length,sourceOffset+run.length+label.length]]) {
    const revision=fresh.find(r=>r.nativeId===nativeId);assert.ok(revision);equal({operation:revision.operation,author:revision.author,date:revision.date,dateUtc:revision.dateUtc,
      paragraphIndex:revision.paragraphIndex,from:revision.from,to:revision.to,state:revision.state},{operation,author,date,dateUtc:'',paragraphIndex:owner.paragraphIndex,from,to,state:'pending'});
  }
  for(const before of beforeNotes.notes){const after=afterNotes.notes.find(n=>n.id===before.id);if(!before.manuscript||before.deleted){equal(after,before);continue;}
    const expected=cloneJsonSafe(before.manuscript.body);let changed=false;for(const p of expected.content)for(const node of p.content||[])if(!changed&&node.type==='text'&&node.text){node.text+=' '+label;changed=true;}
    equal(after.manuscript.body,expected,'complete changed note body and every break/mark preserved');
    const sceneIndex=f.scenes.findIndex(scene=>scene.relativeFile===before.manuscript.reference.sceneId);assert.ok(sceneIndex>=0);
    assert.equal(before.manuscript.reference.sourceTextSha256,sha(beforeReferenceTexts[sceneIndex]),'reference binds the complete before canonical paragraph literals');
    equal(after.manuscript.reference,sceneIndex===owner.sceneIndex?{...before.manuscript.reference,sourceTextSha256:sha(expectedOwnerReferenceText)}:before.manuscript.reference,
      'only the explicitly changed owner text hash updates; owner, point, affinity and other-owner references stay exact');}

  const commentRelative=path.relative(f.root,commentPath(f)),beforeComments=JSON.parse(value.before[commentRelative]),afterComments=JSON.parse(value.after[commentRelative]);
  assert.equal(afterComments.threads.length,beforeComments.threads.length);
  for(let i=0;i<beforeComments.threads.length;i++) {
    const expected=cloneJsonSafe(beforeComments.threads[i]),actual=afterComments.threads[i];
    for(let j=0;j<expected.messages.length;j++)if(i===0&&j===0){expected.messages[j].body+=' discussion-'+label;
      const node=expected.messages[j].richBody.document.content[0].content.find(row=>row.type==='text');assert.ok(node);node.text+=' discussion-'+label;}
    equal(actual,expected,'complete discussion topology/anchors/provenance and every unedited message');
  }
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  if(!request)for(const action of ['undo','redo']) {
    const projection=await value.sandbox.readPendingRevisionProjection(),start=performance.now();
    const result=await value.kernel.dispatch('cmd.project.review.decidePendingRevision',{action,projectId:projection.projectId,sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
    const seconds=(performance.now()-start)/1000;retain('fresh-joint-history-'+action,{projection,result,seconds,files:productFiles(f)});
    assert.equal(result.changed,true,JSON.stringify(result));for(const relative of f.scenes.map(s=>s.relativeFile).concat(['notes.craftsman.json',path.relative(f.root,commentPath(f))]))
      assert.ok(fs.readFileSync(path.join(f.root,relative)).equals((action==='undo'?value.before:value.after)[relative]),'coherent body/notes/comments '+action);assert.ok(seconds<120);
  }
  if(request)for(const row of request.bindings)assert.equal(sha(fs.readFileSync(row.path)),row.sha256,'immutable participating source exact');
  assert.ok(value.timings.prepareSeconds<120&&value.timings.applySeconds<120,JSON.stringify(value.timings));
});
test('novel authenticated atomic notes: independent editor and corrector returns preserve both branches through conflict and decisions',async t=>{
  const f=await importedTiny(t,'independent-roles',{canonicalNotes:true}),baseline=productFiles(f),commentRelative=path.relative(f.root,commentPath(f));
  const baselineDocs=Object.fromEntries(f.scenes.map(scene=>[scene.relativeFile,envelope.parseObservablePayload(baseline[scene.relativeFile].toString()).doc]));
  const baselineNotes=JSON.parse(baseline['notes.craftsman.json']),baselineComments=JSON.parse(baseline[commentRelative]);
  const exports=[];for(const role of ['editorA','correctorB']) {
    const x=await exportImported(f,f.scenes,{roundIdHex:crypto.randomBytes(16).toString('hex')});equal(productFiles(f),baseline,'both independently signed exports use the complete same baseline');
    const mutation={},label=role==='editorA'?'editor-A-return':'corrector-B-return',bytes=changedNotesZip(x,label,true,mutation);
    const extracted=x.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes);assert.equal(extracted.ok,true);
    const parts={...extracted.parts};for(const nativeId of [mutation.insertId,mutation.deleteId])parts['word/document.xml']=parts['word/document.xml']
      .replace(new RegExp('(<w:(?:ins|del)\\b[^>]*w:id="'+nativeId+'"[^>]*w:author=")[^"]*(")','g'),'$1'+role+'$2');
    const returnedBytes=buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data})));
    exports.push({role,label,x,mutation,returnedBytes});
  }
  const [a,b]=exports;assert.notEqual(a.x.source.localAuthorityCapsule.roundId,b.x.source.localAuthorityCapsule.roundId);assert.notEqual(sha(a.returnedBytes),sha(b.returnedBytes));
  retain('independent-roles-immutable-exports',{baseline,baselineDocs,baselineNotes,baselineComments,branches:exports.map(({role,label,x,mutation,returnedBytes})=>({role,label,mutation,
    input:cloneJsonSafe(x.input),source:cloneJsonSafe(x.source),originalBytes:x.bytes,returnedBytes,phases:x.phases}))});
  equal(a.x.input,b.x.input,'complete canonical source agrees before both independent signatures');equal(a.x.source.documentNotes,b.x.source.documentNotes);equal(a.x.source.commentExport,b.x.source.commentExport);
  const currentRound=branch=>branch.x.source.localAuthorityCapsule.roundId;
  const otherRounds=(record,branch)=>({...cloneJsonSafe(record),roundsById:Object.fromEntries(Object.entries(record.roundsById).filter(([id])=>id!==currentRound(branch)).map(([id,row])=>[id,cloneJsonSafe(row)]))});
  const cancelA=await authenticatedBookNoteReturn(t,f,a.x,a.returnedBytes,{label:'independent-A-cancel',cancel:true});
  assert.equal(cancelA.result.ok,true,JSON.stringify(cancelA.result));assert.equal(cancelA.result.status,'preview-ready');assert.equal(cancelA.applied,undefined);
  assert.equal(cancelA.requests.length,0);assert.equal(cancelA.publications.length,0);equal(productFiles(f),baseline,'CancelA has no product byte or packet write');
  const cancelB=await authenticatedBookNoteReturn(t,f,b.x,b.returnedBytes,{label:'independent-B-cancel',cancel:true,priorAuthorityRecord:cancelA.authorityRecord});
  assert.equal(cancelB.result.ok,true,JSON.stringify(cancelB.result));assert.equal(cancelB.result.status,'preview-ready');assert.equal(cancelB.applied,undefined);
  assert.equal(cancelB.requests.length,0);assert.equal(cancelB.publications.length,0);equal(productFiles(f),baseline,'CancelB has no product byte or packet write');
  const records=cloneJsonSafe(cancelB.authorityRecord.roundsById);equal(records[currentRound(a)],cancelA.authorityRecord.roundsById[currentRound(a)]);
  const artifactHashes=exports.map(branch=>({roundId:currentRound(branch),original:sha(branch.x.bytes),returned:sha(branch.returnedBytes),record:sha(JSON.stringify(records[currentRound(branch)]))}));
  retain('independent-roles-published-source-fixture',{cancelA:cancelA.authorityRecord,cancelB:cancelB.authorityRecord,records,artifactHashes});
  const assertRecords=value=>{for(const branch of exports)equal(value.authorityRecord.roundsById[currentRound(branch)],records[currentRound(branch)],'every complete earlier strict round record is immutable');
    for(const [i,branch]of exports.entries()){assert.equal(sha(branch.x.bytes),artifactHashes[i].original);assert.equal(sha(branch.returnedBytes),artifactHashes[i].returned);}};
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));
  const expectations=branch=>{
    const sources=Object.fromEntries(Object.entries(baselineDocs).map(([relative,document])=>[relative,pending.normalizeNode(document)]));
    const run=decode(branch.mutation.runText),at=decode(branch.mutation.runText.slice(0,branch.mutation.runOffset)).length,candidates=[];
    for(const [relative,document]of Object.entries(sources))pending.paragraphs(document).forEach((paragraph,paragraphIndex)=>{
      for(const [runIndex,node]of (paragraph.content||[]).entries())if(node.type==='text'&&node.text===run)candidates.push({relative,paragraphIndex,runIndex,paragraph});});
    assert.equal(candidates.length,1);const owner=candidates[0],sourceOffset=owner.paragraph.content.slice(0,owner.runIndex).reduce((n,node)=>n+(node.type==='hardBreak'?1:node.text.length),0);
    owner.paragraph.content.splice(owner.runIndex+1,0,{type:'text',text:branch.label,marks:[{type:'textStyle',attrs:{fontSize:'12pt'}}]});
    for(let i=1;i<owner.paragraph.content.length;i++){const left=owner.paragraph.content[i-1],right=owner.paragraph.content[i];
      if(left.type==='text'&&right.type==='text'&&isDeepStrictEqual(left.marks||[],right.marks||[])){left.text+=right.text;owner.paragraph.content.splice(i--,1);}}
    const ledger=pending.validateLedger({schemaVersion:2,source:sources[owner.relative],revisions:[
      {id:'revision-1',nativeId:branch.mutation.deleteId,operation:'delete',author:branch.role,date:'2026-10-09T01:00:01Z',dateUtc:'',groupId:null,
        paragraphIndex:owner.paragraphIndex,from:sourceOffset+at,to:sourceOffset+at+1,state:'pending'},
      {id:'revision-2',nativeId:branch.mutation.insertId,operation:'insert',author:branch.role,date:'2026-10-09T01:00:00Z',dateUtc:'',groupId:null,
        paragraphIndex:owner.paragraphIndex,from:sourceOffset+run.length,to:sourceOffset+run.length+branch.label.length,state:'pending'}],
      undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
    const original=pending.materialize(ledger,'original'),current=pending.materialize(ledger,'current');
    const expectedNotes=cloneJsonSafe(baselineNotes),emission=branch.x.source.documentNotes.breakEmission;
    assert.equal(emission.schemaVersion,2);
    const originalPhase=branch.x.phases.find(phase=>phase.phase==='final');assert.equal(originalPhase.analysis.ok,true);
    const originalNotes=branch.x.bridge.parseDocumentNotesRichReturn(branch.x.bytes,originalPhase.analysis.reviewIr.documentNotes,{includeBreakProjection:true});
    const beforeLiteral=notes.sceneText(baseline[owner.relative].toString()),index=beforeLiteral.indexOf(run);
    assert.ok(index>=0&&beforeLiteral.indexOf(run,index+run.length)<0);const currentLiteral=beforeLiteral.slice(0,index)+run.slice(0,at)+run.slice(at+1)+branch.label+beforeLiteral.slice(index+run.length);
    for(const note of expectedNotes.notes)if(note.manuscript&&!note.deleted){
      const binding=branch.x.source.documentNotes.sourceBindings.find(row=>row.noteId===note.id);assert.ok(binding);
      const recipe=notes.validateNoteBody(binding.richBody);
      for(const {paragraph:p}of recipe.paragraphs){
        p.attrs={textAlign:'left',...p.attrs,wordParagraphSpacing:{...emission.paragraphSpacing,...p.attrs?.wordParagraphSpacing},
          wordParagraphMarkLanguage:{...emission.wordLanguage,...p.attrs?.wordParagraphMarkLanguage}};
        for(const node of p.content||[])if(['text','hardBreak'].includes(node.type)){
          const marks=cloneJsonSafe(node.marks||[]);let style=marks.find(mark=>mark.type==='textStyle');if(!style){style={type:'textStyle',attrs:{}};marks.push(style);}
          style.attrs={fontFamily:emission.fontFamily,fontSize:emission.fontSize,...style.attrs,wordLanguage:{...emission.wordLanguage,...style.attrs.wordLanguage}};
          node.marks=marks.sort((left,right)=>left.type.localeCompare(right.type));
        }
      }
      const emitted=notes.validateNoteBody(recipe.body).body;
      equal(emitted,originalNotes.find(row=>row.transportIdentity===binding.transportIdentity)?.body,'complete closed signed BEFORE note recipe equals original raw DOCX emission');
      note.manuscript.body=emitted;let changed=false;for(const p of note.manuscript.body.content)for(const node of p.content||[])
      if(!changed&&node.type==='text'&&node.text){node.text+=' '+branch.label;changed=true;}
      if(note.manuscript.reference.sceneId===owner.relative){assert.ok(note.manuscript.reference.offsetUtf16>index+run.length);
        note.manuscript.reference.offsetUtf16+=branch.label.length-1;note.manuscript.reference.sourceTextSha256=sha(currentLiteral);}}
    const expectedThreads=cloneJsonSafe(baselineComments.threads);expectedThreads[0].messages[0].body+=' discussion-'+branch.label;
    expectedThreads[0].messages[0].richBody=cloneJsonSafe(branch.x.source.commentExport.threads[0].messages[0].transportRichBody);
    expectedThreads[0].messages[0].richBody.document.content[0].content.find(node=>node.type==='text').text+=' discussion-'+branch.label;
    return {sources,owner:{relative:owner.relative,paragraphIndex:owner.paragraphIndex,sourceOffset},run,at,original,current,currentLiteral,expectedNotes,expectedThreads};
  };
  const expectedA=expectations(a),expectedB=expectations(b);assert.equal(expectedA.owner.relative,expectedB.owner.relative,'both roles address the same actual scene');
  const assertApplied=(value,branch,expected)=>{
    assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));assert.equal(value.requests.length,1);assert.equal(value.publications.length,1);assertRecords(value);
    for(const scene of f.scenes){const document=envelope.parseObservablePayload(textFile(path.join(f.root,scene.relativeFile))).doc,ledger=pending.readLedger(document);
      if(scene.relativeFile!==expected.owner.relative)assert.ok(fs.readFileSync(path.join(f.root,scene.relativeFile)).equals(baseline[scene.relativeFile]),'every unedited rich scene raw byte stays exact');
      else {assert.ok(ledger);equal(ledger.source,expected.sources[scene.relativeFile],'complete rich source changes only by the specified insertion');
        equal(pending.materialize(ledger,'current'),expected.current);equal(pending.materialize(ledger,'original'),expected.original);
        assert.equal(notes.sceneText(textFile(path.join(f.root,scene.relativeFile))),expected.currentLiteral);assert.equal(ledger.revisions.length,2);
        for(const [nativeId,operation,date,from,to]of [[branch.mutation.deleteId,'delete','2026-10-09T01:00:01Z',expected.owner.sourceOffset+expected.at,expected.owner.sourceOffset+expected.at+1],
          [branch.mutation.insertId,'insert','2026-10-09T01:00:00Z',expected.owner.sourceOffset+expected.run.length,expected.owner.sourceOffset+expected.run.length+branch.label.length]]) {
          const revision=ledger.revisions.find(row=>row.nativeId===nativeId);assert.ok(revision);equal({operation:revision.operation,author:revision.author,date:revision.date,dateUtc:revision.dateUtc,
            paragraphIndex:revision.paragraphIndex,from:revision.from,to:revision.to,state:revision.state},{operation,author:branch.role,date,dateUtc:'',paragraphIndex:expected.owner.paragraphIndex,from,to,state:'pending'});}
      }
    }
    const actualNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),expectedNotes=cloneJsonSafe(expected.expectedNotes),proof=JSON.parse(value.requests[0].treeCohort.input.returnProofJson);
    for(const note of expectedNotes.notes)if(note.manuscript&&!note.deleted){note.body=notes.validateNoteBody(note.manuscript.body).text;note.updatedAtUtc=proof.now;}
    equal(actualNotes.notes,expectedNotes.notes,'all complete rich note bodies/private metadata and owner points preserve the explicit branch meaning');
    assert.equal(actualNotes.wordNoteReturnReceipts.length,(baselineNotes.wordNoteReturnReceipts||[]).length+1);
    equal(actualNotes.wordNoteReturnReceipts.slice(0,-1),baselineNotes.wordNoteReturnReceipts||[]);
    const actualComments=JSON.parse(textFile(commentPath(f)));equal(actualComments.threads,expected.expectedThreads,'all discussion graph/message/anchor/provenance fields follow the explicit branch');
    const plan=value.requests[0].treeCohort,allowed=new Set(plan.entries.map(entry=>entry.relativePath));for(const scene of f.scenes)allowed.add(path.relative(f.root,tx.commitPathFor(path.join(f.root,scene.relativeFile))));
    allowed.add(path.relative(f.root,f.manifestPath));allowed.add(path.relative(f.root,tx.treeCommitPathFor(f.manifestPath)));
    for(const [relative,bytes]of Object.entries(value.before))if(!allowed.has(relative))assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(bytes),'protected branch byte '+relative);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  };
  const applyA=await authenticatedBookNoteReturn(t,f,a.x,a.returnedBytes,{label:'independent-A-apply',priorAuthorityRecord:otherRounds(cancelB.authorityRecord,a)});
  retain('independent-roles-A-expected',expectedA);assertApplied(applyA,a,expectedA);
  const beforeStale=productFiles(f),staleB=await authenticatedBookNoteReturn(t,f,b.x,b.returnedBytes,{label:'independent-B-stale',priorAuthorityRecord:otherRounds(applyA.authorityRecord,b)});
  assertRecords(staleB);assert.equal(staleB.result.ok,false);assert.equal(staleB.result.code,'WORD_BOOK_RETURN_SOURCE_STALE');assert.equal(staleB.requests.length,0);assert.equal(staleB.publications.length,0);
  assert.equal(staleB.applied,undefined);equal(productFiles(f),beforeStale,'independent B conflict preserves every product byte and both readable branches');
  const reopenedA={...f,...await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined})},undoPort=await authenticatedBookNoteReturn(t,reopenedA,null,null,{historyOnly:true,scene:f.scenes.find(scene=>scene.relativeFile===expectedA.owner.relative)});
  const undoProjection=await undoPort.sandbox.readPendingRevisionProjection();assert.equal(undoProjection.canUndo,true);
  const undo=await undoPort.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'undo',projectId:undoProjection.projectId,sceneId:undoProjection.sceneId,
    subjectId:undoProjection.subjectId,expectedSceneSha256:undoProjection.expectedSceneSha256});
  retain('independent-roles-A-public-undo',{projection:undoProjection,result:undo,requests:undoPort.requests,publications:undoPort.publications,files:productFiles(f)});
  assert.equal(undo.ok,true,JSON.stringify(undo));assert.equal(undo.changed,true);assert.equal(undoPort.requests.length,1);assert.equal(undoPort.publications.length,1);
  for(const relative of f.scenes.map(scene=>scene.relativeFile).concat(['notes.craftsman.json',commentRelative]))assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(baseline[relative]),'synchronized UndoA restores the complete common baseline '+relative);
  const applyB=await authenticatedBookNoteReturn(t,f,b.x,b.returnedBytes,{label:'independent-B-fresh-apply',priorAuthorityRecord:otherRounds(staleB.authorityRecord,b)});
  retain('independent-roles-B-expected',expectedB);assertApplied(applyB,b,expectedB);
  const beforeReplay=productFiles(f),replayB=await authenticatedBookNoteReturn(t,f,b.x,b.returnedBytes,{label:'independent-B-replay',priorAuthorityRecord:otherRounds(applyB.authorityRecord,b)});
  assertRecords(replayB);assert.equal(replayB.result.ok,true,JSON.stringify(replayB.result));assert.equal(replayB.result.status,'replayed');
  assert.equal(replayB.result.replay,true);assert.equal(replayB.result.writerCalled,false);assert.equal(replayB.requests.length,0);assert.equal(replayB.publications.length,0);
  assert.equal(replayB.applied,undefined);equal(productFiles(f),beforeReplay,'exact authentic B replay preserves every product and packet byte');
  const branchPackets=[applyA,applyB].map(value=>{const receipt=JSON.parse(value.after[path.relative(f.root,tx.treeCommitPathFor(f.manifestPath))]);const packetPath=tx.recoveryPacketPathFor(f.manifestPath,receipt.transactionId);
    return {path:path.relative(f.root,packetPath),bytes:fs.readFileSync(packetPath)};});
  retain('independent-roles-readable-packets',{branchPackets,applyA:applyA.authorityRecord,applyB:applyB.authorityRecord});
  const scene=f.scenes.find(row=>row.relativeFile===expectedB.owner.relative),decisions=[];
  for(const action of ['acceptAll','undo','rejectAll','undo','redo']) {
    const before=productFiles(f),parsed=envelope.parseObservablePayload(before[scene.relativeFile].toString()),ledger=pending.readLedger(parsed.doc),expected=pending.decide(parsed.doc,{action});assert.equal(expected.changed,true);
    const expectedLedger=pending.readLedger(expected.doc),expectedContent=envelope.composeObservablePayload({...parsed,doc:expected.doc});
    equal(expectedLedger.source,ledger.source);equal(expectedLedger.revisions.map(({state,...row})=>row),ledger.revisions.map(({state,...row})=>row));
    const expectedNotes=cloneJsonSafe(JSON.parse(before['notes.craftsman.json'])),points=pending.noteProjection(expected.doc),literal=notes.sceneText(expectedContent);
    for(const note of expectedNotes.notes)if(!note.deleted&&note.manuscript?.reference.sceneId===scene.relativeFile){const point=points.find(row=>row.noteId===note.id);assert.ok(point);
      note.manuscript.reference.offsetUtf16=point.globalOffsetUtf16;note.manuscript.reference.sourceTextSha256=sha(literal);}
    const commentDecision=require('../../src/core/word-pending-comment-decisions-v1.cjs').planPendingCommentDecision({beforeText:before[commentRelative].toString(),projectId:f.projectId,
      sceneId:scene.relativeFile,beforeContent:before[scene.relativeFile].toString(),afterContent:expectedContent,decision:{action}});
    const h=await actualRichRecordingSavePort(t,{...f,...await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined})},scene),projection=await h.c.readPendingRevisionProjection();
    const result=await h.dispatch('cmd.project.review.decidePendingRevision',{action,projectId:projection.projectId,sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
    const after=productFiles(f);retain('independent-roles-decision-'+decisions.length,{action,before,expectedDoc:expected.doc,expectedContent,expectedNotes,commentDecision,projection,result,after,requests:h.port.requests,receipts:h.receipts});
    assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.changed,true);assert.equal(h.receipts.length,1);assert.equal(textFile(h.file),expectedContent,'complete before-derived public decision envelope');
    equal(JSON.parse(after['notes.craftsman.json']),expectedNotes);equal(JSON.parse(after[commentRelative]),JSON.parse(commentDecision.afterText));
    const actual=envelope.parseObservablePayload(after[scene.relativeFile].toString()).doc;equal(pending.readLedger(actual),expectedLedger);
    for(const mode of ['current','original'])equal(pending.materialize(pending.readLedger(actual),mode),pending.materialize(expectedLedger,mode),'complete decision '+mode);
    for(const branch of branchPackets)assert.ok(fs.readFileSync(path.join(f.root,branch.path)).equals(branch.bytes),'both earlier readable recovery packets remain immutable');
    const mutable=new Set([scene.relativeFile,path.relative(f.root,tx.commitPathFor(h.file)),'project.craftsman.json','notes.craftsman.json',commentRelative]);
    for(const [relative,bytes]of Object.entries(before))if(!mutable.has(relative))assert.ok(after[relative].equals(bytes),'protected decision byte '+relative);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);decisions.push({action,result,states:expectedLedger.revisions.map(row=>row.state)});h.editor.destroy();
  }
  equal(decisions.map(row=>row.states),[['accepted','accepted'],['pending','pending'],['rejected','rejected'],['pending','pending'],['rejected','rejected']]);
  retain('independent-roles-terminal',{baseline,artifactHashes,records,decisions,files:productFiles(f)});
});
test('novel manuscript note browser projection matches Core for actual PM rich breaks and refuses malformed bodies',async()=>{
  const {getSchema}=await import('@tiptap/core'),{EditorState}=await import('@tiptap/pm/state');
  const renderer=await import('../../src/renderer/tiptap/manuscriptNotes.mjs'),schema=getSchema(renderer.manuscriptBodyExtensions());
  const marks=[{type:'bold'},{type:'italic'},{type:'textStyle',attrs:{color:'#112233',fontFamily:'Georgia',fontSize:'14pt',
    wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}},{type:'link',attrs:{href:'https://example.invalid/note-break',
      target:'_blank',rel:'noopener noreferrer nofollow',class:null,title:null}}].sort((a,b)=>schema.marks[a.type].rank-schema.marks[b.type].rank);
  const positive=[];
  for(const kind of [undefined,null,'line','page','column']){
    const body={type:'doc',content:[{type:'paragraph',attrs:{textAlign:'left',wordParagraphSpacing:{before:0,after:80,line:240,lineRule:'auto'},
      wordParagraphMarkLanguage:{val:'ru-RU'},wordParagraphMarkTypography:{fontFamily:'Georgia',fontSize:'14pt'}},content:[
      {type:'text',text:'Before Ж🧭 ',marks:cloneJsonSafe(marks)},
      {type:'hardBreak',...(kind!==undefined?{attrs:{wordBreakType:kind}}:{}),marks:cloneJsonSafe(marks)},
      {type:'text',text:' After 漢字',marks:cloneJsonSafe(marks)}]}]};
    const node=schema.nodeFromJSON(body);node.check();const state=EditorState.create({doc:node});
    const expected=notes.validateNoteBodyProjection(body).body,actual=renderer.readManuscriptBodyDocument({getJSON:()=>state.doc.toJSON()});
    positive.push({kind:kind??'absent',body,pm:state.doc.toJSON(),expected,actual});retain('browser-note-projection',{positive});
    equal(actual,expected,'complete authored paragraph/run/link/break fields agree with the independent Core projection');
    assert.equal(Object.hasOwn(actual.content[0].content[1],'attrs'),kind!=null);
  }
  const negative=[],base=cloneJsonSafe(positive[0].body);
  for(const mutate of [body=>body.content[0].content[1].attrs={},body=>body.content[0].content[1].attrs=null,
    body=>body.content[0].content[1].attrs=[],body=>body.content[0].content[1].attrs={wordBreakType:'section'},
    body=>body.content[0].content[1].attrs={wordBreakType:null,unknown:null},body=>body.content[0].content[1].marks.push({type:'unknown'}),
    body=>body.content[0].content[1].marks[0].attrs={unknown:true},body=>body.content[0].content[1].marks.find(mark=>mark.type==='link').attrs.href='file:///secret',
    ...[null,false,0,''].map(value=>body=>body.content[0].content[1].marks=value)]){
    const body=cloneJsonSafe(base);mutate(body);let coreError,rendererError;
    assert.throws(()=>notes.validateNoteBodyProjection(body),error=>{coreError=error.code||error.message;return true;});
    assert.throws(()=>renderer.readManuscriptBodyDocument({getJSON:()=>cloneJsonSafe(body)}),error=>{rendererError=error.code||error.message;return true;});
    negative.push({body,coreError,rendererError});
  }
  const budgetBody={type:'doc',content:[{type:'paragraph',content:Array.from({length:18000},()=>({type:'hardBreak',attrs:{wordBreakType:'line'},marks:[{type:'bold'}]}))}]};
  const surrogate={type:'doc',content:[{type:'paragraph',content:budgetBody.content[0].content.map(node=>({type:'text',text:'\n',marks:node.marks}))}]};
  assert.ok(Buffer.byteLength(JSON.stringify(surrogate))<1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(budgetBody))>1024*1024);
  assert.throws(()=>notes.validateNoteBodyProjection(budgetBody),/NOTE_BODY_BUDGET/);
  assert.throws(()=>renderer.readManuscriptBodyDocument({getJSON:()=>cloneJsonSafe(budgetBody)}),/NOTE_BODY_BUDGET/);
  const commentSchema=getSchema(renderer.manuscriptBodyExtensions({profile:'comment'}));assert.equal(commentSchema.nodes.hardBreak.spec.attrs,undefined);
  const commentBody=cloneJsonSafe(base);commentBody.content[0].content[1].attrs={wordBreakType:null};
  assert.throws(()=>renderer.readManuscriptBodyDocument({getJSON:()=>cloneJsonSafe(commentBody)},'comment'),/COMMENT_RICH_BODY_PROFILE/);
  retain('browser-note-projection',{positive,negative,budgetBody,surrogateBytes:Buffer.byteLength(JSON.stringify(surrogate)),bodyBytes:Buffer.byteLength(JSON.stringify(budgetBody))});
});
async function actualRichRecordingSavePort(t,f,scene,options={}) {
  const source=readSource(MAIN_PATH),renderer=readSource(path.join(REPO_ROOT,'src/renderer/editor.js'));
  const tiptap=readSource(path.join(REPO_ROOT,'src/renderer/tiptap/index.js'));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'novel-recording-schema-')),output=path.join(directory,'schema.cjs');
  const imports=tiptap.slice(0,tiptap.indexOf('let currentEditorInstance'));
  const extensions=tiptap.slice(tiptap.indexOf('    extensions: [')+'    extensions: '.length,tiptap.indexOf("    content: '<p></p>'")).trim().replace(/,$/,'');
  const readers=tiptap.slice(tiptap.indexOf('function readEditorText('),tiptap.indexOf('function normalizeFormattingColor('));
  require('esbuild').buildSync({stdin:{contents:imports+'\nimport {getSchema} from "@tiptap/core";\n'+readers+'\nconst extensions='+extensions+';const schema=getSchema(extensions);export {Editor,extensions,schema,readEditorDocument};',
    resolveDir:path.join(REPO_ROOT,'src/renderer/tiptap')},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
  const production=require(output);fs.rmSync(directory,{recursive:true,force:true});
  const [ui,review,lists,{history}]=await Promise.all([import('../../src/renderer/tiptap/documentCommentEditIntents.mjs'),
    import('../../src/renderer/tiptap/wordPendingRevisions.mjs'),import('../../src/renderer/tiptap/documentListNumbering.mjs'),import('@tiptap/pm/history')]);
  const file=path.join(f.root,scene.relativeFile),raw=textFile(file),parsed=envelope.parseObservablePayload(raw);
  const editor=new production.Editor({element:null,extensions:production.extensions,content:parsed.doc});
  editor.view.updateState(editor.state.reconfigure({plugins:editor.extensionManager.plugins}));Object.defineProperty(editor,'isDestroyed',{get:()=>false});
  editor.getJSON=()=>editor.state.doc.toJSON();editor.getText=()=>editor.state.doc.textBetween(0,editor.state.doc.content.size,'\n');
  t.after(()=>editor.destroy());
  const port=await authenticatedBookNoteReturn(t,f,null,null,{historyOnly:true,scene}),c=port.sandbox;
  const h={editor,content:raw,generation:0,acks:[],snapshots:[],receipts:[],errors:[],publications:[],lifecycle:'owned'};
  const requests=new Map(),gateway=require('../../src/core/legacy-strangler-v1.cjs');
  Object.assign(c,{setTimeout,clearTimeout,pendingSnapshotRequests:requests,activeAutoSavePromise:null,lastAcknowledgedEditGeneration:0,
    currentLifecycleSubjectId:()=>h.lifecycle,lastAutosaveHash:sha(raw),userBookmarkSaveContinuation:null,userBookmarkRenameLineage:null,
    normalizeSelectionRangeForSettings:()=>null,logDevError:(name,error)=>h.errors.push({name,code:error?.code,message:error?.message}),
    getProjectDocumentIdentityPayload:async()=>({documentId:scene.relativeFile,projectId:f.projectId}),
    getDocumentContextFromPath:()=>({kind:'scene',title:'Current chapter',metaEnabled:envelope.parseObservablePayload(textFile(file)).hasMetaBlock}),
    ...gateway,SAVE_AUTHORITY_OBSERVER_IDS:gateway.OBSERVER_IDS,
    ...require('../../src/core/autosave-generation-v1.cjs'),...require('../../src/core/dirty-admission-v1.cjs'),...require('../../src/core/save-receipt-ack-v1.cjs'),
    durableSaveTransaction:require('../../src/core/save-coordinator-v1.cjs').durableSaveTransaction,planCommentAnchorSave:anchors.planCommentAnchorSave,
    getProjectRelativeFilePath:target=>path.relative(f.root,target),PROJECT_MANIFEST_SCHEMA_VERSION:1,sanitizeFilename:value=>value,
    normalizeProjectId:require('../../src/product/projectIdDomain.cjs').normalizeProjectId,
    loadBookProfileModule:()=>import('../../src/core/bookProfile.mjs'),loadProRoundtripPreservationModule:()=>import('../../src/core/proRoundtripPreservation.mjs'),
    loadMarkdownIoModule:()=>import('../../src/io/markdown/index.mjs'),isPathInside:(root,target)=>target===root||target.startsWith(root+path.sep),
    ensureProjectManifest:async()=>{const manifestRaw=textFile(f.manifestPath),manifest=JSON.parse(manifestRaw);assert.equal(manifest.projectId,f.projectId);
      return {manifestPath:f.manifestPath,manifest,manifestRaw};},
    COMMAND_SURFACE_KERNEL_COMMAND_IDS:{PROJECT_SAVE:'cmd.project.save'},saveLastFile:async()=>{},dialog:{showMessageBox:async()=>({response:0})},
  });
  const r=vm.createContext({...envelope,parseDocumentContent:envelope.parseObservablePayload,currentEditorInstance:editor,
    currentProjectId:f.projectId,currentDocumentId:scene.relativeFile,currentTreeContentPublicationId:'',isTiptapMode:true,
    centralSheetStripLargePayloadFastPathActive:false,localEditGeneration:0,lastAckedGeneration:0,localDirty:false,
    wordCommentDraft:null,wordCommentBusy:false,manuscriptDrafts:new Map(),storyDrafts:new Map(),flowModeState:{active:false},
    notesMutationPending:false,storyMutationPending:false,pendingStoryRequestId:null,
    getPlainText:()=>editor.getText(),getActiveBookProfile:()=>JSON.parse(textFile(f.manifestPath)).bookProfile||null,
    getSelectionOffsets:()=>null,getTiptapImageInsertionPosition:()=>null,getTiptapRootSplitBoundary:()=>null,
    getTiptapCommentEditIntentsJson:()=>ui.getCommentEditIntentsJson(editor),checkpointTiptapCommentEditIntents:hash=>ui.checkpointCommentEditIntents(editor,hash),
    wordSections:sections,wordStories:require('../../src/core/word-stories-projection-v1.cjs'),wordListNumbering:require('../../src/core/word-list-numbering-v1.cjs'),
    numberingDocumentJSON:lists.numberingDocumentJSON,setCheckedReviewDocument:review.setCheckedDocument,history,notifyFormattingStateChange(){},
    updateMetaInputs(){},updateMetaVisibility(){},updateCardsList(){},updateWordCount(){},updateSaveStateText(){},updateInspectorSnapshot(){},
    refreshManuscriptNoteReferences:async()=>{},refreshVisibleCommentProjection:async()=>{},
    window:{electronAPI:{onEditorSetText(fn){r.publish=fn;},onSetDirty(fn){r.dirty=fn;},sendEditorSnapshotResponse(requestId,snapshot){
      h.snapshots.push(cloneJsonSafe(snapshot));const p=requests.get(requestId);assert.ok(p);clearTimeout(p.timeoutId);requests.delete(requestId);
      if(options.beforeSnapshotReply)options.beforeSnapshotReply({h,c,r});p.resolve(c.normalizeEditorSnapshotPayload(snapshot));
    }}}});
  const part=name=>{const found=tiptap.match(new RegExp('(?:export )?function '+name+'\\([^]*?\\n}'));assert.ok(found);return found[0].replace(/^export /,'');};
  vm.runInContext(['readEditorText','readEditorDocument','getTiptapDocumentSnapshot','setCheckedDocument','setTiptapDocumentSnapshot'].map(part).join('\n'),r);
  vm.runInContext(['composeDocumentContent','composeEditorSnapshot'].map(n=>namedFunction(renderer,n)).join('\n'),r);
  const callback=renderer.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  vm.runInContext(renderer.slice(callback,renderer.indexOf('    if (payload?.storyPublication',callback))+'});',r);
  const ackStart=renderer.indexOf('window.electronAPI.onSetDirty((message) => {');
  vm.runInContext(renderer.slice(ackStart,renderer.indexOf('\n  });',ackStart)+7),r);
  const sync=()=>{const value=envelope.parseObservablePayload(h.content);r.currentMeta=value.meta;r.currentCards=value.cards;r.metaEnabled=value.hasMetaBlock;r.localEditGeneration=h.generation;};sync();
  c.mainWindow={isDestroyed:()=>false,webContents:{send(channel,payload){
    sync();
    if(channel==='editor:set-text'){h.publications.push(cloneJsonSafe(payload));r.publish(payload);h.content=r.composeDocumentContent();}
    else if(channel==='editor:snapshot-request')r.window.electronAPI.sendEditorSnapshotResponse(payload.requestId,r.composeEditorSnapshot());
    else if(channel==='set-dirty'){h.acks.push(cloneJsonSafe(payload));r.dirty(payload);}
  }}};
  const recordingSource=source.slice(source.indexOf('let activePendingRecording ='),source.indexOf('const authenticatedPendingReturnAdmissions ='));
  vm.runInContext(['cloneJsonSafe','normalizeEditorSnapshotPayload','requestEditorSnapshot','normalizeStableProjectId','createStableProjectId','canonicalizeComparableValue',
    'getProjectManifestComparable','normalizeProjectManifest','resolveProjectBindingForFile','prepareBookProfileManifestForFile',
    'boundUserBookmarkRenameLineage','continueUserBookmarkWorkingDocument','commitWriterProjectSnapshot','publishUserBookmarkSaveReceipt',
    'setDirtyState','acknowledgeMainOwnedSave','projectSaveFailure','writerSaveFailureStatus','showCommentSaveFailure','handleSave'].map(n=>namedFunction(source,n)).join('\n')
    +'\n'+recordingSource,c,{filename:MAIN_PATH});
  const kernel=require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({
    'cmd.project.save':c.handleSave,'cmd.project.review.recordTextRevisions':c.handlePendingRecordingCommand,'cmd.project.review.decidePendingRevision':c.handlePendingRevisionCommand});
  c.MENU_COMMAND_HANDLERS=Object.fromEntries(['cmd.project.save','cmd.project.review.recordTextRevisions','cmd.project.review.decidePendingRevision'].map(id=>[id,payload=>kernel.dispatch(id,payload)]));
  const realCommit=c.commitProjectTransaction;c.commitProjectTransaction=async args=>{const receipt=await realCommit(args);h.receipts.push(cloneJsonSafe(receipt));if(options.afterCommit)options.afterCommit({h,c,r});return receipt;};
  h.renderer=r;h.c=c;h.kernel=kernel;h.port=port;h.file=file;
  h.dispatch=(id,payload)=>c.dispatchMenuCommand(id,payload,{route:'command.bus'});
  h.record=async action=>{const payload={action,projectId:f.projectId,sceneId:scene.relativeFile,subjectId:h.lifecycle+':'+c.commentAuthoringSessionId,
    ...(action==='start'?{expectedSceneSha256:sha(textFile(file)),author:'Yalken recording proof'}:{sessionId:h.sessionId})};
    const result=await h.dispatch('cmd.project.review.recordTextRevisions',payload);retain('rich-public-recording-command-'+path.basename(f.root)+'-'+action,{payload,result,errors:h.errors,snapshots:h.snapshots});
    if(action==='start'&&result.ok)h.sessionId=result.sessionId||result.result?.sessionId;return result;};
  h.insert=(position,text)=>{editor.commands.setTextSelection(position);assert.equal(editor.commands.insertContent({type:'text',text}),true);
    h.generation++;c.lastSignaledEditGeneration=h.generation;c.isDirty=true;r.localEditGeneration=h.generation;r.localDirty=true;h.content=r.composeDocumentContent();};
  return h;
}
test('novel authenticated atomic notes: rich public recording Save keeps local history after Word Apply',async t=>{
  const f=await importedTiny(t,'rich-recording-save',{canonicalNotes:true}),x=await exportImported(f);
  const returned=await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'before-recording',true),{label:'before-recording-save'});assert.equal(returned.applied?.ok,true);
  const before=productFiles(f),h=await actualRichRecordingSavePort(t,f,f.scenes[0]);
  const coupled=await h.c.readPendingRevisionProjection();assert.equal(coupled.canUndo,true);assert.equal(coupled.canRedo,false);
  const opposite=await h.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'redo',projectId:f.projectId,sceneId:f.scenes[0].relativeFile,
    subjectId:h.lifecycle+':'+h.c.commentAuthoringSessionId,expectedSceneSha256:sha(textFile(h.file))});
  retain('rich-public-recording-coupled-history',{coupled,opposite,before,after:productFiles(f)});
  assert.equal(opposite.ok,false);assert.equal(opposite.error.code,'WORD_BOOK_HISTORY_UNAVAILABLE');equal(productFiles(f),before);
  const started=await h.record('start');assert.equal(started.ok,true,JSON.stringify(started));
  const metadata=vm.runInContext('cloneJsonSafe(activePendingRecording.metadata)',h.c);
  const working=cloneJsonSafe(h.editor.getJSON()),original=pending.projection(envelope.parseObservablePayload(textFile(h.file)).doc).original;
  const position=h.editor.state.doc.child(0).content.size+1;assert.equal(h.editor.state.doc.child(0).type.name,'paragraph');
  assert.ok(position);h.insert(position,' recording-one');const wire=h.renderer.getTiptapCommentEditIntentsJson();assert.equal(JSON.parse(wire).schemaVersion,2);
  const saved=await h.dispatch('cmd.project.save',{});retain('rich-public-recording-save',{started,saved,working,before,after:productFiles(f),snapshots:h.snapshots,acks:h.acks,receipts:h.receipts,errors:h.errors});
  assert.equal(saved.ok,true,JSON.stringify(saved));assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].success,true);
  assert.ok(h.acks.some(row=>row.ack?.kind==='SAVED'&&row.ack.commentEditIntentsSha256===sha(wire)));assert.equal(h.renderer.localDirty,false);
  const stopped=await h.record('stop');assert.equal(stopped.ok,true,JSON.stringify(stopped));
  const savedFiles=productFiles(f),current=envelope.parseObservablePayload(textFile(h.file)),local=pending.projection(current.doc),projection=await h.c.readPendingRevisionProjection();
  assert.equal(local.original,original);assert.ok(local.current.includes(' recording-one'));assert.equal(local.canUndo,true);
  const sceneId=f.scenes[0].relativeFile,commentsPath=path.relative(f.root,commentPath(f));
  const beforeDoc=envelope.parseObservablePayload(before[sceneId].toString()).doc,beforeLedger=pending.readLedger(beforeDoc),savedLedger=pending.readLedger(current.doc);
  const assertProtected=(prior,actual,receipt)=>{
    const mutable=new Set([sceneId,path.relative(f.root,tx.commitPathFor(h.file)),'project.craftsman.json','notes.craftsman.json',commentsPath]);
    for(const [relative,bytes] of Object.entries(prior))if(!mutable.has(relative))assert.deepEqual(actual[relative],bytes,'protected '+relative);
    const added=Object.keys(actual).filter(relative=>!Object.hasOwn(prior,relative));
    equal(added,[path.relative(f.root,tx.recoveryPacketPathFor(f.manifestPath,receipt.transactionId))]);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  };
  const expectedSource=cloneJsonSafe(beforeLedger.source),inserted=' recording-one';
  const first=expectedSource.content[0],from=first.content.reduce((n,node)=>n+(node.type==='hardBreak'?1:node.text.length),0);
  first.content.push({type:'text',text:inserted,marks:cloneJsonSafe(first.content.at(-1).marks)});
  const id=Math.max(...beforeLedger.revisions.map(row=>Number(row.id.slice(9))))+1;
  const expectedRevisions=[...cloneJsonSafe(beforeLedger.revisions),{id:'revision-'+id,nativeId:'yalken-'+id,operation:'insert',author:metadata.author,
    date:metadata.date,dateUtc:metadata.date,groupId:null,paragraphIndex:0,from,to:from+inserted.length,state:'pending'}];
  assertProtected(before,savedFiles,h.receipts[0]);equal(savedLedger.source,expectedSource,'complete rich union differs only by the explicit marked insertion');
  equal(pending.materialize(savedLedger,'original'),pending.materialize(beforeLedger,'original'),'complete Original rich document is exact');
  equal(savedLedger.revisions,expectedRevisions,'all old Word rows plus one exact main-owned recording revision');
  const oppositeAfter=await h.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'redo',projectId:f.projectId,sceneId,
    subjectId:h.lifecycle+':'+h.c.commentAuthoringSessionId,expectedSceneSha256:sha(textFile(h.file))});
  retain('rich-public-recording-local-opposite',{projection,oppositeAfter,before:savedFiles,after:productFiles(f),requests:h.port.requests});
  assert.equal(oppositeAfter.ok,false);assert.equal(oppositeAfter.error.code,'WORD_BOOK_HISTORY_UNAVAILABLE');equal(productFiles(f),savedFiles);
  const baseNotes=JSON.parse(before['notes.craftsman.json']),savedNotes=JSON.parse(savedFiles['notes.craftsman.json']);
  const expectedSavedNotes=cloneJsonSafe(baseNotes);
  const beforeLiteral=notes.sceneText(before[sceneId].toString()),insertAt=beforeLiteral.indexOf('\n');assert.ok(insertAt>=0);
  const expectedLiteral=beforeLiteral.slice(0,insertAt)+inserted+beforeLiteral.slice(insertAt);
  assert.equal(notes.sceneText(savedFiles[sceneId].toString()),expectedLiteral,'complete literal predicted before Save');
  for(const n of expectedSavedNotes.notes)if(!n.deleted&&n.manuscript?.reference.sceneId===sceneId){
    assert.ok(n.manuscript.reference.offsetUtf16>=position-1);n.manuscript.reference.offsetUtf16+=inserted.length;
    n.manuscript.reference.sourceTextSha256=sha(expectedLiteral);
  }
  equal(savedNotes,expectedSavedNotes,'all rich note bodies/private fields exact; only actual owner reference follows the literal edit');
  const savedComments=JSON.parse(savedFiles[commentsPath]),expectedSavedComments=cloneJsonSafe(JSON.parse(before[commentsPath]));
  const baseline=pending.roundFrame(beforeLedger),stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  const identity={sessionId:'recording-round:'+sha(stable(baseline)),historyId:'round:'+sha(stable({baseline,source:expectedSource,revisions:expectedRevisions.map(({state,...row})=>row)}))};
  expectedSavedComments.schemaVersion='yalken.rtk.word.non-text-return-state.v5';expectedSavedComments.revision++;
  let histories=0;
  for(const thread of expectedSavedComments.threads)if(thread.sceneId===sceneId){
    const snapshot=anchors.structuralSnapshot(thread);assert.equal(snapshot.kind,'multi-paragraph-range');assert.ok(snapshot.sceneParagraphIndex>0);
    thread.anchorEditHistory=[...(thread.anchorEditHistory||[]),{schemaVersion:2,...identity,before:cloneJsonSafe(snapshot),after:cloneJsonSafe(snapshot),
      beforeTextSha256:snapshot.coveredParagraphsSha256,afterTextSha256:snapshot.coveredParagraphsSha256,undone:false}];histories++;
  }
  retain('rich-public-recording-save-predictions',{metadata,expectedSource,expectedRevisions,expectedLiteral,expectedSavedNotes,expectedSavedComments,before,after:savedFiles});
  assert.equal(histories,1);equal(savedComments,expectedSavedComments,'complete BEFORE discussion graph plus one independently bound recording row');
  const expectedUndoComments=cloneJsonSafe(expectedSavedComments);expectedUndoComments.revision++;
  for(const thread of expectedUndoComments.threads)for(const row of thread.anchorEditHistory||[])if(row.sessionId===identity.sessionId&&row.historyId===identity.historyId)row.undone=true;
  const result=await h.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'undo',projectId:f.projectId,sceneId:f.scenes[0].relativeFile,
    subjectId:h.lifecycle+':'+h.c.commentAuthoringSessionId,expectedSceneSha256:sha(textFile(h.file))});
  const undoneFiles=productFiles(f),undone=envelope.parseObservablePayload(textFile(h.file));
  retain('rich-public-recording-local-history',{local,projection,result,before:savedFiles,after:undoneFiles,requests:h.port.requests});
  assert.equal(projection.canUndo,true,JSON.stringify(projection));assert.equal(result.ok,true,JSON.stringify(result));
  equal(pending.normalizeNode(undone.doc),pending.normalizeNode(beforeDoc),'complete rich document restored');
  equal(pending.readLedger(undone.doc).source,beforeLedger.source);equal(pending.readLedger(undone.doc).revisions,beforeLedger.revisions);
  assert.equal(pending.projection(undone.doc).original,original);equal(JSON.parse(undoneFiles['notes.craftsman.json']),baseNotes);
  equal(JSON.parse(undoneFiles[commentsPath]),expectedUndoComments);assertProtected(savedFiles,undoneFiles,result.receipt);
  const reopened=await actualRichRecordingSavePort(t,f,f.scenes[0]),redoProjection=await reopened.c.readPendingRevisionProjection();assert.equal(redoProjection.canRedo,true);
  const redone=await reopened.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'redo',projectId:f.projectId,sceneId,
    subjectId:reopened.lifecycle+':'+reopened.c.commentAuthoringSessionId,expectedSceneSha256:sha(textFile(reopened.file))});
  const redoneFiles=productFiles(f),redoDoc=envelope.parseObservablePayload(textFile(h.file)).doc;
  retain('rich-public-recording-local-redo',{redoProjection,redone,before:undoneFiles,after:redoneFiles,requests:reopened.port.requests});
  assert.equal(redone.ok,true,JSON.stringify(redone));equal(pending.normalizeNode(redoDoc),pending.normalizeNode(current.doc));
  equal(pending.readLedger(redoDoc).source,savedLedger.source);equal(pending.readLedger(redoDoc).revisions,savedLedger.revisions);
  assert.equal(pending.projection(redoDoc).original,original);equal(JSON.parse(redoneFiles['notes.craftsman.json']),savedNotes);
  const expectedRedoComments=cloneJsonSafe(expectedUndoComments);expectedRedoComments.revision++;
  for(const thread of expectedRedoComments.threads)for(const row of thread.anchorEditHistory||[])if(row.sessionId===identity.sessionId&&row.historyId===identity.historyId)row.undone=false;
  equal(JSON.parse(redoneFiles[commentsPath]),expectedRedoComments);assertProtected(undoneFiles,redoneFiles,redone.receipt);
});
test('novel authenticated atomic notes: ordinary rich public Save reopens imported note owner without a recording ledger',async t=>{
  const f=await importedTiny(t,'ordinary-rich-note-save',{canonicalNotes:true,sourceOptions:{emptyParagraphIndex:10}});
  const scene=f.scenes.find((row,i)=>f.source.plan.candidateCreatePlan.entries[i].partition.leafFrom===10);assert.ok(scene);
  const initialDoc=envelope.parseObservablePayload(textFile(path.join(f.root,scene.relativeFile))).doc;
  equal(initialDoc.content[0],{type:'paragraph',content:[],attrs:{wordParagraphMarkLanguage:{val:'en-US'},wordParagraphSpacing:{after:0,line:240,lineRule:'auto'}}},'actual imported empty paragraph matches the genuine owner boundary');
  const initialNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),body=cloneJsonSafe(initialNotes.notes.find(n=>n.manuscript).manuscript.body);
  const operation={action:'create',noteId:'ordinary-empty-'+crypto.randomUUID(),kind:'footnote',offsetUtf16:0,body},beforeCreate=productFiles(f);
  const created=await governedNotesAuthoring(f,scene,operation);retain('ordinary-rich-note-create',{operation,created,before:beforeCreate,after:productFiles(f)});
  assert.equal(created.result.ok,true,JSON.stringify(created.result));
  const owner=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.find(n=>n.id===operation.noteId);assert.ok(owner);
  equal(owner.manuscript.reference,{sceneId:scene.relativeFile,offsetUtf16:0,affinity:'after',sourceTextSha256:sha(notes.sceneText(textFile(path.join(f.root,scene.relativeFile))))});equal(owner.manuscript.body,body);
  const sceneId=scene.relativeFile,file=path.join(f.root,sceneId),commentsPath=path.relative(f.root,commentPath(f));
  for(const marker of ['ordinary-one Ж ','ordinary-two 🧭 ']) {
    const before=productFiles(f),beforeDoc=envelope.parseObservablePayload(before[sceneId].toString()).doc,beforeLiteral=notes.sceneText(before[sceneId].toString());
    assert.equal(pending.readLedger(beforeDoc),null);assert.equal(pending.noteProjection(beforeDoc),null);
    assert.equal(beforeDoc.content[0].type,'paragraph');assert.equal(beforeDoc.content[0].content.length,marker.startsWith('ordinary-one')?0:1);
    const beforeNotes=JSON.parse(before['notes.craftsman.json']),expectedNotes=cloneJsonSafe(beforeNotes);let expectedDoc=cloneJsonSafe(beforeDoc);
    if(expectedDoc.content[0].content.length)expectedDoc.content[0].content[0].text=marker+expectedDoc.content[0].content[0].text;
    else expectedDoc.content[0].content=[{type:'text',text:marker}];
    const expectedLiteral=marker+beforeLiteral;
    for(const note of expectedNotes.notes)if(!note.deleted&&note.manuscript?.reference.sceneId===sceneId){
      assert.equal(note.manuscript.reference.sourceTextSha256,sha(beforeLiteral));assert.equal(notes.boundary(beforeLiteral,note.manuscript.reference.offsetUtf16),true);
      note.manuscript.reference.offsetUtf16+=marker.length;note.manuscript.reference.sourceTextSha256=sha(expectedLiteral);
    }
    const h=await actualRichRecordingSavePort(t,f,scene),startedAt=new Date();
    expectedDoc=envelope.canonicalizeDocumentJson(h.editor.schema.nodeFromJSON(expectedDoc).toJSON());h.insert(1,marker);
    const wire=h.renderer.getTiptapCommentEditIntentsJson();assert.equal(JSON.parse(wire).schemaVersion,2);
    const result=await h.dispatch('cmd.project.save',{}),finishedAt=new Date(),after=productFiles(f),doc=envelope.parseObservablePayload(after[sceneId].toString()).doc;
    const beforeManifest=JSON.parse(before['project.craftsman.json']),actualManifest=JSON.parse(after['project.craftsman.json']),expectedManifest=cloneJsonSafe(beforeManifest),prior=expectedManifest.proDataInvalidation||{};
    assert.ok(Number.isFinite(Date.parse(actualManifest.proDataInvalidation?.updatedAtUtc))&&Date.parse(actualManifest.proDataInvalidation.updatedAtUtc)>=startedAt.getTime()&&Date.parse(actualManifest.proDataInvalidation.updatedAtUtc)<=finishedAt.getTime());
    expectedManifest.schemaVersion=1;expectedManifest.proDataInvalidation={...prior,schemaVersion:'pro-data-invalidation.v1',reason:'FREE_EDIT_REQUIRES_PRO_REFRESH',
      changedSceneIds:[...new Set([...(prior.changedSceneIds||[]),sceneId])].sort(),deletedSceneIds:prior.deletedSceneIds||[],sceneTombstones:prior.sceneTombstones||[],updatedAtUtc:actualManifest.proDataInvalidation.updatedAtUtc};
    retain('ordinary-rich-note-save-'+marker.split(' ')[0],{result,before,after,expectedDoc,expectedLiteral,expectedNotes,expectedManifest,wire,snapshots:h.snapshots,acks:h.acks,receipts:h.receipts,errors:h.errors});
    assert.equal(result.ok,true,JSON.stringify(result));assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].success,true);
    assert.equal(pending.readLedger(doc),null);equal(doc,expectedDoc,'whole rich canonical document predicted from BEFORE plus one explicit insertion');
    assert.equal(notes.sceneText(after[sceneId].toString()),expectedLiteral);equal(JSON.parse(after['notes.craftsman.json']),expectedNotes,'complete notes/private fields; only actual owner offset/hash changed');equal(actualManifest,expectedManifest,'complete manifest; only normal Main schema/invalidation changes');
    assert.deepEqual(after[commentsPath],before[commentsPath],'whole discussion state unchanged on different owner');
    assert.ok(h.acks.some(row=>row.ack?.kind==='SAVED'&&row.ack.commentEditIntentsSha256===sha(wire)));assert.equal(h.c.isDirty,false);assert.equal(h.renderer.localDirty,false);
    const mutable=new Set([sceneId,path.relative(f.root,tx.commitPathFor(file)),'project.craftsman.json','notes.craftsman.json']);
    for(const [relative,bytes] of Object.entries(before))if(!mutable.has(relative))assert.deepEqual(after[relative],bytes,'protected '+relative);
    equal(Object.keys(after).filter(relative=>!Object.hasOwn(before,relative)),[path.relative(f.root,tx.recoveryPacketPathFor(f.manifestPath,h.receipts[0].transactionId))]);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  }
});
test('novel authenticated atomic notes: governed six changed rich Saves reopen first middle last and reexport the complete book',async t=>{
  let f,request,prior,indices,untouchedEmpty,batches=[1,2];const requestPath=process.env.YALKEN_NOVEL_SIX_SAVE_REQUEST;
  if(!requestPath){
    const mixed=require('../../src/core/word-pending-comment-return-v1.cjs'),typography=require('../../src/core/word-review-typography-v1.cjs');
    const raw={type:'doc',attrs:{wordPendingRevisions:null,wordUserBookmarks:null,wordDefaultTabStop:720,
      wordSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage'}}},content:[{type:'paragraph',content:[]},
      {type:'codeBlock',attrs:{language:null},content:[{type:'text',text:'code Ж'}]}]},before=cloneJsonSafe(raw);
    const source={type:'doc',attrs:{wordDefaultTabStop:720,wordSections:cloneJsonSafe(raw.attrs.wordSections)},
      content:[{type:'paragraph'},{type:'codeBlock',content:[{type:'text',text:'code Ж'}]}]};
    const basis={schemaVersion:2,source,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]},profile=typography.freshBodyTypography();
    const checked=pending.asRoundLedger(raw);equal(checked.source,{...cloneJsonSafe(source),content:[{type:'paragraph',content:[]},cloneJsonSafe(source.content[1])]});
    const returnedSource=typography.document(source,profile);returnedSource.content[1].attrs={...returnedSource.content[1].attrs,language:null};
    const exportParagraphs=[{nodeType:'paragraph'},{nodeType:'codeBlock',codeLanguage:''}],binding=pending.buildCommentExportBinding({document:pending.bindLedger(basis),
      exportTypography:profile,exportParagraphs,schemaVersion:2}).binding;
    const input={document:raw,returnedDocument:pending.bindLedger({...basis,source:returnedSource}),binding,anchors:[],exportTypography:profile,
      exportParagraphs,allowUntrackedRichFormatting:true,cleanTransportSchemaVersion:2};
    const positive=mixed.deriveMixedPendingDocument(input);assert.equal(positive.changed,false);equal(pending.readLedger(positive.document).source,source);
    equal(raw,before,'raw empty paragraph, nullable code language and semantic root values are never rewritten');
    const failures=[];
    for(const [key,value,code] of [['unknown',null,'PENDING_RETURN_SOURCE_UNSUPPORTED'],['unknown',1,'PENDING_RETURN_SOURCE_UNSUPPORTED'],
      ['wordUserBookmarks',{},'PENDING_RETURN_SOURCE_UNSUPPORTED'],['wordUserBookmarks',undefined,'PENDING_RETURN_SOURCE_UNSUPPORTED'],
      ['wordPendingRevisions',{},'PENDING_REVISIONS_INVALID'],['wordDefaultTabStop',null,'PENDING_RETURN_SOURCE_UNSUPPORTED'],
      ['wordDefaultTabStop',undefined,'PENDING_RETURN_SOURCE_UNSUPPORTED'],['wordDefaultTabStop',0,'WORD_PARAGRAPH_LAYOUT_INVALID'],
      ['wordSections',null,'PENDING_RETURN_SOURCE_UNSUPPORTED'],['wordSections',undefined,'PENDING_RETURN_SOURCE_UNSUPPORTED'],['wordSections',{},'WORD_SECTIONS_INVALID']]){
      const document=cloneJsonSafe(raw);document.attrs[key]=value;
      for(const operation of ['admit','derive'])assert.throws(()=>operation==='admit'?pending.asRoundLedger(document):mixed.deriveMixedPendingDocument({...input,document}),error=>{
        failures.push({key,value,operation,code:error.code||error.message});return (error.code||error.message)===code;});
    }
    retain('six-rich-saves-neutral-root-controls',{before,source,checked,positive,failures});
  }
  if(requestPath) {
    const stat=fs.lstatSync(requestPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=4*1024*1024);
    assert.match(process.env.YALKEN_NOVEL_SIX_SAVE_REQUEST_SHA256||'',/^[a-f0-9]{64}$/u);
    const raw=fs.readFileSync(requestPath);assert.equal(sha(raw),process.env.YALKEN_NOVEL_SIX_SAVE_REQUEST_SHA256);request=JSON.parse(raw);
    const keys=['schemaVersion','projectRoot','receiptPath','expectedOperandPath','bindings','businessFiles','authorityFiles','batch','markers','exportRoundIdHex','priorBatchTerminalPath'];
    assert.ok(isPlainObjectValue(request)&&Object.keys(request).length===keys.length&&Object.keys(request).every(k=>keys.includes(k)));
    assert.equal(request.schemaVersion,'novel-six-rich-saves-proof.v1');assert.ok([1,2].includes(request.batch));
    assert.match(request.exportRoundIdHex,/^[a-f0-9]{32}$/u);
    assert.ok(Array.isArray(request.markers)&&request.markers.length===2&&request.markers.every(rows=>Array.isArray(rows)&&rows.length===3
      &&rows.every(text=>typeof text==='string'&&text.length>0&&text.length<=128&&text.isWellFormed()&&!/[\r\n\0]/u.test(text))));
    assert.equal(new Set(request.markers.flat()).size,6);
    for(const key of ['projectRoot','receiptPath','expectedOperandPath'])assert.ok(typeof request[key]==='string'&&path.isAbsolute(request[key])&&request[key].length<4096);
    assert.ok(request.batch===1?request.priorBatchTerminalPath===null:typeof request.priorBatchTerminalPath==='string'&&path.isAbsolute(request.priorBatchTerminalPath)&&request.priorBatchTerminalPath.length<4096);
    for(const key of ['bindings','businessFiles','authorityFiles']) {
      assert.ok(Array.isArray(request[key])&&request[key].length>0&&request[key].length<=5000);
      for(const row of request[key])assert.ok(isPlainObjectValue(row)&&Object.keys(row).length===3&&typeof row.path==='string'&&row.path.length<4096
        &&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=256*1024*1024&&/^[a-f0-9]{64}$/u.test(row.sha256));
    }
    const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;assert.ok(evidence&&path.isAbsolute(evidence));
    assert.ok(request.projectRoot.startsWith(path.resolve(evidence,'../..')+path.sep));assert.equal(fs.realpathSync(request.projectRoot),request.projectRoot);
    for(const row of request.bindings){assert.ok(path.isAbsolute(row.path)&&fs.realpathSync(row.path)===row.path);const st=fs.lstatSync(row.path);
      assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size===row.bytes);const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(row.path))hash.update(bytes);assert.equal(hash.digest('hex'),row.sha256);}
    for(const key of ['receiptPath','expectedOperandPath',...(request.batch===2?['priorBatchTerminalPath']:[])])assert.ok(request.bindings.some(row=>row.path===request[key]));
    equal(await noteAuthoringFilePins(request.projectRoot),[...request.businessFiles,...request.authorityFiles].sort((a,b)=>a.path.localeCompare(b.path)),'entire current sealed book before any Save');
    const receipt=JSON.parse(textFile(request.receiptPath));assert.equal(receipt.schemaVersion,'revision-bridge.docx-import-receipt.v3');assert.equal(receipt.createdScenes.length,42);
    assert.equal(request.receiptPath,path.join(request.projectRoot,'.yalken/docx-import/receipts',receipt.importOperationId+'.json'));
    assert.equal(new Set(receipt.createdScenes.map(row=>row.relativeFile)).size,42);
    for(const row of receipt.createdScenes)assert.ok(typeof row.relativeFile==='string'&&row.relativeFile.startsWith('roman/')&&row.relativeFile.endsWith('.txt')
      &&row.relativeFile.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0')));
    const fresh=v8.deserialize(fs.readFileSync(request.expectedOperandPath));assert.equal(fresh.applied?.ok,true);
    assert.equal(JSON.parse(fresh.after['notes.craftsman.json']).projectId,receipt.projectId);
    if(request.batch===2){prior=v8.deserialize(fs.readFileSync(request.priorBatchTerminalPath));assert.equal(prior.batch,1);assert.equal(prior.projectRoot,request.projectRoot);
      equal(prior.markers,request.markers);equal(prior.pins,[...request.businessFiles,...request.authorityFiles].sort((a,b)=>a.path.localeCompare(b.path)));}
    else for(const row of receipt.createdScenes)assert.ok(fs.readFileSync(path.join(request.projectRoot,row.relativeFile)).equals(fresh.after[row.relativeFile]),'fresh actual returned source '+row.relativeFile);
    f={...await realAuthority.withRealDocxImportAuthority({projectRoot:request.projectRoot,root:request.projectRoot,romanRoot:path.join(request.projectRoot,'roman'),
      manifestPath:path.join(request.projectRoot,'project.craftsman.json'),projectId:receipt.projectId,captureTreeCohortInventory:captureActualInventory}),scenes:receipt.createdScenes};indices=[0,21,41];batches=[request.batch];
  } else {
    f=await importedTiny(t,'six-rich-saves',{canonicalNotes:true,sourceOptions:{emptyParagraphIndex:9}});
    indices=[0,Math.floor(f.scenes.length/2),f.scenes.length-1];
    const emptyOwner=f.source.plan.candidateCreatePlan.entries.findIndex(entry=>entry.partition.leafFrom<=9&&entry.partition.leafTo>9);
    assert.ok(emptyOwner>=0&&!indices.includes(emptyOwner),'the empty paragraph belongs to an untouched chapter');
    const emptyEntry=f.source.plan.candidateCreatePlan.entries[emptyOwner],emptyFile=f.scenes[emptyOwner].relativeFile,emptyText=textFile(path.join(f.root,emptyFile));
    const emptyDocument=envelope.parseObservablePayload(emptyText).doc,emptyParagraph=pending.paragraphs(emptyDocument)[9-emptyEntry.partition.leafFrom];
    assert.equal(emptyParagraph.type,'paragraph');assert.equal(bookmarks.textOf(emptyParagraph),'');assert.ok(!emptyParagraph.content?.length);
    untouchedEmpty={relativeFile:emptyFile,text:emptyText,document:cloneJsonSafe(emptyDocument)};retain('six-rich-saves-untouched-empty-before',untouchedEmpty);
    const x=await exportImported(f);
    assert.equal((await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'six-save-source',true),{label:'six-save-source'})).applied?.ok,true);
    assert.equal(textFile(path.join(f.root,emptyFile)),emptyText,'initial return preserves the untouched empty chapter bytes');
    const document=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json')));
    const body=cloneJsonSafe(document.notes.find(n=>n.manuscript).manuscript.body);
    for(const [i,index] of indices.slice(1).entries())assert.equal((await governedNotesAuthoring(f,f.scenes[index],{action:'create',noteId:'six-save-'+crypto.randomUUID(),
      kind:i?'endnote':'footnote',offsetUtf16:0,body})).result.ok,true);
    request={markers:[[' first-one Ж','middle-one Ж ','last-one Ж '],[' first-two 🧭','middle-two 🧭 ','last-two 🧭 ']],exportRoundIdHex:crypto.randomBytes(16).toString('hex')};
  }
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  const sceneDocs=()=>Object.fromEntries(f.scenes.map(row=>[row.relativeFile,envelope.parseObservablePayload(textFile(path.join(f.root,row.relativeFile))).doc]));
  const initialDocs=prior?.initialDocs||sceneDocs(),predictedDocs=cloneJsonSafe(prior?.predictedDocs||initialDocs),initialPins=prior?.initialPins||await noteAuthoringFilePins(f.root),outcomes=[],sloFailures=[];
  const commentsRelative=path.relative(f.root,commentPath(f)),recording=require('../../src/core/word-pending-recording-v1.cjs');
  const stable=value=>JSON.stringify(value,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  for(const batch of batches)for(const [which,index] of indices.entries()) {
    const scene=f.scenes[index],relative=scene.relativeFile,file=path.join(f.root,relative),marker=request.markers[batch-1][which];
    const beforePins=await noteAuthoringFilePins(f.root),beforeText=textFile(file),beforeDoc=envelope.parseObservablePayload(beforeText).doc;
    const beforeNotes=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),beforeComments=JSON.parse(textFile(commentPath(f))),beforeManifest=JSON.parse(textFile(f.manifestPath));
    equal(beforeDoc,predictedDocs[relative],'reopen matches the independently predicted previous saved document');
    const beforeLiteral=notes.sceneText(beforeText),oldFirst=bookmarks.textOf(beforeDoc.content[0]);assert.ok((which===0?['paragraph']:['paragraph','heading']).includes(beforeDoc.content[0].type));
    const h=await actualRichRecordingSavePort(t,f,scene);assert.equal(h.content,beforeText,'fresh editor opens the current complete envelope');
    let metadata,expectedLedger,started;const position=which===0?h.editor.state.doc.child(0).content.size+1:1,at=which===0?oldFirst.length:0;
    const expectedLiteral=beforeLiteral.slice(0,at)+marker+beforeLiteral.slice(at),expectedNotes=cloneJsonSafe(beforeNotes);
    for(const note of expectedNotes.notes)if(!note.deleted&&note.manuscript?.reference.sceneId===relative){const ref=note.manuscript.reference;
      assert.equal(ref.sourceTextSha256,sha(beforeLiteral));assert.equal(notes.boundary(beforeLiteral,ref.offsetUtf16),true);
      if(ref.offsetUtf16>at||ref.offsetUtf16===at&&ref.affinity==='after')ref.offsetUtf16+=marker.length;ref.sourceTextSha256=sha(expectedLiteral);}
    let expectedDoc=cloneJsonSafe(which===0?pending.materialize(pending.readLedger(beforeDoc)):beforeDoc);const first=expectedDoc.content[0];
    if(which===0){assert.ok(first.content?.at(-1)?.type==='text');first.content.at(-1).text+=marker;}
    else if(first.content?.length){assert.equal(first.content[0].type,'text');first.content[0].text=marker+first.content[0].text;}
    else first.content=[{type:'text',text:marker}];
    expectedDoc=envelope.canonicalizeDocumentJson(h.editor.schema.nodeFromJSON(expectedDoc).toJSON());
    if(which===0){const ledger=pending.readLedger(beforeDoc);assert.ok(ledger&&ledger.revisions.length>=2);started=await h.record('start');assert.equal(started.ok,true,JSON.stringify(started));
      metadata=vm.runInContext('cloneJsonSafe(activePendingRecording.metadata)',h.c);expectedLedger=cloneJsonSafe(pending.readLedger(recording.prepare(beforeDoc).baseline));
      const sourceAt=bookmarks.textOf(expectedLedger.source.content[0]).length;
      assert.ok(expectedLedger.revisions.filter(row=>row.paragraphIndex===0).every(row=>row.to<=sourceAt),'append follows every complete union interval');
      const inserted={type:'text',text:marker},marks=pending.normalizeNode(expectedDoc.content[0].content.at(-1)).marks;if(marks?.length)inserted.marks=marks;
      expectedLedger.source.content[0].content.push(inserted);
      for(const point of expectedLedger.noteSourcePoints||[])if(point.paragraphIndex===0&&point.offsetUtf16>=sourceAt)point.offsetUtf16+=marker.length;
      const id=Math.max(...[expectedLedger,...expectedLedger.roundUndo,...expectedLedger.roundRedo].flatMap(frame=>frame.revisions.map(row=>Number(row.id.slice(9)))))+1;
      expectedLedger.revisions.push({id:'revision-'+id,nativeId:'yalken-'+id,operation:'insert',author:metadata.author,date:metadata.date,dateUtc:metadata.date,
        groupId:null,paragraphIndex:0,from:sourceAt,to:sourceAt+marker.length,state:'pending'});expectedLedger.revisions.sort((a,b)=>a.paragraphIndex-b.paragraphIndex||a.from-b.from);
      const frame=pending.roundFrame(pending.readLedger(recording.prepare(beforeDoc).baseline));frame.redo=[];expectedLedger.roundUndo.push(frame);
      expectedLedger.roundRedo=[];expectedLedger.undo=[];expectedLedger.redo=[];expectedLedger=pending.compactRoundHistory(expectedLedger);
      expectedDoc=envelope.canonicalizeDocumentJson(pending.bindLedger(expectedLedger));
    } else {assert.equal(pending.readLedger(beforeDoc),null);assert.equal(pending.noteProjection(beforeDoc),null);}
    h.insert(position,marker);const wire=h.renderer.getTiptapCommentEditIntentsJson(),intents=JSON.parse(wire);assert.equal(intents.schemaVersion,2);assert.equal(intents.edits.length,1);
    const expectedComments=cloneJsonSafe(beforeComments);
    if(which===0){const baseline=pending.lastRoundFrame(expectedLedger),identity={sessionId:'recording-round:'+sha(stable(baseline)),
      historyId:'round:'+sha(stable({baseline,source:expectedLedger.source,revisions:expectedLedger.revisions.map(({state,...row})=>row)}))};
      let owned=0;for(const thread of expectedComments.threads)if(thread.sceneId===relative){assert.notEqual(thread.status,'deleted');const before=anchors.structuralSnapshot(thread);
        assert.equal(thread.anchor.pendingUnionLocator,undefined,'this maintained source has independently bound ordinary anchors');
        if(thread.anchor.sceneParagraphIndex===0){assert.ok(!thread.anchor.kind&&thread.anchor.startUtf16+thread.anchor.selectedText.length<=at);
          thread.anchor.blockTextSha256=sha(oldFirst+marker);}
        const after=anchors.structuralSnapshot(thread);let history=thread.anchorEditHistory||[];
        const digest=s=>s.kind==='multi-paragraph-range'?s.coveredParagraphsSha256:s.blockTextSha256;
        if(!isDeepStrictEqual(before,after)){history=history.filter(row=>row.sessionId.startsWith('recording-round:')||!row.undone&&row.sessionId===h.sessionId);
          history.push({schemaVersion:2,historyId:intents.edits[0].historyId,sessionId:h.sessionId,before,after,beforeTextSha256:digest(before),afterTextSha256:digest(after),undone:false});}
        const entry={schemaVersion:2,...identity,before,after,beforeTextSha256:digest(before),afterTextSha256:digest(after),undone:false};
        const current=history.findIndex(row=>row.sessionId===h.sessionId);history.splice(current<0?history.length:current,0,entry);thread.anchorEditHistory=history;owned++;
      }
      assert.ok(owned>0);expectedComments.revision++;if(expectedComments.schemaVersion!=='yalken.rtk.word.non-text-return-state.v6')expectedComments.schemaVersion='yalken.rtk.word.non-text-return-state.v5';
    } else {
      const rows=bookmarks.paragraphs(beforeDoc).map(node=>({text:bookmarks.textOf(node)})),next=cloneJsonSafe(rows);next[0].text=marker+rows[0].text;
      for(const thread of expectedComments.threads.filter(thread=>thread.sceneId===relative)) {
        assert.notEqual(thread.status,'deleted');const a=thread.anchor,before=anchors.structuralSnapshot(thread);assert.equal(a.pendingUnionLocator,undefined);
        const start=a.startUtf16+(a.sceneParagraphIndex===0?marker.length:0),end=a.kind==='multi-paragraph-range'?a.endUtf16+(a.endSceneParagraphIndex===0&&a.endUtf16>0?marker.length:0):start+a.selectedText.length;
        const derived=require('../../src/core/word-comment-ranges-v1.cjs').deriveCommentAnchor({sceneId:relative,paragraphs:next,input:{paragraphIndex:a.sceneParagraphIndex,startUtf16:start,
          ...(a.kind==='multi-paragraph-range'?{kind:a.kind,endParagraphIndex:a.endSceneParagraphIndex,endUtf16:end}:a.kind==='point'?{kind:'point',affinity:'right',selectedText:''}:{selectedText:a.selectedText})}});
        thread.anchor={...Object.fromEntries(Object.entries(a).filter(([k])=>['authoritySource','sourceChangeId'].includes(k))),...derived};const after=anchors.structuralSnapshot(thread);
        if(!isDeepStrictEqual(before,after)){const digest=s=>s.kind==='multi-paragraph-range'?s.coveredParagraphsSha256:s.blockTextSha256;
          thread.anchorEditHistory=(thread.anchorEditHistory||[]).filter(row=>row.sessionId.startsWith('recording-round:')||!row.undone&&row.sessionId===h.sessionId);
          thread.anchorEditHistory.push({schemaVersion:2,historyId:intents.edits[0].historyId,sessionId:h.sessionId,before,after,beforeTextSha256:digest(before),afterTextSha256:digest(after),undone:false});}
      }
      if(JSON.stringify(expectedComments)!==JSON.stringify(beforeComments)){expectedComments.revision++;if(expectedComments.schemaVersion!=='yalken.rtk.word.non-text-return-state.v6')expectedComments.schemaVersion='yalken.rtk.word.non-text-return-state.v5';}
    }
    const start=performance.now(),startedAt=new Date(),result=await h.dispatch('cmd.project.save',{}),seconds=(performance.now()-start)/1000,finishedAt=new Date();
    const afterPins=await noteAuthoringFilePins(f.root),afterText=textFile(file),actualDoc=envelope.parseObservablePayload(afterText).doc;
    const actualManifest=JSON.parse(textFile(f.manifestPath)),expectedManifest=cloneJsonSafe(beforeManifest),invalidation=expectedManifest.proDataInvalidation||{};
    assert.ok(Number.isFinite(Date.parse(actualManifest.proDataInvalidation?.updatedAtUtc))&&Date.parse(actualManifest.proDataInvalidation.updatedAtUtc)>=startedAt.getTime()&&Date.parse(actualManifest.proDataInvalidation.updatedAtUtc)<=finishedAt.getTime());
    expectedManifest.schemaVersion=1;expectedManifest.proDataInvalidation={...invalidation,schemaVersion:'pro-data-invalidation.v1',reason:'FREE_EDIT_REQUIRES_PRO_REFRESH',
      changedSceneIds:[...new Set([...(invalidation.changedSceneIds||[]),relative])].sort(),deletedSceneIds:invalidation.deletedSceneIds||[],sceneTombstones:invalidation.sceneTombstones||[],updatedAtUtc:actualManifest.proDataInvalidation.updatedAtUtc};
    const outcome={batch,index,marker,position,metadata,started,result,seconds,beforePins,afterPins,beforeText,beforeNotes,beforeComments,beforeManifest,
      expectedDoc,expectedLiteral,expectedNotes,expectedComments,expectedManifest,wire,snapshots:h.snapshots,acks:h.acks,receipts:h.receipts,errors:h.errors};
    outcomes.push(outcome);retain('six-rich-save-'+batch+'-'+which,outcome);console.log(JSON.stringify({phase:'six-rich-save',batch,index,seconds,result,receipts:h.receipts.length}));
    const changed=afterPins.filter(row=>!row.path.startsWith('.test-authority/')&&!beforePins.some(old=>old.path===row.path&&old.sha256===row.sha256));
    retainDirectory('six-rich-save-changed-'+batch+'-'+which,Object.fromEntries(changed.map(row=>[row.path,fs.readFileSync(path.join(f.root,row.path))])));
    assert.equal(result.ok,true,JSON.stringify(result));assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].success,true);
    equal(actualDoc,expectedDoc,'entire rich canonical scene predicted BEFORE the actual PM Save');predictedDocs[relative]=cloneJsonSafe(expectedDoc);assert.equal(notes.sceneText(afterText),expectedLiteral);
    equal(JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),expectedNotes,'all complete notes/private fields plus independently predicted owner references');
    equal(JSON.parse(textFile(commentPath(f))),expectedComments,'full discussion graph and only the independently bound recording rows');equal(actualManifest,expectedManifest);
    if(which===0){equal(pending.readLedger(actualDoc),expectedLedger);equal(pending.materialize(pending.readLedger(actualDoc),'original'),pending.materialize(pending.readLedger(beforeDoc),'original'),'complete rich Original preserved');
      assert.equal((await h.record('stop')).ok,true);}else assert.equal(pending.readLedger(actualDoc),null);
    assert.ok(h.acks.some(row=>row.ack?.kind==='SAVED'&&row.ack.commentEditIntentsSha256===sha(wire)));assert.equal(h.c.isDirty,false);assert.equal(h.renderer.localDirty,false);
    const mutable=new Set([relative,path.relative(f.root,tx.commitPathFor(file)),'project.craftsman.json','notes.craftsman.json',commentsRelative]);
    for(const old of beforePins.filter(row=>!row.path.startsWith('.test-authority/')&&!mutable.has(row.path)))equal(afterPins.find(row=>row.path===old.path),old,'complete protected byte '+old.path);
    equal(afterPins.filter(row=>!row.path.startsWith('.test-authority/')&&!beforePins.some(old=>old.path===row.path)).map(row=>row.path),[path.relative(f.root,tx.recoveryPacketPathFor(f.manifestPath,h.receipts[0].transactionId))]);
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);if(seconds>120)sloFailures.push({batch,index,seconds});h.editor.destroy();
  }
  if(batches.includes(2)) {
    const verified=await tx.readVerifiedProjectDocxNovelCohort({manifestPath:f.manifestPath,projectId:f.projectId,scenePaths:f.scenes.map(scene=>path.join(f.root,scene.relativeFile)),
      verifyManifestContinuation:args=>f.transactionAuthority.verifyManifestContinuation({...args,projectId:f.projectId})});assert.equal(verified.records.length,f.scenes.length);
    const current=sceneDocs(),selected=new Set(indices.map(index=>f.scenes[index].relativeFile)),finalPins=await noteAuthoringFilePins(f.root);equal(current,predictedDocs,'all complete Current/Original carrier documents equal the explicit six-save prediction');
    for(const row of f.scenes)if(!selected.has(row.relativeFile)){equal(current[row.relativeFile],initialDocs[row.relativeFile]);equal(finalPins.find(pin=>pin.path===row.relativeFile),initialPins.find(pin=>pin.path===row.relativeFile),'uninvolved whole scene bytes');}
    if(untouchedEmpty)assert.equal(textFile(path.join(f.root,untouchedEmpty.relativeFile)),untouchedEmpty.text,'six Saves preserve the complete untouched empty chapter bytes');
    const beforeExport=await noteAuthoringFilePins(f.root),x=await exportImported(f,f.scenes,{roundIdHex:request.exportRoundIdHex}),typography=require('../../src/core/word-review-typography-v1.cjs');
    const noteDocument=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))),noteDelta=require('../../src/core/word-note-return-delta-v1.cjs'),compareComments=require('../../src/export/docx/docxReviewPacketComments').compareCommentExportReadback;
    retain('six-rich-saves-full-reexport',{input:x.input,source:x.source,bytes:x.bytes,phases:x.phases,current,initialDocs,noteDocument,completeCommentState:x.completeCommentState});
    const literal=x.source.blocks.map(block=>block.text),exportMap=x.source.localAuthorityCapsule.exportMap;
    for(const phase of x.phases){assert.equal(phase.analysis.ok,true,'actual full reexport '+phase.phase+' '+phase.analysis.code);const ir=phase.analysis.reviewIr;
      equal(ir.formattingParagraphs.map(p=>p.paragraphText),literal);assert.equal(ir.formattingParagraphs.length,x.source.blocks.length);
      x.source.blocks.forEach((block,i)=>assert.equal(typography.readback(block.formatIr,ir.formattingParagraphs[i],x.source.exportTypography),true,'full effective format '+phase.phase+'/'+i));
      assert.equal(compareComments(x.source.commentExport,ir.commentThreads).ok,true);
      const returnedNotes=x.bridge.parseDocumentNotesRichReturn(phase.bytes,ir.documentNotes,{includeBreakProjection:true});
      const sectionsReturn=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource').validateFullManuscriptDocumentSectionsReturn({expected:x.source.documentSections,returned:ir.documentSections,signedDigest:x.source.documentSections.protectedDigest});assert.equal(sectionsReturn.ok,true);
      const parseInput={bytes:phase.bytes,budgets:fullManuscriptProductBudgets(),exportMap,
        baselineDocuments:f.scenes.map(scene=>({sceneId:scene.relativeFile,document:predictedDocs[scene.relativeFile]})),baselineDocumentNotes:x.source.documentNotes,
        documentSections:x.source.documentSections,signedSectionsDigest:x.source.documentSections.protectedDigest,cryptoPort:actualCryptoPort(),retainPendingScenes:true};
      const parsed=x.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes(parseInput);
      assert.equal(parsed.ok,true,'actual returned pending documents '+phase.phase+' '+parsed.code);assert.equal(parsed.scenes.length,f.scenes.length);
      if(!requestPath&&phase.phase==='provisional'){
        const cleanId=f.scenes.find(scene=>!pending.readLedger(predictedDocs[scene.relativeFile])).relativeFile,failures=[];
        for(const [key,value,code] of [['unknown',null,'PENDING_REVISIONS_INVALID'],['wordUserBookmarks',{},'USER_BOOKMARK_SHAPE_INVALID'],
          ['wordPendingRevisions',{},'PENDING_REVISIONS_INVALID'],['wordDefaultTabStop',null,'PENDING_REVISIONS_INVALID'],
          ['wordDefaultTabStop',0,'WORD_PARAGRAPH_LAYOUT_INVALID'],['wordSections',null,'PENDING_REVISIONS_INVALID'],['wordSections',{},'WORD_SECTIONS_INVALID']]){
          const baselineDocuments=cloneJsonSafe(parseInput.baselineDocuments);baselineDocuments.find(row=>row.sceneId===cleanId).document.attrs[key]=value;
          const result=x.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({...parseInput,baselineDocuments});failures.push({key,value,baselineDocuments,result});
          assert.equal(result.ok,false);assert.equal(result.code,code);
        }
        retain('six-rich-saves-raw-reader-controls',{cleanId,baselineDocuments:parseInput.baselineDocuments,failures});
      }
      const noteBindings=noteDelta.bindUnchangedBookPendingNotes({document:noteDocument,projectId:f.projectId,baseline:x.source.documentNotes,exportMap,
        scenes:parsed.scenes.map(scene=>({...scene,document:predictedDocs[scene.sceneId]})),returnedNotes,returnedReferences:ir.documentNotes.references,
        unionReferences:parsed.contentPreview.pendingNoteReferences});const readback=[];
      for(const scene of parsed.scenes){const document=predictedDocs[scene.sceneId],map=exportMap.scenes.find(row=>row.sceneId===scene.sceneId),blocks=x.source.blocks.filter(block=>block.sceneId===scene.sceneId);
        const owned=(x.source.commentExport.threads||[]).filter(thread=>thread.sceneId===scene.sceneId).map(thread=>{const a=thread.anchor;
          return {threadId:thread.threadId,anchor:{...require('../../src/core/word-comment-ranges-v1.cjs').deriveCommentAnchor({sceneId:scene.sceneId,paragraphs:blocks.map(block=>({text:block.text})),input:{
            paragraphIndex:blocks.findIndex(block=>block.blockId===a.blockId),startUtf16:a.startUtf16,selectedText:a.selectedText,
            ...(a.kind==='multi-paragraph-range'?{kind:a.kind,endParagraphIndex:blocks.findIndex(block=>block.blockId===a.endBlockId),endUtf16:a.endUtf16}:a.kind==='point'?{kind:'point',affinity:'right'}:{})}}),...(a.pendingUnionLocator?{pendingUnionLocator:a.pendingUnionLocator}:{})}};});
        const before=pending.readLedger(document),expectedLedger=before||pending.asRoundLedger(document);
        const deriveInput={document,returnedDocument:scene.returnedDocument,binding:map.pendingCommentBinding,
          anchors:owned,exportTypography:x.source.exportTypography,exportParagraphs:blocks.map(block=>block.formatIr.paragraph),cleanTransportSchemaVersion:2,allowUntrackedRichFormatting:true,
          noteBinding:noteBindings.find(row=>row.sceneId===scene.sceneId)},mixed=require('../../src/core/word-pending-comment-return-v1.cjs'),derived=mixed.deriveMixedPendingDocument(deriveInput);
        assert.equal(derived.changed,false,'actual DOCX carries no changed rich/pending meaning '+scene.sceneId);const ledger=pending.readLedger(derived.document);
        for(const mode of ['current','original'])equal(ledger?pending.materialize(ledger,mode):derived.document,pending.materialize(expectedLedger,mode),'complete returned '+mode+' '+scene.sceneId);
        if(before){equal(ledger,before,'complete canonical source partitions, revisions, points and history after authenticated DOCX reconstruction');
          if(!requestPath&&phase.phase==='provisional'){
            const failures=[];
            for(const [name,mutate] of [['text',l=>{l.source.content[0].content[0].text='X'+l.source.content[0].content[0].text.slice(1);}],
              ['marks',l=>{l.source.content[0].content[0].marks.push({type:'bold'});}],
              ['language',l=>{l.source.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.wordLanguage={val:'fr-FR',eastAsia:'fr-FR',bidi:'fr-FR'};}],
              ['paragraph',l=>{l.source.content[0].attrs={...l.source.content[0].attrs,wordParagraphSpacing:{before:0,after:0,line:241,lineRule:'auto'}};}],
              ['root',l=>{l.source.attrs={...l.source.attrs,wordDefaultTabStop:721};}],['provenance',l=>{l.revisions[0].author+=' foreign';}]]){
              const changed=cloneJsonSafe(before);mutate(changed);const forgedDocument=pending.bindLedger(changed);
              assert.throws(()=>mixed.deriveMixedPendingDocument({...deriveInput,document:forgedDocument}),error=>{
                failures.push({name,document:forgedDocument,code:error.code});return error.code==='PENDING_COMMENT_BINDING_CHANGED';});
            }
            retain('six-rich-saves-signed-history-controls',{document,returnedDocument:scene.returnedDocument,before,derived,failures});
          }
        }
        readback.push({sceneId:scene.sceneId,returnedDocument:scene.returnedDocument,derived});
      }
      retain('six-rich-saves-reexport-readback-'+phase.phase,{returnedNotes,noteBindings,sectionsReturn,readback,predictedDocs});
    }
    equal(await noteAuthoringFilePins(f.root),beforeExport,'complete export has no canonical filesystem effect');
  }
  const terminal={batch:batches.at(-1),projectRoot:f.root,markers:request.markers,initialDocs,predictedDocs,initialPins,pins:await noteAuthoringFilePins(f.root),outcomes,sloFailures};
  retain('six-rich-saves-terminal-batch-'+terminal.batch,terminal);assert.equal(sloFailures.length,0,'actual public Save120s SLO remains mandatory');
});
test('novel authenticated atomic notes: rich public recording Save stale snapshot preserves dirty buffer',async t=>{
  const f=await importedTiny(t,'rich-recording-stale',{canonicalNotes:true}),x=await exportImported(f);
  assert.equal((await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'before-stale-recording',true),{label:'before-stale-recording'})).applied?.ok,true);const before=productFiles(f);
  let race=false;const h=await actualRichRecordingSavePort(t,f,f.scenes[0],{beforeSnapshotReply:({h})=>{if(race)h.lifecycle='changed';}});
  assert.equal((await h.record('start')).ok,true);h.insert(h.editor.state.doc.child(0).content.size+1,' staged');const buffer=h.content;race=true;
  const result=await h.dispatch('cmd.project.save',{});retain('rich-public-recording-stale',{result,errors:h.errors,before,after:productFiles(f),buffer,current:h.content});
  assert.equal(result.ok,false);equal(productFiles(f),before);assert.equal(h.content,buffer);assert.equal(h.c.isDirty,true);assert.equal(h.receipts.length,0);
});
test('novel authenticated atomic notes: rich public recording Save newer generation ACK retains new work',async t=>{
  const f=await importedTiny(t,'rich-recording-ack',{canonicalNotes:true}),x=await exportImported(f);
  assert.equal((await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'before-ack-recording',true),{label:'before-ack-recording'})).applied?.ok,true);let race=false;
  const h=await actualRichRecordingSavePort(t,f,f.scenes[0],{afterCommit:({h})=>{if(race)h.insert(h.editor.state.doc.child(0).content.size+1,' newer');}});
  assert.equal((await h.record('start')).ok,true);h.insert(h.editor.state.doc.child(0).content.size+1,' captured');race=true;
  const result=await h.dispatch('cmd.project.save',{});retain('rich-public-recording-ack',{result,errors:h.errors,acks:h.acks,receipts:h.receipts,buffer:h.content,raw:textFile(h.file)});
  assert.equal(result.ok,false);assert.equal(h.receipts.length,1);assert.equal(h.receipts[0].success,true);
  assert.ok(envelope.parseObservablePayload(h.content).text.includes(' captured newer'));assert.ok(envelope.parseObservablePayload(textFile(h.file)).text.includes(' captured'));
  assert.equal(h.c.isDirty,true);assert.equal(h.renderer.localDirty,true);assert.ok(!h.acks.some(row=>row.ack?.kind==='SAVED'));
});
test('novel authenticated atomic notes: governed public history continuation reopens the actual saved book',async t=>{
  let f,request,expected,actions=['undo','redo'];
  const requestPath=process.env.YALKEN_NOVEL_HISTORY_CONTINUATION_REQUEST;
  if(requestPath) {
    const stat=fs.lstatSync(requestPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=4*1024*1024);
    const raw=fs.readFileSync(requestPath);assert.match(process.env.YALKEN_NOVEL_HISTORY_CONTINUATION_REQUEST_SHA256||'',/^[a-f0-9]{64}$/);
    assert.equal(sha(raw),process.env.YALKEN_NOVEL_HISTORY_CONTINUATION_REQUEST_SHA256);request=JSON.parse(raw);
    const keys=['schemaVersion','projectRoot','receiptPath','expectedOperandPath','bindings','businessFiles','authorityFiles','action','applyTransactionId','currentTransactionId'];
    assert.ok(isPlainObjectValue(request)&&Object.keys(request).length===keys.length&&Object.keys(request).every(k=>keys.includes(k)));
    assert.equal(request.schemaVersion,'novel-public-history-continuation-proof.v1');assert.ok(['undo','redo'].includes(request.action));
    for(const k of ['applyTransactionId','currentTransactionId'])assert.match(request[k],/^[a-f0-9]{64}$/);
    for(const k of ['projectRoot','receiptPath','expectedOperandPath'])assert.ok(typeof request[k]==='string'&&path.isAbsolute(request[k])&&request[k].length<4096);
    for(const k of ['bindings','businessFiles','authorityFiles']) {
      assert.ok(Array.isArray(request[k])&&request[k].length>0&&request[k].length<=5000);
      for(const row of request[k])assert.ok(isPlainObjectValue(row)&&Object.keys(row).length===3&&typeof row.path==='string'&&row.path.length<4096
        &&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=256*1024*1024&&/^[a-f0-9]{64}$/.test(row.sha256));
    }
    const evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;assert.ok(evidence&&path.isAbsolute(evidence));
    assert.ok(request.projectRoot.startsWith(path.resolve(evidence,'../..')+path.sep));assert.equal(fs.realpathSync(request.projectRoot),request.projectRoot);
    for(const row of request.bindings){assert.ok(path.isAbsolute(row.path)&&fs.realpathSync(row.path)===row.path);const stat=fs.lstatSync(row.path);
      assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size===row.bytes);assert.equal(sha(fs.readFileSync(row.path)),row.sha256);}
    for(const k of ['receiptPath','expectedOperandPath'])assert.ok(request.bindings.some(row=>row.path===request[k]));
    equal(await noteAuthoringFilePins(request.projectRoot),[...request.businessFiles,...request.authorityFiles].sort((a,b)=>a.path.localeCompare(b.path)),'exact whole current durable checkpoint');
    const receipt=JSON.parse(textFile(request.receiptPath));assert.equal(receipt.schemaVersion,'revision-bridge.docx-import-receipt.v3');assert.equal(receipt.createdScenes.length,42);
    assert.equal(request.receiptPath,path.join(request.projectRoot,'.yalken/docx-import/receipts',receipt.importOperationId+'.json'));
    assert.equal(new Set(receipt.createdScenes.map(row=>row.relativeFile)).size,42);
    for(const row of receipt.createdScenes)assert.ok(typeof row.relativeFile==='string'&&row.relativeFile.startsWith('roman/')&&row.relativeFile.endsWith('.txt')
      &&row.relativeFile.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0')));
    expected=v8.deserialize(fs.readFileSync(request.expectedOperandPath));assert.equal(expected.applied?.ok,true);
    const treeRelative=path.relative(request.projectRoot,tx.treeCommitPathFor(path.join(request.projectRoot,'project.craftsman.json')));
    assert.equal(JSON.parse(expected.after[treeRelative]).transactionId,request.applyTransactionId,'immutable expected is the actual fresh Apply frame');
    assert.equal(JSON.parse(textFile(path.join(request.projectRoot,treeRelative))).transactionId,request.currentTransactionId);
    if(request.action==='undo')assert.equal(request.currentTransactionId,request.applyTransactionId);
    for(const side of ['before','after'])assert.equal(JSON.parse(expected[side]['notes.craftsman.json']).projectId,receipt.projectId);
    f={...await realAuthority.withRealDocxImportAuthority({projectRoot:request.projectRoot,root:request.projectRoot,romanRoot:path.join(request.projectRoot,'roman'),
      manifestPath:path.join(request.projectRoot,'project.craftsman.json'),projectId:receipt.projectId,captureTreeCohortInventory:captureActualInventory}),scenes:receipt.createdScenes};
    actions=[request.action];
  } else {
    f=await importedTiny(t,'history-reopened-book',{canonicalNotes:true});const x=await exportImported(f);
    expected=await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'history-reopened',true),{label:'history-reopened'});
    assert.equal(expected.applied?.ok,true,JSON.stringify(expected.error||expected.result));
  }
  const guarded=f.scenes.map(scene=>scene.relativeFile).concat(['notes.craftsman.json',path.relative(f.root,commentPath(f))]);
  const sloFailures=[];
  for(const action of actions) {
    for(const relative of guarded)assert.ok(Buffer.isBuffer(expected.before[relative])&&Buffer.isBuffer(expected.after[relative]));
    const source=action==='undo'?expected.after:expected.before,target=action==='undo'?expected.before:expected.after;
    for(const relative of guarded)assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(source[relative]),'complete history source byte binding '+relative);
    const before=await noteAuthoringFilePins(f.root),reopened={...f,...await realAuthority.withRealDocxImportAuthority({...f,transactionAuthority:undefined})};
    const port=await authenticatedBookNoteReturn(t,reopened,null,null,{historyOnly:true});
    const projectionStart=performance.now(),projection=await port.sandbox.readPendingRevisionProjection(),projectionSeconds=(performance.now()-projectionStart)/1000;
    assert.equal(projection.available,true,JSON.stringify(projection));assert.equal(projection.hasHistory,true);
    assert.equal(projection[action==='undo'?'canUndo':'canRedo'],true);
    const payload={action,projectId:projection.projectId,sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256};
    const started=performance.now(),result=await port.kernel.dispatch('cmd.project.review.decidePendingRevision',payload),seconds=(performance.now()-started)/1000;
    const pins=await noteAuthoringFilePins(f.root),outcome={request,projectRoot:f.root,action,projection,payload,result,projectionSeconds,seconds,before,pins,
      transactions:port.requests.length,publications:port.publications.length,sourceFiles:guarded.map(relative=>({path:relative,sha256:sha(source[relative])})),
      targetFiles:guarded.map(relative=>({path:relative,sha256:sha(target[relative])}))};
    retain('public-history-continuation-'+action,outcome);console.log(JSON.stringify({phase:'public-history-continuation',action,projectionSeconds,seconds,result,transactions:port.requests.length,publications:port.publications.length}));
    const changed=pins.filter(row=>!row.path.startsWith('.test-authority/')&&!before.some(old=>old.path===row.path&&old.sha256===row.sha256));
    retainDirectory('public-history-changed-physical-'+action,Object.fromEntries(changed.map(row=>[row.path,fs.readFileSync(path.join(f.root,row.path))])));
    assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.changed,true);assert.equal(port.requests.length,1);assert.equal(port.publications.length,1);
    for(const relative of guarded)assert.ok(fs.readFileSync(path.join(f.root,relative)).equals(target[relative]),'complete synchronized rich body/notes/comments '+action+' '+relative);
    const allowed=new Set(port.requests[0].treeCohort.entries.map(row=>row.relativePath));
    for(const scene of f.scenes)allowed.add(path.relative(f.root,tx.commitPathFor(path.join(f.root,scene.relativeFile))));
    allowed.add(path.relative(f.root,f.manifestPath));allowed.add(path.relative(f.root,tx.treeCommitPathFor(f.manifestPath)));
    for(const row of before.filter(row=>!row.path.startsWith('.test-authority/')&&!allowed.has(row.path)))equal(pins.find(after=>after.path===row.path),row,'every protected business byte after '+action);
    const receipt=JSON.parse(textFile(tx.treeCommitPathFor(f.manifestPath)));assert.equal(receipt.transactionId,result.receipt.transactionId);
    const added=pins.filter(row=>!row.path.startsWith('.test-authority/')&&!before.some(old=>old.path===row.path));
    equal(added.map(row=>row.path),[path.relative(f.root,tx.recoveryPacketPathFor(f.manifestPath,receipt.transactionId))],'one actual Core history recovery packet');
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
    for(const row of request?.bindings||[]){const stat=fs.lstatSync(row.path);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size===row.bytes);assert.equal(sha(fs.readFileSync(row.path)),row.sha256);}
    if(projectionSeconds>120||seconds>120)sloFailures.push({action,projectionSeconds,seconds});
  }
  retain('public-history-continuation-terminal',{request,projectRoot:f.root,pins:await noteAuthoringFilePins(f.root),sloFailures});
  assert.equal(sloFailures.length,0,'actual public history120s SLO remains mandatory');
});
test('novel authenticated atomic notes: causal history project-root switch refuses late publication',async t=>{
  const f=await importedTiny(t,'causal-history-project-root',{canonicalNotes:true}),x=await exportImported(f);
  const value=await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'causal-root'),{label:'causal-root'});
  assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));
  const projection=await value.sandbox.readPendingRevisionProjection(),beforePublications=value.publications.length;
  const held={file:value.sandbox.currentFilePath,subject:value.sandbox.currentLifecycleSubjectId(),session:value.sandbox.commentAuthoringSessionId,
    owner:value.sandbox.activeStage10ApplicationBootstrap,generation:value.sandbox.lastSignaledEditGeneration};
  let currentRoot=f.root,awaitReached=false;
  value.sandbox.getProjectRootPath=()=>currentRoot;
  value.sandbox.attachProjectIdToEditorPayload=async payload=>{await Promise.resolve();awaitReached=true;currentRoot=path.join(f.root,'foreign-current-project');return payload;};
  const result=await value.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'undo',projectId:projection.projectId,sceneId:projection.sceneId,
    subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
  retain('causal-history-project-root',{projection,result,awaitReached,currentRoot,oldRoot:f.root,beforePublications,publications:value.publications,
    before:value.before,after:productFiles(f)});
  assert.equal(awaitReached,true);
  equal({file:value.sandbox.currentFilePath,subject:value.sandbox.currentLifecycleSubjectId(),session:value.sandbox.commentAuthoringSessionId,
    generation:value.sandbox.lastSignaledEditGeneration},{file:held.file,subject:held.subject,session:held.session,generation:held.generation});
  assert.equal(value.sandbox.activeStage10ApplicationBootstrap,held.owner);
  assert.equal(value.publications.length,beforePublications,'a changed current project root cannot receive the old project history publication');
  assert.equal(result.ok,false);assert.equal(result.error?.code||result.code,'WORD_BOOK_HISTORY_CONTEXT_STALE');
});
test('novel authenticated atomic notes: causal generic import retains marked LINE note breaks',async t=>{
  const f=await projectFixture(t,'causal-generic-marked-line'),bytes=richNovelBytes(20,{inflate:10000});
  const sourceRoot=fs.mkdtempSync(path.join(os.tmpdir(),'causal-marked-line-source-'));t.after(()=>fs.rmSync(sourceRoot,{recursive:true,force:true}));
  const sourcePath=path.join(sourceRoot,'marked-line.docx');fs.writeFileSync(sourcePath,bytes);
  const port=await mainProjectPort(f,{localPath:sourcePath}),sandbox=port.sandbox;
  Object.assign(sandbox,{...require('../../src/core/entitlement-law-v1.cjs'),...require('../../src/core/writer-local-profile-v1.cjs'),app:{isPackaged:true},process:{platform:'darwin'},
    getProductCommandRecord:require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    resolveMenuCommandId:require('../../src/menu/command-namespace-canon.js').resolveMenuCommandId,COMMAND_BUS_ROUTE:'command.bus',
    MENU_LOCAL_CUSTOMIZATION_COMMAND_IDS:new Set(['cmd.project.view.resetMenuCustomization','cmd.project.view.toggleMenuSectionVisibility','cmd.project.view.moveMenuSectionEarlier','cmd.project.view.moveMenuSectionLater'])});
  vm.runInContext(['getWriterLocalRuntimeProfile','isMenuLocalCustomizationCommandId','dispatchMenuCommand'].map(n=>namedFunction(readSource(MAIN_PATH),n)).join('\n'),sandbox);
  sandbox.MENU_COMMAND_HANDLERS={'cmd.project.docx.previewLocalFile':port.handleDocxImportLocalFilePreviewCommandSurface,
    'cmd.project.docx.previewImportPlan':port.handleDocxImportPreviewCommandSurface,'cmd.project.docx.importSafeCreate':port.handleDocxImportSafeCreateCommandSurface};
  const local=await sandbox.dispatchMenuCommand('cmd.project.docx.previewLocalFile',{requestId:'causal-marked-local'},{route:'command.bus'});
  assert.equal(local.contentPreviewOk,true,JSON.stringify(local.error||local));
  const preview=await sandbox.dispatchMenuCommand('cmd.project.docx.previewImportPlan',{requestId:'causal-marked-plan',docxContentPreviewRef:local.docxContentPreviewRef},{route:'command.bus'});
  assert.equal(preview.importPreviewOk,true,JSON.stringify(preview));
  const accepted=await sandbox.dispatchMenuCommand('cmd.project.docx.importSafeCreate',{requestId:'causal-marked-create',docxImportPreviewRef:preview.docxImportPreviewRef},{route:'command.bus'});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const actual=JSON.parse(textFile(path.join(f.root,'notes.craftsman.json'))).notes.filter(note=>note.manuscript&&!note.deleted);
  const marks=[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}}];
  const expected={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:' Note Ж🧭 ',marks},{type:'hardBreak',marks},
    {type:'text',text:'second line',marks}]},{type:'paragraph',content:[]}]};
  const extracted=port.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes);assert.equal(extracted.ok,true);
  for(const part of ['word/footnotes.xml','word/endnotes.xml'])assert.match(extracted.parts[part],/<w:rPr><w:b\/><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"\/><w:sz w:val="28"\/><w:szCs w:val="28"\/><w:lang w:val="ru-RU" w:eastAsia="ja-JP" w:bidi="he-IL"\/><\/w:rPr><w:t xml:space="preserve"> Note Ж🧭 <\/w:t><w:br\/>/);
  const analysis=port.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:actualCryptoPort()});assert.equal(analysis.ok,true);
  for(const invalid of [null,1,'true'])assert.throws(()=>port.bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{preserveBreakMarks:invalid}),/NOTE_BREAK_PROJECTION_INVALID/u);
  const legacy=port.bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes),legacyExpected=cloneJsonSafe(expected);
  delete legacyExpected.content[0].content[1].marks;
  for(const note of legacy)equal(note.body,legacyExpected,'default public API retains its complete legacy body law');
  retain('causal-generic-import-marked-line',{bytes,local,preview,accepted,actual,expected,legacy,files:productFiles(f)});
  assert.equal(actual.length,2);
  for(const note of actual)equal(note.manuscript.body,expected,'the complete independently specified raw marked LINE body survives normal public Main import');
});
test('novel authenticated atomic notes: private guards preserve unchanged, Cancel, replay, stale authority and journal recovery',async t=>{
  for(const mode of ['unchanged','annotation-only','cancel','replay','authority','scene','before-marker','after-marker','history-before-marker','history-after-marker','joint']) {
    const f=await importedTiny(t,'atomic-guard-'+mode,{canonicalNotes:true}),x=await exportImported(f);
    const before=productFiles(f);let bytes=mode==='unchanged'?x.bytes:changedNotesZip(x,'guard-'+mode,mode==='joint');
    if(mode==='annotation-only') {
      const extracted=x.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(x.bytes),parts={...extracted.parts};
      parts['word/comments.xml']=parts['word/comments.xml'].replace(/(<w:t(?:\s[^>]*)?>)([^<]+)(<\/w:t>)/,(_m,a,text,b)=>a+text+' annotation-only'+b);
      bytes=buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data})));
    }
    let fault=false;
    const options={label:'guard-'+mode,cancel:mode==='cancel',
      afterPrepared:async({round})=>{
        if(mode==='authority')fs.appendFileSync(round.storePath,' ');
        if(mode==='scene')fs.appendFileSync(path.join(f.root,f.scenes.at(-1).relativeFile),' foreign');
      },commit:async args=>{
        if(mode==='before-marker')return tx.commitProjectTransaction({...args,afterTreeFilesPublish:async()=>{fault=true;throw Object.assign(Error('TINY_BEFORE_MARKER'),{code:'TINY_BEFORE_MARKER'});}});
        if(mode==='after-marker')return tx.commitProjectTransaction({...args,fsAdapter:{...fsp,unlink:async target=>{
          if(!fault&&target===tx.journalPathFor(f.manifestPath)){fault=true;throw Object.assign(Error('TINY_AFTER_MARKER'),{code:'TINY_AFTER_MARKER'});}return fsp.unlink(target);}}});
        return tx.commitProjectTransaction(args);
      }};
    const value=await authenticatedBookNoteReturn(t,f,x,bytes,options);
    if(['unchanged','annotation-only','cancel','authority','scene','before-marker'].includes(mode)) {
      assert.equal(value.publications.length,0);assert.equal(value.applied,undefined);
      if(mode==='unchanged')assert.equal(value.result.status,'unchanged',JSON.stringify(value.result));
      if(mode==='cancel')assert.equal(value.result.status,'preview-ready');
      if(mode==='annotation-only')assert.equal(value.result.code,'WORD_BOOK_RETURN_ANNOTATIONS_CHANGED');
      if(mode==='authority')assert.equal(value.error.message,'RTK_ROUND_STALE_AUTHORITY');
      if(mode==='scene'){assert.equal(value.error.message,'E_COMMAND_FAILED');assert.equal(value.kernelCalls[0].result.error.details.message,'WORD_BOOK_RETURN_SOURCE_STALE');}
      if(mode==='before-marker')assert.equal(fault,true);
      for(const [relative,content] of Object.entries(before)) {
        if(mode==='scene'&&relative===f.scenes.at(-1).relativeFile)continue;
        equal(productFiles(f)[relative],content,mode+' preserves complete prior business bytes');
      }
    } else if(mode==='after-marker') {
      assert.equal(fault,true);assert.equal(value.publications.length,0);assert.ok(value.error);
      await verifyAllSiblings(f);assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
      assert.notEqual(textFile(path.join(f.root,'notes.craftsman.json')),before['notes.craftsman.json'].toString());
    } else {
      assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));assert.equal(value.publications.length,1);
      if(mode==='replay') {
        const after=productFiles(f),result=await value.sandbox.prepareAuthenticatedBookPendingReturn({context:value.context,requestId:'replay',isCurrent:()=>true,
          docxBytes:bytes,revisionBridge:x.bridge});
        assert.equal(result.replay,true,JSON.stringify(result));equal(productFiles(f),after);assert.equal(value.requests.length,1);
        await assert.rejects(value.prepared.apply(),/PREPARED_CONSUMED/);
        const forged=await value.kernel.dispatch('cmd.rtk.review.applyCommentLifecycleReturn',{action:'authenticated-comment-delta',requestId:'forged'});
        assert.equal(forged.ok,false);equal(productFiles(f),after);
      }
      if(mode.startsWith('history-')) {
        const after=productFiles(f);value.sandbox.commitProjectTransaction=async args=>{
          value.requests.push(cloneJsonSafe(args));
          assert.equal(JSON.parse(args.treeCohort.input.returnProofJson).schemaVersion,6);
          if(mode==='history-before-marker')return tx.commitProjectTransaction({...args,afterTreeFilesPublish:async()=>{fault=true;throw Object.assign(Error('TINY_HISTORY_BEFORE_MARKER'),{code:'TINY_HISTORY_BEFORE_MARKER'});}});
          return tx.commitProjectTransaction({...args,fsAdapter:{...fsp,unlink:async target=>{
            if(!fault&&target===tx.journalPathFor(f.manifestPath)){fault=true;throw Object.assign(Error('TINY_HISTORY_AFTER_MARKER'),{code:'TINY_HISTORY_AFTER_MARKER'});}return fsp.unlink(target);}}});
        };
        const projection=await value.sandbox.readPendingRevisionProjection(),result=await value.kernel.dispatch('cmd.project.review.decidePendingRevision',
          {action:'undo',projectId:projection.projectId,sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
        assert.equal(fault,true);assert.equal(result.ok,false);assert.equal(value.publications.length,1,'failed history command publishes no fabricated inverse');
        assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
        for(const relative of f.scenes.map(scene=>scene.relativeFile).concat(['notes.craftsman.json','.yalken/word-review/non-text-return-state.v1.json']))
          equal(productFiles(f)[relative],(mode==='history-before-marker'?after:before)[relative]);
        await verifyAllSiblings(f);value.historyFault={projection,result};
      }
      if(mode==='joint') {
        const ledger=pending.readLedger(envelope.parseObservablePayload(textFile(path.join(f.root,f.scenes[0].relativeFile))).doc);
        assert.ok(ledger.revisions.some(row=>row.operation==='insert'));assert.ok(ledger.revisions.some(row=>row.operation==='delete'));
        equal(pending.projection(envelope.parseObservablePayload(textFile(path.join(f.root,f.scenes[0].relativeFile))).doc).original,
          envelope.parseObservablePayload(before[f.scenes[0].relativeFile].toString()).text,'complete Original literal remains source');
        assert.ok(textFile(commentPath(f)).includes('discussion-guard-joint'));
      }
    }
    const {sandbox,context,prepared,kernel,...operand}=value;retain('atomic-private-guard-'+mode,operand);
  }
});
test('novel authenticated atomic notes: complete final reads are sequential and late byte or absent-file changes refuse',async t=>{
  const f=await importedTiny(t,'atomic-final-reads',{canonicalNotes:true}),x=await exportImported(f),value=await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'final-reads'),{label:'final-reads-full'});
  assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));
  const paths=f.scenes.map(row=>path.join(f.root,row.relativeFile)),request={manifestPath:f.manifestPath,projectId:f.projectId,scenePaths:paths};
  let active=0,maximum=0;
  const adapter={...fsp,readFile:async(...args)=>{active++;maximum=Math.max(maximum,active);try{await new Promise(resolve=>setImmediate(resolve));return await fsp.readFile(...args);}finally{active--;}}};
  const query=await tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:adapter});assert.equal(maximum,1);assert.equal(query.records.length,paths.length);
  assert.equal(query.treeMutation.lastMutation.id,JSON.parse(textFile(tx.commitPathFor(paths[0]))).transactionId);
  for(const target of [path.join(f.root,'notes.craftsman.json'),tx.treeCommitPathFor(f.manifestPath),tx.journalPathFor(f.manifestPath)]) {
    const original=fs.existsSync(target)?fs.readFileSync(target):null;let fired=false;
    const late={...fsp,readFile:async(p,...args)=>{const bytes=await fsp.readFile(p,...args);if(!fired&&p===paths.at(-1)){fired=true;fs.writeFileSync(target,Buffer.concat([original||Buffer.alloc(0),Buffer.from(' foreign')]));}return bytes;}};
    await assert.rejects(tx.readVerifiedProjectDocxNovelCohort({...request,fsAdapter:late}),error=>typeof error.code==='string');assert.equal(fired,true);
    assert.ok(fs.readFileSync(target).equals(Buffer.concat([original||Buffer.alloc(0),Buffer.from(' foreign')])));
    if(original===null)fs.unlinkSync(target);else fs.writeFileSync(target,original);
  }
  retain('atomic-final-sequential-read',{maximum,query});
  const selected=await exportImported(f,[f.scenes[0]],{actualScene:true});
  const subset=await authenticatedBookNoteReturn(t,f,selected,changedNotesZip(selected,'one-entry'),{label:'one-entry-selected'});
  assert.equal(subset.applied?.ok,true,JSON.stringify(subset.error||subset.result));
  const ids=paths.map(target=>JSON.parse(textFile(tx.commitPathFor(target))).transactionId);assert.ok(new Set(ids).size>1);
  const filename=require.resolve('../../src/core/project-transaction-v1.cjs'),{Module,createRequire}=require('node:module'),owned=new Module(filename);
  owned.filename=filename;owned.paths=Module._nodeModulePaths(path.dirname(filename));owned.require=createRequire(filename);
  const original=readSource(filename),set='invocation.successPackets.set(target,freezeTreeValue({packet,source}));',validate='      await validateTreePacket(packet,manifestPath);';
  assert.equal(original.split(set).length,2);assert.equal(original.split(validate).length,2);
  owned._compile('let maxRetained=0,latestRegenerations=0;\n'+original.replace(set,set+'maxRetained=Math.max(maxRetained,invocation.successPackets.size);')
    .replace(validate,validate+'latestRegenerations++;')+'\nmodule.exports={...module.exports,counts:()=>({maxRetained,latestRegenerations}),reset:()=>{maxRetained=0;latestRegenerations=0;}};',filename);
  const cohort=await owned.exports.readVerifiedProjectDocxNovelCohort(request);assert.equal(cohort.records.length,paths.length);
  assert.equal(owned.exports.counts().maxRetained,1,'distinct real latest packets retain only one verified envelope');
  assert.ok(owned.exports.counts().latestRegenerations>=2,'every distinct semantic packet is regenerated');
  owned.exports.reset();const lineage=await owned.exports.readVerifiedNovelAnnotationLineage({scenePath:paths[0],manifestPath:f.manifestPath});
  assert.equal(owned.exports.counts().latestRegenerations,1,'one owned lineage invocation shares complete latest verification');
  assert.equal(lineage.treeMutation.receipt.transactionId,ids[0]);retain('atomic-private-lineage-and-memory',{ids,cohort,lineage,counts:owned.exports.counts()});
});
test('novel authenticated atomic notes: private history verification retains nested binding and final prewrite freshness',async t=>{
  const f=await importedTiny(t,'private-history-verify',{canonicalNotes:true}),x=await exportImported(f);
  const filename=require.resolve('../../src/core/project-transaction-v1.cjs'),{Module,createRequire}=require('node:module'),owned=new Module(filename);
  owned.filename=filename;owned.paths=Module._nodeModulePaths(path.dirname(filename));owned.require=createRequire(filename);
  const source=readSource(filename),validate='async function validateTreePacket(packet, manifestPath) {',build='  model.validateProjectTreeCohort(privatePlan);';
  assert.equal(source.split(validate).length,2);assert.equal(source.split(build).length,2);
  owned._compile('let actualValidations=[],actualBuilds=[];const proofVersion=p=>p?.kind===\'word-mixed-return\'?JSON.parse(p.input.returnProofJson).schemaVersion:p?.kind;\n'
    +source.replace(validate,validate+'actualValidations.push(proofVersion(packet.plan));')
      .replace(build,build+'actualBuilds.push(proofVersion(privatePlan));')
    +'\nmodule.exports={...module.exports,packetBinding:validateTreePacketBinding,packetMeaning:validateTreePacket,canonicalize,sha256hex,counts:()=>({actualValidations,actualBuilds}),reset:()=>{actualValidations=[];actualBuilds=[];}};',filename);
  let lateTarget=null;const late=[];
  const commit=async args=>{
    if(!lateTarget)return owned.exports.commitProjectTransaction(args);
    let calls=0,writes=0,fired=false;
    const adapter={...fsp,writeFile:async(...values)=>{writes++;return fsp.writeFile(...values);}};
    try{return await owned.exports.commitProjectTransaction({...args,fsAdapter:adapter,revalidate:async()=>{
      await args.revalidate();if(++calls===2){fired=true;fs.writeFileSync(lateTarget.target,lateTarget.foreign);}
    }});}finally{late.push({calls,writes,fired,target:lateTarget.target});}
  };
  const value=await authenticatedBookNoteReturn(t,f,x,changedNotesZip(x,'private-verify',true),{label:'private-verify',commit});
  assert.equal(value.applied?.ok,true,JSON.stringify(value.error||value.result));
  const history=[];
  for(const action of ['undo','redo']) {
    const projection=await value.sandbox.readPendingRevisionProjection();owned.exports.reset();
    const result=await value.kernel.dispatch('cmd.project.review.decidePendingRevision',{action,projectId:projection.projectId,
      sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
    assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.changed,true);
    const counts=cloneJsonSafe(owned.exports.counts());history.push({action,result,counts});
    equal(counts.actualBuilds,[6],'one private outer history meaning is independently regenerated');
    equal(counts.actualValidations.filter(v=>v===5||v===6),[action==='undo'?5:6],'current checked latest packet is regenerated once before journal, never once per member');
    const files=productFiles(f);
    for(const relative of f.scenes.map(scene=>scene.relativeFile).concat(['notes.craftsman.json','.yalken/word-review/non-text-return-state.v1.json']))
      equal(files[relative],(action==='undo'?value.before:value.after)[relative],'complete body and both annotation stores follow the actual public inverse');
    await verifyAllSiblings(f);
  }
  const model=await modelPromise,base=value.requests[1].treeCohort,forgeries=[];
  for(const kind of ['schema','transaction','revision','entries','meaning','project','manifest','origin']) {
    const input=cloneJsonSafe(base.input),packet=input.history.applyPacket,proof=JSON.parse(input.returnProofJson);
    if(kind==='schema')packet.schemaVersion='foreign';
    if(kind==='transaction')packet.transactionId='a'.repeat(64);
    if(kind==='revision')packet.revision++;
    if(kind==='entries')packet.entries[0].afterBase64=Buffer.from('foreign').toString('base64');
    if(kind==='meaning')packet.plan.code='FORGED_MEANING';
    if(kind==='project')packet.projectId='foreign';
    if(kind==='manifest')packet.manifestPath=path.join(f.root,'foreign.json');
    if(kind==='origin')packet.plan.input.novelOrigin.digest='b'.repeat(64);
    proof.applyPacketDigest=model.projectTreeCohortDigest(packet);proof.applyTransactionId=packet.transactionId;input.returnProofJson=JSON.stringify(proof);
    const before=productFiles(f);let error,plan=null,writes=0;
    try {
      plan=model.planProjectMixedWordReturnCohort(input);
      await owned.exports.commitProjectTransaction({manifestPath:f.manifestPath,revision:5,treeCohort:plan,
        publishManifest:async()=>{throw Error('FORGED_PUBLICATION');},revalidate:async()=>{},
        fsAdapter:{...fsp,writeFile:async(...args)=>{writes++;return fsp.writeFile(...args);}}});
    }catch(e){error={code:e.code,message:e.message};}
    assert.ok(error?.code,JSON.stringify({kind,error}));assert.equal(writes,0);equal(productFiles(f),before,'forged '+kind+' has no storage authority');
    if(['schema','transaction','revision','entries'].includes(kind))assert.ok(plan,'valid independently regenerated nested meaning must still meet every envelope binding');
    forgeries.push({kind,error,planAdmitted:plan!==null});
  }
  for(const target of [path.join(f.root,f.scenes[0].relativeFile),path.join(f.root,'notes.craftsman.json'),
    tx.treeCommitPathFor(f.manifestPath),tx.journalPathFor(f.manifestPath),value.requests[0].treeCohort.input.novelOrigin.path]) {
    const original=fs.existsSync(target)?fs.readFileSync(target):null,before=productFiles(f),publicationCount=value.publications.length;
    const projection=await value.sandbox.readPendingRevisionProjection();
    lateTarget={target,foreign:Buffer.concat([original||Buffer.alloc(0),Buffer.from(' late')] )};
    const result=await value.kernel.dispatch('cmd.project.review.decidePendingRevision',{action:'undo',projectId:projection.projectId,
      sceneId:projection.sceneId,subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
    assert.equal(result.ok,false);assert.equal(value.publications.length,publicationCount);assert.equal(late.at(-1).writes,0);assert.equal(late.at(-1).fired,true);
    assert.ok(fs.readFileSync(target).equals(lateTarget.foreign));
    if(original===null)fs.unlinkSync(target);else fs.writeFileSync(target,original);
    equal(productFiles(f),before,'all unmodified business files and previous receipt remain exact after late refusal');lateTarget=null;
  }
  const query=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath,projectId:f.projectId});
  assert.equal(owned.exports.sha256hex(owned.exports.canonicalize(query.retainedPacket)),model.projectTreeCohortDigest(query.retainedPacket));
  for(const text of ['', 'Ж🙂', '\ud800', '\udc00', ...[55,56,63,64,65,127,128,129].map(n=>'x'.repeat(n))])
    assert.equal(owned.exports.sha256hex(owned.exports.canonicalize({text})),model.projectTreeCohortDigest({text}));
  retain('atomic-private-history-verification',{history,forgeries,late,query,files:productFiles(f)});
});
test('novel return: indexed ownership preserves exact signed ranges and refuses malformed aliases',async()=>{
  const {extractTransportParagraphOwnershipV1:read}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const options={cryptoPort:actualCryptoPort()},name=i=>'YRTK_'+i,
    start=(i,n=name(i))=>`<w:bookmarkStart w:id="${i}" w:name="${n}"/>`,end=i=>`<w:bookmarkEnd w:id="${i}"/>`,
    xml=body=>`<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`,p=body=>'<w:p>'+body+'</w:p>',run='<w:r><w:t>x</w:t></w:r>';
  equal(read(xml(p(start(1)+run)+p(run+end(1)+start(2)+run+end(2))),[name(1),name(2)],options),[[0],[0,1]]);
  equal(read(xml(p(run)+p(start(1)+run+end(1))),[name(1)],{...options,allowUnownedParagraphs:true}),[[],[0]]);
  for(const [body,names,code] of [
    [p(start(1)+start(1,'ordinary')+run+end(1)),[name(1)],'PAIR'],
    [p(start(1)+run+end(1)+end(1)),[name(1)],'PAIR'],
    [p(start(2)+run+end(2)+start(1)+run+end(1)),[name(1),name(2)],'ORDER'],
    [p(start(1)+start(2)+run+end(1)+end(2)),[name(1),name(2)],'OVERLAP'],
    [start(1)+p(run)+end(1),[name(1)],'OWNER'],
    [p(start(1)+run+end(1))+p(run),[name(1)],'UNOWNED']
  ])assert.throws(()=>read(xml(body),names,options),new RegExp('PENDING_RETURN_BOOKMARK_'+code+'$'));
});
test('novel return: unchanged rich runs require style-import identity and preserve exact note points',()=>{
  const {Module,createRequire}=require('node:module'),filename=require.resolve('../../src/core/word-pending-comment-return-v1.cjs'),exposed=new Module(filename);
  exposed.filename=filename;exposed.paths=Module._nodeModulePaths(path.dirname(filename));exposed.require=createRequire(filename);
  exposed._compile(readSource(filename)+'\nmodule.exports={importRunStyle,deriveMixedPendingDocument};',filename);
  const language={val:'ru-RU',eastAsia:'ru-RU',bidi:'ru-RU'},marks=[{type:'textStyle',attrs:{wordLanguage:language}}],node={type:'text',text:'x'};
  assert.notDeepEqual(exposed.exports.importRunStyle(node,marks,marks,'paragraph'),node,'equal emitted/returned marks do not prove canonical style identity');
  const typography=require('../../src/core/word-review-typography-v1.cjs').freshBodyTypography(),source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'alpha beta'}]}]},
    ledger={schemaVersion:3,source,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[],noteSourcePoints:[{noteId:'note-boundary',paragraphIndex:0,offsetUtf16:5}]},
    document=pending.bindLedger(ledger),exportParagraphs=[{nodeType:'paragraph'}],checked=pending.buildCommentExportBinding({document,anchors:[],exportTypography:typography,exportParagraphs,schemaVersion:1}),
    incoming=cloneJsonSafe(ledger);incoming.source=checked.projection.union;
  const derive=returned=>exposed.exports.deriveMixedPendingDocument({document,returnedDocument:pending.bindLedger(returned),binding:checked.binding,anchors:[],
    exportTypography:typography,exportParagraphs,cleanTransportSchemaVersion:1,allowUntrackedRichFormatting:true,
    noteBinding:{beforeDoc:document,returnedDoc:pending.bindLedger(returned)}});
  const unchanged=derive(incoming);assert.equal(unchanged.changed,false);equal(pending.readLedger(unchanged.document).noteSourcePoints,ledger.noteSourcePoints);
  for(const [key,value]of [['fontFamily','Georgia'],['fontSize','14pt'],['wordLanguage',language]]){
    const altered=cloneJsonSafe(incoming);altered.source.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs[key]=value;
    assert.throws(()=>derive(altered),/MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED/,'changed '+key+' retains the strict note-body style guard');
  }
});
test('novel authenticated atomic notes: subset lineage survives untouched chapter Save and late publication refuses changed owners',async t=>{
  const f=await importedTiny(t,'subset-note-return',{canonicalNotes:true}),x=await exportImported(f,[f.scenes[0]],{actualScene:true}),bytes=changedNotesZip(x,'subset');
  const {sandbox,context,prepared,kernel,...outcome}=await authenticatedBookNoteReturn(t,f,x,bytes,{label:'subset'});
  assert.equal(outcome.applied?.ok,true,JSON.stringify(outcome.error||outcome.result));
  assert.equal(outcome.requests.length,1);await verifyAllSiblings(f);
  const old=textFile(path.join(f.root,f.scenes.at(-1).relativeFile));
  const saved=await saveOrdinaryScene(f,f.scenes.at(-1),'UNTARGETED-SAVE');assert.equal(saved.result.success,true);assert.notEqual(saved.after,old);
  await verifyAllSiblings(f);const exported=await exportImported(f);assert.equal(exported.phases.at(-1).analysis.ok,true);
  retain('subset-note-return',{outcome,saved,source:exported.source,bytes:exported.bytes,files:productFiles(f)});
  for(const kind of ['scene','notes','comments','origin']) {
    const g=await importedTiny(t,'late-note-'+kind,{canonicalNotes:true}),source=await exportImported(g),returned=changedNotesZip(source,'late');let foreign;
    const initialId=JSON.parse(textFile(tx.commitPathFor(path.join(g.root,g.scenes[0].relativeFile)))).transactionId;
    const value=await authenticatedBookNoteReturn(t,g,source,returned,{label:'late-'+kind,beforePublication:async()=>{
      const target=kind==='scene'?path.join(g.root,g.scenes.at(-1).relativeFile):kind==='notes'?path.join(g.root,'notes.craftsman.json'):
        kind==='comments'?commentPath(g):tx.recoveryPacketPathFor(g.manifestPath,initialId);
      const before=fs.readFileSync(target),after=Buffer.concat([before,Buffer.from(' foreign late')]);foreign={target,before,after};fs.writeFileSync(target,after);
    }});
    const {sandbox,context,prepared,kernel,...operand}=value;retain('late-note-publication-'+kind,{operand,foreign});
    assert.equal(value.applied,undefined);assert.equal(value.publications.length,0);assert.ok(value.error);assert.ok(fs.readFileSync(foreign.target).equals(foreign.after));
  }
});
test('novel authenticated atomic notes: two-owner note-only and joint returns use genuine Main authority and one complete tree',async t=>{
  const observed=[];
  for(const joint of [false,true]) {
    const f=await importedTiny(t,'authenticated-two-owner-'+joint,{canonicalNotes:true}),x=await exportImported(f);
    const extracted=x.bridge.extractDocxReviewTransportPackagePartsFromZipBytes(x.bytes),parts={...extracted.parts};assert.equal(extracted.ok,true);
    for(const name of ['word/footnotes.xml','word/endnotes.xml']) {assert.ok(parts[name].includes('second line'));parts[name]=parts[name].replace('second line','second line edited '+joint);}
    if(joint)parts['word/document.xml']=parts['word/document.xml'].replace('</w:t></w:r>','</w:t></w:r><w:ins w:id="987" w:author="Editor" w:date="2026-10-09T01:00:00Z"><w:r><w:t>Added in Word</w:t></w:r></w:ins>');
    const returnedBytes=buildStoredZip(Object.entries({...parts,...extracted.binaryParts}).map(([name,data])=>({name,data})));
    const {sandbox,context,prepared,kernel,...outcome}=await authenticatedBookNoteReturn(t,f,x,returnedBytes,{label:'before-'+joint});
    if(outcome.applied?.ok) {
      const history=[];
      for(const action of ['undo','redo','undo','redo']) {
        const projection=await sandbox.readPendingRevisionProjection();
        const result=await kernel.dispatch('cmd.project.review.decidePendingRevision',{action,projectId:projection.projectId,sceneId:projection.sceneId,
          subjectId:projection.subjectId,expectedSceneSha256:projection.expectedSceneSha256});
        const files=productFiles(f);history.push({action,projection,result,files});outcome.history=history;
        retain('atomic-notes-history-'+joint,history);
        if(result.ok!==true||result.changed!==true)break;
        for(const relative of f.scenes.map(scene=>scene.relativeFile).concat(['notes.craftsman.json','.yalken/word-review/non-text-return-state.v1.json']))
          equal(files[relative],(action==='undo'?outcome.before:outcome.after)[relative],'global inverse restores complete canonical body and both annotation stores');
        await verifyAllSiblings(f);
      }
    }
    observed.push({joint,outcome,root:f.root,projectId:f.projectId,scenePaths:f.scenes.map(s=>path.join(f.root,s.relativeFile))});retain('atomic-notes-two-owner-causal',observed);
  }
  for(const {joint,outcome,root,projectId,scenePaths} of observed) {
    assert.equal(outcome.applied?.ok,true,JSON.stringify({status:outcome.result?.status,code:outcome.result?.code,error:outcome.error}));
    assert.equal(outcome.requests.length,5);assert.equal(outcome.requests[0].treeCohort?.kind,'word-mixed-return');
    assert.ok(outcome.requests.every(request=>request.treeCohort?.kind==='word-mixed-return'));
    assert.equal(outcome.kernelCalls.length,1,'actual existing Kernel executes the object-admitted tree Apply');
    assert.equal(outcome.history?.length,4,JSON.stringify(outcome.history?.at(-1)?.result));
    for(const item of outcome.history)assert.equal(item.result.changed,true,JSON.stringify(item));
    const after=JSON.parse(textFile(path.join(root,'notes.craftsman.json'))),before=JSON.parse(outcome.before['notes.craftsman.json']);
    equal(after.notes.filter(n=>!n.manuscript),before.notes.filter(n=>!n.manuscript),'all private/deleted notes remain byte-equivalent');
    assert.equal(after.notes.filter(n=>n.manuscript&&n.body.includes('edited '+joint)).length,2);
    await tx.readVerifiedProjectDocxNovelCohort({manifestPath:path.join(root,'project.craftsman.json'),projectId,scenePaths});
  }
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
async function runFullNovelImportProof(t,{bytes,label,afterImport}) {
  const f=await projectFixture(t,'full500k-'+label,{canonicalNotes:true}),evidence=process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;
  const inputDir=evidence||fs.mkdtempSync(path.join(os.tmpdir(),'full500k-docx-source-'));
  if(!evidence)t.after(()=>fs.rmSync(inputDir,{recursive:true,force:true}));
  const sourcePath=path.join(inputDir,label+'-input.docx');assert.equal(fs.existsSync(sourcePath),false);fs.mkdirSync(inputDir,{recursive:true});fs.writeFileSync(sourcePath,bytes);
  const port=await mainProjectPort(f,{localPath:sourcePath}),handlers={
    'cmd.project.docx.previewLocalFile':port.handleDocxImportLocalFilePreviewCommandSurface,
    'cmd.project.docx.previewImportPlan':port.handleDocxImportPreviewCommandSurface,
    'cmd.project.docx.importSafeCreate':port.handleDocxImportSafeCreateCommandSurface};
  const timings=[];
  const dispatch=async(id,payload)=>{const start=process.hrtime.bigint(),result=await handlers[id](payload);const seconds=Number(process.hrtime.bigint()-start)/1e9;timings.push({id,seconds});retain(label+'-timings',timings);assert.ok(seconds<120,'actual public handler remains below existing120s: '+id);return result;};
  const local=await dispatch('cmd.project.docx.previewLocalFile',{requestId:label+'-local'});
  retain(label+'-local',{bytes,local,timings});assert.equal(local.contentPreviewOk,true,`complete local parser: ${JSON.stringify(local.error||{reason:local.reason,code:local.code})}`);
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
  if(afterImport)await afterImport(f);
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

function observedNovelIntake() {
 const filename=require.resolve('../../src/utils/docxImportSafeCreate.js'),{Module,createRequire}=require('node:module'),observed=new Module(filename);
 observed.filename=filename;observed.paths=Module._nodeModulePaths(path.dirname(filename));observed.require=createRequire(filename);
 let source=readSource(filename);
 for(const [needle,replacement] of [
  ['function validateDocxImportPreviewPlan(plan) {','function validateDocxImportPreviewPlan(plan) { if(plan?.candidateCreatePlan?.sceneStrategy===\'word-novel-root-partitions\')actualNovelChecks++;'],
  ['const expected=model.materializeDocxNovelCandidate(','actualReceiptMaterializations++; const expected=model.materializeDocxNovelCandidate('],
  ['const cohort=model.planProjectDocxImportCohort(','actualCohortPlans++; const cohort=model.planProjectDocxImportCohort('],
 ]) {assert.equal(source.split(needle).length,2,'one real observed callsite');source=source.replace(needle,replacement);}
 observed._compile('let actualNovelChecks=0,actualReceiptMaterializations=0,actualCohortPlans=0;\n'+source+'\nmodule.exports={...module.exports,inspectDocxMediaEntries,actualCounts:()=>({novelChecks:actualNovelChecks,receiptMaterializations:actualReceiptMaterializations,cohortPlans:actualCohortPlans})};',filename);
 return observed.exports;
}

test('novel import: one private validated preview survives queued caller mutation without discarding a full materialization',async t=>{
 const intake=observedNovelIntake(),f=await projectFixture(t,'sealed-preview',{canonicalNotes:true}),source=await tinyPlan(20),original=cloneJsonSafe(source.plan),caller=cloneJsonSafe(original);let queued=false;
 intake.rememberDocxImportPreviewPlanAdmission(caller);
 const result=await intake.applyDocxImportSafeCreate({docxImportPreviewPlan:caller},{...f,manifestRaw:textFile(f.manifestPath),importRequestNonce:'sealed-preview',queueDiskOperation:async operation=>{
  queued=true;caller.candidateCreatePlan.sourceCandidate.content+=' foreign queued source';caller.candidateCreatePlan.entries[0].content+=' foreign queued chapter';return operation();
 }});
 assert.equal(queued,true);assert.equal(result.ok,true,JSON.stringify(result.error));
 assert.equal(result.value.receipt.inputHash,intake.hashDocxImportPreviewPlanForAdmission(original),'publication remains bound to the original admitted preview');
 const roots=result.value.receipt.createdScenes.flatMap(scene=>envelope.parseObservablePayload(textFile(path.join(f.root,scene.relativeFile))).doc.content);
 equal(roots,envelope.parseObservablePayload(original.candidateCreatePlan.sourceCandidate.content).doc.content,'every original rich paragraph is preserved despite caller mutation');
 equal(intake.actualCounts(),{novelChecks:1,receiptMaterializations:1,cohortPlans:1},'actual independent receipt proof remains; preview semantic validation occurs once');
 const forbidden=cloneJsonSafe(original);forbidden.filePath=undefined;const before=productFiles(f);let entered=false;
 const rejected=await intake.applyDocxImportSafeCreate({docxImportPreviewPlan:forbidden},{...f,queueDiskOperation:async()=>{entered=true;assert.fail('forbidden field cannot reach the queue');}});
 assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'DOCX_SAFE_CREATE_PREVIEW_FORBIDDEN_FIELD');assert.equal(entered,false);equal(productFiles(f),before,'validation before cloning preserves the forbidden-undefined refusal');
 retain('private-preview-owned-once',{original,caller,result,rejected,counts:intake.actualCounts(),files:productFiles(f)});
});

test('novel import: guarded media bindings include deduplicated existing and missing body, note and story assets',async t=>{
 const intake=observedNovelIntake(),f=await projectFixture(t,'complete-media'),source=await tinyPlan(20,{story:true}),doc=envelope.parseObservablePayload(source.combined.candidateCreatePlan.entries[0].content).doc;
 const {createImageAttrs}=require('../../src/io/documentMedia.js'),jpeg=require('../fixtures/document-jpeg-fixtures.cjs'),attrs=['rgb','gray','subsampled'].map(key=>createImageAttrs(jpeg[key])),image=i=>({type:'image',attrs:attrs[i]});
 doc.content[0].content.push(image(0));doc.content[1].content.push(image(0));doc.attrs.wordStories.stories[0].body.content[0].content.push(image(2));
 const noteBodies=[{body:{type:'doc',content:[{type:'paragraph',content:[image(1)]}]}}],content=envelope.composeObservablePayload({doc}),existing=path.join(f.root,attrs[0].assetPath);
 fs.mkdirSync(path.dirname(existing),{recursive:true});fs.writeFileSync(existing,jpeg.rgb);
 const checked=await intake.inspectDocxMediaEntries(content,f.root,noteBodies);
 assert.equal(checked.bindings.length,3,'all three story/body/note assets appear once');assert.equal(checked.entries.length,2,'existing exact bytes are reused');
 equal(checked.bindings.find(binding=>binding.relativePath===attrs[0].assetPath),{relativePath:attrs[0].assetPath,beforeBase64:jpeg.rgb.toString('base64')});
 for(const a of attrs.slice(1))equal(checked.bindings.find(binding=>binding.relativePath===a.assetPath),{relativePath:a.assetPath,beforeBase64:null});
 fs.writeFileSync(existing,Buffer.from('foreign bytes'));await assert.rejects(intake.inspectDocxMediaEntries(content,f.root,noteBodies),/^Error: DOCX_MEDIA_EXISTING_BYTES$/);
 fs.unlinkSync(existing);const outside=path.join(f.root,'outside.jpg');fs.writeFileSync(outside,jpeg.rgb);fs.symlinkSync(outside,existing);
 await assert.rejects(intake.inspectDocxMediaEntries(content,f.root,noteBodies),/^Error: DOCX_MEDIA_PATH$/);
 retain('complete-guarded-media-bindings',{attrs,checked,content,noteBodies,files:productFiles(f)});
});

async function observedNovelPartition(legacy=false) {
 const filename=require.resolve('../../src/core/project-tree-cohort-v1.mjs'),{pathToFileURL}=require('node:url');
 const selected='let local = { ...clone({ ...doc, content: roots.slice(rootFrom, rootTo) }), attrs: { ...(clone(doc.attrs || {})) } };',whole='let local = { ...clone(doc), content: clone(roots.slice(rootFrom, rootTo)), attrs: { ...(clone(doc.attrs || {})) } };';
 let source=readSource(filename);assert.equal(source.split(selected).length,2,'one actual local partition clone');
 source=source.replace(selected,legacy?whole.replace('clone(doc)','observedLocalClone(doc,doc)'):selected.replace('clone({ ...doc, content: roots.slice(rootFrom, rootTo) })','observedLocalClone({ ...doc, content: roots.slice(rootFrom, rootTo) },doc)'));
 source=`let actualLocalCopies=[]; const observedLocalClone=(input,source)=>{ const result=clone(input),owned=new Set();
  const collect=x=>{if(x&&typeof x==='object'){owned.add(x);Object.values(x).forEach(collect);}};collect(source);
  const check=x=>{if(x&&typeof x==='object'){need(!owned.has(x),'E_TEST_PARTITION_ALIAS');Object.values(x).forEach(check);}};check(result);
  actualLocalCopies.push(input.content.length);return result;};\n`+source+'\nexport const actualPartitionCopies=()=>actualLocalCopies.slice();\n';
 source=source.replace(/(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,(_,a,q,p)=>a+q+pathToFileURL(path.resolve(path.dirname(filename),p)).href+q);
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
test('novel import: partition copies only selected roots with deep ownership and byte-identical complete rich cohorts',async t=>{
 const actual=await observedNovelPartition(),legacy=await observedNovelPartition(true),policy={targetParagraphs:200,targetUtf16:100000},outcomes=[];
 for(const [label,opts] of [['rich-notes-comments',{}],['bookmarks',{bookmark:true}],['pending',{pendingText:true,notes:false}]]) {
  const f=await projectFixture(t,'local-clone-'+label,{canonicalNotes:true}),source=await tinyPlan(20,{...opts,inflate:10000},policy),base=await plannedTiny(f,source,'local-'+label),inputBefore=JSON.stringify(base.input);
  const offset=actual.actualPartitionCopies().length,oldOffset=legacy.actualPartitionCopies().length;
  const candidate=actual.partitionDocxImportCandidate(source.combined.candidateCreatePlan,source.plan.source.sourceArtifactSha256,policy),prior=legacy.partitionDocxImportCandidate(source.combined.candidateCreatePlan,source.plan.source.sourceArtifactSha256,policy);
  assert.equal(candidate.entries.length,4);assert.equal(JSON.stringify(candidate),JSON.stringify(prior),'all source/chapter structures, attributes, marks and annotation recipes stay byte-identical');
  const copied=actual.actualPartitionCopies().slice(offset),oldCopied=legacy.actualPartitionCopies().slice(oldOffset);
  equal(copied,candidate.entries.map(entry=>entry.partition.rootTo-entry.partition.rootFrom),'actual local clone receives only each selected root interval');
  assert.ok(copied.reduce((a,b)=>a+b,0)<oldCopied.reduce((a,b)=>a+b,0),'whole-book copies are removed');
  const cohort=actual.planProjectDocxImportCohort(base.input),oldCohort=legacy.planProjectDocxImportCohort(base.input);
  assert.equal(JSON.stringify(cohort),JSON.stringify(oldCohort),'entire canonical cohort/receipt/digests retain exact bytes');equal(cohort,base);assert.equal(JSON.stringify(base.input),inputBefore,'caller-owned rich source is unchanged');
  const admitted=JSON.stringify(candidate);source.combined.candidateCreatePlan.entries[0].content+=' foreign caller mutation';assert.equal(JSON.stringify(candidate),admitted,'immutable candidate is independently owned');
  outcomes.push({label,copied,oldCopied,candidate,cohort});
 }
 retain('selected-root-clone-conservation',outcomes);
});

test('novel tree hashes retain old string UTF8 digests and complete canonical cohort bytes',async t=>{
 const filename=require.resolve('../../src/core/project-tree-cohort-v1.mjs'),{pathToFileURL}=require('node:url');
 const load=async legacy=>{
  let source=readSource(filename);assert.ok(source.includes("const sha = x => hash.sha256Hex(String(x));"));
  if(legacy)source=source.replace("import hash from './browser-safe-hash.cjs';","import { sha256Hex } from './browser-safe-hash.mjs';")
    .replace('const sha = x => hash.sha256Hex(String(x));','const sha = x => sha256Hex(x);');
  source=source.replace(/(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,(_,a,q,p)=>a+q+pathToFileURL(path.resolve(path.dirname(filename),p)).href+q);
  return import('data:text/javascript;base64,'+Buffer.from(source+'\nexport { sha as observedModelHash };').toString('base64'));
 };
 const actual=await load(false),legacy=await load(true),vectors=['','Ж🧭 e\u0301','\ud800','\udc00','x\ud800y',undefined,null,17,
  ...[55,56,63,64,65,127,128,129,1024].map(n=>'x'.repeat(n))];
 for(const value of vectors){const expected=sha(String(value));assert.equal(actual.observedModelHash(value),expected);assert.equal(legacy.observedModelHash(value),expected);}
 const f=await projectFixture(t,'typed-hash'),source=await tinyPlan(20),baseline=await plannedTiny(f,source,'typed-hash');
 const current=actual.planProjectDocxImportCohort(baseline.input),prior=legacy.planProjectDocxImportCohort(baseline.input);
 assert.equal(JSON.stringify(current),JSON.stringify(prior),'all rich scene/note/comment entries, receipts and canonical digests stay byte-exact');equal(current,baseline);
 retain('typed-model-hash-conservation',{vectors: vectors.map(String),current,prior});
});
