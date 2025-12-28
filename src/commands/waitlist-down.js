const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const ora = require('ora');
const { requireProject, getProjectConfig, isWaitlistInstalled } = require('../utils/project-helpers');

const execAsync = promisify(exec);

/**
 * Stop waitlist service locally
 */
async function waitlistDown() {
  requireProject();

  console.log(chalk.blue.bold('\n🛑 Stopping Waitlist Service (Local)\n'));

  const config = getProjectConfig();

  // Validate waitlist is installed
  if (!isWaitlistInstalled(config)) {
    console.log(chalk.red('❌ Error: Waitlist service not installed\n'));
    console.log(chalk.gray('Run: launchframe service:add waitlist\n'));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const waitlistPath = path.join(projectRoot, 'waitlist');

  // Stop waitlist containers
  const spinner = ora('Stopping waitlist containers...').start();

  try {
    await execAsync(
      `cd ${waitlistPath} && docker-compose -f docker-compose.waitlist.yml -f docker-compose.waitlist.dev.yml down`,
      { timeout: 60000 } // 1 minute
    );

    spinner.succeed('Waitlist stopped successfully');
  } catch (error) {
    spinner.fail('Failed to stop waitlist');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  console.log(chalk.green.bold('\n✅ Waitlist service stopped!\n'));
  console.log(chalk.gray('To start again: launchframe waitlist:up\n'));
}

module.exports = { waitlistDown };
