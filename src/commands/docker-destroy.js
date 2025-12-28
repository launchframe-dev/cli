const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

/**
 * Destroy all Docker resources for this project
 * @param {Object} options - Command options
 * @param {boolean} options.force - Skip confirmation prompt
 */
async function dockerDestroy(options = {}) {
  requireProject();

  console.log(chalk.yellow.bold('\n⚠️  WARNING: Docker Resource Destruction\n'));
  console.log(chalk.white('This will remove ALL Docker resources for this project:'));
  console.log(chalk.gray('  • All containers (running and stopped)'));
  console.log(chalk.gray('  • All volumes (including databases)'));
  console.log(chalk.gray('  • All images'));
  console.log(chalk.gray('  • Project network\n'));
  console.log(chalk.red('⚠️  This action is IRREVERSIBLE. All data will be lost.\n'));

  // Skip confirmation if --force flag is provided
  if (!options.force) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to destroy all Docker resources?',
        default: false
      }
    ]);

    if (!confirmed) {
      console.log(chalk.gray('\n✓ Cancelled. No changes made.\n'));
      return;
    }
  } else {
    console.log(chalk.yellow('--force flag detected, skipping confirmation...\n'));
  }

  try {
    const markerPath = path.join(process.cwd(), '.launchframe');
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    const projectName = marker.projectName;

    console.log(chalk.yellow('\n🗑️  Destroying Docker resources...\n'));

    // Step 1: Stop and remove all containers
    console.log(chalk.gray('Stopping and removing containers...'));
    try {
      execSync(`docker ps -a --filter "name=${projectName}" -q | xargs -r docker rm -f`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if no containers found
    }

    // Step 2: Remove all volumes
    console.log(chalk.gray('Removing volumes...'));
    try {
      execSync(`docker volume ls --filter "name=${projectName}" -q | xargs -r docker volume rm`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if no volumes found
    }

    // Step 3: Remove all images
    console.log(chalk.gray('Removing images...'));
    try {
      execSync(`docker images --filter "reference=${projectName}*" -q | xargs -r docker rmi -f`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if no images found
    }

    // Step 4: Remove network
    console.log(chalk.gray('Removing network...'));
    try {
      execSync(`docker network rm ${projectName}-network`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if network doesn't exist
    }

    console.log(chalk.green.bold('\n✅ All Docker resources destroyed successfully!\n'));
    console.log(chalk.white('To rebuild your project:'));
    console.log(chalk.gray('  cd infrastructure'));
    console.log(chalk.gray('  docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error during cleanup:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerDestroy };
