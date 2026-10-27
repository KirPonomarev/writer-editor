'use strict';

// R2.4 PK0 package content trust: model/contract proof for explicit package
// content admission and no release-profile promotion.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'scripts', 'ops', 'r24', 'package-content-trust-pk0.mjs');

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

const SECURITY_M2 = 'c6328f82d872f6d591bd880fe0676a421072331b';
function securityGit(args) {
  return require('node:child_process').execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
}
function securityFilesystemFixture(t, module, historical = false) {
  const fs = require('node:fs'), os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pk0-security-files-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const read = relative => historical ? securityGit(['show', `${SECURITY_M2}:${relative}`]) : fs.readFileSync(path.join(ROOT, relative));
  const carrierPath = historical ? module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH : module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH;
  const carrier = JSON.parse(read(carrierPath));
  fs.writeFileSync(path.join(directory, '.git'), `gitdir: ${String(securityGit(['rev-parse', '--absolute-git-dir'])).trim()}\n`);
  for (const relative of new Set([module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH, carrierPath, ...Object.keys(carrier.currentFiles)])) {
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, read(relative));
  }
  return directory;
}

function programDagFixture() {
  return {
    stages: [
      {
        stageId: 'PK0_PACKAGE_CONTENT_TRUST',
        profile: 'PACKAGED_RELEASE_SECURITY',
        dependsOn: ['Q0_TOOLCHAIN_HYGIENE', 'SEC0_PATH_CAPABILITY'],
        status: 'PENDING',
        mutationAuthority: 'PACKAGE_MANIFEST_AND_BUILD_EVIDENCE',
        claimCeiling: 'PACKAGE_CONTENT_PROFILE_ONLY',
      },
    ],
  };
}

function scientificContractsFixture() {
  return {
    consistencyModels: [
      {
        consistencyModelId: 'CM_PACKAGE_RESOLVED_STAGED_ADMITTED_SET_R1',
        profileId: 'PACKAGED_RELEASE_SECURITY',
        law: 'Runtime-resolved files must be a subset of staged files, which must be a subset of explicitly admitted package files.',
      },
    ],
  };
}

function packageFixture(files) {
  return {
    name: 'craftsman',
    version: '1.0.2',
    dependencies: { '@tiptap/core': '^3.20.1' },
    devDependencies: { electron: '^40.9.2', 'electron-builder': '^26.8.1' },
    overrides: { plist: '3.1.1' },
    engines: { node: '>=20.19.0 <21.0.0', npm: '>=10.0.0 <11.0.0' },
    build: { files },
  };
}

function trackedFixture() {
  return [
    'package.json',
    'package-lock.json',
    'LICENSE',
    'NOTICE',
    'README.md',
    'SECURITY.md',
    'src/main.js',
    'src/preload.js',
    'src/preload.bundle.cjs',
    'src/core/ipc-envelope-v1.cjs',
    'src/core/contracts.ts',
    'src/contracts/core-state.contract.ts',
    'src/renderer/index.html',
    'src/renderer/editor.bundle.js',
    'src/renderer/editor.js',
    'src/renderer/flags.js',
    'docs/OPS/STATUS/CANON_STATUS.json',
    'scripts/ops/r24/scheduler.mjs',
    'test/unit/example.test.js',
  ];
}

