const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { runInitPrompts, runVariantPrompts } = require('../prompts');
const { generateProject } = require('../generator');
const { checkGitHubAccess, showAccessDeniedMessage } = require('../utils/github-access');
const { ensureCacheReady } = require('../utils/service-cache');
const { isLaunchFrameProject } = require('../utils/project-helpers');

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
  console.log(chalk.blue.bold('\n🚀 Welcome to LaunchFrame!\n'));

  // Check if in development mode
  const devMode = isDevMode();
  
  if (!devMode) {
    // Production mode: Check GitHub access
    console.log(chalk.blue('🔍 Checking repository access...\n'));
    
    const accessCheck = await checkGitHubAccess();
    
    if (!accessCheck.hasAccess) {
      // No access - show purchase/setup message
      showAccessDeniedMessage();
      process.exit(1); // Exit with error code
    }
    
    console.log(chalk.green('✓ Repository access confirmed\n'));
  }
  // Check if already in a LaunchFrame project
  if (isLaunchFrameProject()) {
    console.error(chalk.red('\n❌ Error: Already in a LaunchFrame project'));
    console.log(chalk.gray('Use other commands to manage your project, or run init from outside the project.\n'));
    process.exit(1);
  }

  try {
    let answers;

    // If project name provided via flag, skip prompts
    if (options.projectName) {
      // Validate project name format
      if (!/^[a-z0-9-]+$/.test(options.projectName)) {
        throw new Error('Project name must contain only lowercase letters, numbers, and hyphens');
      }

      // Auto-generate display name from slug
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

      console.log(chalk.gray(`Using project name: ${options.projectName}`));
      console.log(chalk.gray(`Using display name: ${projectDisplayName}`));
      console.log(chalk.gray(`Using description: ${projectDescription}\n`));
    } else {
      // Get user inputs via interactive prompts
      answers = await runInitPrompts();
    }

    // Get variant selections (multi-tenancy, B2B vs B2B2C)
    let variantChoices;
    
    // If both flags provided, skip variant prompts
    if (options.tenancy && options.userModel) {
      // Validate tenancy value
      if (!['single', 'multi'].includes(options.tenancy)) {
        throw new Error('Invalid --tenancy value. Must be "single" or "multi"');
      }
      
      // Validate userModel value
      if (!['b2b', 'b2b2c'].includes(options.userModel)) {
        throw new Error('Invalid --user-model value. Must be "b2b" or "b2b2c"');
      }
      
      // Convert short flag values to full variant names
      const tenancyMap = {
        'single': 'single-tenant',
        'multi': 'multi-tenant'
      };
      
      variantChoices = {
        tenancy: tenancyMap[options.tenancy],
        userModel: options.userModel
      };
      
      console.log(chalk.gray(`Using tenancy: ${options.tenancy}`));
      console.log(chalk.gray(`Using user model: ${options.userModel}\n`));
    } else {
      // Run interactive variant prompts
      variantChoices = await runVariantPrompts();
    }

    // Determine which services are needed based on variant choices
    const requiredServices = [
      'backend',
      'admin-portal',
      'infrastructure',
      'website'
    ];
    
    // Add customers-portal only if B2B2C mode
    if (variantChoices.userModel === 'b2b2c') {
      requiredServices.push('customers-portal');
    }

    // Determine template source (dev mode = local, production = cache)
    let templateRoot;
    
    if (devMode) {
      // Dev mode: Use local services directory
      templateRoot = path.resolve(__dirname, '../../../services');
      console.log(chalk.gray(`[DEV MODE] Using local services: ${templateRoot}\n`));
    } else {
      // Production mode: Use cache
      try {
        templateRoot = await ensureCacheReady(requiredServices);
      } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
      }
    }

    // Generate project with variant selections
    console.log(chalk.yellow('\n⚙️  Generating project...\n'));
    await generateProject(answers, variantChoices, templateRoot);

    console.log(chalk.green.bold('\n✅ Project generated successfully!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.white(`  cd ${answers.projectName}`));
    console.log(chalk.white('  launchframe docker:up    # Start all services\n'));
    console.log(chalk.gray('Optional:'));
    console.log(chalk.gray('  # Review and customize infrastructure/.env if needed'));
    console.log(chalk.gray('  launchframe docker:build # Rebuild images after changes\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

module.exports = { init };
