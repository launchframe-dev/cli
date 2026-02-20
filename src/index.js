#!/usr/bin/env node

const chalk = require('chalk');
const { isLaunchFrameProject } = require('./utils/project-helpers');
const logger = require('./utils/logger');
const { initTelemetry, trackEvent, sanitize, setTelemetryEnabled, showTelemetryStatus } = require('./utils/telemetry');

// Detect locally linked version: npm link installs to global node_modules
// as a symlink. When running from a real install, __dirname is inside the
// global node_modules folder. When linked, it resolves to the source directory.
const isDevMode = !__dirname.includes('node_modules');
if (isDevMode) {
  const packageJson = require('../package.json');
  console.log(chalk.yellow(`⚠ Running locally linked CLI v${packageJson.version} (${__dirname})`));
}

// Import commands
const { init } = require('./commands/init');
const { deployConfigure } = require('./commands/deploy-configure');
const { deploySetEnv } = require('./commands/deploy-set-env');
const { deployInit } = require('./commands/deploy-init');
const { deployUp } = require('./commands/deploy-up');
const { deployBuild } = require('./commands/deploy-build');
const { waitlistDeploy } = require('./commands/waitlist-deploy');
const { waitlistUp } = require('./commands/waitlist-up');
const { waitlistDown } = require('./commands/waitlist-down');
const { waitlistLogs } = require('./commands/waitlist-logs');
const { dockerBuild } = require('./commands/docker-build');
const { dockerUp } = require('./commands/docker-up');
const { dockerDown } = require('./commands/docker-down');
const { dockerLogs } = require('./commands/docker-logs');
const { migrateRun } = require('./commands/migration-run');
const { migrateCreate } = require('./commands/migration-create');
const { migrateRevert } = require('./commands/migration-revert');
const { dockerDestroy } = require('./commands/docker-destroy');
const { doctor } = require('./commands/doctor');
const { help } = require('./commands/help');
const {
  serviceAdd,
  serviceList,
  serviceRemove
} = require('./commands/service');
const { cacheClear, cacheInfo, cacheUpdate } = require('./commands/cache');

// Get command and arguments
const command = process.argv[2];
const args = process.argv.slice(2);

/**
 * Parse flags from command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed flags
 */
function parseFlags(args) {
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const flagName = arg.substring(2);
      const nextArg = args[i + 1];
      // Check if next arg is a value (not a flag)
      if (nextArg && !nextArg.startsWith('-')) {
        flags[flagName] = nextArg;
        i++; // Skip next arg since we consumed it
      } else {
        flags[flagName] = true; // Boolean flag
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const flagName = arg.substring(1);
      flags[flagName] = true; // Short flag (always boolean)
    }
  }
  return flags;
}

/**
 * Main CLI router
 */
async function main() {
  initTelemetry();

  const inProject = isLaunchFrameProject();
  const flags = parseFlags(args);

  // Handle version flag (only as standalone command)
  if (command === '--version') {
    const packageJson = require('../package.json');
    console.log(packageJson.version);
    process.exit(0);
  }

  // Set verbose mode globally
  if (flags.verbose || flags.v) {
    logger.setVerbose(true);
  }

  // No command provided
  if (!command) {
    help();
    process.exit(inProject ? 1 : 0);
  }

  // Route commands
  switch (command) {
    case 'init':
      await init({
        projectName: flags['project-name'],
        tenancy: flags['tenancy'],
        userModel: flags['user-model']
      });
      break;
    case 'deploy:configure':
      await deployConfigure();
      break;
    case 'deploy:set-env':
      await deploySetEnv();
      break;
    case 'deploy:init':
      await deployInit();
      break;
    case 'deploy:up':
      await deployUp();
      break;
    case 'deploy:build':
      await deployBuild(args[1]); // Optional service name
      break;
    case 'waitlist:deploy':
      await waitlistDeploy();
      break;
    case 'waitlist:up':
      await waitlistUp(flags);
      break;
    case 'waitlist:down':
      await waitlistDown();
      break;
    case 'waitlist:logs':
      await waitlistLogs();
      break;
    case 'docker:build':
      await dockerBuild();
      break;
    case 'docker:up':
      await dockerUp(args[1]); // Pass optional service name
      break;
    case 'docker:down':
      await dockerDown();
      break;
    case 'docker:logs':
      await dockerLogs();
      break;
    case 'docker:destroy':
      await dockerDestroy({ force: flags.force || flags.f });
      break;
    case 'migration:run':
      await migrateRun();
      break;
    case 'migration:create':
      await migrateCreate();
      break;
    case 'migration:revert':
      await migrateRevert();
      break;
    case 'doctor':
      await doctor();
      break;
    case 'service:add':
      if (!args[1]) {
        console.error(chalk.red('Error: Service name required'));
        console.log('Usage: launchframe service:add <service-name>');
        process.exit(1);
      }
      await serviceAdd(args[1]);
      break;
    case 'service:list':
      await serviceList();
      break;
    case 'service:remove':
      if (!args[1]) {
        console.error(chalk.red('Error: Service name required'));
        console.log('Usage: launchframe service:remove <service-name>');
        process.exit(1);
      }
      await serviceRemove(args[1]);
      break;
    case 'cache:clear':
      await cacheClear();
      break;
    case 'cache:info':
      await cacheInfo();
      break;
    case 'cache:update':
      await cacheUpdate();
      break;
    case 'telemetry':
      if (flags.disable) {
        setTelemetryEnabled(false);
      } else if (flags.enable) {
        setTelemetryEnabled(true);
      } else {
        showTelemetryStatus();
      }
      break;
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      console.error(chalk.red(`\nUnknown command: ${command}\n`));
      help();
      process.exit(1);
  }
}

main()
  .then(() => {
    if (command && command !== 'help' && command !== '--help' && command !== '-h' && command !== '--version') {
      trackEvent('command_executed', { command, success: true });
    }
  })
  .catch((error) => {
    trackEvent('command_executed', {
      command,
      success: false,
      error_message: sanitize(error.message)
    });
    console.error(chalk.red(error.message));
    process.exit(1);
  });
