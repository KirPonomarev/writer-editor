import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const cleanRoot = process.env.X102_CLEAN_ROOT || process.cwd();
const runtimeDir = process.env.X102_RUNTIME_DIR || path.join(cleanRoot, 'docs', 'OPS', 'STATUS', 'runtime', 'x102_capture');
const runtimePath = process.env.X102_RUNTIME_PATH || path.join(runtimeDir, 'runtime.json');
const stageLogPath = process.env.X102_STAGE_LOG_PATH || path.join(runtimeDir, 'helper.log');
const launcherLogPath = process.env.X102_HELPER_LOG_PATH || path.join(runtimeDir, 'launcher.log');
const captureOutDir = process.env.X102_CAPTURE_OUT_DIR || path.join(cleanRoot, 'docs', 'OPS', 'STATUS', 'assets', 'x102_visual_source');
const helperPath = path.join(cleanRoot, 'scripts', 'ops', 'x102-capture-helper.js');

fs.mkdirSync(runtimeDir, { recursive: true });
fs.writeFileSync(launcherLogPath, '');

function logLine(message) {
  fs.appendFileSync(launcherLogPath, `${message}\n`);
}

const requireFromRoot = createRequire(path.join(cleanRoot, 'package.json'));
let electronBinary = process.env.X102_ELECTRON_BIN || '';

if (!electronBinary) {
  try {
    electronBinary = requireFromRoot('electron');
  } catch {
    electronBinary = '';
  }
}

if (!electronBinary || !fs.existsSync(electronBinary)) {
  logLine('ELECTRON_BINARY_UNRESOLVED');
  process.exit(2);
}

if (!fs.existsSync(helperPath)) {
  logLine('HELPER_SCRIPT_MISSING');
  process.exit(3);
}

const env = {
  ...process.env,
  X102_CLEAN_ROOT: cleanRoot,
  X102_RUNTIME_PATH: runtimePath,
  X102_CAPTURE_OUT_DIR: captureOutDir,
  X102_STAGE_LOG_PATH: stageLogPath,
  X102_CLEAN_HEAD: process.env.X102_CLEAN_HEAD || '',
};
delete env.ELECTRON_RUN_AS_NODE;

logLine(`LAUNCH_MODE:ELECTRON_BINARY`);
logLine(`ELECTRON_BINARY:${electronBinary}`);
logLine(`HELPER_SCRIPT:${helperPath}`);

const result = spawnSync(electronBinary, [helperPath], {
  cwd: cleanRoot,
  env,
  encoding: 'utf8',
});

if (result.stdout) {
  logLine(`STDOUT_BEGIN`);
  fs.appendFileSync(launcherLogPath, result.stdout);
  logLine(`STDOUT_END`);
}
if (result.stderr) {
  logLine(`STDERR_BEGIN`);
  fs.appendFileSync(launcherLogPath, result.stderr);
  logLine(`STDERR_END`);
}
if (typeof result.status === 'number') {
  logLine(`STATUS:${result.status}`);
  process.exit(result.status);
}
if (result.signal) {
  logLine(`SIGNAL:${result.signal}`);
}
process.exit(1);
