const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const { SERVICE_REGISTRY } = require('../services/registry');
const { isLaunchFrameProject, getProjectConfig, updateProjectConfig, getPrimaryDomain } = require('../utils/project-helpers');
const { replaceVariables } = require('../utils/variable-replacer');
const { updateEnvFile } = require('../utils/env-generator');
const { checkGitHubAccess, showAccessDeniedMessage } = require('../utils/github-access');
const { ensureCacheReady, getModulePath } = require('../utils/module-cache');

async function serviceAdd(serviceName) {
  // STEP 1: Validation
  console.log(chalk.blue(`Installing ${serviceName} service...`));

  // Check if inside LaunchFrame project
  if (!isLaunchFrameProject()) {
    console.error(chalk.red('Error: Not in a LaunchFrame project directory'));
    console.log('Run this command from your LaunchFrame project root');
    process.exit(1);
  }

  // Get project config
  const projectConfig = getProjectConfig();
  const projectName = projectConfig.projectName;

  // Check if service exists
  const service = SERVICE_REGISTRY[serviceName];
  if (!service) {
    console.error(chalk.red(`Error: Service "${serviceName}" not found`));
    console.log('\nAvailable services:');
    Object.keys(SERVICE_REGISTRY).forEach(key => {
      console.log(`  - ${key}`);
    });
    process.exit(1);
  }

  // Check if already installed
  const installedServices = projectConfig.installedServices || [];
  if (installedServices.includes(serviceName)) {
    console.error(chalk.red(`Error: Service "${serviceName}" is already installed`));
    process.exit(1);
  }

  // STEP 2: Display service info and confirm
  console.log(chalk.green(`\n${service.displayName}`));
  console.log(service.description);
  console.log(`Tech stack: ${service.techStack}`);
  console.log(`Dependencies: ${service.dependencies.join(', ')}`);

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: 'Continue with installation?',
    default: true
  }]);

  if (!confirmed) {
    console.log('Installation cancelled');
    process.exit(0);
  }

  // STEP 3: Get service files (from cache in production, local in dev)
  const installPath = path.resolve(process.cwd(), serviceName);

  if (fs.existsSync(installPath)) {
    console.error(chalk.red(`Error: Directory ${installPath} already exists`));
    process.exit(1);
  }

  // Check if in development mode
  const isDevMode = process.env.LAUNCHFRAME_DEV === 'true';

  let sourceDir;

  if (isDevMode) {
    // Local development: copy from launchframe-dev/modules directory
    console.log(chalk.blue('\n[DEV MODE] Copying service from local directory...'));
    sourceDir = path.resolve(__dirname, '../../../modules', serviceName);

    if (!fs.existsSync(sourceDir)) {
      console.error(chalk.red(`Error: Local service directory not found: ${sourceDir}`));
      console.log('Make sure the service exists in the modules directory');
      process.exit(1);
    }
  } else {
    // Production mode: Check access and use cache
    console.log(chalk.blue('\n🔍 Checking repository access...'));
    
    const accessCheck = await checkGitHubAccess();
    
    if (!accessCheck.hasAccess) {
      showAccessDeniedMessage();
      process.exit(1);
    }
    
    console.log(chalk.green('✓ Repository access confirmed'));
    
    try {
      // Ensure cache has this service module
      await ensureCacheReady([serviceName]);
      sourceDir = getModulePath(serviceName);
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }

  // Copy service from source to installation path
  try {
    await fs.copy(sourceDir, installPath, {
      filter: (src) => {
        const basename = path.basename(src);
        return !['node_modules', '.git', '.next', 'dist', 'build', '.env'].includes(basename);
      }
    });
    console.log(chalk.green('✓ Service files copied successfully'));
  } catch (error) {
    console.error(chalk.red('Failed to copy service directory'));
    console.error(error.message);
    process.exit(1);
  }

  // STEP 4: Service-specific prompts (e.g., Airtable credentials)
  console.log(chalk.blue('\nConfiguring service...'));
  const envValues = await runServicePrompts(service);

  // STEP 5: Replace template variables
  console.log(chalk.blue('\nCustomizing service for your project...'));

  // Build replacement map for ALL {{TEMPLATE_VARIABLES}}
  const replacements = {
    '{{PROJECT_NAME}}': projectName,
    '{{PROJECT_NAME_UPPER}}': projectName.toUpperCase().replace(/-/g, '_'),
    '{{PROJECT_DISPLAY_NAME}}': projectConfig.projectDisplayName || projectName,
    '{{PRIMARY_DOMAIN}}': getPrimaryDomain(projectConfig) || 'example.com',
    '{{GITHUB_ORG}}': projectConfig.deployment?.githubOrg || projectConfig.githubOrg || 'launchframe'
  };

  // Add service-specific env var values as {{VAR_NAME}} (with double curly braces)
  for (const [key, value] of Object.entries(envValues)) {
    replacements[`{{${key}}}`] = value;
  }

  // Replace all template variables (but preserve Docker Compose ${VAR} syntax)
  await replaceVariables(installPath, replacements);

  // STEP 6: Create service .env file
  console.log(chalk.blue('\nCreating service environment file...'));
  const serviceEnvPath = path.resolve(installPath, '.env');
  let serviceEnvContent = '';
  for (const [key, description] of Object.entries(service.envVars)) {
    serviceEnvContent += `${key}=${envValues[key]}\n`;
  }
  // Add project-specific vars
  serviceEnvContent += `\n# Project Configuration\n`;
  serviceEnvContent += `PROJECT_NAME=${projectConfig.projectDisplayName || projectName}\n`;
  serviceEnvContent += `PRIMARY_DOMAIN=${getPrimaryDomain(projectConfig) || 'localhost'}\n`;
  serviceEnvContent += `NEXT_PUBLIC_PROJECT_NAME=${projectConfig.projectDisplayName || projectName}\n`;
  serviceEnvContent += `NEXT_PUBLIC_SITE_URL=http://localhost:${service.devPort || 3000}\n`;
  await fs.writeFile(serviceEnvPath, serviceEnvContent, 'utf8');

  // Create .env.prod for production deployment
  const serviceEnvProdPath = path.resolve(installPath, '.env.prod');
  let serviceEnvProdContent = serviceEnvContent;
  const productionDomain = getPrimaryDomain(projectConfig);
  if (productionDomain && productionDomain !== 'localhost') {
    serviceEnvProdContent = serviceEnvProdContent.replace(
      /PRIMARY_DOMAIN=.*/g,
      `PRIMARY_DOMAIN=${productionDomain}`
    );
    serviceEnvProdContent = serviceEnvProdContent.replace(
      /NEXT_PUBLIC_SITE_URL=.*/g,
      `NEXT_PUBLIC_SITE_URL=https://${productionDomain}`
    );
  }
  await fs.writeFile(serviceEnvProdPath, serviceEnvProdContent, 'utf8');
  console.log(chalk.green('✓ Created .env (development)'));
  console.log(chalk.green('✓ Created .env.prod (production)'));

  // STEP 7: Update main project .env file (in infrastructure/)
  console.log(chalk.blue('\nUpdating main project environment configuration...'));
  const mainEnvPath = path.resolve(process.cwd(), 'infrastructure', '.env');
  if (fs.existsSync(mainEnvPath)) {
    await updateEnvFile(mainEnvPath, serviceName, service.envVars, envValues);
  }

  // STEP 8: Update .launchframe marker
  projectConfig.installedServices = installedServices;
  projectConfig.installedServices.push(serviceName);
  updateProjectConfig(projectConfig);

  // STEP 8b: For integrated services, append to docker-compose files
  if (!service.standalone) {
    console.log(chalk.blue('\nAdding service to infrastructure docker-compose files...'));
    await appendServiceToDockerCompose(serviceName, service, projectName, projectConfig);
  }

  // STEP 8c: Initialize git repository for the service
  console.log(chalk.blue('\nInitializing git repository for service...'));
  try {
    execSync('git init', { cwd: installPath, stdio: 'ignore' });
    execSync('git add .', { cwd: installPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: installPath, stdio: 'ignore' });
    console.log(chalk.green('✓ Git repository initialized'));
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Could not initialize git repository: ${error.message}`));
  }

  // STEP 9: Success message
  console.log(chalk.green(`\n✓ Service "${serviceName}" installed successfully!`));
  console.log(`\nLocation: ${installPath}`);

  // Service-specific customization reminder
  if (serviceName === 'waitlist') {
    console.log(chalk.yellow('\n📝 Customize the landing page:'));
    console.log(chalk.gray(`    ${serviceName}/src/components/HeroSection.tsx`));
    console.log(chalk.gray(`    ${serviceName}/src/components/BenefitsSection.tsx`));
    console.log(chalk.gray('    (LaunchFrame example content included - update for your product)'));
  }

  // Get service-specific port info
  const devPort = service.devPort || 3000;

  console.log('\nNext steps:');

  // Service-specific instructions
  if (service.standalone) {
    // Standalone services like waitlist
    if (serviceName === 'waitlist') {
      console.log(chalk.cyan('\n  Run locally with Docker (recommended):'));
      console.log(chalk.white(`    launchframe waitlist:up`));
      console.log(chalk.gray(`    → Starts development server at http://localhost:${devPort}`));
      console.log(chalk.gray(`    → Hot reloading enabled`));

      console.log(chalk.cyan('\n  Deploy to production VPS:'));
      console.log(chalk.white(`    launchframe waitlist:deploy`));
      console.log(chalk.gray(`    → Builds and deploys with SSL via Traefik`));

      console.log(chalk.cyan('\n  Other commands:'));
      console.log(chalk.gray(`    launchframe waitlist:down              - Stop running service`));
      console.log(chalk.gray(`    launchframe waitlist:logs              - View service logs`));
    }
  } else {
    // Integrated services like docs
    console.log(chalk.cyan('\n  Run locally with Docker:'));
    console.log(chalk.white(`    launchframe docker:up ${serviceName}`));
    console.log(chalk.gray(`    → Starts ${serviceName} at http://localhost:${devPort}`));
    console.log(chalk.gray(`    → Part of main infrastructure`));

    console.log(chalk.cyan('\n  Or start all services:'));
    console.log(chalk.white(`    launchframe docker:up`));
    console.log(chalk.gray(`    → Includes ${serviceName} + all other services`));

    console.log(chalk.cyan('\n  View logs:'));
    console.log(chalk.white(`    launchframe docker:logs ${serviceName}`));

    console.log(chalk.cyan('\n  Deploy to production:'));
    console.log(chalk.white(`    launchframe deploy:up`));
    console.log(chalk.gray(`    → Deploys entire stack including ${serviceName}`));
    console.log(chalk.gray(`    → Available at https://${serviceName}.your-domain.com`));
  }

  console.log(`\n📖 See README.md in ${serviceName}/ for more details.`);
}

