const chalk = require('chalk');
const { isLaunchFrameProject, isWaitlistInstalled } = require('../utils/project-helpers');

/**
 * Show help message
 */
function help() {
  const inProject = isLaunchFrameProject();

  console.log(chalk.blue.bold('\nLaunchFrame CLI\n'));
  console.log(chalk.white('Usage:'));
  console.log(chalk.gray('  launchframe [command] [options]\n'));
  console.log(chalk.white('Global options:'));
  console.log(chalk.gray('  --verbose, -v           Show detailed output'));
  console.log(chalk.gray('  --version               Show version number\n'));

  if (inProject) {
    console.log(chalk.white('Deployment commands:'));
    console.log(chalk.gray('  deploy:configure  Configure production deployment settings'));
    console.log(chalk.gray('  deploy:set-env    Configure production environment variables'));
    console.log(chalk.gray('  deploy:init       Initialize VPS and build Docker images'));
    console.log(chalk.gray('  deploy:up         Start services on VPS'));
    console.log(chalk.gray('  deploy:build [service]  Build, push, and deploy (all or specific service)\n'));

    // Conditionally show waitlist commands
    if (isWaitlistInstalled()) {
      console.log(chalk.white('Waitlist commands:'));
      console.log(chalk.gray('  waitlist:deploy   Build and deploy waitlist component to VPS'));
      console.log(chalk.gray('  waitlist:up       Start waitlist component locally'));
      console.log(chalk.gray('  waitlist:down     Stop waitlist component locally'));
      console.log(chalk.gray('  waitlist:logs     View waitlist logs from VPS\n'));
    }
    console.log(chalk.white('Local Docker commands:'));
    console.log(chalk.gray('  docker:build                Build all Docker images'));
    console.log(chalk.gray('  docker:up [service]         Start all services or specific service (detached)'));
    console.log(chalk.gray('  docker:down                 Stop all services (keeps data)'));
    console.log(chalk.gray('  docker:logs [service]       View logs from all services or specific service'));
    console.log(chalk.gray('  docker:destroy              Remove all resources (containers, volumes, images)'));
    console.log(chalk.gray('    --force, -f               Skip confirmation prompt\n'));
    console.log(chalk.white('Service Management:'));
    console.log(chalk.gray('  service:add <name>     Add an optional service to your project'));
    console.log(chalk.gray('  service:list           List available services'));
    console.log(chalk.gray('  service:remove <name>  Remove installed service\n'));
    console.log(chalk.white('Available Services:'));
    console.log(chalk.gray('  waitlist          Coming soon page with email collection\n'));
    console.log(chalk.white('Cache Management:'));
    console.log(chalk.gray('  cache:info        Show cache location, size, and cached services'));
    console.log(chalk.gray('  cache:update      Force update cache to latest version'));
    console.log(chalk.gray('  cache:clear       Delete cache (re-download on next use)\n'));
    console.log(chalk.white('Other commands:'));
    console.log(chalk.gray('  doctor            Check project health and configuration'));
    console.log(chalk.gray('  help              Show this help message\n'));
    console.log(chalk.white('Examples:'));
    console.log(chalk.gray('  # Deploy full app to production'));
    console.log(chalk.gray('  launchframe deploy:configure'));
    console.log(chalk.gray('  launchframe deploy:set-env'));
    console.log(chalk.gray('  launchframe deploy:init'));
    console.log(chalk.gray('  launchframe deploy:up\n'));

    // Conditionally show waitlist example
    if (isWaitlistInstalled()) {
      console.log(chalk.gray('  # Deploy waitlist component'));
      console.log(chalk.gray('  launchframe waitlist:deploy'));
      console.log(chalk.gray('  launchframe waitlist:up\n'));
    }

    console.log(chalk.gray('  # Local development'));
    console.log(chalk.gray('  launchframe docker:up              # Start all services'));
    console.log(chalk.gray('  launchframe docker:up docs         # Start specific service'));
    console.log(chalk.gray('  launchframe docker:logs backend    # View backend logs\n'));
    console.log(chalk.gray('  # Add services'));
    console.log(chalk.gray('  launchframe service:add docs'));
    console.log(chalk.gray('  launchframe docker:up docs         # Start the docs service\n'));
  } else {
    console.log(chalk.white('Available commands:'));
    console.log(chalk.gray('  init                        Initialize a new LaunchFrame project'));
    console.log(chalk.gray('    --project-name <name>     Project name (skips prompt)'));
    console.log(chalk.gray('    --tenancy <single|multi>  Tenancy model (skips prompt)'));
    console.log(chalk.gray('    --user-model <b2b|b2b2c>  User model (skips prompt)'));
    console.log(chalk.gray('  help                        Show this help message\n'));
    console.log(chalk.white('Cache Management:'));
    console.log(chalk.gray('  cache:info        Show cache location, size, and cached services'));
    console.log(chalk.gray('  cache:update      Force update cache to latest version'));
    console.log(chalk.gray('  cache:clear       Delete cache (re-download on next use)\n'));
    console.log(chalk.white('Examples:'));
    console.log(chalk.gray('  # Interactive mode'));
    console.log(chalk.gray('  launchframe init\n'));
    console.log(chalk.gray('  # Non-interactive mode'));
    console.log(chalk.gray('  launchframe init --project-name my-saas --tenancy single --user-model b2b\n'));
    console.log(chalk.gray('  # With verbose output'));
    console.log(chalk.gray('  launchframe init --verbose\n'));
  }
}

module.exports = { help };
