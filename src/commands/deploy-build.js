const chalk = require('chalk');
const path = require('path');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');
const { buildAndPushWorkflow } = require('../utils/docker-helper');
const { pullImagesOnVPS, restartServicesOnVPS } = require('../utils/ssh-helper');

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

  const { vpsHost, vpsUser, vpsAppFolder, githubOrg, ghcrToken } = config.deployment;
  const { projectName, installedServices } = config;
  const envProdPath = path.join(projectRoot, 'infrastructure', '.env.prod');

  // Step 1-3: Build and push images
  console.log(chalk.yellow('🐳 Step 1: Building and pushing images...\n'));

  try {
    await buildAndPushWorkflow({
      projectRoot,
      projectName,
      githubOrg,
      ghcrToken,
      envProdPath,
      installedServices,
      serviceName
    });
  } catch (error) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
    process.exit(1);
  }

  // Step 4: Pull images on VPS
  console.log(chalk.yellow('🚀 Step 2: Pulling images on VPS...\n'));

  try {
    await pullImagesOnVPS(vpsUser, vpsHost, vpsAppFolder);
  } catch (error) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
    process.exit(1);
  }

  // Step 5: Restart services
  console.log(chalk.yellow('\n🔄 Step 3: Restarting services...\n'));

  try {
    await restartServicesOnVPS(vpsUser, vpsHost, vpsAppFolder);
  } catch (error) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
    process.exit(1);
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Build and deploy complete!\n'));

  console.log(chalk.gray('Your updated application is now running.\n'));
}

module.exports = { deployBuild };