async function runServicePrompts(service) {
  const envValues = {};

  // Prompt for each required env var
  for (const [key, description] of Object.entries(service.envVars)) {
    const { value } = await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: `${description}:`,
      validate: input => input.length > 0 || 'This field is required'
    }]);
    envValues[key] = value;
  }

  return envValues;
}

async function serviceList() {
  console.log(chalk.blue('\nAvailable Services:\n'));

  Object.values(SERVICE_REGISTRY).forEach(service => {
    console.log(chalk.green(`  ${service.name}`));
    console.log(`    ${service.description}`);
    console.log(`    Tech: ${service.techStack}`);
    console.log(`    Dependencies: ${service.dependencies.join(', ')}`);
    console.log('');
  });

  console.log('To install a service:');
  console.log('  launchframe service:add <service-name>');
}

async function serviceRemove(serviceName) {
  console.log(chalk.yellow('Service removal is not yet implemented.'));
  console.log('To manually remove:');
  console.log(`  1. rm -rf ${serviceName}/`);
  console.log(`  2. Edit .launchframe to remove "${serviceName}" from installedServices array`);
}

/**
 * Append service definitions to infrastructure docker-compose files
 * Used for integrated services (not standalone like waitlist)
 */
async function appendServiceToDockerCompose(serviceName, service, projectName, projectConfig) {
  const infrastructurePath = path.resolve(process.cwd(), 'infrastructure');

  // Define service configurations for each docker-compose file
  const serviceDefinitions = getDockerComposeDefinitions(serviceName, service, projectName, projectConfig);

  // Append to base docker-compose.yml
  await appendToComposeFile(
    path.join(infrastructurePath, 'docker-compose.yml'),
    serviceDefinitions.base.service,
    serviceDefinitions.base.volumes
  );
  console.log(chalk.green('✓ Added to docker-compose.yml'));

  // Append to docker-compose.dev.yml
  await appendToComposeFile(
    path.join(infrastructurePath, 'docker-compose.dev.yml'),
    serviceDefinitions.dev.service,
    serviceDefinitions.dev.volumes
  );
  console.log(chalk.green('✓ Added to docker-compose.dev.yml'));

  // Append to docker-compose.prod.yml
  await appendToComposeFile(
    path.join(infrastructurePath, 'docker-compose.prod.yml'),
    serviceDefinitions.prod.service,
    serviceDefinitions.prod.volumes
  );
  console.log(chalk.green('✓ Added to docker-compose.prod.yml'));
}

