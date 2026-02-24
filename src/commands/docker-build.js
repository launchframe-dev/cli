const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

/**
 * Build Docker images for the project
 * @param {string} [serviceName] - Optional service to build (builds all if omitted)
 */
async function dockerBuild(serviceName) {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  const target = serviceName ? `${serviceName} service` : 'all services';
  console.log(chalk.blue.bold(`\n🔨 Building Docker Images (${target})\n`));

  try {
    const buildCommand = `docker-compose -f docker-compose.yml -f docker-compose.dev.yml build${serviceName ? ` ${serviceName}` : ''}`;

    console.log(chalk.gray(`Running: ${buildCommand}\n`));

    execSync(buildCommand, {
      cwd: infrastructurePath,
      stdio: 'inherit'
    });

    console.log(chalk.green.bold('\n✅ Docker images built successfully!\n'));
    if (!serviceName) {
      console.log(chalk.white('Next steps:'));
      console.log(chalk.gray('  launchframe docker:up    # Start all services\n'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error during build:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerBuild };
