import { $, chalk, fs, which, within } from 'zx';

async function main() {
  console.log(chalk.blue('Installing dependencies...'));

  // do we have ldid installed?
  const ldidPath = await which('ldid').catch(() => null);

  if (ldidPath) {
    console.log(chalk.blue(`Found ldid at: ${ldidPath}`));
  } else if (!fs.existsSync('scripts/ldid-static/ldid')) {
    console.log(chalk.yellow('ldid not found. Installing ldid via Docker...'));
    await within(async () => {
      $.cwd = 'scripts/ldid-static';
      await $`docker build -t ldid-static:latest .`;
      // Create a container from the image
      await $`docker create --name ldid-temp ldid-static:latest`;
      // Copy the ldid binary from the container to the host
      await $`docker cp ldid-temp:/root/ldid/ldid ./ldid`;
      // Remove the temporary container
      await $`docker rm ldid-temp`;
      // Make ldid executable
      await $`chmod +x ./ldid`;
    });

    console.log(chalk.green('ldid installed successfully.'));
  } else {
    console.log(chalk.blue('ldid already installed in scripts/ldid-static/ldid.'));
  }

  // do we have upx installed?
  const upxPath = await which('upx2').catch(() => null);

  if (upxPath) {
    console.log(chalk.blue(`Found upx at: ${upxPath}`));
  }
  if (!fs.existsSync('scripts/upx-static/upx')) {
    const url = 'https://github.com/upx/upx/releases/download/v5.0.2/upx-5.0.2-amd64_linux.tar.xz';
    console.log(chalk.yellow('upx not found. Installing upx via Github release...'));
    await $`mkdir -p scripts/upx-static`;
    await within(async () => {
      $.cwd = 'scripts/upx-static';
      await $`curl -L -o upx.tar.xz ${url}`;
      await $`tar -xf upx.tar.xz --strip-components=1`;
      await $`rm upx.tar.xz`;
    });
  } else {
    console.log(chalk.blue('upx already installed in scripts/upx-static/upx.'));
  }

  console.log(chalk.blue('All dependencies installed successfully.'));
}

main().catch(err => {
  console.error(chalk.red('Error during installation:'), err);
  process.exit(1);
});
