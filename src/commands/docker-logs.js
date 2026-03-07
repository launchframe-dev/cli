const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { spawn, execSync } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

/**
 * View logs from Docker services
 * @param {string} service - Optional service name to filter logs
 * @param {Object} flags - Optional flags
 * @param {boolean} flags['no-follow'] - Snapshot mode: print lines and exit (non-interactive)
 * @param {number} flags.tail - Number of lines to show (default 100, only used with --no-follow)
 */
async function dockerLogs(service, flags = {}) {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  const noFollow = flags['no-follow'];

  if (noFollow) {
    // Snapshot mode — print tail and exit (non-interactive, suitable for MCP)
    const tail = flags.tail || 100;
    const args = ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml', 'logs', '--no-follow', '--tail', String(tail)];
    if (service) args.push(service);

    try {
      execSync(`docker-compose ${args.join(' ')}`, { cwd: infrastructurePath, stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('\n❌ Error viewing logs:'), error.message);
      process.exit(1);
    }
    return;
  }

  // Streaming mode (interactive)
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
    const spawnArgs = ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml', 'logs', '-f'];

    if (service) {
      spawnArgs.push(service);
    }

    // Use spawn to stream output in real-time
    const child = spawn(logsCommand, spawnArgs, {
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
