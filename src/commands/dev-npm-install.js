const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { requireProject } = require('../utils/project-helpers');

async function devNpmInstall(serviceName, packages = []) {
  requireProject();

  const servicePath = path.join(process.cwd(), serviceName);

  if (!fs.existsSync(servicePath)) {
    console.error(chalk.red(`\n❌ Error: directory "${serviceName}/" not found`));
    process.exit(1);
  }

  const pkgList = packages.length ? packages.join(' ') : '';
  const label = pkgList ? `Installing ${pkgList} in ${serviceName}` : `Running npm install in ${serviceName}`;
  console.log(chalk.blue.bold(`\n📦 ${label}\n`));
  console.log(chalk.gray('Using node:20-alpine to match Docker build environment...\n'));

  const npmArgs = pkgList ? `npm install ${pkgList}` : 'npm install';
  const cmd = `docker run --rm -v "${servicePath}":/app -w /app node:20-alpine ${npmArgs}`;
  console.log(chalk.gray(`Running: ${cmd}\n`));

  execSync(cmd, { stdio: 'inherit' });

  console.log(chalk.green.bold(`\n✅ Done! package-lock.json updated with node:20-alpine.\n`));
  console.log(chalk.white('Next: rebuild the service:'));
  console.log(chalk.gray(`  launchframe docker:build ${serviceName}\n`));
}

module.exports = { devNpmInstall };
