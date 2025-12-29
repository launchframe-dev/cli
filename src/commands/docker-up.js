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

  // Check Docker Compose version for watch support
  try {
    const composeVersion = execSync('docker compose version', { encoding: 'utf8' });
    const versionMatch = composeVersion.match(/v?(\d+)\.(\d+)\.(\d+)/);
    
    if (versionMatch) {
      const [, major, minor] = versionMatch.map(Number);
      
      if (major < 2 || (major === 2 && minor < 22)) {
        console.error(chalk.red('\n❌ Error: Docker Compose v2.22+ is required for watch support'));
        console.log(chalk.yellow(`Current version: Docker Compose v${major}.${minor}`));
        console.log(chalk.gray('\nPlease upgrade Docker Compose:'));
        console.log(chalk.white('  https://docs.docker.com/compose/install/\n'));
        process.exit(1);
      }
    }
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not detect Docker Compose version'));
  }

  if (serviceName) {
    console.log(chalk.blue.bold(`\n🚀 Starting ${serviceName} service with watch\n`));
    console.log(chalk.gray(`Starting ${serviceName} with file watching enabled...\n`));
  } else {
    console.log(chalk.blue.bold('\n🚀 Starting Docker Services with Watch\n'));
    console.log(chalk.gray('Starting all services with file watching enabled...\n'));
  }

  try {
    const upCommand = serviceName
      ? `docker-compose -f docker-compose.yml -f docker-compose.dev.yml watch ${serviceName}`
      : 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml watch';

    console.log(chalk.gray(`Running: ${upCommand}\n`));

    execSync(upCommand, {
      cwd: infrastructurePath,
      stdio: 'inherit'
    });

    if (serviceName) {
      console.log(chalk.green.bold(`\n✅ ${serviceName} service started with watch!\n`));
      console.log(chalk.yellow('📺 Watching for file changes (press Ctrl+C to stop)...\n'));
      console.log(chalk.white('Watch behavior:'));
      console.log(chalk.gray('  • Code changes → Auto-sync to container'));
      console.log(chalk.gray('  • package.json → Auto-rebuild & restart\n'));
      console.log(chalk.white('To stop:'));
      console.log(chalk.gray('  Press Ctrl+C in this terminal\n'));
    } else {
      console.log(chalk.green.bold('\n✅ All services started with watch!\n'));
      console.log(chalk.yellow('📺 Watching for file changes (press Ctrl+C to stop)...\n'));
      console.log(chalk.white('Watch behavior:'));
      console.log(chalk.gray('  • Code changes → Auto-sync to containers'));
      console.log(chalk.gray('  • package.json → Auto-rebuild & restart\n'));
      console.log(chalk.white('Services running at:'));
      console.log(chalk.gray('  Backend API:      http://localhost:4000'));
      console.log(chalk.gray('  Admin Panel:      http://localhost:3001'));

      // Only show Customers Portal for B2B2C variant
      const config = getProjectConfig();
      if (config.variants && config.variants.userModel === 'b2b2c') {
        console.log(chalk.gray('  Customers Portal: http://localhost:3000'));
      }

      console.log(chalk.gray('  Marketing Site:   http://localhost:8080\n'));
      console.log(chalk.white('To stop all services:'));
      console.log(chalk.gray('  Press Ctrl+C in this terminal'));
      console.log(chalk.gray('  Or run: launchframe docker:down\n'));
      console.log(chalk.cyan('💡 Tip (Linux/Mac): Add & at the end to run in background\n'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error starting services:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerUp };
