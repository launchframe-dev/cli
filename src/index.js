#!/usr/bin/env node

const chalk = require('chalk');
const { isLaunchFrameProject } = require('./utils/project-helpers');
const logger = require('./utils/logger');
const packageJson = require('../package.json');

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
  const inProject = isLaunchFrameProject();
  const flags = parseFlags(args);

  // Handle version flag (only as standalone command)
  if (command === '--version') {
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

main();
