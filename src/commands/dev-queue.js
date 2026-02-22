const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { spawnSync, spawn } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

async function devQueue() {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  // Check backend container is running
  const psResult = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'ps', '--status', 'running', '-q', 'backend'
    ],
    { cwd: infrastructurePath, encoding: 'utf8' }
  );

  if (!psResult.stdout || psResult.stdout.trim() === '') {
    console.error(chalk.red('\n❌ Backend container is not running.'));
    console.log(chalk.gray('Start local services first:'));
    console.log(chalk.white('  launchframe docker:up\n'));
    process.exit(1);
  }

  // Read BULL_ADMIN_TOKEN from backend container
  const tokenResult = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'exec', '-T', 'backend', 'sh', '-c', 'echo $BULL_ADMIN_TOKEN'
    ],
    { cwd: infrastructurePath, encoding: 'utf8' }
  );

  const token = (tokenResult.stdout || '').trim();

  if (!token) {
    console.error(chalk.red('\n❌ Could not read BULL_ADMIN_TOKEN from backend container.'));
    console.log(chalk.gray('Make sure the backend is fully started and BULL_ADMIN_TOKEN is set in your .env\n'));
    process.exit(1);
  }

  // Read BACKEND_PORT from backend container (fallback to 4000)
  const portResult = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'exec', '-T', 'backend', 'sh', '-c', 'echo $BACKEND_PORT'
    ],
    { cwd: infrastructurePath, encoding: 'utf8' }
  );

  const port = (portResult.stdout || '').trim() || '4000';

  const url = `http://localhost:${port}/admin/queues/${token}`;

  console.log(chalk.green('\n Opening Bull queue dashboard...'));
  console.log(chalk.gray(`  ${url}\n`));

  // Open URL with platform-appropriate command
  const platform = process.platform;
  let openCmd;
  if (platform === 'darwin') {
    openCmd = 'open';
  } else if (platform === 'win32') {
    openCmd = 'start';
  } else {
    openCmd = 'xdg-open';
  }

  const child = spawn(openCmd, [url], { detached: true, stdio: 'ignore' });
  child.unref();
}

module.exports = { devQueue };
