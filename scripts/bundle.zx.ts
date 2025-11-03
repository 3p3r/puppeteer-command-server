import * as esbuild from 'esbuild';

esbuild
  .build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    outfile: 'dist/server.js',
    platform: 'node',
    format: 'cjs',
    plugins: []
  })
  .catch(() => process.exit(1));
