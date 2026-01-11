const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { execSync } = require('child_process');
const chalk = require('chalk');

const SERVICES_REPO = 'git@github.com:launchframe-dev/services.git';
const BRANCH = 'main';

/**
 * Get the cache directory path
 * Works cross-platform (Linux, Mac, Windows)
 * @returns {string} Cache directory path
 */
function getCacheDir() {
  const homeDir = os.homedir();
  // Use same path structure on all platforms
  // Windows: C:\Users\username\.launchframe\cache\services
  // Mac/Linux: /home/username/.launchframe/cache/services
  return path.join(homeDir, '.launchframe', 'cache', 'services');
}

/**
 * Check if cache exists and is valid
 * @returns {boolean} True if cache exists
 */
async function cacheExists() {
  const cacheDir = getCacheDir();
  const gitDir = path.join(cacheDir, '.git');
  return await fs.pathExists(gitDir);
}

/**
 * Initialize cache with sparse checkout
 * Clones only the repository structure, no services yet
 * @returns {Promise<void>}
 */
async function initializeCache() {
  const cacheDir = getCacheDir();

  console.log(chalk.blue('🔄 Initializing services cache...'));

  try {
    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(cacheDir));

    // Sparse clone (only root files, no services)
    execSync(
      `git clone --sparse --depth 1 --branch ${BRANCH} ${SERVICES_REPO} "${cacheDir}"`,
      {
        stdio: 'pipe', // Hide output
        timeout: 60000 // 1 minute timeout
      }
    );

    // Configure sparse checkout (starts with empty set)
    execSync('git sparse-checkout init --cone', {
      cwd: cacheDir,
      stdio: 'pipe'
    });

    console.log(chalk.green('✓ Cache initialized'));
  } catch (error) {
    // Clean up partial clone on failure
    await fs.remove(cacheDir);
    throw new Error(`Failed to initialize cache: ${error.message}`);
  }
}

/**
 * Update cache to latest version from main branch
 * Requires internet connection
 * @returns {Promise<void>}
 */
async function updateCache() {
  const cacheDir = getCacheDir();

  console.log(chalk.blue('🔄 Updating service cache...'));

  try {
    execSync('git pull origin main', {
      cwd: cacheDir,
      stdio: 'pipe',
      timeout: 30000 // 30 seconds
    });

    console.log(chalk.green('✓ Cache updated'));
  } catch (error) {
    throw new Error(`Failed to update cache: ${error.message}`);
  }
}

/**
 * Expand sparse checkout to include specific services
 * @param {string[]} serviceNames - Array of services names to expand
 * @returns {Promise<void>}
 */
async function expandServices(serviceNames) {
  const cacheDir = getCacheDir();

  console.log(chalk.blue(`📦 Loading services: ${serviceNames.join(', ')}...`));

  try {
    // Get current sparse checkout list
    let currentServices = [];
    try {
      const output = execSync('git sparse-checkout list', {
        cwd: cacheDir,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      currentServices = output.trim().split('\n').filter(Boolean);
    } catch (error) {
      // No services yet, that's fine
    }

    // Add new services to the list
    const allServices = [...new Set([...currentServices, ...serviceNames])];

    // Set sparse checkout to include all services
    execSync(`git sparse-checkout set ${allServices.join(' ')}`, {
      cwd: cacheDir,
      stdio: 'pipe',
      timeout: 60000 // 1 minute (may need to download files)
    });

    console.log(chalk.green('✓ Services loaded'));
  } catch (error) {
    throw new Error(`Failed to expand services: ${error.message}`);
  }
}

/**
 * Get path to a specific service in the cache
 * @param {string} serviceName - Service name (e.g., 'backend', 'admin-portal')
 * @returns {string} Absolute path to service
 */
function getServicePath(serviceName) {
  const cacheDir = getCacheDir();
  return path.join(cacheDir, serviceName);
}

/**
 * Get cache root path
 * @returns {string} Absolute path to cache root
 */
function getCachePath() {
  return getCacheDir();
}

/**
 * Clear the entire service cache
 * Useful for troubleshooting or forcing fresh download
 * @returns {Promise<void>}
 */
async function clearCache() {
  const cacheDir = getCacheDir();

  if (await fs.pathExists(cacheDir)) {
    await fs.remove(cacheDir);
    console.log(chalk.green('✓ Cache cleared'));
  } else {
    console.log(chalk.gray('Cache is already empty'));
  }
}

/**
 * Get cache information (size, last update, services)
 * @returns {Promise<{exists: boolean, path: string, size?: number, services?: string[], lastUpdate?: Date}>}
 */
async function getCacheInfo() {
  const cacheDir = getCacheDir();
  const info = {
    exists: false,
    path: cacheDir
  };

  if (!(await cacheExists())) {
    return info;
  }

  info.exists = true;

  try {
    // Get cache size (du command works on Unix/Mac, different on Windows)
    if (process.platform === 'win32') {
      // Windows: use powershell to get size
      const output = execSync(
        `powershell -command "(Get-ChildItem -Path '${cacheDir}' -Recurse | Measure-Object -Property Length -Sum).Sum"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      info.size = parseInt(output.trim());
    } else {
      // Unix/Mac: use du
      const output = execSync(`du -sb "${cacheDir}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      info.size = parseInt(output.split('\t')[0]);
    }
  } catch (error) {
    // Size calculation failed, not critical
  }

  try {
    // Get list of expanded services
    const output = execSync('git sparse-checkout list', {
      cwd: cacheDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    info.services = output.trim().split('\n').filter(Boolean);
  } catch (error) {
    info.services = [];
  }

  try {
    // Get last update time from git log
    const output = execSync('git log -1 --format=%cd --date=iso', {
      cwd: cacheDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    info.lastUpdate = new Date(output.trim());
  } catch (error) {
    // Last update time failed, not critical
  }

  return info;
}

/**
 * Ensure cache is ready (initialize if needed, update if exists)
 * This is the main entry point for cache management
 * @param {string[]} requiredServices - Services needed for the operation
 * @returns {Promise<string>} Path to cache root
 */
async function ensureCacheReady(requiredServices) {
  try {
    if (!(await cacheExists())) {
      // Cache doesn't exist, initialize it
      await initializeCache();
    } else {
      // Cache exists, update it
      await updateCache();
    }

    // Expand sparse checkout to include required services
    await expandServices(requiredServices);

    return getCachePath();
  } catch (error) {
    // If we fail and it's a network error, provide helpful message
    if (error.message.includes('Connection') || error.message.includes('timed out')) {
      throw new Error(
        'Cannot connect to GitHub. Please check your internet connection and try again.'
      );
    }
    throw error;
  }
}

module.exports = {
  getCacheDir,
  cacheExists,
  initializeCache,
  updateCache,
  expandServices,
  getServicePath,
  getCachePath,
  clearCache,
  getCacheInfo,
  ensureCacheReady
};
