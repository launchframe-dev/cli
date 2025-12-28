const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const { replaceVariables } = require('./utils/variable-replacer');
const { copyDirectory } = require('./utils/file-ops');
const { generateEnvFile } = require('./utils/env-generator');
const { processServiceVariant } = require('./utils/variant-processor');
const { resolveVariantChoices } = require('./services/variant-config');

/**
 * Initialize git repository in a service directory
 * @param {string} servicePath - Path to service directory
 * @param {string} serviceName - Name of the service (for logging)
 */
function initGitRepo(servicePath, serviceName) {
  try {
    console.log(`🔧 Initializing git repository for ${serviceName}...`);
    execSync('git init', { cwd: servicePath, stdio: 'ignore' });
    execSync('git add .', { cwd: servicePath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: servicePath, stdio: 'ignore' });
    console.log(`✅ Git repository initialized for ${serviceName}`);
  } catch (error) {
    console.warn(`⚠️  Could not initialize git repository for ${serviceName}: ${error.message}`);
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
  // templateRoot is now passed as parameter (cache or local dev path)
  const projectRoot = path.resolve(__dirname, '../..'); // For root-level files like .github, CLAUDE.md
  const destinationRoot = path.resolve(process.cwd(), projectName);

  console.log(`📁 Template source: ${templateRoot}`);
  console.log(`📁 Destination: ${destinationRoot}\n`);

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

  // Step 1: Process backend service with variants
  console.log('🔧 Processing backend service...');
  await processServiceVariant(
    'backend',
    allServiceVariants.backend,
    path.join(destinationRoot, 'backend'),
    variables,
    templateRoot
  );
  initGitRepo(path.join(destinationRoot, 'backend'), 'backend');

  // Step 2: Process admin-portal service with variants
  // Note: admin-portal folder might not exist yet in templates, skip if missing
  const adminPortalTemplatePath = path.join(templateRoot, 'admin-portal/templates/base');
  if (await fs.pathExists(adminPortalTemplatePath)) {
    console.log('🔧 Processing admin-portal service...');
    await processServiceVariant(
      'admin-portal',
      allServiceVariants['admin-portal'],
      path.join(destinationRoot, 'admin-portal'),
      variables,
      templateRoot
    );
    initGitRepo(path.join(destinationRoot, 'admin-portal'), 'admin-portal');
  } else {
    // Fallback: Copy admin-portal directly without variants (for now)
    console.log('📋 Copying admin-portal service (no variants yet)...');
    const adminPortalSource = path.join(templateRoot, 'admin-portal');
    if (await fs.pathExists(adminPortalSource)) {
      await copyDirectory(adminPortalSource, path.join(destinationRoot, 'admin-portal'));
      await replaceVariables(path.join(destinationRoot, 'admin-portal'), variables);
      initGitRepo(path.join(destinationRoot, 'admin-portal'), 'admin-portal');
    }
  }

  // Step 3: Process customers-portal service (ONLY if B2B2C selected)
  if (variantChoices.userModel === 'b2b2c') {
    // Note: customers-portal folder might not exist yet in templates, skip if missing
    const customersPortalTemplatePath = path.join(templateRoot, 'customers-portal/templates/base');
    if (await fs.pathExists(customersPortalTemplatePath)) {
      console.log('🔧 Processing customers-portal service...');
      await processServiceVariant(
        'customers-portal',
        allServiceVariants['customers-portal'],
        path.join(destinationRoot, 'customers-portal'),
        variables,
        templateRoot
      );
      initGitRepo(path.join(destinationRoot, 'customers-portal'), 'customers-portal');
    } else {
      // Fallback: Copy customers-portal directly without variants (for now)
      console.log('📋 Copying customers-portal service (B2B2C mode)...');
      const customersPortalSource = path.join(templateRoot, 'customers-portal');
      if (await fs.pathExists(customersPortalSource)) {
        await copyDirectory(customersPortalSource, path.join(destinationRoot, 'customers-portal'));
        await replaceVariables(path.join(destinationRoot, 'customers-portal'), variables);
        initGitRepo(path.join(destinationRoot, 'customers-portal'), 'customers-portal');
      }
    }
  } else {
    console.log('📋 Skipping customers-portal (B2B mode - admin users only)');
  }

  // Step 4: Process infrastructure with variants (docker-compose files conditionally include customers-portal)
  console.log('🔧 Processing infrastructure...');
  await processServiceVariant(
    'infrastructure',
    allServiceVariants.infrastructure,
    path.join(destinationRoot, 'infrastructure'),
    variables,
    templateRoot
  );
  initGitRepo(path.join(destinationRoot, 'infrastructure'), 'infrastructure');

  console.log('📋 Copying website...');
  await copyDirectory(
    path.join(templateRoot, 'website'),
    path.join(destinationRoot, 'website')
  );
  await replaceVariables(path.join(destinationRoot, 'website'), variables);
  initGitRepo(path.join(destinationRoot, 'website'), 'website');

  // Step 5: Copy additional files (from project root, not modules/)
  console.log('📋 Copying additional files...');
  const additionalFiles = [
    '.github',
    'CLAUDE.md',
    'README.md',
    '.gitignore',
    'LICENSE'
  ];

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

  // Step 6: Generate .env file with localhost defaults
  console.log('\n🔐 Generating .env file with secure secrets...');
  const { envPath } = await generateEnvFile(destinationRoot, answers);
  console.log(`✅ Environment file created: ${envPath}`);

  // Step 7: Create .launchframe marker file with variant metadata
  console.log('📝 Creating LaunchFrame marker file...');
  const markerPath = path.join(destinationRoot, '.launchframe');
  
  // Determine which services were installed
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
    // Store variant choices for future reference
    variants: variantChoices
  };
  await fs.writeJson(markerPath, markerContent, { spaces: 2 });

  console.log('✅ Base project generated with variants applied');
}

module.exports = { generateProject };
