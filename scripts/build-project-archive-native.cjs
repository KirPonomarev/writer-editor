'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const SOURCE = path.join(__dirname, '..', 'src', 'platform', 'darwin', 'projectArchiveFilesystem.c');
function buildProjectArchiveNative({ outputPath = path.join(__dirname, '..', 'dist', 'native', 'project-archive-fs'), arch = process.arch,
  runCommand = spawnSync } = {}) {
  if (process.platform !== 'darwin') return { available: false, reason: 'DARWIN_ONLY' };
  if (!['arm64','x64'].includes(arch) || !path.isAbsolute(outputPath)) throw Error('ARCHIVE_NATIVE_BUILD_TARGET_INVALID');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = runCommand('/usr/bin/clang', ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-arch', arch === 'x64' ? 'x86_64' : arch,
    '-mmacosx-version-min=12.0', SOURCE, '-o', outputPath], { encoding: 'utf8', timeout: 60000,
    env: { PATH: '/usr/bin:/bin', TMPDIR: process.env.TMPDIR || '/private/tmp' } });
  if (result.error || result.status !== 0) throw Error('ARCHIVE_NATIVE_BUILD_FAILED: ' + (result.error?.message || result.stderr || 'compiler failure'));
  fs.chmodSync(outputPath, 0o755);
  return { available: true, arch, outputPath, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex'),
    binarySha256: crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex') };
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !path.isAbsolute(args[1]))) throw Error('ARCHIVE_NATIVE_BUILD_ARGUMENTS');
  process.stdout.write(JSON.stringify(buildProjectArchiveNative(args.length ? { outputPath: args[1] } : {})) + '\n');
}
module.exports = { buildProjectArchiveNative };
