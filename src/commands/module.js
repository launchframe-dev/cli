const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { MODULE_REGISTRY } = require('../services/module-registry');
const { MODULE_CONFIG } = require('../services/module-config');
const { installModule } = require('../utils/module-installer');
const { dockerBuild } = require('./docker-build');
const { dockerDown } = require('./docker-down');
const { dockerUp } = require('./docker-up');
const {
  requireProject,
  getProjectConfig,
  getInstalledModules,
  isModuleInstalled,
  addInstalledModule
} = require('../utils/project-helpers');

// Core services that can't be added via service:add
const CORE_SERVICES = ['backend', 'admin-portal', 'infrastructure', 'website'];

async function moduleList() {
  requireProject();

  const installedModules = getInstalledModules();
  const modules = Object.values(MODULE_REGISTRY);

  console.log(chalk.blue('\nAvailable Modules:\n'));

  modules.forEach(mod => {
    const installed = installedModules.includes(mod.name);
    const status = installed ? chalk.green(' [installed]') : '';
    console.log(chalk.green(`  ${mod.name}`) + status);
    console.log(`    ${mod.description}`);
    console.log(`    Affects services: ${mod.services.join(', ')}`);
    console.log('');
  });

  console.log('To install a module:');
  console.log('  launchframe module:add <module-name>');
}

async function moduleAdd(moduleName) {
  requireProject();

  // Validate module exists in registry
  const mod = MODULE_REGISTRY[moduleName];
  if (!mod) {
    console.error(chalk.red(`Error: Module "${moduleName}" not found`));
    console.log('\nAvailable modules:');
    Object.keys(MODULE_REGISTRY).forEach(key => {
      console.log(`  - ${key}`);
    });
    process.exit(1);
  }

  // Check not already installed
  if (isModuleInstalled(moduleName)) {
    console.error(chalk.red(`Error: Module "${moduleName}" is already installed`));
    process.exit(1);
  }

  // Validate required services
  const config = getProjectConfig();
  const installedServices = config.installedServices || [];
  const errors = [];

  for (const service of mod.services) {
    // Check if service is in installedServices
    if (!installedServices.includes(service)) {
      if (CORE_SERVICES.includes(service)) {
        errors.push(`Core service '${service}' is missing from your project`);
      } else {
        errors.push(`Service '${service}' is not installed. Install it first with: launchframe service:add ${service}`);
      }
      continue;
    }

    // Check if service directory exists on disk
    const serviceDir = path.join(process.cwd(), service);
    if (!fs.existsSync(serviceDir)) {
      errors.push(`Service '${service}' directory not found. Your project structure may be corrupted.`);
    }
  }

  if (errors.length > 0) {
    console.error(chalk.red(`\nCannot install module "${moduleName}":\n`));
    errors.forEach(err => {
      console.error(chalk.red(`  - ${err}`));
    });
    process.exit(1);
  }

  // Display module info and confirm
  console.log(chalk.green(`\n${mod.displayName}`));
  console.log(mod.description);
  console.log(`Affects services: ${mod.services.join(', ')}`);

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: `Add module "${mod.displayName}" to your project?`,
    default: true
  }]);

  if (!confirmed) {
    console.log('Installation cancelled');
    process.exit(0);
  }

  const affectedServices = [...new Set(Object.keys(MODULE_CONFIG[moduleName] || {}))].filter(s => s !== 'infrastructure');
  const infrastructurePath = path.join(process.cwd(), 'infrastructure');
  const composeCmd = 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml';

  // Bring the stack down and remove affected containers before touching files
  await dockerDown();
  for (const service of affectedServices) {
    try {
      execSync(`${composeCmd} rm -f ${service}`, { cwd: infrastructurePath, stdio: 'inherit' });
    } catch (_) {
      // Container may already be gone — that's fine
    }
  }

  // Register module in .launchframe
  addInstalledModule(moduleName);

  // Install module files, sections, and dependencies
  const moduleServiceConfig = MODULE_CONFIG[moduleName];
  if (moduleServiceConfig) {
    await installModule(moduleName, moduleServiceConfig);
  }

  console.log(chalk.green(`\n✓ Module "${moduleName}" installed successfully!`));

  // Rebuild affected containers
  for (const service of affectedServices) {
    await dockerBuild(service);
  }

  // Restart the full stack in watch mode
  await dockerUp();
}

module.exports = { moduleAdd, moduleList };
