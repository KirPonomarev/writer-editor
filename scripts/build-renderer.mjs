import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const isWatch = process.argv.includes('--watch');
const projectRoot = process.cwd();
const entry = path.join(projectRoot, 'src', 'renderer', 'editor.js');
const outdir = path.join(projectRoot, 'dist', 'renderer');
const outfile = path.join(outdir, 'editor.bundle.js');
const runtimeOutfile = path.join(projectRoot, 'src', 'renderer', 'editor.bundle.js');
const require = createRequire(import.meta.url);

function listSharedSearchRoots() {
  const parentDir = path.dirname(projectRoot);
  const roots = [projectRoot];
  const preferredSiblingRoots = [
    path.join(parentDir, 'writer-editor-codex'),
    path.join(parentDir, 'writer-editor-contour-00ab-isolation-001'),
  ];

  for (const root of preferredSiblingRoots) {
    if (root !== projectRoot && fsSync.existsSync(root)) {
      roots.push(root);
    }
  }

  try {
    const siblingRoots = fsSync.readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('writer-editor'))
      .map((entry) => path.join(parentDir, entry.name));
    for (const root of siblingRoots) {
      if (!roots.includes(root)) {
        roots.push(root);
      }
    }
  } catch {
    // Ignore sibling discovery failures and fall back to explicit roots only.
  }

  return roots;
}

function resolveEsbuildModule() {
  for (const searchRoot of listSharedSearchRoots()) {
    try {
      const resolvedPath = require.resolve('esbuild', { paths: [searchRoot] });
      return require(resolvedPath);
    } catch {
      // Continue scanning sibling worktrees for the shared toolchain install.
    }
  }

  throw new Error('ESBUILD_MODULE_NOT_FOUND: install dependencies in this worktree or an adjacent shared worktree');
}

const esbuild = resolveEsbuildModule();
const sharedNodePaths = listSharedSearchRoots()
  .map((searchRoot) => path.join(searchRoot, 'node_modules'))
  .filter((nodeModulesPath, index, allPaths) => fsSync.existsSync(nodeModulesPath) && allPaths.indexOf(nodeModulesPath) === index);

await fs.mkdir(outdir, { recursive: true });

async function copyRuntimeBundle() {
  await fs.mkdir(path.dirname(runtimeOutfile), { recursive: true });
  await fs.copyFile(outfile, runtimeOutfile);
}

const buildOptions = {
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  minify: !isWatch,
  outfile,
  nodePaths: sharedNodePaths,
  sourcemap: isWatch ? 'external' : false,
  logLevel: 'info',
  plugins: [
    {
      name: 'runtime-bundle-copy',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length > 0) {
            return;
          }
          await copyRuntimeBundle();
        });
      }
    }
  ]
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[renderer] esbuild watch: ON');

  const dispose = () => {
    ctx.dispose().finally(() => process.exit(0));
  };

  process.on('SIGINT', dispose);
  process.on('SIGTERM', dispose);
} else {
  await esbuild.build(buildOptions);
}
