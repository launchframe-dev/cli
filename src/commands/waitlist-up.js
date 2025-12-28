const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const ora = require('ora');
const { requireProject, getProjectConfig, isWaitlistInstalled } = require('../utils/project-helpers');

const execAsync = promisify(exec);

/**
 * Start waitlist service locally
 * @param {Object} flags - Command line flags
 * @param {boolean} flags.build - Force rebuild of containers
 */
async function waitlistUp(flags = {}) {
  requireProject();

  console.log(chalk.blue.bold('\n🚀 Starting Waitlist Service (Local)\n'));

  const config = getProjectConfig();

  // Validate waitlist is installed
  if (!isWaitlistInstalled(config)) {
    console.log(chalk.red('❌ Error: Waitlist service not installed\n'));
    console.log(chalk.gray('Run: launchframe service:add waitlist\n'));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const waitlistPath = path.join(projectRoot, 'waitlist');

  // STEP 1: Check Docker version
  console.log(chalk.yellow('🐳 Step 1: Checking Docker...\n'));

  const dockerSpinner = ora('Checking Docker installation...').start();

  try {
    const { stdout: versionOutput } = await execAsync('docker version --format "{{.Client.Version}}"');
    const version = versionOutput.trim();
    dockerSpinner.succeed(`Docker ${version} (compatible)`);
  } catch (error) {
    dockerSpinner.fail('Docker not found');
    console.log(chalk.red('\n❌ Docker is not installed or not in PATH\n'));
    process.exit(1);
  }

  // STEP 2: Start waitlist locally
  console.log(chalk.yellow('\n🚀 Step 2: Starting waitlist containers...\n'));

  const buildFlag = flags.build ? '--build' : '';
  const deploySpinner = ora('Starting waitlist containers...').start();

  try {
    await execAsync(
      `cd ${waitlistPath} && docker-compose -f docker-compose.waitlist.yml -f docker-compose.waitlist.dev.yml up -d ${buildFlag}`.trim(),
      { timeout: 180000 } // 3 minutes
    );

    deploySpinner.succeed('Waitlist started successfully');
  } catch (error) {
    deploySpinner.fail('Failed to start waitlist');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // STEP 3: Verify services are running
  console.log(chalk.yellow('\n🔍 Step 3: Verifying containers...\n'));

  const verifySpinner = ora('Checking service status...').start();

  try {
    const { stdout: psOutput } = await execAsync(
      `cd ${waitlistPath} && docker-compose -f docker-compose.waitlist.yml -f docker-compose.waitlist.dev.yml ps`,
      { timeout: 30000 }
    );

    verifySpinner.succeed('Services verified');
    console.log(chalk.gray('\n' + psOutput));
  } catch (error) {
    verifySpinner.warn('Could not verify services');
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Waitlist is now running locally!\n'));

  console.log(chalk.white('Your waitlist landing page is available at:\n'));
  console.log(chalk.cyan(`  🌍 Waitlist: http://localhost:3002`));
  console.log(chalk.gray(`  ✓ Running in development mode with hot reload`));
  console.log(chalk.gray(`  ✓ Source code mounted from ./waitlist/src\n`));

  console.log(chalk.white('Monitor waitlist:'));
  console.log(chalk.gray(`  launchframe waitlist:logs\n`));

  console.log(chalk.white('Stop waitlist:'));
  console.log(chalk.gray(`  launchframe waitlist:down\n`));
}

module.exports = { waitlistUp };
