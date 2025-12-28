const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

/**
 * View logs from Docker services
 */
async function dockerLogs() {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  // Get optional service name from args (e.g., launchframe docker:logs backend)
  const service = process.argv[3];

  console.log(chalk.blue.bold('\n📋 Docker Service Logs\n'));

  if (service) {
    console.log(chalk.gray(`Streaming logs for: ${service}\n`));
  } else {
    console.log(chalk.gray('Streaming logs for all services\n'));
  }

  console.log(chalk.yellow('Press Ctrl+C to stop\n'));
  console.log(chalk.gray('─'.repeat(80) + '\n'));

  try {
    const logsCommand = 'docker-compose';
    const args = ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml', 'logs', '-f'];

    if (service) {
      args.push(service);
    }

    // Use spawn to stream output in real-time
    const child = spawn(logsCommand, args, {
      cwd: infrastructurePath,
      stdio: 'inherit',
      shell: true
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n✓ Stopped viewing logs\n'));
      child.kill('SIGINT');
      process.exit(0);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.yellow(`\n⚠️  Process exited with code ${code}\n`));
      }
    });

  } catch (error) {
    console.error(chalk.red('\n❌ Error viewing logs:'), error.message);
    process.exit(1);
  }
}

module.exports = { dockerLogs };
