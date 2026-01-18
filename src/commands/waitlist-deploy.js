const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');
const { requireProject, getProjectConfig, getPrimaryDomain, isWaitlistInstalled } = require('../utils/project-helpers');
const {
  testSSHConnection,
  checkSSHKeys,
  executeSSH,
  copyFileToVPS
} = require('../utils/ssh-helper');
const {
  checkDockerRunning,
  loginToGHCR,
  buildWaitlistImage
} = require('../utils/docker-helper');

/**
 * Deploy waitlist service to VPS
 * - Builds waitlist Docker image
 * - Copies docker-compose and .env.prod to VPS
 * - Does NOT clone full repo (standalone deployment)
 */
async function waitlistDeploy() {
  requireProject();

  console.log(chalk.blue.bold('\n🚀 Waitlist Service Deployment\n'));

  const config = getProjectConfig();

  // STEP 1: Validate waitlist is installed
  if (!isWaitlistInstalled(config)) {
    console.log(chalk.red('❌ Error: Waitlist service not installed\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe service:add waitlist\n'));
    process.exit(1);
  }

  // STEP 2: Validate deployment is configured
  if (!config.deployConfigured || !config.deployment) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  const { vpsHost, vpsUser, vpsAppFolder, ghcrToken, adminEmail, githubOrg } = config.deployment;
  const { projectName } = config;
  const projectRoot = process.cwd();
  const waitlistPath = path.join(projectRoot, 'waitlist');

  // STEP 3: Validate waitlist .env.prod exists
  console.log(chalk.yellow('📋 Step 1: Validating waitlist environment...\n'));

  const envProdPath = path.join(waitlistPath, '.env.prod');
  if (!await fs.pathExists(envProdPath)) {
    console.log(chalk.red('❌ Error: waitlist/.env.prod not found\n'));
    console.log(chalk.gray('The .env.prod file should be created during service installation.'));
    console.log(chalk.gray('You can create it manually by copying waitlist/.env and updating values.\n'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Waitlist environment validated\n'));

  // STEP 4: Check SSH keys and test connection
  console.log(chalk.yellow('🔑 Step 2: Checking SSH configuration...\n'));

  const { hasKeys } = await checkSSHKeys();
  if (!hasKeys) {
    console.log(chalk.yellow('⚠️  Warning: No SSH keys found in ~/.ssh/\n'));
  }

  const spinner = ora('Connecting to VPS...').start();
  const connectionTest = await testSSHConnection(vpsUser, vpsHost);

  if (!connectionTest.success) {
    spinner.fail('Failed to connect to VPS');
    console.log(chalk.red(`\n❌ SSH connection failed: ${connectionTest.error}\n`));
    process.exit(1);
  }

  spinner.succeed('Connected to VPS successfully');
  console.log();

  // STEP 5: Build and push Docker image
  console.log(chalk.yellow('🐳 Step 3: Building waitlist Docker image...\n'));

  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    console.log(chalk.red('❌ Docker is not running\n'));
    console.log(chalk.gray('Please start Docker Desktop and try again.\n'));
    process.exit(1);
  }

  if (!ghcrToken) {
    console.log(chalk.red('❌ GHCR token not configured\n'));
    console.log(chalk.gray('Run: launchframe deploy:configure\n'));
    process.exit(1);
  }

  try {
    await loginToGHCR(githubOrg, ghcrToken);
    await buildWaitlistImage(projectRoot, projectName, githubOrg);
    console.log(chalk.green.bold('\n✅ Waitlist image built and pushed!\n'));
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to build Docker image\n'));
    console.log(chalk.gray('Error:'), error.message, '\n');
    process.exit(1);
  }

  // STEP 6: Copy deployment files to VPS
  console.log(chalk.yellow('📦 Step 4: Copying deployment files to VPS...\n'));

  const deploySpinner = ora('Creating app directory...').start();

  try {
    // Create waitlist directory on VPS
    await executeSSH(vpsUser, vpsHost, `mkdir -p ${vpsAppFolder}/waitlist`);

    // Copy docker-compose file
    deploySpinner.text = 'Copying docker-compose file...';
    const composeFile = path.join(waitlistPath, 'docker-compose.waitlist.yml');
    await copyFileToVPS(composeFile, vpsUser, vpsHost, `${vpsAppFolder}/waitlist/docker-compose.waitlist.yml`);

    // Copy .env.prod file (ensure ADMIN_EMAIL is included)
    deploySpinner.text = 'Copying .env.prod file...';

    // Read .env.prod and add ADMIN_EMAIL if missing
    let envProdContent = await fs.readFile(envProdPath, 'utf8');
    if (!envProdContent.includes('ADMIN_EMAIL=') && adminEmail) {
      envProdContent += `ADMIN_EMAIL=${adminEmail}\n`;
      await fs.writeFile(envProdPath, envProdContent, 'utf8');
    }

    await copyFileToVPS(envProdPath, vpsUser, vpsHost, `${vpsAppFolder}/waitlist/.env`);

    deploySpinner.succeed('Deployment files copied to VPS');
  } catch (error) {
    deploySpinner.fail('Failed to copy files');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // STEP 7: Pull Docker image on VPS
  console.log(chalk.yellow('\n🐳 Step 5: Pulling waitlist Docker image on VPS...\n'));

  const pullSpinner = ora('Pulling Docker image...').start();

  try {
    await executeSSH(
      vpsUser,
      vpsHost,
      `cd ${vpsAppFolder}/waitlist && docker-compose -f docker-compose.waitlist.yml pull`,
      { timeout: 300000 } // 5 minutes
    );
    pullSpinner.succeed('Docker image pulled successfully');
  } catch (error) {
    pullSpinner.fail('Failed to pull Docker image');
    console.log(chalk.yellow(`\n⚠️  Warning: ${error.message}\n`));
    console.log(chalk.gray('You can try pulling the image manually on the VPS.\n'));
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Waitlist deployment initialized!\n'));

  console.log(chalk.white('Summary:'));
  console.log(chalk.gray(`  - Deployment files copied to: ${vpsAppFolder}/waitlist`));
  console.log(chalk.gray('  - Docker image pulled from GHCR'));
  console.log(chalk.gray('  - Production .env configured\n'));

  // STEP 8: Automatically start the waitlist
  console.log(chalk.yellow('🚀 Step 6: Starting waitlist containers...\n'));

  const startSpinner = ora('Starting waitlist on VPS...').start();

  try {
    await executeSSH(
      vpsUser,
      vpsHost,
      `cd ${vpsAppFolder}/waitlist && docker-compose -f docker-compose.waitlist.yml up -d`,
      { timeout: 180000 } // 3 minutes
    );

    startSpinner.succeed('Waitlist started successfully');
  } catch (error) {
    startSpinner.fail('Failed to start waitlist');
    console.log(chalk.yellow(`\n⚠️  Warning: ${error.message}\n`));
    console.log(chalk.gray('You can start it manually with: launchframe waitlist:up\n'));
    process.exit(1);
  }

  // Verify services are running
  console.log(chalk.yellow('\n🔍 Step 7: Verifying deployment...\n'));

  const verifySpinner = ora('Checking service status...').start();

  try {
    const { stdout: psOutput } = await executeSSH(
      vpsUser,
      vpsHost,
      `cd ${vpsAppFolder}/waitlist && docker-compose -f docker-compose.waitlist.yml ps`,
      { timeout: 30000 }
    );

    verifySpinner.succeed('Services verified');
    console.log(chalk.gray('\n' + psOutput));
  } catch (error) {
    console.error(chalk.yellow(`\n⚠️  Error: ${error.message}\n`));
    verifySpinner.warn('Could not verify services');
  }

  // Final success message
  const primaryDomain = getPrimaryDomain(config);

  console.log(chalk.green.bold('\n✅ Waitlist is now live!\n'));

  console.log(chalk.white('Your waitlist landing page is available at:\n'));
  console.log(chalk.cyan(`  🌍 Waitlist: https://${primaryDomain || 'your-domain.com'}`));
  console.log(chalk.gray(`  ✓ Standalone Traefik instance (SSL + reverse proxy)`));
  console.log(chalk.gray(`  ✓ Automatic Let's Encrypt SSL certificates`));
  console.log(chalk.gray(`  ✓ Fully isolated from full-app deployment\n`));

  console.log(chalk.white('⏰ Note: SSL certificates may take a few minutes to provision.\n'));

  console.log(chalk.white('Monitor waitlist:'));
  console.log(chalk.gray(`  launchframe waitlist:logs\n`));

  console.log(chalk.white('Stop waitlist:'));
  console.log(chalk.gray(`  launchframe waitlist:down\n`));
}

module.exports = { waitlistDeploy };
