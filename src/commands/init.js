const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const { runInitPrompts, runVariantPrompts } = require('../prompts');
const { generateProject } = require('../generator');
const { isLaunchFrameProject } = require('../utils/project-helpers');
const logger = require('../utils/logger');
const { trackEvent } = require('../utils/telemetry');

// License key config helpers
const CONFIG_PATH = path.join(os.homedir(), '.launchframe', 'config.json');
const PROXY_CLONE_URL = 'https://api.launchframe.dev/git/services';

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function writeConfig(data) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = readConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function getLicenseKey(promptFn) {
  const config = readConfig();
  if (config.licenseKey && isValidUUID(config.licenseKey)) {
    return config.licenseKey;
  }

  const { licenseKey } = await promptFn([
    {
      type: 'input',
      name: 'licenseKey',
      message: 'Enter your LaunchFrame license key:',
      validate: (val) => isValidUUID(val) || 'Please enter a valid license key (UUID format)',
    },
  ]);

  writeConfig({ licenseKey });
  return licenseKey;
}

/**
 * Check if running in development mode (local) vs production (npm install)
 */
function isDevMode() {
  // Only use dev mode if LAUNCHFRAME_DEV is explicitly set to 'true'
  return process.env.LAUNCHFRAME_DEV === 'true';
}

/**
 * Initialize a new LaunchFrame project
 * @param {Object} options - Command options
 * @param {string} options.projectName - Project name (skips prompt if provided)
 * @param {string} options.tenancy - Tenancy model: 'single' or 'multi' (skips prompt if provided)
 * @param {string} options.userModel - User model: 'b2b' or 'b2b2c' (skips prompt if provided)
 */
