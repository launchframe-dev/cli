const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const ora = require('ora');
const path = require('path');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');
const { checkDockerRunning, loginToGHCR, buildFullAppImages, buildAndPushImage } = require('../utils/docker-helper');

const execAsync = promisify(exec);

/**
 * Build, push, and deploy Docker images
 * @param {string} [serviceName] - Optional specific service to build (e.g., 'backend', 'admin-portal')
 */
async function deployBuild(serviceName) {
  requireProject();

  const serviceLabel = serviceName ? `(${serviceName})` : '(all services)';
  console.log(chalk.blue.bold(`\n🔨 LaunchFrame Build & Deploy ${serviceLabel}\n`));

  const config = getProjectConfig();
  const projectRoot = process.cwd();

  // Validate deployment is configured
  if (!config.deployConfigured || !config.deployment) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  const { vpsHost, vpsUser, vpsAppFolder, githubOrg } = config.deployment;
  const { projectName, installedServices } = config;
  const envProdPath = path.join(projectRoot, 'infrastructure', '.env.prod');

  // Step 1: Check Docker is running
  console.log(chalk.yellow('🐳 Step 1: Checking Docker...\n'));

  const dockerSpinner = ora('Checking Docker...').start();

  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    dockerSpinner.fail('Docker is not running');
    console.log(chalk.red('\n❌ Please start Docker and try again.\n'));
    process.exit(1);
  }

  dockerSpinner.succeed('Docker is running');

  // Step 2: Login to GHCR
  console.log(chalk.yellow('\n🔐 Step 2: Logging in to GitHub Container Registry...\n'));

  const ghcrToken = config.deployment.ghcrToken;
  if (!ghcrToken) {
    console.log(chalk.red('❌ Error: GHCR token not found in .launchframe config\n'));
    console.log(chalk.gray('Run deploy:configure to set up your GitHub token.\n'));
    process.exit(1);
  }

  try {
    await loginToGHCR(githubOrg, ghcrToken);
  } catch (error) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
    process.exit(1);
  }

  // Step 3: Build and push images
  console.log(chalk.yellow('\n📦 Step 3: Building and pushing images...\n'));

  try {
    if (serviceName) {
      // Build specific service
      if (!installedServices.includes(serviceName)) {
        console.log(chalk.red(`❌ Service "${serviceName}" not found in installed services.\n`));
        console.log(chalk.gray(`Available services: ${installedServices.join(', ')}\n`));
        process.exit(1);
      }

      const registry = `ghcr.io/${githubOrg}`;
      await buildAndPushImage(
        serviceName,
        path.join(projectRoot, serviceName),
        registry,
        projectName
      );
      console.log(chalk.green.bold(`\n✅ ${serviceName} built and pushed to GHCR!\n`));
    } else {
      // Build all services
      await buildFullAppImages(projectRoot, projectName, githubOrg, envProdPath, installedServices);
      console.log(chalk.green.bold('\n✅ All images built and pushed to GHCR!\n'));
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Build failed: ${error.message}\n`));
    process.exit(1);
  }

  // Step 4: Pull images on VPS
  console.log(chalk.yellow('\n🚀 Step 4: Pulling images on VPS...\n'));

  const pullSpinner = ora('Pulling images on VPS...').start();

  try {
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull"`,
      { timeout: 600000 } // 10 minutes
    );
    pullSpinner.succeed('Images pulled on VPS');
  } catch (error) {
    pullSpinner.fail('Failed to pull images');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // Step 5: Restart services
  console.log(chalk.yellow('\n🔄 Step 5: Restarting services...\n'));

  const restartSpinner = ora('Restarting services...').start();

  try {
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"`,
      { timeout: 300000 } // 5 minutes
    );
    restartSpinner.succeed('Services restarted');
  } catch (error) {
    restartSpinner.fail('Failed to restart services');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Build and deploy complete!\n'));

  console.log(chalk.gray('Your updated application is now running.\n'));
}

module.exports = { deployBuild };
