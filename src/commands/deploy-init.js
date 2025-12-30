const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');
const { validateEnvProd } = require('../utils/env-validator');
const {
  testSSHConnection,
  checkSSHKeys,
  executeSSH,
  copyFileToVPS,
  copyDirectoryToVPS
} = require('../utils/ssh-helper');

/**
 * Initial VPS setup - copy infrastructure files and configure environment
 */
async function deployInit() {
  requireProject();

  console.log(chalk.blue.bold('\n🚀 LaunchFrame Initial VPS Setup\n'));

  const config = getProjectConfig();

  // Validate deployment is configured
  if (!config.deployConfigured || !config.deployment) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  const { vpsHost, vpsUser, vpsAppFolder, githubOrg } = config.deployment;
  const { projectName } = config;
  const projectRoot = process.cwd();
  const envProdPath = path.join(projectRoot, 'infrastructure', '.env.prod');

  // Step 1: Validate .env.prod exists and has no placeholders
  console.log(chalk.yellow('📋 Step 1: Validating production environment...\n'));

  const validation = await validateEnvProd(envProdPath);
  if (!validation.valid) {
    console.log(chalk.red(`❌ Error: ${validation.error}\n`));

    if (validation.placeholders) {
      console.log(chalk.yellow('Placeholder variables found:'));
      validation.placeholders.forEach(p => console.log(chalk.gray(`  - ${p}`)));
      console.log();
    }

    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:set-env\n'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Production environment validated\n'));

  // Step 2: Check SSH keys
  console.log(chalk.yellow('🔑 Step 2: Checking SSH configuration...\n'));

  const { hasKeys, keyPaths } = await checkSSHKeys();
  if (!hasKeys) {
    console.log(chalk.yellow('⚠️  Warning: No SSH keys found in ~/.ssh/\n'));
    console.log(chalk.gray('You may need to generate SSH keys:'));
    console.log(chalk.white('  ssh-keygen -t ed25519\n'));
  } else {
    console.log(chalk.green(`✓ Found SSH keys: ${keyPaths.length} key(s)\n`));
  }

  // Step 3: Test SSH connection
  console.log(chalk.yellow('🔌 Step 3: Testing VPS connection...\n'));

  const spinner = ora('Connecting to VPS...').start();
  const connectionTest = await testSSHConnection(vpsUser, vpsHost);

  if (!connectionTest.success) {
    spinner.fail('Failed to connect to VPS');
    console.log(chalk.red(`\n❌ SSH connection failed: ${connectionTest.error}\n`));
    console.log(chalk.gray('Troubleshooting:'));
    console.log(chalk.gray(`  - Check VPS is online: ping ${vpsHost}`));
    console.log(chalk.gray(`  - Test SSH manually: ssh ${vpsUser}@${vpsHost}`));
    console.log(chalk.gray('  - Verify SSH keys are configured\n'));
    process.exit(1);
  }

  spinner.succeed('Connected to VPS successfully');
  console.log();

  // Step 3.5: Build and push Docker images
  console.log(chalk.yellow('🐳 Step 3.5: Building Docker images locally...\n'));

  // Check if Docker is running
  const {
    checkDockerRunning,
    loginToGHCR,
    buildFullAppImages
  } = require('../utils/docker-helper');

  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    console.log(chalk.red('❌ Docker is not running\n'));
    console.log(chalk.gray('Please start Docker Desktop and try again.\n'));
    console.log(chalk.gray('Docker is required to build production images for deployment.\n'));
    process.exit(1);
  }

  // Validate GHCR token is configured
  const { ghcrToken } = config.deployment || {};
  if (!ghcrToken) {
    console.log(chalk.red('❌ GHCR token not configured\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  try {
    // Login to GHCR
    await loginToGHCR(githubOrg, ghcrToken);

    // Build full-app images (only for installed services)
    const installedServices = config.installedServices || ['backend', 'admin-portal', 'website'];
    await buildFullAppImages(projectRoot, projectName, githubOrg, envProdPath, installedServices);

    console.log(chalk.green.bold('\n✅ All images built and pushed to GHCR!\n'));
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to build Docker images\n'));
    console.log(chalk.gray('Error:'), error.message, '\n');
    console.log(chalk.gray('Common issues:'));
    console.log(chalk.gray('  - Invalid GHCR token (check write:packages permission)'));
    console.log(chalk.gray('  - Dockerfile syntax errors'));
    console.log(chalk.gray('  - Insufficient disk space (~10GB required)'));
    console.log(chalk.gray('  - Network connection issues\n'));
    console.log(chalk.white('To create a valid token:'));
    console.log(chalk.gray('  https://github.com/settings/tokens/new\n'));
    process.exit(1);
  }


  // Step 4: Create app directory and copy infrastructure files
  console.log(chalk.yellow('📦 Step 4: Setting up application on VPS...\n'));

  const setupSpinner = ora('Creating app directory...').start();

  try {
    // Create infrastructure directory on VPS
    await executeSSH(vpsUser, vpsHost, `mkdir -p ${vpsAppFolder}/infrastructure`);
    
    setupSpinner.text = 'Copying infrastructure files to VPS...';

    // Copy entire infrastructure directory to VPS
    const infrastructurePath = path.join(projectRoot, 'infrastructure');
    await copyDirectoryToVPS(infrastructurePath, vpsUser, vpsHost, `${vpsAppFolder}/infrastructure`);

    setupSpinner.succeed('Infrastructure files copied to VPS');
  } catch (error) {
    setupSpinner.fail('Failed to copy infrastructure files');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // Create symlink for docker-compose.override.yml -> docker-compose.prod.yml
  const symlinkSpinner = ora('Creating docker-compose.override.yml symlink...').start();

  try {
    await executeSSH(
      vpsUser,
      vpsHost,
      `cd ${vpsAppFolder}/infrastructure && ln -sf docker-compose.prod.yml docker-compose.override.yml`
    );
    symlinkSpinner.succeed('Docker Compose override symlink created');
  } catch (error) {
    symlinkSpinner.fail('Failed to create symlink');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // Check if waitlist is running and stop it (full-app deployment)
  try {
    const { stdout: psOutput } = await executeSSH(
      vpsUser,
      vpsHost,
      `docker ps --filter "name=${projectName}-waitlist" --format "{{.Names}}"`,
      { timeout: 10000 }
    );

    if (psOutput.trim()) {
      console.log(chalk.yellow('\n⚠️  Waitlist is currently running. Stopping it...\n'));

      const stopSpinner = ora('Stopping waitlist containers...').start();

      try {
        await executeSSH(
          vpsUser,
          vpsHost,
          `cd ${vpsAppFolder}/waitlist && docker-compose -f docker-compose.waitlist.yml down`,
          { timeout: 30000 }
        );
        stopSpinner.succeed('Waitlist stopped');
      } catch (stopError) {
        stopSpinner.warn('Could not stop waitlist automatically');
        console.log(chalk.gray('You may need to stop it manually after deployment.\n'));
      }
    }
  } catch (error) {
    // If error, waitlist probably not running - continue
  }

  // Step 5: Copy .env.prod to VPS (overwrites .env copied from infrastructure/)
  console.log(chalk.yellow('\n📄 Step 5: Configuring production environment...\n'));

  const envSpinner = ora('Copying .env.prod to VPS...').start();

  try {
    const remoteEnvPath = `${vpsAppFolder}/infrastructure/.env`;
    await copyFileToVPS(envProdPath, vpsUser, vpsHost, remoteEnvPath);
    envSpinner.succeed('.env.prod copied as .env successfully');
  } catch (error) {
    envSpinner.fail('Failed to copy .env.prod');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // Step 6: Pull Docker images
  console.log(chalk.yellow('\n🐳 Step 6: Pulling Docker images...\n'));
  console.log(chalk.gray('This may take several minutes...\n'));

  const dockerSpinner = ora('Pulling Docker images...').start();

  try {
    await executeSSH(
      vpsUser,
      vpsHost,
      `cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull`,
      { timeout: 600000 } // 10 minutes for image pull
    );
    dockerSpinner.succeed('Docker images pulled successfully');
  } catch (error) {
    dockerSpinner.fail('Failed to pull Docker images');
    console.log(chalk.yellow(`\n⚠️  Warning: ${error.message}\n`));
    console.log(chalk.gray('This might mean Docker is not installed on the VPS.'));
    console.log(chalk.gray('Please install Docker and Docker Compose:\n'));
    console.log(chalk.white('  curl -fsSL https://get.docker.com | sh'));
    console.log(chalk.white('  sudo usermod -aG docker ${vpsUser}\n'));
    process.exit(1);
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Initial VPS setup complete!\n'));

  console.log(chalk.white('Summary:'));
  console.log(chalk.gray(`  - Infrastructure copied to: ${vpsAppFolder}`));
  console.log(chalk.gray('  - Production .env configured'));
  console.log(chalk.gray('  - Docker images pulled\n'));

  console.log(chalk.white('Next step:'));
  console.log(chalk.gray('  Run: launchframe deploy:up\n'));
}

module.exports = { deployInit };