/**
 * Get docker-compose service definitions for a service
 */
function getDockerComposeDefinitions(serviceName, service, projectName, projectConfig) {
  const definitions = {};

  // Base configuration (docker-compose.yml)
  if (serviceName === 'customers-portal') {
    definitions.base = {
      service: `
  # ---------------------------------------------------------------------------
  # ${service.displayName} - ${service.techStack}
  # ---------------------------------------------------------------------------
  ${serviceName}:
    networks:
      - ${projectName}-network
    depends_on:
      - backend
    environment:
      - API_BASE_URL=\${API_BASE_URL}
      - WEBSITE_BASE_URL=\${WEBSITE_BASE_URL}
      - FRONTEND_BASE_URL=\${FRONTEND_BASE_URL}
      - USER_FRONTEND_SENTRY_DSN=\${USER_FRONTEND_SENTRY_DSN}
`,
      volumes: null
    };
  } else {
    definitions.base = {
      service: `
  # ---------------------------------------------------------------------------
  # ${service.displayName} - ${service.techStack}
  # ---------------------------------------------------------------------------
  ${serviceName}:
    networks:
      - ${projectName}-network
`,
      volumes: null
    };
  }

  // Development configuration (docker-compose.dev.yml)
  if (serviceName === 'docs') {
    definitions.dev = {
      service: `
  ${serviceName}:
    container_name: ${projectName}-${serviceName}
    build:
      context: ../${serviceName}
      dockerfile: Dockerfile
      target: development
    image: ${projectName}-${serviceName}:dev
    restart: "no"
    volumes:
      - ../${serviceName}/.vitepress:/app/.vitepress
      - ../${serviceName}/content:/app/content
      - ../${serviceName}/public:/app/public
      - ${serviceName}_node_modules:/app/node_modules
    environment:
      - NODE_ENV=development
    ports:
      - "${service.devPort}:${service.devPort}"
`,
      volumes: `  ${serviceName}_node_modules:
    name: ${projectName}-${serviceName}-node-modules
`
    };
  } else if (serviceName === 'customers-portal') {
    definitions.dev = {
      service: `
  ${serviceName}:
    container_name: ${projectName}-${serviceName}
    build:
      context: ../${serviceName}
      dockerfile: Dockerfile
      target: development
    image: ${projectName}-${serviceName}:dev
    volumes:
      - ../${serviceName}:/app
      - ${serviceName}_node_modules:/app/node_modules
      - ${serviceName}_dist:/app/dist
    command: npm run dev -- --host 0.0.0.0 --port ${service.devPort}
    environment:
      - NODE_ENV=development
      - PORT=${service.devPort}
      - API_BASE_URL=\${API_BASE_URL}
      - WEBSITE_BASE_URL=\${WEBSITE_BASE_URL}
      - FRONTEND_BASE_URL=\${FRONTEND_BASE_URL}
      - USER_FRONTEND_SENTRY_DSN=\${USER_FRONTEND_SENTRY_DSN}
    ports:
      - "${service.devPort}:${service.devPort}"
    stdin_open: true
    tty: true
`,
      volumes: `  ${serviceName}_node_modules:
    name: ${projectName}-${serviceName}-node-modules
  ${serviceName}_dist:
    name: ${projectName}-${serviceName}-dist
`
    };
  }

  // Production configuration (docker-compose.prod.yml)
  const githubOrg = projectConfig.deployment?.githubOrg || 'launchframe';
  const primaryDomain = projectConfig.deployment?.primaryDomain || 'example.com';

  if (serviceName === 'docs') {
    definitions.prod = {
      service: `
  ${serviceName}:
    image: ghcr.io/${githubOrg}/${projectName}-${serviceName}:latest
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${serviceName}.rule=Host(\`${serviceName}.\${PRIMARY_DOMAIN}\`)"
      - "traefik.http.routers.${serviceName}.entrypoints=websecure"
      - "traefik.http.routers.${serviceName}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${serviceName}.loadbalancer.server.port=3000"
`,
      volumes: null // No volumes needed in prod config
    };
  } else if (serviceName === 'customers-portal') {
    definitions.prod = {
      service: `
  ${serviceName}:
    image: ghcr.io/${githubOrg}/${projectName}-${serviceName}:latest
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    labels:
      - "traefik.enable=true"
      # Main app router (app.\${PRIMARY_DOMAIN}) - Higher priority
      - "traefik.http.routers.app.rule=Host(\`app.\${PRIMARY_DOMAIN}\`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.routers.app.priority=100"
      - "traefik.http.routers.app.service=app"
      # Wildcard router (*.\${PRIMARY_DOMAIN}) - Lower priority, catches undefined subdomains
      - "traefik.http.routers.app-wildcard.rule=HostRegexp(\`{subdomain:[a-z0-9-]+}.\${PRIMARY_DOMAIN}\`)"
      - "traefik.http.routers.app-wildcard.entrypoints=websecure"
      - "traefik.http.routers.app-wildcard.tls.certresolver=letsencrypt"
      - "traefik.http.routers.app-wildcard.tls.domains[0].main=*.\${PRIMARY_DOMAIN}"
      - "traefik.http.routers.app-wildcard.priority=50"
      - "traefik.http.routers.app-wildcard.service=app"
      # Service definition (shared by both routers)
      - "traefik.http.services.app.loadbalancer.server.port=80"
`,
      volumes: null // No volumes needed in prod config
    };
  }

  return definitions;
}