async function init(options = {}) {
  console.log(chalk.blue.bold('\nLaunchFrame\n'));

  // Check if in development mode
  const devMode = isDevMode();

  // Check if already in a LaunchFrame project
  if (isLaunchFrameProject()) {
    console.error(chalk.red('Error: Already in a LaunchFrame project'));
    console.log(chalk.gray('Use other commands to manage your project, or run init from outside the project.\n'));
    process.exit(1);
  }

  try {
    // Get license key upfront (from cache or prompt) before asking project questions
    if (!devMode) {
      var licenseKey = await getLicenseKey(inquirer.prompt.bind(inquirer));

      // Validate key immediately via a HEAD request to the git proxy
      process.stdout.write('Validating license key...');
      try {
        const https = require('https');
        await new Promise((resolve, reject) => {
          const auth = Buffer.from(`git:${licenseKey}`).toString('base64');
          const req = https.request(
            `${PROXY_CLONE_URL}/info/refs?service=git-upload-pack`,
            { method: 'GET', headers: { Authorization: `Basic ${auth}` } },
            (res) => {
              if (res.statusCode === 200) {
                process.stdout.write(' ✓\n');
                resolve();
              } else if (res.statusCode === 402) {
                reject(new Error('TRIAL_LIMIT'));
              } else {
                reject(new Error('INVALID_KEY'));
              }
              res.resume();
            }
          );
          req.on('error', () => reject(new Error('NETWORK_ERROR')));
          req.end();
        });
      } catch (err) {
        process.stdout.write('\n');
        if (err.message === 'TRIAL_LIMIT') {
          console.error(chalk.red('\n✗ You have used your free trial init.'));
          console.error('  Purchase a full license to create unlimited projects and deploy to production.');
          console.error('  Upgrade at: https://admin.launchframe.dev/purchase\n');
        } else if (err.message === 'INVALID_KEY') {
          console.error(chalk.red('\n✗ Invalid or revoked license key.'));
          console.error('  Check your key at: https://admin.launchframe.dev\n');
          writeConfig({ licenseKey: null });
        } else {
          console.error(chalk.yellow('\n⚠ Could not validate license key (network error). Proceeding anyway.\n'));
        }
        if (err.message !== 'NETWORK_ERROR') process.exit(1);
      }
    }

    let answers;

    // If project name provided via flag, skip prompts
    if (options.projectName) {
      if (!/^[a-z0-9-]+$/.test(options.projectName)) {
        throw new Error('Project name must contain only lowercase letters, numbers, and hyphens');
      }

      const projectDisplayName = options.projectName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const projectDescription = `${projectDisplayName} - Modern SaaS Platform`;

      answers = {
        projectName: options.projectName,
        projectDisplayName: projectDisplayName,
        projectDescription: projectDescription,
        projectNameUpper: options.projectName.toUpperCase().replace(/-/g, '_'),
        projectNameCamel: options.projectName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      };

      logger.detail(`Project name: ${options.projectName}`);
      logger.detail(`Display name: ${projectDisplayName}`);
      logger.detail(`Description: ${projectDescription}`);
    } else {
      answers = await runInitPrompts();
    }

    // Get variant selections (multi-tenancy, B2B vs B2B2C)
    let variantChoices;

    if (options.tenancy && options.userModel) {
      if (!['single', 'multi'].includes(options.tenancy)) {
        throw new Error('Invalid --tenancy value. Must be "single" or "multi"');
      }

      if (!['b2b', 'b2b2c'].includes(options.userModel)) {
        throw new Error('Invalid --user-model value. Must be "b2b" or "b2b2c"');
      }

      const tenancyMap = {
        'single': 'single-tenant',
        'multi': 'multi-tenant'
      };

      variantChoices = {
        tenancy: tenancyMap[options.tenancy],
        userModel: options.userModel,
        permissions: options.permissions || 'basic'
      };

      logger.detail(`Tenancy: ${options.tenancy}`);
      logger.detail(`User model: ${options.userModel}`);
      logger.detail(`Permissions: ${variantChoices.permissions}`);
    } else {
      variantChoices = await runVariantPrompts();
    }

    // Determine which services are needed
    const requiredServices = ['backend', 'admin-portal', 'infrastructure', 'website'];

    if (variantChoices.userModel === 'b2b2c') {
      requiredServices.push('customers-portal');
    }

    // Determine template source
    let templateRoot;
    let tmpDir;

    if (devMode) {
      templateRoot = path.resolve(__dirname, '../../../services');
      logger.detail(`[DEV MODE] Using local services: ${templateRoot}`);
    } else {
      // Clone from proxy into a temp directory
      tmpDir = path.join(os.tmpdir(), `lf-clone-${Date.now()}`);

      console.log('\n📦 Fetching LaunchFrame services...\n');

      try {
        const cloneUrl = PROXY_CLONE_URL.replace('https://', `https://git:${licenseKey}@`);
        execSync(`git clone --depth 1 ${cloneUrl} ${tmpDir}`, { stdio: 'pipe' });
      } catch (err) {
        const stderr = err.stderr?.toString() ?? '';
        // Detect 402 Payment Required (trial limit exceeded)
        if (stderr.includes('402') || stderr.includes('Trial limit')) {
          console.error('\n✗ You have used your free trial init.');
          console.error('  Purchase a full license to create unlimited projects and deploy to production.');
          console.error('  Upgrade at: https://admin.launchframe.dev/purchase\n');
        } else if (stderr.includes('403') || stderr.includes('Invalid')) {
          console.error('\n✗ Invalid or revoked license key.');
          console.error('  Check your key at: https://admin.launchframe.dev\n');
          // Clear cached key so they can re-enter
          writeConfig({ licenseKey: null });
        } else {
          console.error('\n✗ Failed to fetch LaunchFrame services:', stderr);
        }
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        process.exit(1);
      }

      // templateRoot now points to the cloned tmp directory
      templateRoot = tmpDir;
    }

    // Generate project
    console.log(chalk.white('\nGenerating project...\n'));
    await generateProject(answers, variantChoices, templateRoot);

    trackEvent('command_executed', {
      command: 'init',
      success: true,
      tenancy: variantChoices.tenancy,
      user_model: variantChoices.userModel,
      permissions: variantChoices.permissions
    });

    // Record successful init against the license
    if (!devMode && licenseKey) {
      try {
        const https = require('https');
        await new Promise((resolve) => {
          const body = '';
          const req = https.request(
            'https://api.launchframe.dev/licenses/record-init',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${licenseKey}`,
                'Content-Length': 0,
              },
            },
            (res) => { res.resume(); resolve(); }
          );
          req.on('error', () => resolve()); // non-fatal
          req.end();
        });
      } catch {}
    }

    console.log(chalk.green.bold('\nProject created successfully!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray(`  cd ${answers.projectName}`));
    console.log(chalk.gray('  launchframe docker:up\n'));

    // Clean up tmp clone
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = { init };
