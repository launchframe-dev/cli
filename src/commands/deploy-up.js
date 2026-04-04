const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const ora = require('ora');
const https = require('https');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

const execAsync = promisify(exec);

const CONFIG_PATH = path.join(os.homedir(), '.launchframe', 'config.json');

function getCachedLicenseKey() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.licenseKey || null;
  } catch {
    return null;
  }
}

async function checkLicenseCanDeploy(licenseKey) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.launchframe.dev',
        path: '/licenses/check',
        method: 'GET',
        headers: { Authorization: `Bearer ${licenseKey}` },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Start services on VPS using Docker context
 */
async function deployUp() {
  // License check — soft gate
  const licenseKey = getCachedLicenseKey();
  if (licenseKey) {
    const licenseInfo = await checkLicenseCanDeploy(licenseKey);
    if (licenseInfo === null) {
      console.warn('\n⚠  Could not verify license. Proceeding anyway.\n');
    } else if (!licenseInfo.canDeploy) {
      console.error('\n✗ Production deployment requires a full LaunchFrame license.');
      console.error('  Your current license is on a free trial (1 init, no deployment).');
      console.error('  Upgrade at: https://admin.launchframe.dev/purchase\n');
      process.exit(1);
    }
  }

  requireProject();

  console.log(chalk.blue.bold('\n🚀 LaunchFrame Service Deployment\n'));

  const config = getProjectConfig();

  // Validate deployment is configured
  if (!config.deployConfigured || !config.deployment) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  const { vpsHost, vpsUser, vpsAppFolder, primaryDomain } = config.deployment;
  const { projectName } = config;

  // Step 1: Check Docker version
  console.log(chalk.yellow('🐳 Step 1: Checking Docker version...\n'));

  const dockerSpinner = ora('Checking Docker installation...').start();

  try {
    const { stdout: versionOutput } = await execAsync('docker version --format "{{.Client.Version}}"');
    const version = versionOutput.trim();
    const [major, minor] = version.split('.').map(Number);

    if (major < 19 || (major === 19 && minor < 3)) {
      dockerSpinner.fail(`Docker version ${version} is too old`);
      console.log(chalk.red('\n❌ Docker 19.03+ is required for context support\n'));
      console.log(chalk.gray('Please upgrade Docker:'));
      console.log(chalk.white('  https://docs.docker.com/engine/install/\n'));
      process.exit(1);
    }

    dockerSpinner.succeed(`Docker ${version} (compatible)`);
  } catch (error) {
    dockerSpinner.fail('Docker not found');
    console.log(chalk.red('\n❌ Docker is not installed or not in PATH\n'));
    console.log(chalk.gray('Please install Docker:'));
    console.log(chalk.white('  https://docs.docker.com/engine/install/\n'));
    process.exit(1);
  }

  // Step 2: Verify SSH connection
  console.log(chalk.yellow('\n🔗 Step 2: Verifying SSH connection...\n'));

  const sshSpinner = ora('Testing SSH connection...').start();

  try {
    await execAsync(`ssh -o ConnectTimeout=10 ${vpsUser}@${vpsHost} "echo 'Connected'"`, {
      timeout: 15000
    });

    sshSpinner.succeed('SSH connection verified');
  } catch (error) {
    sshSpinner.fail('Failed to connect via SSH');
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    console.log(chalk.gray('Make sure you can SSH to the VPS without password (key-based auth).\n'));
    console.log(chalk.gray(`Test manually: ssh ${vpsUser}@${vpsHost}\n`));
    process.exit(1);
  }

  // Step 3: Start services on VPS via SSH
  console.log(chalk.yellow('\n🚀 Step 3: Starting services on VPS...\n'));
  console.log(chalk.gray('This will start all Docker containers in production mode.\n'));

  const deploySpinner = ora('Connecting to VPS...').start();

  try {
    deploySpinner.text = 'Starting full application stack...';

    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"`,
      { timeout: 300000 } // 5 minutes
    );

    deploySpinner.succeed('Full application started successfully');
  } catch (error) {
    deploySpinner.fail('Failed to start services');

    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    console.log(chalk.gray('Common issues:'));
    console.log(chalk.gray('  - Docker not running on VPS'));
    console.log(chalk.gray('  - Docker Compose not installed on VPS'));
    console.log(chalk.gray('  - Insufficient permissions\n'));
    process.exit(1);
  }

  // Step 4: Verify services are running
  console.log(chalk.yellow('\n🔍 Step 4: Verifying deployment...\n'));

  const verifySpinner = ora('Checking service status...').start();

  try {
    const { stdout: psOutput } = await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps"`,
      { timeout: 30000 }
    );

    verifySpinner.succeed('Services verified');

    console.log(chalk.gray('\n' + psOutput));
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    verifySpinner.warn('Could not verify services');
  }

  // Success!
  console.log(chalk.green.bold('\n✅ Deployment complete!\n'));

  console.log(chalk.white('Your application is now running at:\n'));
  console.log(chalk.cyan(`  🌍 User Frontend:  https://${primaryDomain}`));
  console.log(chalk.cyan(`  ⚙️  Admin Panel:    https://admin.${primaryDomain}`));
  console.log(chalk.cyan(`  🔌 API:            https://api.${primaryDomain}`));
  console.log(chalk.cyan(`  📄 Website:        https://www.${primaryDomain || primaryDomain}`));

  console.log(chalk.white('\n⏰ Note: SSL certificates from Let\'s Encrypt may take a few minutes to provision.\n'));

  console.log(chalk.white('Next steps:\n'));
  console.log(chalk.white('1. Configure GitHub Secrets for automated deployments:'));
  console.log(chalk.gray(`   Repository: https://github.com/${config.deployment.githubOrg}/${projectName}/settings/secrets/actions`));
  console.log(chalk.gray('   Required secrets:'));
  console.log(chalk.gray('     - VPS_HOST, VPS_USER, VPS_SSH_KEY, GHCR_TOKEN\n'));

  console.log(chalk.white('2. Future deployments:'));
  console.log(chalk.gray('   Just push to GitHub - CI/CD will handle deployment automatically!\n'));

  console.log(chalk.white('3. Monitor services:'));
  console.log(chalk.gray(`   Run: ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"\n`));
}

module.exports = { deployUp };