/**
 * Append content to a docker-compose file
 * Properly handles separate services and volumes sections
 */
async function appendToComposeFile(filePath, serviceContent, volumesContent) {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`Docker Compose file not found: ${filePath}`);
  }

  // Read existing content
  let existingContent = await fs.readFile(filePath, 'utf8');

  // Extract service name from serviceContent
  const serviceName = serviceContent.match(/^\s+(\w+):/m)?.[1];
  if (!serviceName) {
    throw new Error('Could not extract service name from service definition');
  }

  // Check if service already exists
  if (existingContent.includes(`  ${serviceName}:`)) {
    console.log(chalk.yellow(`⚠️  Service "${serviceName}" already exists in ${path.basename(filePath)}, skipping...`));
    return;
  }

  // Find where to insert the service (before networks/volumes sections)
  // Look for the section markers to insert services in the right place
  const networksSectionMatch = existingContent.match(/\n# ={5,}\n# Networks\n# ={5,}\nnetworks:/);
  const volumesSectionMatch = existingContent.match(/\n# ={5,}\n# Volumes/);

  if (networksSectionMatch) {
    // Insert service before the Networks section header
    const insertPosition = networksSectionMatch.index;
    existingContent =
      existingContent.slice(0, insertPosition) +
      '\n' + serviceContent +
      existingContent.slice(insertPosition);
  } else if (volumesSectionMatch) {
    // Insert service before the Volumes section header
    const insertPosition = volumesSectionMatch.index;
    existingContent =
      existingContent.slice(0, insertPosition) +
      '\n' + serviceContent +
      existingContent.slice(insertPosition);
  } else {
    // No sections found, append at end
    existingContent += '\n' + serviceContent;
  }

  // Handle volumes section if provided
  if (volumesContent) {
    // Find the existing "volumes:" section
    const volumesKeyMatch = existingContent.match(/\nvolumes:\n/);

    if (volumesKeyMatch) {
      // Find the position after "volumes:\n"
      const volumesPosition = volumesKeyMatch.index + volumesKeyMatch[0].length;

      // Insert the new volume definition right after "volumes:"
      existingContent =
        existingContent.slice(0, volumesPosition) +
        volumesContent +
        existingContent.slice(volumesPosition);
    } else {
      // No volumes section exists yet, create one
      existingContent += '\n# =============================================================================\n';
      existingContent += '# Volumes\n';
      existingContent += '# =============================================================================\n';
      existingContent += 'volumes:\n';
      existingContent += volumesContent;
    }
  }

  // Write back to file
  await fs.writeFile(filePath, existingContent, 'utf8');
}

module.exports = {
  serviceAdd,
  serviceList,
  serviceRemove
};
