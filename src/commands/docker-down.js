const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

/**
 * Stop all Docker services (keeps volumes/data)
 */
async function dockerDown() {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  console.log(chalk.blue.bold('\n🛑 Stopping Docker Services\n'));
  console.log(chalk.gray('Stopping all services (data will be preserved)...\n'));

  try {
    const downCommand = 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml down';

    console.log(chalk.gray(`Running: ${downCommand}\n`));

    execSync(downCommand, {
      cwd: infrastructurePath,
      stdio: 'inherit'
    });

    console.log(chalk.green.bold('\n✅ All services stopped successfully!\n'));
    console.log(chalk.white('Your data (database, volumes) has been preserved.'));
    console.log(chalk.gray('Run `launchframe docker:up` to start services again.\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error stopping services:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerDown };
