const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

/**
 * Test SSH connection to VPS
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function testSSHConnection(vpsUser, vpsHost) {
  try {
    // Try a simple SSH command (echo test)
    await execAsync(`ssh -o ConnectTimeout=10 -o BatchMode=yes ${vpsUser}@${vpsHost} "echo 'Connection successful'"`, {
      timeout: 15000
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if SSH keys are configured
 * @returns {Promise<{hasKeys: boolean, keyPaths: string[]}>}
 */
async function checkSSHKeys() {
  const homeDir = os.homedir();
  const sshDir = path.join(homeDir, '.ssh');

  const commonKeyNames = [
    'id_rsa',
    'id_ed25519',
    'id_ecdsa',
    'id_dsa'
  ];

  const keyPaths = [];

  for (const keyName of commonKeyNames) {
    const keyPath = path.join(sshDir, keyName);
    if (await fs.pathExists(keyPath)) {
      keyPaths.push(keyPath);
    }
  }

  return {
    hasKeys: keyPaths.length > 0,
    keyPaths
  };
}

/**
 * Execute SSH command on VPS
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function executeSSH(vpsUser, vpsHost, command, options = {}) {
  const { timeout = 120000 } = options;

  try {
    const { stdout, stderr } = await execAsync(
      `ssh -o ConnectTimeout=10 ${vpsUser}@${vpsHost} "${command.replace(/"/g, '\\"')}"`,
      { timeout }
    );
    return { stdout, stderr };
  } catch (error) {
    throw new Error(`SSH command failed: ${error.message}`);
  }
}

/**
 * Copy file to VPS via SCP
 * @param {string} localPath - Local file path
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} remotePath - Remote file path
 * @returns {Promise<void>}
 */
async function copyFileToVPS(localPath, vpsUser, vpsHost, remotePath) {
  try {
    await execAsync(`scp "${localPath}" ${vpsUser}@${vpsHost}:"${remotePath}"`, {
      timeout: 60000
    });
  } catch (error) {
    throw new Error(`Failed to copy file: ${error.message}`);
  }
}

/**
 * Copy entire directory to VPS using tar + scp
 * @param {string} localDir - Local directory path
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} remoteDir - Remote directory path
 * @returns {Promise<void>}
 */
async function copyDirectoryToVPS(localDir, vpsUser, vpsHost, remoteDir) {
  const path = require('path');
  const fs = require('fs-extra');

  try {
    // Create a temporary tarball excluding unnecessary files
    const tarballName = `deploy-${Date.now()}.tar.gz`;
    const tarballPath = path.join('/tmp', tarballName);

    // Create tarball with exclusions
    await execAsync(
      `tar -czf "${tarballPath}" -C "${localDir}" --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='build' --exclude='.git' --exclude='*.log' .`,
      { timeout: 60000 }
    );

    // Ensure remote directory exists
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "mkdir -p ${remoteDir}"`,
      { timeout: 30000 }
    );

    // Copy tarball to VPS
    await execAsync(
      `scp "${tarballPath}" ${vpsUser}@${vpsHost}:/tmp/${tarballName}`,
      { timeout: 180000 } // 3 minutes
    );

    // Extract tarball on VPS
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "tar -xzf /tmp/${tarballName} -C ${remoteDir} && rm /tmp/${tarballName}"`,
      { timeout: 60000 }
    );

    // Clean up local tarball
    await fs.remove(tarballPath);
  } catch (error) {
    throw new Error(`Failed to copy directory: ${error.message}`);
  }
}

/**
 * Check if repository is private by attempting to clone
 * @param {string} githubOrg - GitHub organization/username
 * @param {string} projectName - Project name
 * @returns {Promise<{isPrivate: boolean, error?: string}>}
 */
async function checkRepoPrivacy(githubOrg, projectName) {
  try {
    // Try to get repository info via HTTPS (no auth)
    await execAsync(`git ls-remote https://github.com/${githubOrg}/${projectName}.git HEAD`, {
      timeout: 10000
    });
    return { isPrivate: false };
  } catch (error) {
    // If error contains "authentication" or "not found", likely private or doesn't exist
    if (error.message.includes('Authentication') || error.message.includes('not found')) {
      return {
        isPrivate: true,
        error: 'Repository appears to be private or does not exist'
      };
    }
    // Other errors
    return {
      isPrivate: true,
      error: error.message
    };
  }
}

/**
 * Display instructions for setting up deploy keys for private repository
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} githubOrg - GitHub organization/username
 * @param {string} projectName - Project name
 */
function showDeployKeyInstructions(vpsUser, vpsHost, githubOrg, projectName) {
  console.log(chalk.yellow('\n📝 Private Repository Detected\n'));
  console.log(chalk.white('Your repository appears to be private. Follow these steps:\n'));

  console.log(chalk.white('1. SSH to your VPS:'));
  console.log(chalk.gray(`   ssh ${vpsUser}@${vpsHost}\n`));

  console.log(chalk.white('2. Generate SSH key (if not already exists):'));
  console.log(chalk.gray(`   ssh-keygen -t ed25519 -C "deploy-key-${projectName}"\n`));

  console.log(chalk.white('3. Display the public key:'));
  console.log(chalk.gray('   cat ~/.ssh/id_ed25519.pub\n'));

  console.log(chalk.white('4. Add deploy key to GitHub:'));
  console.log(chalk.gray(`   - Go to: https://github.com/${githubOrg}/${projectName}/settings/keys`));
  console.log(chalk.gray('   - Click "Add deploy key"'));
  console.log(chalk.gray('   - Paste the public key'));
  console.log(chalk.gray('   - Title: "VPS Deploy Key"'));
  console.log(chalk.gray('   - Check "Allow write access" if needed\n'));

  console.log(chalk.white('5. Test the connection:'));
  console.log(chalk.gray('   ssh -T git@github.com\n'));

  console.log(chalk.white('6. Then retry:'));
  console.log(chalk.gray('   launchframe deploy:init\n'));
}

/**
 * Pull Docker images on VPS
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} vpsAppFolder - App folder path on VPS
 * @returns {Promise<void>}
 */
async function pullImagesOnVPS(vpsUser, vpsHost, vpsAppFolder) {
  const ora = require('ora');

  const spinner = ora('Pulling images on VPS...').start();

  try {
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull"`,
      { timeout: 600000 } // 10 minutes
    );
    spinner.succeed('Images pulled on VPS');
  } catch (error) {
    spinner.fail('Failed to pull images on VPS');
    throw new Error(`Failed to pull images: ${error.message}`);
  }
}

/**
 * Restart services on VPS
 * @param {string} vpsUser - SSH username
 * @param {string} vpsHost - VPS hostname or IP
 * @param {string} vpsAppFolder - App folder path on VPS
 * @returns {Promise<void>}
 */
async function restartServicesOnVPS(vpsUser, vpsHost, vpsAppFolder) {
  const ora = require('ora');

  const spinner = ora('Restarting services...').start();

  try {
    await execAsync(
      `ssh ${vpsUser}@${vpsHost} "cd ${vpsAppFolder}/infrastructure && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"`,
      { timeout: 300000 } // 5 minutes
    );
    spinner.succeed('Services restarted');
  } catch (error) {
    spinner.fail('Failed to restart services');
    throw new Error(`Failed to restart services: ${error.message}`);
  }
}

module.exports = {
  testSSHConnection,
  checkSSHKeys,
  executeSSH,
  copyFileToVPS,
  copyDirectoryToVPS,
  checkRepoPrivacy,
  showDeployKeyInstructions,
  pullImagesOnVPS,
  restartServicesOnVPS
};
