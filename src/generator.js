const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const chalk = require('chalk');
const { replaceVariables } = require('./utils/variable-replacer');
const { copyDirectory } = require('./utils/file-ops');
const { generateEnvFile } = require('./utils/env-generator');
const { processServiceVariant } = require('./utils/variant-processor');
const { resolveVariantChoices } = require('./services/variant-config');
const logger = require('./utils/logger');

/**
 * Initialize git repository in a service directory
 * @param {string} servicePath - Path to service directory
 * @param {string} serviceName - Name of the service (for logging)
 */
function initGitRepo(servicePath, serviceName) {
  try {
    logger.detail(`Initializing git repository for ${serviceName}`);
    execSync('git init', { cwd: servicePath, stdio: 'ignore' });
    execSync('git add .', { cwd: servicePath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: servicePath, stdio: 'ignore' });
    logger.detail(`Git initialized: ${serviceName}`);
  } catch (error) {
    logger.warn(`Could not initialize git for ${serviceName}: ${error.message}`);
  }
}

/**
 * Main project generation function
 * @param {Object} answers - User answers from prompts
 * @param {Object} variantChoices - User's variant selections (tenancy, userModel)
 * @param {string} templateRoot - Path to templates (cache or local dev path)
 */
async function generateProject(answers, variantChoices, templateRoot) {
  const { projectName } = answers;

  // Define source (template) and destination paths
  const projectRoot = path.resolve(__dirname, '../..'); // For root-level files
  const destinationRoot = path.resolve(process.cwd(), projectName);

  logger.detail(`Template source: ${templateRoot}`);
  logger.detail(`Destination: ${destinationRoot}`);

  // Ensure destination directory exists
  await fs.ensureDir(destinationRoot);

  // Template variable replacements
  const variables = {
    '{{PROJECT_NAME}}': answers.projectName,
    '{{PROJECT_NAME_UPPER}}': answers.projectNameUpper,
    '{{PROJECT_DISPLAY_NAME}}': answers.projectDisplayName,
    '{{PROJECT_DESCRIPTION}}': answers.projectDescription,
    // Leave these as template variables for deploy:configure to replace
    '{{GITHUB_ORG}}': '{{GITHUB_ORG}}',
    '{{PRIMARY_DOMAIN}}': '{{PRIMARY_DOMAIN}}',
    '{{ADMIN_EMAIL}}': '{{ADMIN_EMAIL}}',
    '{{VPS_HOST}}': '{{VPS_HOST}}'
  };

  // Resolve variant choices for all services
  const allServiceVariants = resolveVariantChoices(variantChoices);

  // Process backend
  console.log(chalk.gray('  Processing backend...'));
  await processServiceVariant(
    'backend',
    allServiceVariants.backend,
    path.join(destinationRoot, 'backend'),
    variables,
    templateRoot
  );
  initGitRepo(path.join(destinationRoot, 'backend'), 'backend');

  // Process admin-portal
  const adminPortalTemplatePath = path.join(templateRoot, 'admin-portal/base');
  if (await fs.pathExists(adminPortalTemplatePath)) {
    console.log(chalk.gray('  Processing admin-portal...'));
    await processServiceVariant(
      'admin-portal',
      allServiceVariants['admin-portal'],
      path.join(destinationRoot, 'admin-portal'),
      variables,
      templateRoot
    );
    initGitRepo(path.join(destinationRoot, 'admin-portal'), 'admin-portal');
  } else {
    // Fallback: Copy admin-portal directly without variants
    console.log(chalk.gray('  Copying admin-portal...'));
    const adminPortalSource = path.join(templateRoot, 'admin-portal');
    if (await fs.pathExists(adminPortalSource)) {
      await copyDirectory(adminPortalSource, path.join(destinationRoot, 'admin-portal'));
      await replaceVariables(path.join(destinationRoot, 'admin-portal'), variables);
      initGitRepo(path.join(destinationRoot, 'admin-portal'), 'admin-portal');
    }
  }

  // Process customers-portal (only if B2B2C)
  if (variantChoices.userModel === 'b2b2c') {
    const customersPortalTemplatePath = path.join(templateRoot, 'customers-portal/base');
    if (await fs.pathExists(customersPortalTemplatePath)) {
      console.log(chalk.gray('  Processing customers-portal...'));
      await processServiceVariant(
        'customers-portal',
        allServiceVariants['customers-portal'],
        path.join(destinationRoot, 'customers-portal'),
        variables,
        templateRoot
      );
      initGitRepo(path.join(destinationRoot, 'customers-portal'), 'customers-portal');
    } else {
      console.log(chalk.gray('  Copying customers-portal...'));
      const customersPortalSource = path.join(templateRoot, 'customers-portal');
      if (await fs.pathExists(customersPortalSource)) {
        await copyDirectory(customersPortalSource, path.join(destinationRoot, 'customers-portal'));
        await replaceVariables(path.join(destinationRoot, 'customers-portal'), variables);
        initGitRepo(path.join(destinationRoot, 'customers-portal'), 'customers-portal');
      }
    }
  } else {
    logger.detail('Skipping customers-portal (B2B mode)');
  }

  // Process infrastructure
  console.log(chalk.gray('  Processing infrastructure...'));
  await processServiceVariant(
    'infrastructure',
    allServiceVariants.infrastructure,
    path.join(destinationRoot, 'infrastructure'),
    variables,
    templateRoot
  );
  initGitRepo(path.join(destinationRoot, 'infrastructure'), 'infrastructure');

  // Process website
  console.log(chalk.gray('  Processing website...'));
  await copyDirectory(
    path.join(templateRoot, 'website'),
    path.join(destinationRoot, 'website')
  );
  await replaceVariables(path.join(destinationRoot, 'website'), variables);
  initGitRepo(path.join(destinationRoot, 'website'), 'website');

  // Copy additional files
  logger.detail('Copying additional files...');
  const additionalFiles = ['.github', 'README.md', '.gitignore', 'LICENSE'];

  for (const file of additionalFiles) {
    const sourcePath = path.join(projectRoot, file);
    const destPath = path.join(destinationRoot, file);

    if (await fs.pathExists(sourcePath)) {
      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
      } else {
        await fs.copy(sourcePath, destPath);
      }
      await replaceVariables(destPath, variables);
    }
  }

  // Generate .env file
  console.log(chalk.gray('  Generating environment file...'));
  const { envPath } = await generateEnvFile(destinationRoot, answers);
  logger.detail(`Environment file: ${envPath}`);

  // Create .launchframe marker file
  logger.detail('Creating project marker file...');
  const markerPath = path.join(destinationRoot, '.launchframe');

  const installedServices = ['backend', 'admin-portal', 'infrastructure', 'website'];
  if (variantChoices.userModel === 'b2b2c') {
    installedServices.push('customers-portal');
  }

  const markerContent = {
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    projectName: answers.projectName,
    projectDisplayName: answers.projectDisplayName,
    deployConfigured: false,
    installedServices: installedServices,
    variants: variantChoices
  };
  await fs.writeJson(markerPath, markerContent, { spaces: 2 });
}

module.exports = { generateProject };
