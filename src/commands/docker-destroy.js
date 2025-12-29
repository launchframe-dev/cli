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

    // Step 1: Stop all running containers first
    console.log(chalk.gray('Stopping running containers...'));
    try {
      const runningContainerIds = execSync(`docker ps --filter "name=${projectName}" -q`, { encoding: 'utf8' }).trim();
      if (runningContainerIds) {
        const ids = runningContainerIds.replace(/\n/g, ' ');
        execSync(`docker stop ${ids}`, { stdio: 'inherit' });
      }
    } catch (error) {
      // Ignore errors if no running containers
    }

    // Step 2: Remove all containers (running and stopped)
    console.log(chalk.gray('Removing containers...'));
    try {
      const containerIds = execSync(`docker ps -a --filter "name=${projectName}" -q`, { encoding: 'utf8' }).trim();
      if (containerIds) {
        const ids = containerIds.replace(/\n/g, ' ');
        execSync(`docker rm -f ${ids}`, { stdio: 'inherit' });
      }
    } catch (error) {
      // Ignore errors if no containers found
    }

    // Step 3: Remove network (must be after containers are removed)
    console.log(chalk.gray('Removing network...'));
    try {
      execSync(`docker network rm ${projectName}-network`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if network doesn't exist or has active endpoints
    }

    // Step 4: Remove all volumes (must be after containers are removed)
    console.log(chalk.gray('Removing volumes...'));
    try {
      const volumeIds = execSync(`docker volume ls --filter "name=${projectName}" -q`, { encoding: 'utf8' }).trim();
      if (volumeIds) {
        const ids = volumeIds.replace(/\n/g, ' ');
        execSync(`docker volume rm ${ids}`, { stdio: 'inherit' });
      }
    } catch (error) {
      // Ignore errors if no volumes found
    }

    // Step 5: Remove all images (do this last)
    console.log(chalk.gray('Removing images...'));
    try {
      const imageIds = execSync(`docker images --filter "reference=${projectName}*" -q`, { encoding: 'utf8' }).trim();
      if (imageIds) {
        const ids = imageIds.replace(/\n/g, ' ');
        execSync(`docker rmi -f ${ids}`, { stdio: 'inherit' });
      }
    } catch (error) {
      // Ignore errors if no images found
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
