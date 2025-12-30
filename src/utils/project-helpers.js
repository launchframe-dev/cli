const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Check if current directory is a LaunchFrame project
 */
function isLaunchFrameProject() {
  const markerPath = path.join(process.cwd(), '.launchframe');
  try {
    return fs.existsSync(markerPath) && fs.statSync(markerPath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Require that the current directory is a LaunchFrame project
 * Exits with error if not
 */
function requireProject() {
  if (!isLaunchFrameProject()) {
    console.error(chalk.red('\n❌ Error: Not in a LaunchFrame project'));
    console.log(chalk.gray('Run this command from the root of your LaunchFrame project.\n'));
    process.exit(1);
  }
}

/**
 * Get project configuration from .launchframe file
 */
function getProjectConfig() {
  requireProject();
  const markerPath = path.join(process.cwd(), '.launchframe');
  const content = fs.readFileSync(markerPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Update project configuration in .launchframe file
 */
function updateProjectConfig(config) {
  const markerPath = path.join(process.cwd(), '.launchframe');
  fs.writeFileSync(markerPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Get list of installed services
 */
function getInstalledComponents() {
  const config = getProjectConfig();
  return config.installedServices || [];
}

/**
 * Check if a service is installed
 */
function isComponentInstalled(componentName) {
  const installedComponents = getInstalledComponents();
  return installedComponents.includes(componentName);
}

/**
 * Add a service to the installed services list
 */
function addInstalledComponent(componentName) {
  const config = getProjectConfig();
  if (!config.installedServices) {
    config.installedServices = [];
  }
  if (!config.installedServices.includes(componentName)) {
    config.installedServices.push(componentName);
    updateProjectConfig(config);
  }
}

/**
 * Get primary domain from config
 * @param {Object} config - Project config object
 * @returns {string|null} Primary domain
 */
function getPrimaryDomain(config) {
  return config.deployment?.primaryDomain || null;
}

/**
 * Check if waitlist service is installed
 * @param {Object} config - Project config object (optional, will fetch if not provided)
 * @returns {boolean}
 */
function isWaitlistInstalled(config = null) {
  if (!config) {
    config = getProjectConfig();
  }
  return (config.installedServices || []).includes('waitlist');
}

module.exports = {
  isLaunchFrameProject,
  requireProject,
  getProjectConfig,
  updateProjectConfig,
  getInstalledComponents,
  isComponentInstalled,
  addInstalledComponent,
  getPrimaryDomain,
  isWaitlistInstalled
};
