const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');
const { generateSecret, checkForPlaceholders } = require('../utils/env-validator');

/**
 * Configure production environment variables
 */
async function deploySetEnv() {
  requireProject();

  console.log(chalk.blue.bold('\n🔐 LaunchFrame Production Environment Configuration\n'));

  const config = getProjectConfig();
  if (!config.deployConfigured) {
    console.log(chalk.red('❌ Error: Deployment not configured yet\n'));
    console.log(chalk.gray('Run this command first:'));
    console.log(chalk.white('  launchframe deploy:configure\n'));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, 'infrastructure', '.env');
  const envProdPath = path.join(projectRoot, 'infrastructure', '.env.prod');

  // Check if .env.prod already exists
  const envProdExists = await fs.pathExists(envProdPath);

  if (envProdExists) {
    console.log(chalk.yellow('⚠️  .env.prod already exists.\n'));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Update existing values', value: 'update' },
          { name: 'Start fresh (overwrite)', value: 'overwrite' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') {
      console.log(chalk.yellow('\n❌ Configuration cancelled\n'));
      return;
    }

    if (action === 'overwrite') {
      await fs.remove(envProdPath);
    }
  }

  // Copy .env as template if .env.prod doesn't exist
  if (!await fs.pathExists(envProdPath)) {
    if (!await fs.pathExists(envPath)) {
      console.log(chalk.red('❌ Error: infrastructure/.env file not found\n'));
      process.exit(1);
    }

    await fs.copy(envPath, envProdPath);
    console.log(chalk.green('✓ Created .env.prod from .env template\n'));
  }

  console.log(chalk.yellow('Configure production environment variables.\n'));
  console.log(chalk.gray('Leave blank to keep existing values or generate secure defaults.\n'));

  // Generate secure defaults
  const dbPassword = generateSecret(24);
  const redisPassword = generateSecret(24);
  const betterAuthSecret = generateSecret(32);
  const bullAdminToken = generateSecret(32);

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'dbPassword',
      message: 'Database password:',
      default: dbPassword,
      mask: '*'
    },
    {
      type: 'password',
      name: 'redisPassword',
      message: 'Redis password:',
      default: redisPassword,
      mask: '*'
    },
    {
      type: 'password',
      name: 'betterAuthSecret',
      message: 'Better Auth secret (min 32 chars):',
      default: betterAuthSecret,
      mask: '*'
    },
    {
      type: 'password',
      name: 'bullAdminToken',
      message: 'Bull Admin token:',
      default: bullAdminToken,
      mask: '*'
    },
    {
      type: 'input',
      name: 'resendApiKey',
      message: 'Resend API key (email):',
      default: ''
    },
    {
      type: 'input',
      name: 'polarAccessToken',
      message: 'Polar Access Token:',
      default: ''
    },
    {
      type: 'input',
      name: 'polarWebhookSecret',
      message: 'Polar Webhook Secret:',
      default: ''
    },
    {
      type: 'input',
      name: 'googleClientId',
      message: 'Google OAuth Client ID:',
      default: ''
    },
    {
      type: 'input',
      name: 'googleClientSecret',
      message: 'Google OAuth Client Secret:',
      default: ''
    }
  ]);

  // Read current .env.prod content
  let envContent = await fs.readFile(envProdPath, 'utf8');

  // Replace values based on deployment mode
  const replacements = {};

  replacements['DB_PASSWORD'] = answers.dbPassword;
  replacements['REDIS_PASSWORD'] = answers.redisPassword;
  replacements['BETTER_AUTH_SECRET'] = answers.betterAuthSecret;
  replacements['BULL_ADMIN_TOKEN'] = answers.bullAdminToken;
  replacements['RESEND_API_KEY'] = answers.resendApiKey || 're_your_resend_api_key';
  replacements['POLAR_ACCESS_TOKEN'] = answers.polarAccessToken || 'polar_oat_your_token';
  replacements['POLAR_WEBHOOK_SECRET'] = answers.polarWebhookSecret || 'polar_whs_your_secret';
  replacements['GOOGLE_CLIENT_ID'] = answers.googleClientId || 'YOUR_GOOGLE_CLIENT_ID';
  replacements['GOOGLE_CLIENT_SECRET'] = answers.googleClientSecret || 'YOUR_GOOGLE_CLIENT_SECRET';

  // Update environment variables
  for (const [key, value] of Object.entries(replacements)) {
    // Match KEY=old_value and replace with KEY=new_value
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    }
  }

  // Update production URLs based on deployment config
  if (config.deployment?.primaryDomain) {
    const domain = config.deployment.primaryDomain;
    const urlReplacements = {
      'API_BASE_URL': `https://api.${domain}`,
      'ADMIN_BASE_URL': `https://admin.${domain}`,
      'FRONTEND_BASE_URL': `https://app.${domain}`,
      'WEBSITE_BASE_URL': `https://${domain}`
    };

    for (const [key, value] of Object.entries(urlReplacements)) {
      const regex = new RegExp(`^${key}=.*$`, 'gm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      }
    }
  }

  // Write updated content
  await fs.writeFile(envProdPath, envContent, 'utf8');

  console.log(chalk.yellow('\n⚙️  Validating configuration...\n'));

  // Check for remaining placeholders
  const { hasPlaceholders, placeholders } = await checkForPlaceholders(envProdPath);

  if (hasPlaceholders) {
    console.log(chalk.yellow('⚠️  Warning: Some placeholder variables remain:\n'));
    placeholders.forEach(p => console.log(chalk.gray(`  - ${p}`)));
    console.log(chalk.gray('\nYou can edit .env.prod manually to set these values.\n'));
  } else {
    console.log(chalk.green('✓ No placeholder variables found\n'));
  }

  console.log(chalk.green.bold('✅ Production environment configured!\n'));
  console.log(chalk.white('Configuration saved to:'));
  console.log(chalk.gray('  - infrastructure/.env.prod\n'));

  console.log(chalk.yellow('⚠️  Important:'));
  console.log(chalk.gray('  - .env.prod is gitignored (will not be committed)'));
  console.log(chalk.gray('  - Keep this file secure - it contains production secrets\n'));

  console.log(chalk.white('Next step:'));
  console.log(chalk.gray('  Run: launchframe deploy:init\n'));
}

module.exports = { deploySetEnv };
