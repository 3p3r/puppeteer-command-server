import path from 'node:path';
import { $, chalk, which, within } from 'zx';

import { name } from '../package.json';

const BUILD_DIR = path.join(__dirname, '../build');

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const fastMode = args.includes('--fast');
  const buildWin = args.includes('--win');
  const buildMac = args.includes('--mac');
  const buildLinux = args.includes('--linux');
  const buildAll = !buildWin && !buildMac && !buildLinux;

  console.log(chalk.blue('Cleaning build directory...'));
  await $`rm -rf ${BUILD_DIR}`;
  await $`mkdir -p ${BUILD_DIR}`;

  console.log(chalk.blue(`Compiling ${name}...`));

  // Build compression flags based on fast mode
  const compressionArgs = fastMode ? [] : ['-C', 'Brotli'];

  // Build platform-specific binaries
  const pkgCommands = [];

  // add "scripts/ldid-static" and "scripts/upx-static" to PATH for pkg to find ldid and upx
  const upxPath = path.join(__dirname, 'upx-static');
  const ldidPath = path.join(__dirname, 'ldid-static');
  process.env.PATH = `${ldidPath}${path.delimiter}${upxPath}${path.delimiter}${process.env.PATH}`;

  if (buildMac || buildAll) {
    pkgCommands.push(
      $`npx pkg --public dist/server.js -c package.json ${compressionArgs} -t "node18-macos-arm64" -o ${path.join(BUILD_DIR, name)}-macos-arm64`,
      $`npx pkg --public dist/server.js -c package.json ${compressionArgs} -t "node18-macos-x64" -o ${path.join(BUILD_DIR, name)}-macos-x64`
    );
  }

  if (buildLinux || buildAll) {
    pkgCommands.push(
      $`npx pkg --public dist/server.js -c package.json ${compressionArgs} -t "node18-linux-x64" -o ${path.join(BUILD_DIR, 'linux', 'pcs')}`
    );
  }

  if (buildWin || buildAll) {
    pkgCommands.push(
      $`npx pkg --public dist/server.js -c package.json ${compressionArgs} -t "node18-win-x64" -o ${path.join(BUILD_DIR, 'win', 'pcs.exe')}`
    );
  }

  await Promise.all(pkgCommands);

  // Find upx early for macOS build process
  const upx = await which('upx').catch(() => null);
  const upxLevel = fastMode ? '-1' : '-9';

  // Process macOS binaries: upx individual binaries, then lipo
  if (buildMac || buildAll) {
    async function findLipo() {
      const lipoPath = await Promise.all([
        which('lipo').catch(() => null),
        which('llvm-lipo').catch(() => null),
        which('llvm-lipo-13').catch(() => null),
        which('llvm-lipo-14').catch(() => null),
        which('llvm-lipo-15').catch(() => null),
        which('lipo.exe').catch(() => null)
      ]).then(paths => paths.find(path => path !== null));
      return lipoPath;
    }

    const lipo = await findLipo();
    console.log(chalk.blue(`Found lipo at: ${lipo ?? 'not found'}`));

    await within(async () => {
      $.cwd = BUILD_DIR;

      // Apply upx to individual arch binaries before lipo
      if (upx) {
        console.log(chalk.blue(`Compressing individual macOS binaries with upx ${upxLevel}...`));
        await Promise.all([
          $`${upx} ${upxLevel} ${name}-macos-arm64 --force-macos`,
          $`${upx} ${upxLevel} ${name}-macos-x64 --force-macos`
        ]);
      }

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
  }

  // Copy binaries to sig/build/ for Go embedding
  console.log(chalk.blue('Copying binaries to sig/build/ for Go embedding...'));
  const SIG_BUILD_DIR = path.join(__dirname, '../sig/build');

  if (buildLinux || buildAll) {
    await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'linux')}`;
    await $`cp ${path.join(BUILD_DIR, 'linux', 'pcs')} ${path.join(SIG_BUILD_DIR, 'linux', 'pcs')}`;
  }

  if (buildMac || buildAll) {
    await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'mac')}`;
    await $`cp ${path.join(BUILD_DIR, 'mac', 'pcs')} ${path.join(SIG_BUILD_DIR, 'mac', 'pcs')}`;
  }

  if (buildWin || buildAll) {
    await $`mkdir -p ${path.join(SIG_BUILD_DIR, 'win')}`;
    await $`cp ${path.join(BUILD_DIR, 'win', 'pcs.exe')} ${path.join(SIG_BUILD_DIR, 'win', 'pcs.exe')}`;
  }

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

    if (buildLinux || buildAll) {
      await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/linux`;
    }
    if (buildMac || buildAll) {
      await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/mac`;
    }
    if (buildWin || buildAll) {
      await $`mkdir -p ${SIG_BUILD_OUTPUT_DIR}/win`;
    }

    const repoRoot = path.join(__dirname, '..');

    // Build for selected platforms
    await within(async () => {
      $.cwd = repoRoot;
      const goBuilds = [];

      if (buildLinux || buildAll) {
        goBuilds.push(
          (async () => {
            console.log(chalk.blue('Building Go binary for Linux...'));
            await $`GOOS=linux GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'linux/sig')} ./sig`;
          })()
        );
      }

      if (buildMac || buildAll) {
        goBuilds.push(
          (async () => {
            console.log(chalk.blue('Building Go binary for macOS...'));
            await $`GOOS=darwin GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'mac/sig')} ./sig`;
          })()
        );
      }

      if (buildWin || buildAll) {
        goBuilds.push(
          (async () => {
            console.log(chalk.blue('Building Go binary for Windows...'));
            await $`GOOS=windows GOARCH=amd64 ${go} build -o ${path.join(SIG_BUILD_OUTPUT_DIR, 'win/sig.exe')} ./sig`;
          })()
        );
      }

      await Promise.all(goBuilds);
    });

    console.log(chalk.green('Go wrapper binaries compiled successfully.'));
  } else {
    console.log(chalk.yellow('Go not found. Skipping Go wrapper compilation.'));
  }

  console.log(chalk.green(`Compiled ${name} successfully.`));

  // compress sig binaries with upx if available
  if (upx) {
    console.log(chalk.blue(`Compressing sig binaries with upx ${upxLevel}...`));
    const SIG_BUILD_OUTPUT_DIR = path.join(BUILD_DIR, 'sig');
    const MIN_BUILD_OUTPUT_DIR = path.join(BUILD_DIR, 'min');
    await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}`;

    const upxCommands = [];

    if (buildLinux || buildAll) {
      await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/linux`;
      upxCommands.push(
        $`${upx} ${upxLevel} ${path.join(SIG_BUILD_OUTPUT_DIR, 'linux', 'sig')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'linux', 'pcs')}`
      );
    }

    if (buildMac || buildAll) {
      await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/mac`;
      upxCommands.push(
        $`${upx} ${upxLevel} ${path.join(SIG_BUILD_OUTPUT_DIR, 'mac', 'sig')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'mac', 'pcs')} --force-macos`
      );
      // upxCommands.push(
      //   $`cp ${path.join(SIG_BUILD_OUTPUT_DIR, 'mac', 'sig')} ${path.join(MIN_BUILD_OUTPUT_DIR, 'mac', 'pcs')}`
      // );
    }

    if (buildWin || buildAll) {
      await $`mkdir -p ${MIN_BUILD_OUTPUT_DIR}/win`;
      upxCommands.push(
        $`${upx} ${upxLevel} ${path.join(SIG_BUILD_OUTPUT_DIR, 'win', 'sig.exe')} -o ${path.join(MIN_BUILD_OUTPUT_DIR, 'win', 'pcs.exe')}`
      );
    }

    await Promise.all(upxCommands);
    console.log(chalk.green('Binaries compressed successfully.'));
  } else {
    console.log(chalk.yellow('upx not found. Skipping binary compression.'));
  }
}

main().catch(err => {
  console.error(chalk.red(err));
  process.exit(1);
});
