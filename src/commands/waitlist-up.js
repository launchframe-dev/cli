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

  console.log(chalk.blue.bold('\n🚀 Starting Waitlist Service with Watch (Local)\n'));

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

  // STEP 1b: Check Docker Compose version for watch support
  console.log(chalk.yellow('\n🔍 Checking Docker Compose version...\n'));

  const composeSpinner = ora('Verifying Docker Compose v2.22+...').start();

  try {
    const { stdout: composeVersion } = await execAsync('docker compose version');
    const versionMatch = composeVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
    
    if (versionMatch) {
      const [, major, minor] = versionMatch.map(Number);
      
      if (major < 2 || (major === 2 && minor < 22)) {
        composeSpinner.fail(`Docker Compose v${major}.${minor} is too old`);
        console.log(chalk.red('\n❌ Docker Compose v2.22+ is required for watch support\n'));
        console.log(chalk.gray('Please upgrade Docker Compose:'));
        console.log(chalk.white('  https://docs.docker.com/compose/install/\n'));
        process.exit(1);
      }
      composeSpinner.succeed(`Docker Compose v${major}.${minor} (compatible)`);
    } else {
      composeSpinner.warn('Could not parse version, proceeding anyway...');
    }
  } catch (error) {
    composeSpinner.warn('Could not detect Docker Compose version');
  }

  // STEP 2: Start waitlist with watch
  console.log(chalk.yellow('\n🚀 Step 2: Starting waitlist with watch...\n'));

  const buildFlag = flags.build ? '--build' : '';
  const deploySpinner = ora('Starting waitlist with watch...').start();

  try {
    await execAsync(
      `cd ${waitlistPath} && docker-compose -f docker-compose.waitlist.yml -f docker-compose.waitlist.dev.yml watch ${buildFlag}`.trim(),
      { timeout: 180000 } // 3 minutes
    );

    deploySpinner.succeed('Waitlist started with watch');
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
  console.log(chalk.green.bold('\n✅ Waitlist started with watch mode!\n'));

  console.log(chalk.yellow('📺 Watching for file changes (press Ctrl+C to stop)...\n'));
  
  console.log(chalk.white('Watch behavior:'));
  console.log(chalk.gray('  • Code changes → Auto-sync to container'));
  console.log(chalk.gray('  • package.json → Auto-rebuild & restart\n'));

  console.log(chalk.white('Your waitlist landing page is available at:\n'));
  console.log(chalk.cyan(`  🌍 Waitlist: http://localhost:3002`));
  console.log(chalk.gray(`  ✓ Running in development mode with file watching\n`));

  console.log(chalk.white('To stop:'));
  console.log(chalk.gray('  Press Ctrl+C in this terminal'));
  console.log(chalk.gray('  Or run: launchframe waitlist:down\n'));
  
  console.log(chalk.cyan('💡 Tip (Linux/Mac): Add & at the end to run in background\n'));
}

module.exports = { waitlistUp };
