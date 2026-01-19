const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { runInitPrompts, runVariantPrompts } = require('../prompts');
const { generateProject } = require('../generator');
const { checkGitHubAccess, showAccessDeniedMessage } = require('../utils/github-access');
const { ensureCacheReady } = require('../utils/service-cache');
const { isLaunchFrameProject } = require('../utils/project-helpers');
const logger = require('../utils/logger');

/**
 * Check if running in development mode (local) vs production (npm install)
 */
function isDevMode() {
  // Only use dev mode if LAUNCHFRAME_DEV is explicitly set to 'true'
  return process.env.LAUNCHFRAME_DEV === 'true';
}

/**
 * Initialize a new LaunchFrame project
 * @param {Object} options - Command options
 * @param {string} options.projectName - Project name (skips prompt if provided)
 * @param {string} options.tenancy - Tenancy model: 'single' or 'multi' (skips prompt if provided)
 * @param {string} options.userModel - User model: 'b2b' or 'b2b2c' (skips prompt if provided)
 */
async function init(options = {}) {
  console.log(chalk.blue.bold('\nLaunchFrame\n'));

  // Check if in development mode
  const devMode = isDevMode();

  if (!devMode) {
    // Production mode: Check GitHub access
    console.log(chalk.gray('Checking repository access...'));

    const accessCheck = await checkGitHubAccess();

    if (!accessCheck.hasAccess) {
      showAccessDeniedMessage();
      process.exit(1);
    }

    console.log(chalk.green('Repository access confirmed\n'));
  }

  // Check if already in a LaunchFrame project
  if (isLaunchFrameProject()) {
    console.error(chalk.red('Error: Already in a LaunchFrame project'));
    console.log(chalk.gray('Use other commands to manage your project, or run init from outside the project.\n'));
    process.exit(1);
  }

  try {
    let answers;

    // If project name provided via flag, skip prompts
    if (options.projectName) {
      if (!/^[a-z0-9-]+$/.test(options.projectName)) {
        throw new Error('Project name must contain only lowercase letters, numbers, and hyphens');
      }

      const projectDisplayName = options.projectName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const projectDescription = `${projectDisplayName} - Modern SaaS Platform`;

      answers = {
        projectName: options.projectName,
        projectDisplayName: projectDisplayName,
        projectDescription: projectDescription,
        projectNameUpper: options.projectName.toUpperCase().replace(/-/g, '_'),
        projectNameCamel: options.projectName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      };

      logger.detail(`Project name: ${options.projectName}`);
      logger.detail(`Display name: ${projectDisplayName}`);
      logger.detail(`Description: ${projectDescription}`);
    } else {
      answers = await runInitPrompts();
    }

    // Get variant selections (multi-tenancy, B2B vs B2B2C)
    let variantChoices;

    if (options.tenancy && options.userModel) {
      if (!['single', 'multi'].includes(options.tenancy)) {
        throw new Error('Invalid --tenancy value. Must be "single" or "multi"');
      }

      if (!['b2b', 'b2b2c'].includes(options.userModel)) {
        throw new Error('Invalid --user-model value. Must be "b2b" or "b2b2c"');
      }

      const tenancyMap = {
        'single': 'single-tenant',
        'multi': 'multi-tenant'
      };

      variantChoices = {
        tenancy: tenancyMap[options.tenancy],
        userModel: options.userModel
      };

      logger.detail(`Tenancy: ${options.tenancy}`);
      logger.detail(`User model: ${options.userModel}`);
    } else {
      variantChoices = await runVariantPrompts();
    }

    // Determine which services are needed
    const requiredServices = ['backend', 'admin-portal', 'infrastructure', 'website'];

    if (variantChoices.userModel === 'b2b2c') {
      requiredServices.push('customers-portal');
    }

    // Determine template source
    let templateRoot;

    if (devMode) {
      templateRoot = path.resolve(__dirname, '../../../services');
      logger.detail(`[DEV MODE] Using local services: ${templateRoot}`);
    } else {
      try {
        templateRoot = await ensureCacheReady(requiredServices);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}\n`));
        process.exit(1);
      }
    }

    // Generate project
    console.log(chalk.white('\nGenerating project...\n'));
    await generateProject(answers, variantChoices, templateRoot);

    console.log(chalk.green.bold('\nProject created successfully!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray(`  cd ${answers.projectName}`));
    console.log(chalk.gray('  launchframe docker:up\n'));

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = { init };
