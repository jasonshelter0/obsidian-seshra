import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view'],
  outfile: 'main.js',
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
