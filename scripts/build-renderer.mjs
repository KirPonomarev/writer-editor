import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

const isWatch = process.argv.includes('--watch');
const projectRoot = process.cwd();
const entry = path.join(projectRoot, 'src', 'renderer', 'editor.js');
const outdir = path.join(projectRoot, 'dist', 'renderer');
const outfile = path.join(outdir, 'editor.bundle.js');
const runtimeOutfile = path.join(projectRoot, 'src', 'renderer', 'editor.bundle.js');

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