test('PK0 accepts exact build.files manifest and proves runtime/staged/admitted subset law', async () => {
  const module = await loadModule();
  const result = module.evaluatePackageContentTrust({
    packageJson: packageFixture(module.PK0_REQUIRED_BUILD_FILES),
    trackedFiles: trackedFixture(),
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.stageId, 'PK0_PACKAGE_CONTENT_TRUST');
  assert.equal(result.value.profileId, 'PACKAGED_RELEASE_SECURITY');
  assert.equal(result.value.programBinding.claimCeiling, 'PACKAGE_CONTENT_PROFILE_ONLY');
  assert.equal(result.value.subsetLaw.runtimeResolvedSubsetOfStaged, true);
  assert.equal(result.value.subsetLaw.stagedSubsetOfAdmitted, true);
  assert.equal(result.value.sets.forbiddenStaged.length, 0);
  assert.equal(result.value.sets.missingRuntime.length, 0);
  assert.equal(result.value.authority.releaseReadyClaim, false);
  assert.equal(result.value.authority.signingNotarizationClaim, false);
  assert.equal(result.value.authority.releasePublication, false);
  assert.equal(result.value.authority.dependencyMutation, false);
  assert.equal(result.value.authority.productRuntimeMutation, false);
  assert.equal(result.value.authority.runtimeNetworkActivated, false);
  assert.equal(result.value.sets.runtimeResolvedFiles.includes('src/preload.bundle.cjs'), true);
  assert.equal(result.value.sets.runtimeResolvedFiles.includes('src/renderer/editor.bundle.js'), true);
});

test('PK0 rejects broad globs, forbidden staged files, missing runtime entries, and release promotion', async () => {
  const module = await loadModule();
  const broad = module.evaluatePackageContentTrust({
    packageJson: packageFixture(['**/*']),
    trackedFiles: trackedFixture(),
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(broad.ok, false);
  assert.equal(broad.error.value.errors.includes('PK0_BUILD_FILES_MANIFEST_MISMATCH'), true);
  assert.equal(broad.error.value.errors.some((code) => code.startsWith('PK0_BROAD_PACKAGE_GLOB_FORBIDDEN')), true);
  assert.equal(broad.error.value.errors.includes('PK0_FORBIDDEN_FILE_STAGED'), true);

  const missing = module.evaluatePackageContentTrust({
    packageJson: packageFixture(module.PK0_REQUIRED_BUILD_FILES),
    trackedFiles: trackedFixture().filter((file) => file !== 'src/preload.bundle.cjs'),
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.value.errors.includes('PK0_RUNTIME_RESOLVED_NOT_STAGED'), true);
  assert.equal(missing.error.value.errors.includes('PK0_RUNTIME_RESOLVED_NOT_TRACKED'), true);

  const promoted = module.evaluatePackageContentTrust({
    packageJson: packageFixture(module.PK0_REQUIRED_BUILD_FILES),
    trackedFiles: trackedFixture(),
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
    externalClaims: { releaseReady: true, signingPass: true, notarizationPass: true },
  });
  assert.equal(promoted.ok, false);
  assert.equal(promoted.error.value.errors.includes('PK0_RELEASE_READY_CLAIM_FORBIDDEN'), true);
  assert.equal(promoted.error.value.errors.includes('PK0_SIGNING_NOTARIZATION_CLAIM_FORBIDDEN'), true);
});

test('PK0 rejects dependency, lockfile, program binding, and consistency-law drift', async () => {
  const module = await loadModule();
  const packageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  const baselinePackageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  packageJson.dependencies.leftpad = '1.0.0';

  const dependencyDrift = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package-lock.json'],
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(dependencyDrift.ok, false);
  assert.equal(dependencyDrift.error.value.errors.includes('PK0_LOCKFILE_OR_WORKSPACE_MUTATION_FORBIDDEN'), true);
  assert.equal(dependencyDrift.error.value.errors.includes('PK0_DEPENDENCIES_MUTATION_FORBIDDEN'), true);

  const programDrift = module.evaluatePackageContentTrust({
    packageJson: packageFixture(module.PK0_REQUIRED_BUILD_FILES),
    trackedFiles: trackedFixture(),
    programDag: { stages: [{ stageId: 'PK0_PACKAGE_CONTENT_TRUST', profile: 'WRITER_CORE' }] },
    scientificContracts: { consistencyModels: [] },
  });
  assert.equal(programDrift.ok, false);
  assert.equal(programDrift.error.value.errors.includes('PK0_PROFILE_MISMATCH'), true);
  assert.equal(programDrift.error.value.errors.includes('PK0_AUTHORITY_MISMATCH'), true);
  assert.equal(programDrift.error.value.errors.includes('PK0_CLAIM_CEILING_MISMATCH'), true);
  assert.equal(programDrift.error.value.errors.includes('PK0_CONSISTENCY_MODEL_MISSING'), true);
});

test('PK0 admits only the exact owner-bound C6D Electron security upgrade', async () => {
  const module = await loadModule();
  const baselinePackageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  const packageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  packageJson.devDependencies.electron = '41.10.3';

  const admitted = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.C6D_DEPENDENCY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(admitted.ok, true, admitted.ok ? '' : JSON.stringify(admitted.error.value.errors));
  assert.equal(admitted.value.authority.dependencyMutation, false);
  assert.equal(admitted.value.authority.admittedDependencyAuditException, true);

  const forged = structuredClone(module.C6D_DEPENDENCY_MUTATION_ADMISSION);
  forged.currentLockSha256 = '0'.repeat(64);
  const forgedResult = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: forged,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(forgedResult.ok, false);
  assert.equal(forgedResult.error.value.errors.includes('PK0_LOCKFILE_OR_WORKSPACE_MUTATION_FORBIDDEN'), true);
  assert.equal(forgedResult.error.value.errors.includes('PK0_DEVDEPENDENCIES_MUTATION_FORBIDDEN'), true);

  const expanded = structuredClone(packageJson);
  expanded.devDependencies.unapproved = '1.0.0';
  const expandedResult = module.evaluatePackageContentTrust({
    packageJson: expanded,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.C6D_DEPENDENCY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(expandedResult.ok, false);
  assert.equal(expandedResult.error.value.errors.includes('PK0_DEVDEPENDENCIES_MUTATION_FORBIDDEN'), true);

  const workspaceResult = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json', 'pnpm-workspace.yaml'],
    dependencyMutationAdmission: module.C6D_DEPENDENCY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(workspaceResult.ok, false);
  assert.equal(workspaceResult.error.value.errors.includes('PK0_LOCKFILE_OR_WORKSPACE_MUTATION_FORBIDDEN'), true);
  assert.equal(workspaceResult.error.value.errors.includes('PK0_DEPENDENCY_ADMISSION_WRITE_SET_EXPANSION'), true);
});

test('PK0 admits only the exact owner-bound post-audit Node and npm successor', async () => {
  const module = await loadModule();
  const baselinePackageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  baselinePackageJson.devDependencies.electron = '41.10.3';
  const packageJson = structuredClone(baselinePackageJson);
  packageJson.packageManager = 'npm@10.9.0';
  packageJson.engines = { node: '>=22.12.0 <23.0.0', npm: '>=10.9.0 <11.0.0' };

  const admitted = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.POST_AUDIT_TOOLCHAIN_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(admitted.ok, true, admitted.ok ? '' : JSON.stringify(admitted.error.value.errors));
  assert.equal(admitted.value.authority.admittedDependencyAuditException, true);

  const wrongEngine = structuredClone(packageJson);
  wrongEngine.engines.node = '>=22.0.0 <23.0.0';
  const wrongEngineResult = module.evaluatePackageContentTrust({
    packageJson: wrongEngine,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.POST_AUDIT_TOOLCHAIN_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(wrongEngineResult.ok, false);
  assert.equal(wrongEngineResult.error.value.errors.includes('PK0_ENGINES_MUTATION_FORBIDDEN'), true);

  const wrongPackageManager = structuredClone(packageJson);
  wrongPackageManager.packageManager = 'npm@10.8.2';
  const wrongPackageManagerResult = module.evaluatePackageContentTrust({
    packageJson: wrongPackageManager,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.POST_AUDIT_TOOLCHAIN_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(wrongPackageManagerResult.ok, false);
  assert.equal(wrongPackageManagerResult.error.value.errors.includes('PK0_PACKAGEMANAGER_MUTATION_FORBIDDEN'), true);

  const dependencyExpansion = structuredClone(packageJson);
  dependencyExpansion.dependencies.unapproved = '1.0.0';
  const dependencyExpansionResult = module.evaluatePackageContentTrust({
    packageJson: dependencyExpansion,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.POST_AUDIT_TOOLCHAIN_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(dependencyExpansionResult.ok, false);
  assert.equal(dependencyExpansionResult.error.value.errors.includes('PK0_DEPENDENCIES_MUTATION_FORBIDDEN'), true);

  const crossStageElectron = structuredClone(packageJson);
  crossStageElectron.devDependencies.electron = '^40.9.2';
  const crossStageElectronResult = module.evaluatePackageContentTrust({
    packageJson: crossStageElectron,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package.json', 'package-lock.json'],
    dependencyMutationAdmission: module.POST_AUDIT_TOOLCHAIN_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(crossStageElectronResult.ok, false);
  assert.equal(crossStageElectronResult.error.value.errors.includes('PK0_DEVDEPENDENCIES_MUTATION_FORBIDDEN'), true);
});

test('PK0 admits only the exact WP702 security override transition and rejects forged or expanded scope', async () => {
  const module = await loadModule();
  const baselinePackageJson = packageFixture(module.PK0_REQUIRED_BUILD_FILES);
  baselinePackageJson.devDependencies.electron = '41.10.3';
  baselinePackageJson.packageManager = 'npm@10.9.0';
  baselinePackageJson.engines = { node: '>=22.12.0 <23.0.0', npm: '>=10.9.0 <11.0.0' };
  baselinePackageJson.overrides = {
    '@xmldom/xmldom': '0.9.10',
    'linkify-it': '5.0.2',
    picomatch: '4.0.4',
    plist: '3.1.1',
    tar: '7.5.22',
  };
  const packageJson = structuredClone(baselinePackageJson);
  packageJson.overrides['@xmldom/xmldom'] = '0.9.12';
  packageJson.overrides['fast-uri'] = '4.1.4';

  const admitted = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package-lock.json', 'package.json'],
    dependencyMutationAdmission: module.WP702_DEPENDENCY_SECURITY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(admitted.ok, true, admitted.ok ? '' : JSON.stringify(admitted.error.value.errors));
  assert.equal(admitted.value.authority.dependencyMutation, false);
  assert.equal(admitted.value.authority.admittedDependencyAuditException, true);

  const forgedAdmission = structuredClone(module.WP702_DEPENDENCY_SECURITY_MUTATION_ADMISSION);
  forgedAdmission.stageAdmissionDigest = '0'.repeat(64);
  const forged = module.evaluatePackageContentTrust({
    packageJson,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package-lock.json', 'package.json'],
    dependencyMutationAdmission: forgedAdmission,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(forged.ok, false);
  assert.equal(forged.error.value.errors.includes('PK0_LOCKFILE_OR_WORKSPACE_MUTATION_FORBIDDEN'), true);
  assert.equal(forged.error.value.errors.includes('PK0_OVERRIDES_MUTATION_FORBIDDEN'), true);

  const expanded = structuredClone(packageJson);
  expanded.overrides.tar = '7.5.23';
  const expandedResult = module.evaluatePackageContentTrust({
    packageJson: expanded,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package-lock.json', 'package.json'],
    dependencyMutationAdmission: module.WP702_DEPENDENCY_SECURITY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(expandedResult.ok, false);
  assert.equal(expandedResult.error.value.errors.includes('PK0_OVERRIDES_MUTATION_FORBIDDEN'), true);

  const dependencyExpansion = structuredClone(packageJson);
  dependencyExpansion.dependencies.unapproved = '1.0.0';
  const dependencyExpansionResult = module.evaluatePackageContentTrust({
    packageJson: dependencyExpansion,
    baselinePackageJson,
    trackedFiles: trackedFixture(),
    changedFiles: ['package-lock.json', 'package.json'],
    dependencyMutationAdmission: module.WP702_DEPENDENCY_SECURITY_MUTATION_ADMISSION,
    programDag: programDagFixture(),
    scientificContracts: scientificContractsFixture(),
  });
  assert.equal(dependencyExpansionResult.ok, false);
  assert.equal(dependencyExpansionResult.error.value.errors.includes('PK0_DEPENDENCIES_MUTATION_FORBIDDEN'), true);
});

test('PK0 current Word Mac security successor binds exact graph and rejects expansion or forged admission', async () => {
  const module=await loadModule(),fs=require('node:fs'),cp=require('node:child_process');
  const admission=module.WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION;
  const baselinePackageJson=JSON.parse(cp.execFileSync('git',['show','e4be0d8d22937745f691dc6121541278668139ed:package.json'],{cwd:ROOT,encoding:'utf8'}));
  const packageJson=JSON.parse(securityGit(['show',`${SECURITY_M2}:package.json`]));
  const evaluate=(pkg,candidate=admission,changedFiles=['package.json','package-lock.json'])=>module.evaluatePackageContentTrust({packageJson:pkg,baselinePackageJson,trackedFiles:trackedFixture(),changedFiles,dependencyMutationAdmission:candidate,wordMacSecuritySuccessorRequired:true,programDag:programDagFixture(),scientificContracts:scientificContractsFixture()});
  assert.equal(evaluate(packageJson).ok,true);
  for(const mutate of [p=>p.dependencies.unapproved='1.0.0',p=>p.devDependencies.electron='41.10.7',p=>p.overrides['fast-uri']='4.1.6',p=>p.engines.node='>=24',p=>p.build.extends='./unapproved.cjs']){
    const expanded=structuredClone(packageJson);mutate(expanded);assert.equal(evaluate(expanded).ok,false);
  }
  assert.equal(evaluate(packageJson,{...admission,carrierSha256:'0'.repeat(64)}).ok,false);
  assert.equal(evaluate(packageJson,admission,['package.json','package-lock.json','pnpm-lock.yaml']).ok,false);
});

test('PK0 repository security successor refuses altered carrier package lock hook and missing admission', async t=>{
  const module=await loadModule(),fs=require('node:fs'),os=require('node:os');
  const historicalRoot=securityFilesystemFixture(t,module,true);
  assert.deepEqual(module.readWordMacDependencySecurityAdmission(historicalRoot),module.WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'word-mac-security-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const carrierPath=module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH;
  const carrier=JSON.parse(fs.readFileSync(path.join(ROOT,carrierPath),'utf8'));
  const gitDir=require('node:child_process').execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:ROOT,encoding:'utf8'}).trim();
  fs.writeFileSync(path.join(temp,'.git'),`gitdir: ${gitDir}\n`);
  const files=[carrierPath,...Object.keys(carrier.currentFiles)];
  for(const relative of files){fs.mkdirSync(path.dirname(path.join(temp,relative)),{recursive:true});fs.copyFileSync(path.join(historicalRoot,relative),path.join(temp,relative));}
  assert.ok(module.readWordMacDependencySecurityAdmission(temp));
  for(const relative of files){const target=path.join(temp,relative),before=fs.readFileSync(target);fs.appendFileSync(target,' ');assert.equal(module.readWordMacDependencySecurityAdmission(temp),null,relative);fs.writeFileSync(target,before);}
  fs.unlinkSync(path.join(temp,carrierPath));assert.equal(module.readWordMacDependencySecurityAdmission(temp),null);
});

test('PK0 recognizes only the exact squash lineage and retains all candidate byte guards', async () => {
  const module = await loadModule(), cp = require('node:child_process');
  const original = module.WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION.baseSha;
  const squash = 'be11163f98ad992d9f522c4f3e40e2d1361e016d';
  const parent = 'e4be0d8d22937745f691dc6121541278668139ed';
  const real = args => cp.execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const carrier = JSON.parse(real(['show', `${squash}:${module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH}`]));
  let fault = null;
  const git = args => {
    // Model a fresh main clone in which the branch-only admission commit is absent.
    if (args.some(arg => arg.includes(original))) throw Error('MISSING_BRANCH_OBJECT');
    if (fault === 'ancestry' && args[0] === 'merge-base') throw Error('NOT_ANCESTOR');
    if (fault === 'tree' && args[0] === 'rev-parse' && args[1] === `${squash}^{tree}`) return '0'.repeat(40);
    if (fault === 'parentTree' && args[0] === 'rev-parse' && args[1] === `${parent}^{tree}`) return '0'.repeat(40);
    if (fault === 'parent' && args.includes('--format=%P')) return `${parent} ${original}`;
    const bytes = real(args);
    if (fault === args[1] && args[0] === 'show') return Buffer.concat([bytes, Buffer.from(' ')]);
    return bytes;
  };
  assert.deepEqual(module.readWordMacDependencySecurityCandidate({ candidateSha: squash, git }), carrier);
  for (const failure of ['ancestry', 'tree', 'parent', 'parentTree',
    `${squash}:${module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH}`,
    ...Object.keys(carrier.currentFiles).map(p => `${squash}:${p}`),
    ...Object.keys(carrier.previousFiles).map(p => `${parent}:${p}`)]) {
    fault = failure;
    assert.equal(module.readWordMacDependencySecurityCandidate({ candidateSha: squash, git }), null, failure);
  }
  fault = null;
  const branchCandidate = 'a'.repeat(40);
  const branchGit = args => {
    if (args[0] === 'rev-parse' && args[1] === branchCandidate) return branchCandidate;
    if (args[0] === 'merge-base') { assert.deepEqual(args.slice(1), ['--is-ancestor', original, branchCandidate]); return ''; }
    return real(args.map(arg => arg.replace(`${branchCandidate}:`, `${squash}:`).replace(`${original}:`, `${parent}:`)));
  };
  assert.ok(module.readWordMacDependencySecurityCandidate({ candidateSha: branchCandidate, git: branchGit }), 'original ancestry route remains valid without requiring orphan objects in the test checkout');
  const descendant = 'd'.repeat(40);
  const descendantGit = args => {
    if (args[0] === 'rev-parse' && args[1] === descendant) return descendant;
    if (args[0] === 'merge-base' && args[2] === squash && args[3] === descendant) return '';
    return git(args.map(arg => arg.replace(`${descendant}:`, `${squash}:`)));
  };
  assert.ok(module.readWordMacDependencySecurityCandidate({ candidateSha: descendant, git: descendantGit }), 'descendants retain only the exact pinned squash authority');
});

test('PK0 filesystem reader supports a main clone without the branch admission object and refuses false squash ancestry', async t => {
  const fs = require('node:fs'), os = require('node:os'), cp = require('node:child_process');
  const historicalRoot = securityFilesystemFixture(t, await loadModule(), true);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'word-squash-git-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const preload = path.join(directory, 'git-boundary.cjs');
  const original = '89d9991331013c26b724e3cbb17ea3faa7d058e9';
  // Patch only the isolated child's process boundary before the production ESM
  // import. All non-faulted calls still execute the actual platform Git binary.
  fs.writeFileSync(preload, `const cp=require('node:child_process');
const real=cp.spawnSync;
cp.spawnSync=function(command,args,options){
 if(command==='git' && (args.some(arg=>arg.includes('${original}')) ||
   (process.env.YALKEN_TEST_SQUASH_BAD_ANCESTRY==='1' && args[0]==='merge-base')))
   return {status:1,stdout:Buffer.alloc(0),stderr:Buffer.from('MISSING_OR_NONANCESTOR')};
 return real.call(this,command,args,options);
};
require('node:module').syncBuiltinESMExports();
`);
  const moduleUrl = require('node:url').pathToFileURL(path.join(ROOT, 'scripts/ops/r24/package-content-trust-pk0.mjs')).href;
  const probe = `import {readWordMacDependencySecurityAdmission} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(Boolean(readWordMacDependencySecurityAdmission(process.cwd()))));`;
  const run = invalid => cp.execFileSync(process.execPath, ['--require', preload, '--input-type=module', '-e', probe], {
    cwd: historicalRoot, encoding: 'utf8', env: { ...process.env, YALKEN_TEST_SQUASH_BAD_ANCESTRY: invalid ? '1' : '0' },
  }).trim();
  assert.equal(run(false), 'true');
  assert.equal(run(true), 'false');
});

test('PK0 current V2 admits only the exact four approved pins and cannot substitute V1 authority', async () => {
  const module = await loadModule(), fs = require('node:fs');
  const admission = module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION;
  const baselinePackageJson = JSON.parse(securityGit(['show', `${SECURITY_M2}:package.json`]));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json')));
  const evaluate = (pkg, candidate = admission, changedFiles = ['package.json', 'package-lock.json']) => module.evaluatePackageContentTrust({
    packageJson: pkg, baselinePackageJson, trackedFiles: trackedFixture(), changedFiles,
    dependencyMutationAdmission: candidate, currentWordMacSecuritySuccessorRequired: true,
    programDag: programDagFixture(), scientificContracts: scientificContractsFixture(),
  });
  assert.equal(evaluate(packageJson).ok, true);
  for (const mutate of [p => p.devDependencies.electron = '41.10.6', p => p.devDependencies.electron = '43.8.5',
    p => p.devDependencies.electron = '^43.8.4', p => p.overrides['undici@^6'] = '6.28.1',
    p => p.overrides['undici@^7'] = '7.29.1', p => p.overrides['fast-uri'] = '4.1.5',
    p => p.dependencies.unapproved = '1.0.0', p => p.overrides.tar = '7.5.23',
    p => p.engines.node = '>=24', p => p.scripts.install = 'unapproved', p => p.build.extends = './unapproved.cjs']) {
    const expanded = structuredClone(packageJson); mutate(expanded); assert.equal(evaluate(expanded).ok, false);
  }
  for (const candidate of [null, module.WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION,
    { ...admission, carrierSha256: '0'.repeat(64) }, { ...admission, baseSha: 'a'.repeat(40) },
    { ...admission, targetElectronVersion: '43.8.5' }]) assert.equal(evaluate(packageJson, candidate).ok, false);
  assert.equal(evaluate(packageJson, admission, ['package.json', 'package-lock.json', 'pnpm-lock.yaml']).ok, false);
});

test('PK0 current filesystem admission consumes exact V2, predecessor and all five physical inputs', async t => {
  const module = await loadModule(), fs = require('node:fs'), crypto = require('node:crypto');
  assert.deepEqual(module.readCurrentWordMacDependencySecurityAdmission(ROOT), module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_MUTATION_ADMISSION);
  const root = securityFilesystemFixture(t, module);
  const relative = module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH, target = path.join(root, relative);
  const bytes = fs.readFileSync(target), carrier = JSON.parse(bytes);
  const files = [relative, module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH, ...Object.keys(carrier.currentFiles)];
  assert.ok(module.readCurrentWordMacDependencySecurityAdmission(root));
  for (const file of files) {
    const name = path.join(root, file), original = fs.readFileSync(name);
    fs.appendFileSync(name, ' '); assert.equal(module.readCurrentWordMacDependencySecurityAdmission(root), null, file);
    fs.writeFileSync(name, original); assert.ok(module.readCurrentWordMacDependencySecurityAdmission(root));
  }
  for (const mutate of [c => c.authority.ownerAuthorizationSha256 = '0'.repeat(64),
    c => c.baseTree = '0'.repeat(40), c => c.predecessor.sha256 = '0'.repeat(64),
    c => c.transition.overrides.after['undici@^7'] = '7.29.1', c => c.currentFiles['outside.txt'] = '0'.repeat(64),
    c => c.previousFiles['package.json'] = '0'.repeat(64), c => c.claims.testsPassed = true]) {
    const forged = structuredClone(carrier); mutate(forged); fs.writeFileSync(target, JSON.stringify(forged));
    assert.equal(module.readCurrentWordMacDependencySecurityAdmission(root), null); fs.writeFileSync(target, bytes);
  }
  const packagePath = path.join(root, 'package.json'), packageBytes = fs.readFileSync(packagePath);
  const packageJson = JSON.parse(packageBytes); packageJson.devDependencies.electron = '43.8.5';
  const forgedPackage = Buffer.from(JSON.stringify(packageJson)); fs.writeFileSync(packagePath, forgedPackage);
  const coordinated = structuredClone(carrier); coordinated.currentFiles['package.json'] = crypto.createHash('sha256').update(forgedPackage).digest('hex');
  fs.writeFileSync(target, JSON.stringify(coordinated)); assert.equal(module.readCurrentWordMacDependencySecurityAdmission(root), null, 'coordinated input and carrier forgery');
  fs.writeFileSync(packagePath, packageBytes); fs.writeFileSync(target, bytes);
  fs.unlinkSync(target); assert.equal(module.readCurrentWordMacDependencySecurityAdmission(root), null, 'missing V2 cannot fall back');
});

test('PK0 current candidate requires exact M2 ancestry and complete historical-to-current chain', async () => {
  const module = await loadModule(), fs = require('node:fs');
  const current = String(securityGit(['rev-parse', 'HEAD'])).trim();
  const carrierPath = module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH;
  const predecessorPath = module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH;
  const carrier = JSON.parse(fs.readFileSync(path.join(ROOT, carrierPath)));
  let fault = null;
  const git = args => {
    if (fault === 'ancestry' && args[0] === 'merge-base' && args[2] === SECURITY_M2 && args[3] === current) throw Error('NOT_ANCESTOR');
    if (fault === 'tree' && args[0] === 'rev-parse' && args[1] === `${SECURITY_M2}^{tree}`) return '0'.repeat(40);
    if (fault === 'historical-lineage' && args[0] === 'merge-base' && args[3] === SECURITY_M2 && args[2] !== current) throw Error('FALSE_PREDECESSOR_ANCESTRY');
    let bytes;
    if (args[0] === 'show' && args[1].startsWith(current + ':')) bytes = fs.readFileSync(path.join(ROOT, args[1].slice(41)));
    else bytes = securityGit(args);
    return args[0] === 'show' && args[1] === fault ? Buffer.concat([Buffer.from(bytes), Buffer.from(' ')]) : bytes;
  };
  assert.deepEqual(module.readCurrentWordMacDependencySecurityCandidate({ candidateSha: current, git }), carrier);
  assert.deepEqual(module.resolveWordMacDependencySecurityCandidate({ candidateSha: current, git }), carrier);
  for (const failure of ['ancestry', 'tree', 'historical-lineage', `${SECURITY_M2}:${predecessorPath}`,
    ...Object.keys(carrier.previousFiles).map(p => `${SECURITY_M2}:${p}`),
    ...[carrierPath, predecessorPath, ...Object.keys(carrier.currentFiles)].map(p => `${current}:${p}`)]) {
    fault = failure;
    assert.equal(module.readCurrentWordMacDependencySecurityCandidate({ candidateSha: current, git }), null, failure);
    assert.equal(module.resolveWordMacDependencySecurityCandidate({ candidateSha: current, git }), null, failure);
  }
  fault = null;
  assert.ok(module.resolveWordMacDependencySecurityCandidate({ candidateSha: SECURITY_M2, git: securityGit }), 'explicit historical M2 replay remains valid');
  const downgraded = args => {
    if (args[0] === 'show' && args[1].startsWith(current + ':')) {
      if (args[1] === `${current}:${carrierPath}`) throw Error('MISSING_V2');
      return securityGit(['show', `${SECURITY_M2}:${args[1].slice(41)}`]);
    }
    return securityGit(args);
  };
  assert.ok(module.readWordMacDependencySecurityCandidate({ candidateSha: current, git: downgraded }), 'fixture proves V1 alone would be accepted by the historical reader');
  assert.equal(module.resolveWordMacDependencySecurityCandidate({ candidateSha: current, git: downgraded }), null, 'current resolver must not use otherwise valid historical V1 as fallback');
});

test('PK0 resolved bridge admits only the pinned predecessor hashes and designated protected paths', async () => {
  const module = await loadModule(), fs = require('node:fs');
  const carrier = JSON.parse(fs.readFileSync(path.join(ROOT, module.CURRENT_WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH)));
  const historical = JSON.parse(securityGit(['show', `${SECURITY_M2}:${module.WORD_MAC_DEPENDENCY_SECURITY_SUCCESSOR_PATH}`]));
  for (const relative of ['package.json', 'package-lock.json', 'scripts/ops/rtk-interop-order-c1.mjs', 'scripts/ops/rtk-interop-text-order-c1.mjs']) {
    for (const sha256 of [historical.previousFiles[relative], carrier.previousFiles[relative]])
      assert.equal(module.admitsResolvedWordMacSecurityProtectedBinding({ path: relative, sha256 }, carrier.currentFiles[relative], carrier), true);
    assert.equal(module.admitsResolvedWordMacSecurityProtectedBinding({ path: relative, sha256: '0'.repeat(64) }, carrier.currentFiles[relative], carrier), false);
    assert.equal(module.admitsResolvedWordMacSecurityProtectedBinding({ path: relative, sha256: carrier.previousFiles[relative] }, '0'.repeat(64), carrier), false);
  }
  for (const relative of ['outside.txt', 'scripts/electron-download-config.cjs', 'src/main.js']) {
    assert.equal(module.admitsResolvedWordMacSecurityProtectedBinding({ path: relative, sha256: carrier.previousFiles[relative] }, carrier.currentFiles[relative], carrier), false);
    assert.equal(module.admitsResolvedWordMacSecurityChecker(relative, carrier.currentFiles[relative], carrier), false);
  }
  for (const relative of ['scripts/ops/rtk-interop-order-c1.mjs', 'scripts/ops/rtk-interop-text-order-c1.mjs']) {
    assert.equal(module.admitsResolvedWordMacSecurityChecker(relative, carrier.currentFiles[relative], carrier), true);
    const forged = structuredClone(carrier); forged.currentFiles[relative] = '0'.repeat(64);
    assert.equal(module.admitsResolvedWordMacSecurityChecker(relative, '0'.repeat(64), forged), false);
  }
});
