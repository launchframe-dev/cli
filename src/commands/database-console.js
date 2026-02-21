const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { spawnSync } = require('child_process');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

async function databaseConsole({ remote = false } = {}) {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  if (remote) {
    // 1. Check deployment is configured
    const config = getProjectConfig();

    if (!config.deployConfigured || !config.deployment) {
      console.error(chalk.red('\n❌ Deployment is not configured.'));
      console.log(chalk.gray('Run deploy:configure first.\n'));
      process.exit(1);
    }

    const { vpsUser, vpsHost, vpsAppFolder } = config.deployment;

    // 2. Warn before connecting to production
    console.log(chalk.yellow.bold('\n⚠️  You are about to connect to the PRODUCTION database.\n'));
    console.log(chalk.gray(`  Host: ${vpsHost}`));
    console.log(chalk.gray(`  Folder: ${vpsAppFolder}\n`));

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to open a console to the production database?',
        default: false
      }
    ]);

    if (!confirmed) {
      console.log(chalk.gray('\nAborted.\n'));
      process.exit(0);
    }

    console.log(chalk.blue.bold('\n🔌 Connecting to production database...\n'));

    // 3. Let the shell inside the container expand $POSTGRES_USER / $POSTGRES_DB.
    //    Pass the remote command as a single ssh argument (spawnSync array form)
    //    so the local shell never touches it.
    const remoteCmd = `cd ${vpsAppFolder}/infrastructure && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -it database sh -c 'psql -U $POSTGRES_USER $POSTGRES_DB'`;

    const result = spawnSync('ssh', ['-t', `${vpsUser}@${vpsHost}`, remoteCmd], { stdio: 'inherit' });

    if (result.status !== 0) {
      console.error(chalk.red('\n❌ Could not connect to the production database.'));
      console.log(chalk.gray('Check that the VPS is reachable and services are running.\n'));
      process.exit(1);
    }
  } else {
    console.log(chalk.blue.bold('\n🗄️  Opening local database console...\n'));

    // Let the shell inside the container expand $POSTGRES_USER / $POSTGRES_DB
    const psqlCmd = [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'exec', 'database', 'sh', '-c', 'psql -U $POSTGRES_USER $POSTGRES_DB'
    ];

    const result = spawnSync('docker', psqlCmd, { cwd: infrastructurePath, stdio: 'inherit' });

    if (result.status !== 0) {
      console.error(chalk.red('\n❌ Could not connect to the local database container.'));
      console.log(chalk.gray('Make sure services are running:'));
      console.log(chalk.white('  launchframe docker:up\n'));
      process.exit(1);
    }
  }
}

module.exports = { databaseConsole };
