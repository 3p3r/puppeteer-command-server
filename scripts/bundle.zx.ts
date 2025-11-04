import * as esbuild from 'esbuild';

esbuild
  .build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    outfile: 'dist/server.js',
    platform: 'node',
    format: 'cjs',
    mainFields: ['main', 'module'],
    external: [
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
      'puppeteer-extra-plugin-anonymize-ua',
      'puppeteer-extra-plugin-user-preferences'
    ],
    plugins: []
  })
  .catch(() => process.exit(1));
