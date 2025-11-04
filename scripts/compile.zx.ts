import path from 'node:path';
import { os, $, chalk, which, within } from 'zx';

import { name } from '../package.json';

const BUILD_DIR = path.join(__dirname, '../build');

async function main() {
  console.log(chalk.blue('Cleaning build directory...'));
  await $`rm -rf ${BUILD_DIR}`;
  await $`mkdir -p ${BUILD_DIR}`;

  console.log(chalk.blue(`Compiling ${name}...`));
  await Promise.all([
    $`npx pkg --public dist/server.js -c package.json -C Brotli -t "node18-macos-arm64" -o ${path.join(BUILD_DIR, name)}-macos-arm64`,
    $`npx pkg --public dist/server.js -c package.json -C Brotli -t "node18-macos-x64" -o ${path.join(BUILD_DIR, name)}-macos-x64`,
    $`npx pkg --public dist/server.js -c package.json -C Brotli -t "node18-linux-x64" -o ${path.join(BUILD_DIR, 'linux', 'pcs')}`,
    $`npx pkg --public dist/server.js -c package.json -C Brotli -t "node18-win-x64" -o ${path.join(BUILD_DIR, 'win', 'pcs.exe')}`
  ]);

  async function findLipo() {
    const lipoPath = await Promise.race([
      which('lipo').catch(() => null),
      which('llvm-lipo').catch(() => null),
      which('llvm-lipo-13').catch(() => null),
      which('llvm-lipo-14').catch(() => null),
      which('llvm-lipo-15').catch(() => null),
      which('lipo.exe').catch(() => null)
    ]);
    return lipoPath;
  }

  const lipo = await findLipo();
  console.log(chalk.blue(`Found lipo at: ${lipo ?? 'not found'}`));

  await within(async () => {
    $.cwd = BUILD_DIR;
    if (lipo) {
      console.log(chalk.blue('Creating universal binary using lipo...'));
      await $`${lipo} -create -output ${name} ${name}-macos-arm64 ${name}-macos-x64`;
      await $`rm ${name}-macos-arm64 ${name}-macos-x64`;
      await $`mkdir -p mac`;
      await $`mv ${name} mac/pcs`;
    } else {
      throw new Error('lipo tool not found. Cannot create universal binary.');
    }
  });

  // Copy binaries to sig/build/ for Go embedding
  console.log(chalk.blue('Copying binaries to sig/build/ for Go embedding...'));
  const SIG_BUILD_DIR = path.join(__dirname, '../sig/build');
  await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'linux')}`;
  await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'mac')}`;
  await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'win')}`;
  await $`cp ${path.join(BUILD_DIR, 'linux', 'pcs')} ${path.join(SIG_BUILD_DIR, 'linux', 'pcs')}`;
  await $`cp ${path.join(BUILD_DIR, 'mac', 'pcs')} ${path.join(SIG_BUILD_DIR, 'mac', 'pcs')}`;
  await $`cp ${path.join(BUILD_DIR, 'win', 'pcs.exe')} ${path.join(SIG_BUILD_DIR, 'win', 'pcs.exe')}`;

  // Compile Go binaries for all platforms
  async function findGo() {
    const goPath = await which('go').catch(() => null);
    return goPath;
  }

  const go = await findGo();
  if (go) {
    console.log(chalk.blue(`Found Go at: ${go}`));
    console.log(chalk.blue('Compiling Go wrapper binaries...'));

    const SIG_BUILD_OUTPUT_DIR = path.join(BUILD_DIR, 'sig');
    await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}`;
    await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/linux`;
    await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/mac`;
    await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/win`;

    const repoRoot = path.join(__dirname, '..');

    // Build for Linux
    await within(async () => {
      $.cwd = repoRoot;
      await Promise.all([
        (async () => {
          console.log(chalk.blue('Building Go binary for Linux...'));
          await $`GOOS=linux GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'linux/sig')} ./sig`;
        })(),
        (async () => {
          console.log(chalk.blue('Building Go binary for macOS...'));
          // todo: use lipo here
          await $`GOOS=darwin GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'mac/sig')} ./sig`;
        })(),
        (async () => {
          console.log(chalk.blue('Building Go binary for Windows...'));
          await $`GOOS=windows GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'win/sig.exe')} ./sig`;
        })()
      ]);
    });

    console.log(chalk.green('Go wrapper binaries compiled successfully.'));
  } else {
    console.log(chalk.yellow('Go not found. Skipping Go wrapper compilation.'));
  }

  console.log(chalk.green(`Compiled ${name} successfully.`));

  // compress sig binaries with upx if available
  const upx = await which('upx').catch(() => null);
  if (upx) {
    console.log(chalk.blue('Compressing binaries with upx...'));
    const SIG_BUILD_OUTPUT_DIR = path.join(BUILD_DIR, 'sig');
    const MIN_BUILD_OUTPUT_DIR = path.join(BUILD_DIR, 'min');
    await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}`;
    await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/linux`;
    await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/mac`;
    await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/win`;

    await Promise.all([
      $`${upx} -9 ${path.join(SIG_BUILD_OUTPUT_DIR, 'linux', 'sig')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'linux', 'sig')}`,
      $`${upx} -9 ${path.join(SIG_BUILD_OUTPUT_DIR, 'mac', 'sig')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'mac', 'sig')} --force-macos`,
      $`${upx} -9 ${path.join(SIG_BUILD_OUTPUT_DIR, 'win', 'sig.exe')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'win', 'sig.exe')}`
    ]);
    console.log(chalk.green('Binaries compressed successfully.'));
  } else {
    console.log(chalk.yellow('upx not found. Skipping binary compression.'));
  }
}

main().catch(err => {
  console.error(chalk.red(err));
  process.exit(1);
});
