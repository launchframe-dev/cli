const inquirer = require('inquirer');
const { getVariantPrompts } = require('./services/variant-config');

/**
 * Prompts for initial project setup (local development only)
 */
async function runInitPrompts() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name (slug):',
      default: 'my-saas',
      validate: (input) => {
        if (/^[a-z0-9-]+$/.test(input)) {
          return true;
        }
        return 'Project name must contain only lowercase letters, numbers, and hyphens';
      }
    },
    {
      type: 'input',
      name: 'projectDisplayName',
      message: 'Project display name:',
      default: (answers) => {
        // Convert kebab-case to Title Case
        return answers.projectName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      },
      validate: (input) => {
        if (input.trim().length > 0) {
          return true;
        }
        return 'Project display name is required';
      }
    },
    {
      type: 'input',
      name: 'projectDescription',
      message: 'Project description (for meta tags):',
      default: (answers) => `${answers.projectDisplayName} - Modern SaaS Platform`,
      validate: (input) => {
        if (input.trim().length > 0) {
          return true;
        }
        return 'Project description is required';
      }
    }
  ]);

  // Transform answers
  return {
    ...answers,
    projectNameUpper: answers.projectName.toUpperCase().replace(/-/g, '_'),
    projectNameCamel: answers.projectName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  };
}

/**
 * Prompts for deployment configuration
 * @param {string} projectName - The project name from .launchframe config
 */
async function runDeployPrompts(projectName = 'launchframe') {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'primaryDomain',
      message: 'Primary domain (e.g., example.com):',
      validate: (input) => {
        if (/^[a-z0-9-]+\.[a-z]{2,}$/.test(input)) {
          return true;
        }
        return 'Please enter a valid domain (e.g., example.com)';
      }
    },
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Admin email (for Let\'s Encrypt SSL):',
      validate: (input) => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
          return true;
        }
        return 'Please enter a valid email address';
      }
    },
    {
      type: 'input',
      name: 'githubOrg',
      message: 'GitHub organization/username:',
      validate: (input) => {
        if (input.trim().length > 0) {
          return true;
        }
        return 'GitHub org/username is required';
      }
    },
    {
      type: 'input',
      name: 'vpsHost',
      message: 'VPS hostname or IP:',
      validate: (input) => {
        if (input.trim().length > 0) {
          return true;
        }
        return 'VPS host is required';
      }
    },
    {
      type: 'input',
      name: 'vpsUser',
      message: 'VPS SSH username:',
      default: 'root',
      validate: (input) => {
        if (input.trim().length > 0) {
          return true;
        }
        return 'VPS user is required';
      }
    },
    {
      type: 'input',
      name: 'vpsAppFolder',
      message: 'VPS deployment folder path:',
      default: `/opt/${projectName}`,
      validate: (input) => {
        if (!input.startsWith('/')) {
          return 'Must be an absolute path starting with /';
        }
        if (input.endsWith('/')) {
          return 'Must not end with a trailing slash';
        }
        if (input.trim().length === 0) {
          return 'VPS app folder is required';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'ghcrToken',
      message: 'GitHub Personal Access Token (for Docker images):',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'GHCR token is required for pushing Docker images';
        }
        if (!input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
          return 'Invalid GitHub token format (should start with ghp_ or github_pat_)';
        }
        return true;
      }
    }
  ]);

  return answers;
}

/**
 * Prompts for variant selection (multi-tenancy, B2B vs B2B2C)
 */
async function runVariantPrompts() {
  const prompts = getVariantPrompts();

  console.log('\n📦 Configure Your Application\n');

  // Prompt for user model
  const userModelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'userModel',
      message: prompts.userModel.message,
      choices: prompts.userModel.choices.map(choice => ({
        name: choice.name,
        value: choice.value,
        short: choice.value
      })),
      default: prompts.userModel.default
    }
  ]);

  // Prompt for tenancy
  const tenancyAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'tenancy',
      message: prompts.tenancy.message,
      choices: prompts.tenancy.choices.map(choice => ({
        name: choice.name,
        value: choice.value,
        short: choice.value
      })),
      default: prompts.tenancy.default
    }
  ]);

  const variantChoices = {
    tenancy: tenancyAnswer.tenancy,
    userModel: userModelAnswer.userModel
  };

  // Show summary
  console.log('\n✅ Configuration:');
  console.log(`   User Model: ${variantChoices.userModel}`);
  console.log(`   Tenancy: ${variantChoices.tenancy}\n`);

  return variantChoices;
}

module.exports = { runInitPrompts, runDeployPrompts, runVariantPrompts };
