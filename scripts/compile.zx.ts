import path from 'path';
import { $, chalk, os, which, within } from 'zx';

import { name } from '../package.json';

const BUILD_DIR = path.join(__dirname, '../build');

async function main() {
  console.log(chalk.blue('Cleaning build directory...'));
  await $`rm -rf ${BUILD_DIR}`;
  await $`mkdir -p ${BUILD_DIR}`;

  console.log(chalk.blue(`Compiling ${name}...`));
  await Promise.all([
    $`npx pkg --public dist/server.js -c package.json -t "node18-macos-arm64" -o ${path.join(BUILD_DIR, name)}-macos-arm64`,
    $`npx pkg --public dist/server.js -c package.json -t "node18-macos-x64" -o ${path.join(BUILD_DIR, name)}-macos-x64`,
    $`npx pkg --public dist/server.js -c package.json -t "node18-linux-x64" -o ${path.join(BUILD_DIR, 'linux', 'pcs')}`,
    $`npx pkg --public dist/server.js -c package.json -t "node18-win-x64" -o ${path.join(BUILD_DIR, 'win', 'pcs.exe')}`
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

  within(async () => {
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

  console.log(chalk.green(`Compiled ${name} successfully.`));
}

main().catch(err => {
  console.error(chalk.red(err));
  process.exit(1);
});
