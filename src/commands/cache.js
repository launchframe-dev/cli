const chalk = require('chalk');
const { clearCache, getCacheInfo } = require('../utils/service-cache');

/**
 * Clear service cache
 * @param {Object} flags - Optional flags
 * @param {boolean} flags.yes - Skip confirmation prompt
 * @param {boolean} flags.y - Skip confirmation prompt (short form)
 */
async function cacheClear(flags = {}) {
  console.log(chalk.yellow('\n⚠️  This will delete all cached services'));
  console.log(chalk.gray('You will need to re-download on next init or service:add\n'));

  if (!(flags.yes || flags.y)) {
    const inquirer = require('inquirer');
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Continue with cache clear?',
      default: false
    }]);

    if (!confirmed) {
      console.log('Cancelled');
      return;
    }
  }

  await clearCache();
}

/**
 * Show cache information
 */
async function cacheInfo() {
  const info = await getCacheInfo();
  
  console.log(chalk.blue('\n📦 Service Cache Information\n'));
  
  console.log(chalk.white('Location:'));
  console.log(chalk.gray(`  ${info.path}\n`));
  
  if (!info.exists) {
    console.log(chalk.yellow('Status: Not initialized'));
    console.log(chalk.gray('Cache will be created on first use\n'));
    return;
  }
  
  console.log(chalk.green('Status: Active\n'));
  
  if (info.size !== undefined) {
    const sizeMB = (info.size / 1024 / 1024).toFixed(2);
    console.log(chalk.white('Size:'));
    console.log(chalk.gray(`  ${sizeMB} MB\n`));
  }
  
  if (info.lastUpdate) {
    console.log(chalk.white('Last Updated:'));
    console.log(chalk.gray(`  ${info.lastUpdate.toLocaleString()}\n`));
  }
  
  if (info.services && info.services.length > 0) {
    console.log(chalk.white('Cached Services:'));
    info.services.forEach(mod => {
      console.log(chalk.gray(`  • ${mod}`));
    });
    console.log('');
  } else {
    console.log(chalk.gray('No services cached yet\n'));
  }
  
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  launchframe cache:clear  - Delete cache'));
  console.log(chalk.gray('  launchframe cache:update - Force update\n'));
}

/**
 * Force update cache
 */
async function cacheUpdate() {
  const { ensureCacheReady, getCacheInfo } = require('../utils/service-cache');
  
  console.log(chalk.blue('\n🔄 Forcing cache update...\n'));
  
  try {
    const info = await getCacheInfo();
    const currentServices = info.services || [];
    
    if (currentServices.length === 0) {
      console.log(chalk.yellow('No services in cache yet. Use init or service:add to populate.\n'));
      return;
    }
    
    // Update cache with current services
    await ensureCacheReady(currentServices);
    console.log(chalk.green('\n✓ Cache updated successfully\n'));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to update cache: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = {
  cacheClear,
  cacheInfo,
  cacheUpdate
};
