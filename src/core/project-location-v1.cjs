'use strict';

const LOCATION_FILENAME = '.yalken-location.v1.json';
const LOCATION_SCHEMA = 'yalken.project-location.v1';
const MAX_LOCATION_BYTES = 16384;
// No ambient filesystem, platform-path or hashing authority. The existing
// persistence owner supplies these ports; the binding only confines their use.
function createProjectLocationAdapter({ fsAdapter: defaultFsAdapter, path, sha256 }) {
  const adapters = new WeakMap();
  const failure = code => Object.assign(new Error(code), { code });
  const need = (condition, code = 'E_PROJECT_LOCATION_INVALID') => { if (!condition) throw failure(code); };
  need(defaultFsAdapter && typeof defaultFsAdapter.lstat === 'function' && typeof defaultFsAdapter.readFile === 'function' && path && typeof path.relative === 'function'
    && typeof sha256 === 'function', 'E_PROJECT_LOCATION_PORT');
  const locationPathFor = manifestPath => path.join(path.dirname(manifestPath), LOCATION_FILENAME);
  const sameFile = (a, b) => ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink'].every(key => a[key] === b[key]);
  const absolute = value => typeof value === 'string' && value.length <= 4096 && !value.includes('\0')
    && path.isAbsolute(value) && path.resolve(value) === value && value !== path.parse(value).root;

  function within(root, target) {
    need(absolute(target), 'E_PROJECT_LOCATION_PATH');
    const relative = path.relative(root, target);
    need(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'E_PROJECT_LOCATION_BOUNDARY');
    return relative;
  }

  function validateLocationRecord(value, manifestPath, projectId) {
    need(value && Object.getPrototypeOf(value) === Object.prototype
      && Object.keys(value).sort().join(',') === 'logicalManifestPath,physicalManifestPath,projectId,schemaVersion');
    need(value.schemaVersion === LOCATION_SCHEMA && typeof value.projectId === 'string'
      && value.projectId.length > 0 && value.projectId.length <= 1024 && !value.projectId.includes('\0')
      && (!projectId || value.projectId === projectId));
    need(absolute(value.logicalManifestPath) && absolute(value.physicalManifestPath)
      && value.physicalManifestPath === manifestPath
      && path.basename(value.logicalManifestPath) === path.basename(manifestPath));
    return Object.freeze({ ...value });
  }

  async function readLocationRecord(manifestPath, fsAdapter = defaultFsAdapter) {
    const target = locationPathFor(manifestPath);
    let stat;
    try { stat = await fsAdapter.lstat(target); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    need(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= MAX_LOCATION_BYTES);
    const bytes = await fsAdapter.readFile(target);
    need(Buffer.isBuffer(bytes) && bytes.length <= MAX_LOCATION_BYTES && sameFile(stat, await fsAdapter.lstat(target)));
    const text = bytes.toString('utf8');
    need(Buffer.from(text, 'utf8').equals(bytes));
    let value;
    try { value = JSON.parse(text); } catch { throw failure('E_PROJECT_LOCATION_INVALID'); }
    return { text, stat, value };
  }

  // Absolute historical names are a transaction namespace, never I/O authority.
  // Only the caller's current project root is accessed. A different location is
  // admitted by the leased Main lifecycle, not inferred from a retained packet.
  async function getProjectLocation({ manifestPath, projectId, fsAdapter = defaultFsAdapter }) {
    need(absolute(manifestPath), 'E_PROJECT_LOCATION_PATH');
    const physicalRoot = path.dirname(manifestPath);
    const disk = await readLocationRecord(manifestPath, fsAdapter);
    if (!disk) return Object.freeze({ bound: false, manifestPath, physicalManifestPath: manifestPath,
      logicalRoot: physicalRoot, physicalRoot, bindingText: null, fsAdapter,
      toLogical: target => { within(physicalRoot, target); return target; },
      toPhysical: target => { within(physicalRoot, target); return target; },
      assertCurrent: async () => need(await readLocationRecord(manifestPath, fsAdapter) === null, 'E_PROJECT_LOCATION_STALE') });
    const rootStat = await fsAdapter.lstat(physicalRoot);
    need(rootStat.isDirectory() && !rootStat.isSymbolicLink()
      && await fsAdapter.realpath(physicalRoot) === physicalRoot, 'E_PROJECT_LOCATION_BOUNDARY');
    const manifestStat = await fsAdapter.lstat(manifestPath);
    need(manifestStat.isFile() && !manifestStat.isSymbolicLink() && manifestStat.nlink === 1
      && manifestStat.size <= 32 * 1024 * 1024, 'E_PROJECT_LOCATION_PROJECT');
    let manifest;
    try { manifest = JSON.parse(await fsAdapter.readFile(manifestPath, 'utf8')); }
    catch { throw failure('E_PROJECT_LOCATION_PROJECT'); }
    need(typeof manifest?.projectId === 'string' && (!projectId || manifest.projectId === projectId), 'E_PROJECT_LOCATION_PROJECT');
    const record = validateLocationRecord(disk.value, manifestPath, manifest.projectId);
    const logicalRoot = path.dirname(record.logicalManifestPath);
    const toPhysical = target => path.join(physicalRoot, within(logicalRoot, target));
    const toLogical = target => path.join(logicalRoot, within(physicalRoot, target));
    const bindingPath = locationPathFor(manifestPath);
    async function assertCurrent(checkBytes = true) {
      try {
        const currentRoot = await fsAdapter.lstat(physicalRoot), current = await fsAdapter.lstat(bindingPath);
        need(currentRoot.isDirectory() && !currentRoot.isSymbolicLink() && rootStat.dev === currentRoot.dev
          && rootStat.ino === currentRoot.ino && current.isFile() && !current.isSymbolicLink()
          && sameFile(disk.stat, current), 'E_PROJECT_LOCATION_STALE');
        if (checkBytes) need(await fsAdapter.readFile(bindingPath, 'utf8') === disk.text
          && await fsAdapter.realpath(physicalRoot) === physicalRoot, 'E_PROJECT_LOCATION_STALE');
      } catch (error) {
        if (error.code === 'ENOENT') throw failure('E_PROJECT_LOCATION_STALE');
        throw error;
      }
    }
    async function checkPath(target) {
      const relative = within(physicalRoot, target);
      await assertCurrent(false);
      let at = physicalRoot;
      for (const component of relative ? relative.split(path.sep) : []) {
        at = path.join(at, component);
        let stat;
        try { stat = await fsAdapter.lstat(at); }
        catch (error) { if (error.code === 'ENOENT') break; throw error; }
        need(!stat.isSymbolicLink() && (at === target || stat.isDirectory()), 'E_PROJECT_LOCATION_BOUNDARY');
      }
      return target;
    }
    function makeAdapter(translate) {
      const mapped = {};
      for (const name of ['readFile', 'writeFile', 'lstat', 'stat', 'readdir', 'access', 'open', 'mkdir', 'unlink', 'rmdir']) {
        mapped[name] = async (target, ...args) => {
          const physical = await checkPath(translate(target));
          const writingOpen = name === 'open' && !['r', 'rs', 'sr', 0].includes(args[0]);
          if (writingOpen || ['writeFile', 'mkdir', 'unlink', 'rmdir'].includes(name)) need(physical !== physicalRoot && physical !== bindingPath, 'E_PROJECT_LOCATION_BOUNDARY');
          return fsAdapter[name](physical, ...args);
        };
      }
      for (const name of ['rename', 'link']) mapped[name] = async (from, to, ...args) => {
        const a = await checkPath(translate(from)), b = await checkPath(translate(to));
        need(a !== physicalRoot && b !== physicalRoot && a !== bindingPath && b !== bindingPath, 'E_PROJECT_LOCATION_BOUNDARY');
        await assertCurrent();
        return fsAdapter[name](a, b, ...args);
      };
      mapped.realpath = async target => toLogical(await fsAdapter.realpath(await checkPath(translate(target))));
      mapped.syncDirectory = async target => {
        const directory = await checkPath(translate(target));
        const handle = await fsAdapter.open(directory, 'r');
        try { await handle.sync(); } finally { await handle.close(); }
      };
      return Object.freeze(mapped);
    }
    const logicalAdapter = makeAdapter(toPhysical), physicalAdapter = makeAdapter(target => { within(physicalRoot, target); return target; });
    const location = Object.freeze({ bound: true, record, manifestPath: record.logicalManifestPath,
      physicalManifestPath: manifestPath, physicalRoot, logicalRoot, bindingText: disk.text,
      toPhysical, toLogical, assertCurrent, fsAdapter: logicalAdapter, physicalAdapter });
    adapters.set(logicalAdapter, location);
    await assertCurrent();
    return location;
  }

  function createLocationRecord(location, projectId, targetManifestPath) {
    need(absolute(targetManifestPath) && path.basename(targetManifestPath) === path.basename(location.manifestPath));
    return validateLocationRecord({ schemaVersion: LOCATION_SCHEMA, projectId,
      logicalManifestPath: location.manifestPath, physicalManifestPath: targetManifestPath }, targetManifestPath, projectId);
  }

  // The save coordinator's cleanup uses physical filenames. Keep that contract;
  // only the transaction's stored payloads retain their logical namespace.
  function bindDurableSave(operation, options) {
    const location = adapters.get(options.fsAdapter);
    return operation(location ? { ...options, filePath: location.toPhysical(options.filePath), fsAdapter: location.physicalAdapter } : options);
  }

  function physicalRecord(record, location) {
    return Object.freeze({ ...record,
      ...(record.scenePath ? { scenePath: location.toPhysical(record.scenePath) } : {}),
      ...(record.manifestPath ? { manifestPath: location.toPhysical(record.manifestPath) } : {}),
      ...(record.resources ? { resources: Object.freeze(record.resources.map(entry => Object.freeze({ ...entry, path: location.toPhysical(entry.path) }))) } : {}) });
  }

  function bindTransaction(operation, resultKind = '', ownInput = null) {
    return async options => {
      // Preserve call-time input ownership before location lookup adds any await.
      options = ownInput ? ownInput(options) : options && { ...options,
        ...(Array.isArray(options.scenePaths) ? { scenePaths: [...options.scenePaths] } : {}) };
      // Keep the original invalid-input diagnostics on the old API.
      if (!options || typeof options.manifestPath !== 'string' || !path.isAbsolute(options.manifestPath)) return operation(options);
      const location = await getProjectLocation(options);
      const next = location.bound ? { ...options, manifestPath: location.manifestPath, fsAdapter: location.fsAdapter } : { ...options };
      if (location.bound) {
        if (options.scenePath !== undefined) next.scenePath = location.toLogical(options.scenePath);
        if (options.scenePaths !== undefined) next.scenePaths = options.scenePaths.map(location.toLogical);
        for (const key of ['createResources', 'mediaUpdateResources']) if (options[key] !== undefined) {
          need(Array.isArray(options[key]), 'E_PROJECT_LOCATION_RESOURCES');
          next[key] = options[key].map(entry => ({ ...entry, path: location.toLogical(entry.path) }));
        }
      }
      if (typeof options.revalidate === 'function') next.revalidate = async (...args) => { await location.assertCurrent(); return options.revalidate(...args); };
      if (typeof options.publishManifest === 'function') next.publishManifest = async request => {
        await location.assertCurrent();
        const result = await options.publishManifest({ ...request, manifestPath: location.toPhysical(request.manifestPath) });
        await location.assertCurrent();
        return result;
      };
      const result = await operation(next);
      await location.assertCurrent();
      if (!location.bound) return result;
      const treeState = value => Object.freeze({ ...value, transactionManifestPath: location.manifestPath });
      if (resultKind === 'tree') return treeState(result);
      if (resultKind === 'recoverySnapshot') return Object.freeze({ ...result,
        projectRootDigest: sha256(location.physicalRoot) });
      if (resultKind === 'record') return physicalRecord(result, location);
      if (resultKind === 'cohort') return Object.freeze({ ...result, treeMutation: treeState(result.treeMutation),
        records: Object.freeze(result.records.map(record => physicalRecord(record, location))) });
      if (resultKind === 'lineage' && result) return Object.freeze({ ...result, treeMutation: treeState(result.treeMutation), scenePaths: Object.freeze(result.scenePaths.map(location.toPhysical)),
        originResource: Object.freeze({ ...result.originResource, path: location.toPhysical(result.originResource.path) }) });
      if (result?.wordHistory?.scenePaths) return { ...result, wordHistory: { ...result.wordHistory,
        scenePaths: result.wordHistory.scenePaths.map(location.toPhysical) } };
      if (resultKind === 'pending' && result.pending) return physicalRecord(result, location);
      return result;
    };
  }

  return Object.freeze({ LOCATION_FILENAME, LOCATION_SCHEMA, MAX_LOCATION_BYTES, locationPathFor,
    validateLocationRecord, readLocationRecord, getProjectLocation, createLocationRecord, bindDurableSave, bindTransaction });
}

module.exports = Object.freeze({ createProjectLocationAdapter, LOCATION_FILENAME, LOCATION_SCHEMA, MAX_LOCATION_BYTES });
