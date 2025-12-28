const chalk = require('chalk');
const { spawn } = require('child_process');
const { requireProject, getProjectConfig, isWaitlistInstalled } = require('../utils/project-helpers');

/**
 * View waitlist logs from VPS (streaming)
 */
async function waitlistLogs() {
  requireProject();

  console.log(chalk.blue.bold('\n📋 Waitlist Logs\n'));

  const config = getProjectConfig();

  // Validate waitlist is installed
  if (!isWaitlistInstalled(config)) {
    console.log(chalk.red('❌ Error: Waitlist service not installed\n'));
    console.log(chalk.gray('Run: launchframe service:add waitlist\n'));
    process.exit(1);
  }

  // Validate deployment is configured
  if (!config.deployConfigured || !config.deployment) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run: launchframe deploy:configure\n'));
    process.exit(1);
  }

  const { vpsHost, vpsUser, vpsAppFolder } = config.deployment;

  console.log(chalk.gray('Connecting to VPS and streaming logs...\n'));
  console.log(chalk.gray('Press Ctrl+C to exit\n'));

  // Use spawn instead of exec for streaming logs
  const logsProcess = spawn('ssh', [
    `${vpsUser}@${vpsHost}`,
    `cd ${vpsAppFolder}/waitlist && docker-compose -f docker-compose.waitlist.yml logs -f --tail=100`
  ], {
    stdio: 'inherit' // Stream output directly to terminal
  });

  logsProcess.on('error', (error) => {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  });

  logsProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.yellow(`\n⚠️  Process exited with code ${code}\n`));
    }
  });
}

module.exports = { waitlistLogs };
