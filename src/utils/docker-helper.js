const { exec } = require('child_process');
const { promisify } = require('util');
const ora = require('ora');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Check if Docker is running
 * @returns {Promise<boolean>}
 */
async function checkDockerRunning() {
  try {
    await execAsync('docker info', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Login to GitHub Container Registry
 * @param {string} githubOrg - GitHub organization/username
 * @param {string} ghcrToken - GitHub Personal Access Token
 * @returns {Promise<void>}
 */
async function loginToGHCR(githubOrg, ghcrToken) {
  const spinner = ora('Logging in to GitHub Container Registry...').start();

  try {
    await execAsync(
      `echo "${ghcrToken}" | docker login ghcr.io -u ${githubOrg} --password-stdin`,
      { timeout: 30000 }
    );
    spinner.succeed('Logged in to GHCR');
  } catch (error) {
    spinner.fail('Failed to login to GHCR');
    throw new Error(`GHCR login failed: ${error.message}`);
  }
}

/**
 * Build and push a Docker image
 * @param {string} serviceName - Service name (e.g., 'backend', 'admin-portal')
 * @param {string} contextDir - Docker build context directory
 * @param {string} registry - Registry URL (e.g., 'ghcr.io/myorg')
 * @param {string} projectName - Project name
 * @param {string[]} buildArgs - Array of build arguments (e.g., ['KEY=value'])
 * @returns {Promise<void>}
 */
async function buildAndPushImage(serviceName, contextDir, registry, projectName, buildArgs = []) {
  const imageName = `${registry}/${projectName}-${serviceName}:latest`;

  console.log(chalk.blue(`\n🐳 Building ${serviceName}...\n`));

  const spinner = ora(`Building ${serviceName} image...`).start();

  try {
    // Build image
    const buildArgsStr = buildArgs.map(arg => `--build-arg "${arg}"`).join(' ');
    const buildCmd = `docker build --target production --tag ${imageName} ${buildArgsStr} ${contextDir}`;

    await execAsync(buildCmd, {
      timeout: 600000, // 10 minutes per service
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for build output
    });

    spinner.text = `Pushing ${serviceName} to registry...`;

    // Push image
    await execAsync(`docker push ${imageName}`, {
      timeout: 600000 // 10 minutes for push
    });

    spinner.succeed(`${serviceName} built and pushed successfully`);
  } catch (error) {
    spinner.fail(`Failed to build ${serviceName}`);
    throw new Error(`Build failed for ${serviceName}: ${error.message}`);
  }
}

/**
 * Load environment variables from .env.prod
 * @param {string} envFilePath - Path to .env.prod file
 * @returns {Object} Environment variables as key-value pairs
 */
function loadEnvFile(envFilePath) {
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove surrounding quotes if present
      envVars[key] = value.replace(/^["']|["']$/g, '');
    }
  });

  return envVars;
}

/**
 * Build all production images for full app
 * @param {string} projectRoot - Project root directory
 * @param {string} projectName - Project name
 * @param {string} githubOrg - GitHub organization/username
 * @param {string} envFilePath - Path to .env.prod file
 * @param {string[]} installedServices - List of installed services from .launchframe
 * @returns {Promise<void>}
 */
async function buildFullAppImages(projectRoot, projectName, githubOrg, envFilePath, installedServices = []) {
  const registry = `ghcr.io/${githubOrg}`;
  const envVars = loadEnvFile(envFilePath);

  console.log(chalk.yellow('\n📦 Building production Docker images...\n'));
  console.log(chalk.gray('This may take 10-20 minutes depending on your system.\n'));
  console.log(chalk.gray(`Services to build: ${installedServices.join(', ')}\n`));

  // Build backend (always required)
  if (installedServices.includes('backend')) {
    await buildAndPushImage(
      'backend',
      path.join(projectRoot, 'backend'),
      registry,
      projectName
    );
  }

  // Build admin-portal (always required)
  if (installedServices.includes('admin-portal')) {
    await buildAndPushImage(
      'admin-portal',
      path.join(projectRoot, 'admin-portal'),
      registry,
      projectName
    );
  }

  // Build customers-portal (only if installed - B2B2C mode)
  if (installedServices.includes('customers-portal')) {
    await buildAndPushImage(
      'customers-portal',
      path.join(projectRoot, 'customers-portal'),
      registry,
      projectName
    );
  }

  // Build website (always required)
  if (installedServices.includes('website')) {
    const websiteBuildArgs = [
      `APP_NAME=${envVars.APP_NAME || ''}`,
      `DOCS_URL=${envVars.DOCS_URL || ''}`,
      `CONTACT_EMAIL=${envVars.CONTACT_EMAIL || ''}`,
      `CTA_LINK=${envVars.CTA_LINK || ''}`,
      `LIVE_DEMO_URL=${envVars.LIVE_DEMO_URL || ''}`,
      `MIXPANEL_PROJECT_TOKEN=${envVars.MIXPANEL_PROJECT_TOKEN || ''}`,
      `GOOGLE_ANALYTICS_ID=${envVars.GOOGLE_ANALYTICS_ID || ''}`
    ];

    await buildAndPushImage(
      'website',
      path.join(projectRoot, 'website'),
      registry,
      projectName,
      websiteBuildArgs
    );
  }

  // Build docs (optional service - VitePress documentation)
  if (installedServices.includes('docs')) {
    await buildAndPushImage(
      'docs',
      path.join(projectRoot, 'docs'),
      registry,
      projectName
    );
  }
}

/**
 * Build waitlist image
 * @param {string} projectRoot - Project root directory
 * @param {string} projectName - Project name (unused for waitlist, kept for API compatibility)
 * @param {string} githubOrg - GitHub organization/username
 * @returns {Promise<void>}
 */
async function buildWaitlistImage(projectRoot, projectName, githubOrg) {
  const registry = `ghcr.io/${githubOrg}`;
  const waitlistPath = path.join(projectRoot, 'waitlist');
  const imageName = `${registry}/waitlist:latest`;

  console.log(chalk.yellow('\n📦 Building waitlist Docker image...\n'));
  console.log(chalk.gray(`Project root: ${projectRoot}`));
  console.log(chalk.gray(`Waitlist path: ${waitlistPath}\n`));

  // Load environment variables from waitlist .env.prod file (for production build)
  const waitlistEnvProdPath = path.join(waitlistPath, '.env.prod');
  const waitlistEnvPath = path.join(waitlistPath, '.env');

  // Prefer .env.prod for deployment, fallback to .env
  const envFilePath = fs.existsSync(waitlistEnvProdPath) ? waitlistEnvProdPath : waitlistEnvPath;
  let buildArgs = [];

  if (fs.existsSync(envFilePath)) {
    const envVars = loadEnvFile(envFilePath);
    buildArgs = [
      `AIRTABLE_PERSONAL_ACCESS_TOKEN=${envVars.AIRTABLE_PERSONAL_ACCESS_TOKEN || ''}`,
      `AIRTABLE_BASE_ID=${envVars.AIRTABLE_BASE_ID || ''}`,
      `AIRTABLE_TABLE_NAME=${envVars.AIRTABLE_TABLE_NAME || 'Waitlist'}`,
      `NEXT_PUBLIC_PROJECT_NAME=${envVars.NEXT_PUBLIC_PROJECT_NAME || envVars.PROJECT_NAME || ''}`,
      `NEXT_PUBLIC_SITE_URL=${envVars.NEXT_PUBLIC_SITE_URL || ''}`,
      `NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN=${envVars.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN || ''}`,
      `NEXT_PUBLIC_MIXPANEL_DATA_RESIDENCY=${envVars.NEXT_PUBLIC_MIXPANEL_DATA_RESIDENCY || ''}`,
      `PROJECT_NAME=${envVars.PROJECT_NAME || ''}`,
      `PRIMARY_DOMAIN=${envVars.PRIMARY_DOMAIN || ''}`
    ];
  }

  console.log(chalk.blue(`\n🐳 Building waitlist...\n`));

  const spinner = ora(`Building waitlist image...`).start();

  try {
    // Build image
    const buildArgsStr = buildArgs.map(arg => `--build-arg "${arg}"`).join(' ');
    const buildCmd = `docker build --tag ${imageName} ${buildArgsStr} ${waitlistPath}`;

    await execAsync(buildCmd, {
      timeout: 600000, // 10 minutes
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for build output
    });

    spinner.text = `Pushing waitlist to registry...`;

    // Push image
    await execAsync(`docker push ${imageName}`, {
      timeout: 600000 // 10 minutes for push
    });

    spinner.succeed(`waitlist built and pushed successfully`);
  } catch (error) {
    spinner.fail(`Failed to build waitlist`);
    throw new Error(`Build failed for waitlist: ${error.message}`);
  }
}

/**
 * Complete build and push workflow - checks Docker, logs in to GHCR, builds and pushes images
 * @param {Object} options - Workflow options
 * @param {string} options.projectRoot - Project root directory
 * @param {string} options.projectName - Project name
 * @param {string} options.githubOrg - GitHub organization/username
 * @param {string} options.ghcrToken - GitHub Container Registry token
 * @param {string} options.envProdPath - Path to .env.prod file
 * @param {string[]} options.installedServices - List of installed services
 * @param {string} [options.serviceName] - Optional specific service to build (if not provided, builds all)
 * @returns {Promise<void>}
 */
async function buildAndPushWorkflow(options) {
  const {
    projectRoot,
    projectName,
    githubOrg,
    ghcrToken,
    envProdPath,
    installedServices,
    serviceName
  } = options;

  // Step 1: Check Docker is running
  const dockerSpinner = ora('Checking Docker...').start();

  const dockerRunning = await checkDockerRunning();
  if (!dockerRunning) {
    dockerSpinner.fail('Docker is not running');
    throw new Error('Docker is not running. Please start Docker and try again.');
  }

  dockerSpinner.succeed('Docker is running');

  // Step 2: Login to GHCR
  if (!ghcrToken) {
    throw new Error('GHCR token not found. Run deploy:configure to set up your GitHub token.');
  }

  await loginToGHCR(githubOrg, ghcrToken);

  // Step 3: Build and push images
  console.log(chalk.yellow('\n📦 Building and pushing images...\n'));

  if (serviceName) {
    // Build specific service
    if (!installedServices.includes(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in installed services. Available: ${installedServices.join(', ')}`);
    }

    const registry = `ghcr.io/${githubOrg}`;
    const path = require('path');
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
}

module.exports = {
  checkDockerRunning,
  loginToGHCR,
  buildAndPushImage,
  buildFullAppImages,
  buildWaitlistImage,
  buildAndPushWorkflow
};
