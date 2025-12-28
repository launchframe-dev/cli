const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

/**
 * Start Docker services (all or specific service)
 * @param {string} serviceName - Optional service name to start (e.g., 'docs', 'backend')
 */
async function dockerUp(serviceName) {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  if (serviceName) {
    console.log(chalk.blue.bold(`\n🚀 Starting ${serviceName} service\n`));
    console.log(chalk.gray(`Starting ${serviceName} in detached mode...\n`));
  } else {
    console.log(chalk.blue.bold('\n🚀 Starting Docker Services\n'));
    console.log(chalk.gray('Starting all services in detached mode...\n'));
  }

  try {
    const upCommand = serviceName
      ? `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d ${serviceName}`
      : 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d';

    console.log(chalk.gray(`Running: ${upCommand}\n`));

    execSync(upCommand, {
      cwd: infrastructurePath,
      stdio: 'inherit'
    });

    if (serviceName) {
      console.log(chalk.green.bold(`\n✅ ${serviceName} service started successfully!\n`));
      console.log(chalk.white('Useful commands:'));
      console.log(chalk.gray(`  launchframe docker:logs ${serviceName}   # View logs`));
      console.log(chalk.gray(`  docker-compose -f docker-compose.yml -f docker-compose.dev.yml down ${serviceName}   # Stop service\n`));
    } else {
      console.log(chalk.green.bold('\n✅ All services started successfully!\n'));
      console.log(chalk.white('Services running at:'));
      console.log(chalk.gray('  Backend API:      http://localhost:4000'));
      console.log(chalk.gray('  Admin Panel:      http://localhost:3001'));

      // Only show Customers Portal for B2B2C variant
      const config = getProjectConfig();
      if (config.variants && config.variants.userModel === 'b2b2c') {
        console.log(chalk.gray('  Customers Portal: http://localhost:3000'));
      }

      console.log(chalk.gray('  Marketing Site:   http://localhost:8080\n'));
      console.log(chalk.white('Useful commands:'));
      console.log(chalk.gray('  launchframe docker:logs       # View logs from all services'));
      console.log(chalk.gray('  launchframe docker:logs backend   # View logs from specific service'));
      console.log(chalk.gray('  launchframe docker:down       # Stop services (keeps data)'));
      console.log(chalk.gray('  launchframe docker:destroy    # Remove all resources\n'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error starting services:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerUp };
