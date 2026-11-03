'use strict';

// Shared read-only prerequisites for the existing hard lane and unit caller.
function validateTestEnvironment({
  requiresDarwinAlias = false,
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  hostProcess = process,
  spawnSync = require('node:child_process').spawnSync,
} = {}) {
  const temporary = fs.realpathSync(os.tmpdir());
  const identity = fs.statSync(temporary);
  if (!identity.isDirectory()) throw new Error('Temporary path is not a directory');
  fs.accessSync(temporary, fs.constants.W_OK);
  if (hostProcess.platform === 'darwin' && requiresDarwinAlias) {
    if (!temporary.startsWith('/private/var/')) {
      throw new Error('Native Save alias tests require the genuine canonical macOS temporary ancestry before initialization');
    }
    if (typeof hostProcess.getuid === 'function' && identity.uid !== hostProcess.getuid()) {
      throw new Error('Native Save test temporary root must belong to the current user');
    }
    const actual = spawnSync('/usr/bin/getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8' });
    if (actual.error || actual.status !== 0 || !String(actual.stdout || '').trim()) {
      throw new Error('Cannot verify the genuine macOS temporary parent');
    }
    const parent = fs.realpathSync(String(actual.stdout).trim());
    const relative = path.relative(parent, temporary);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
      throw new Error('Native Save test TMP must be inside the genuine OS temporary parent');
    }
  }
  return temporary;
}
module.exports = { validateTestEnvironment };
