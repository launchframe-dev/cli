const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const ora = require('ora');
const { runDeployPrompts } = require('../prompts');
const { requireProject, getProjectConfig, updateProjectConfig } = require('../utils/project-helpers');
const { replaceVariablesInFile } = require('../utils/variable-replacer');
const { testSSHConnection, executeSSH } = require('../utils/ssh-helper');

/**
 * Configure deployment settings
 */
async function deployConfigure() {
  requireProject();

  console.log(chalk.blue.bold('\n🚀 LaunchFrame Deployment Configuration\n'));

  // Check if already configured
  const config = getProjectConfig();
  if (config.deployConfigured) {
    console.log(chalk.yellow('⚠️  Deployment already configured. This will update existing settings.\n'));
    console.log(chalk.gray('Current configuration:'));
    console.log(chalk.gray(`  Domain: ${config.deployment?.primaryDomain || 'Not set'}`));
    console.log(chalk.gray(`  Email: ${config.deployment?.adminEmail || 'Not set'}`));
    console.log(chalk.gray(`  GitHub Org: ${config.deployment?.githubOrg || config.githubOrg || 'Not set'}`));
    console.log(chalk.gray(`  VPS Host: ${config.deployment?.vpsHost || 'Not set'}`));
    console.log(chalk.gray(`  VPS User: ${config.deployment?.vpsUser || 'Not set'}`));
    console.log(chalk.gray(`  VPS App Folder: ${config.deployment?.vpsAppFolder || config.vpsAppFolder || 'Not set'}\n`));

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Continue with reconfiguration?',
        default: false
      }
    ]);

    if (!proceed) {
      console.log(chalk.yellow('\n❌ Configuration cancelled\n'));
      return;
    }
  }

  console.log(chalk.yellow('Configure your production deployment settings.\n'));
  console.log(chalk.gray('Note: VPS credentials (SSH keys, passwords) are managed via GitHub Secrets.'));
  console.log(chalk.gray('This command configures domain and connection details.\n'));

  const deployAnswers = await runDeployPrompts(config.projectName);

  // Prepare variable mappings for file replacement
  const variables = {
    '{{PRIMARY_DOMAIN}}': deployAnswers.primaryDomain,
    '{{ADMIN_EMAIL}}': deployAnswers.adminEmail,
    '{{GITHUB_ORG}}': deployAnswers.githubOrg,
    '{{VPS_APP_FOLDER}}': deployAnswers.vpsAppFolder
  };

  console.log(chalk.yellow('\n⚙️  Updating configuration files...\n'));

  // Files that need template variable replacement
  const filesToUpdate = [
    'infrastructure/.env',
    'infrastructure/.env.example',
    'infrastructure/docker-compose.yml',
    'infrastructure/docker-compose.dev.yml',
    'infrastructure/docker-compose.prod.yml',
    'infrastructure/traefik.yml',
    'backend/src/main.ts',
    'admin-portal/.env.example',
    'admin-portal/public/env-config.js',
    'admin-portal/src/config/runtime.ts',
    'admin-portal/src/config/pageMetadata.ts',
    'admin-portal/src/pages/FirstProject.tsx',
    'admin-portal/src/components/projects/NewProject.tsx',
    'admin-portal/src/components/settings/CustomDomain.tsx',
    'admin-portal/src/App.tsx',
    'admin-portal/src/components/common/PageTitle.tsx',
    'admin-portal/src/sentry.tsx',
    'admin-portal/src/pages/AppSumo.tsx',
    'admin-portal/docs/GITHUB_ACTIONS_SETUP.md',
    'customers-portal/src/App.tsx'
  ];

  const projectRoot = process.cwd();
  let filesUpdated = 0;

  for (const relativePath of filesToUpdate) {
    const filePath = path.join(projectRoot, relativePath);

    try {
      const fs = require('fs-extra');
      if (!await fs.pathExists(filePath)) {
        console.log(chalk.gray(`  ⊘ Skipping ${relativePath} (not found)`));
        continue;
      }

      const modified = await replaceVariablesInFile(filePath, variables);
      if (modified) {
        console.log(chalk.green(`  ✓ Updated ${relativePath}`));
        filesUpdated++;
      } else {
        console.log(chalk.gray(`  − No changes needed in ${relativePath}`));
      }
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed to update ${relativePath}: ${error.message}`));
    }
  }

  // Update all installed component .env.prod files with new domain
  const installedComponents = config.installedComponents || [];
  if (installedComponents.length > 0) {
    console.log(chalk.yellow('\n⚙️  Updating component environment files...\n'));

    for (const componentName of installedComponents) {
      const componentEnvProdPath = path.join(projectRoot, componentName, '.env.prod');

      try {
        const fs = require('fs-extra');
        if (!await fs.pathExists(componentEnvProdPath)) {
          console.log(chalk.gray(`  ⊘ Skipping ${componentName}/.env.prod (not found)`));
          continue;
        }

        // Read current .env.prod content
        let envContent = await fs.readFile(componentEnvProdPath, 'utf8');

        // Replace PRIMARY_DOMAIN with new value
        const oldDomainMatch = envContent.match(/PRIMARY_DOMAIN=.*/);
        if (oldDomainMatch) {
          const newEnvContent = envContent.replace(
            /PRIMARY_DOMAIN=.*/,
            `PRIMARY_DOMAIN=${deployAnswers.primaryDomain}`
          );

          if (newEnvContent !== envContent) {
            await fs.writeFile(componentEnvProdPath, newEnvContent, 'utf8');
            console.log(chalk.green(`  ✓ Updated ${componentName}/.env.prod`));
            filesUpdated++;
          } else {
            console.log(chalk.gray(`  − No changes needed in ${componentName}/.env.prod`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to update ${componentName}/.env.prod: ${error.message}`));
      }
    }
  }

  // Update .launchframe config
  console.log(chalk.yellow('\n📝 Saving configuration...\n'));

  const updatedConfig = {
    ...config,
    deployConfigured: true,
    deployment: {
      adminEmail: deployAnswers.adminEmail,
      vpsHost: deployAnswers.vpsHost,
      vpsUser: deployAnswers.vpsUser,
      vpsAppFolder: deployAnswers.vpsAppFolder,
      primaryDomain: deployAnswers.primaryDomain,
      githubOrg: deployAnswers.githubOrg,
      ghcrToken: deployAnswers.ghcrToken,
      configuredAt: new Date().toISOString()
    }
  };

  updateProjectConfig(updatedConfig);

  // Authenticate to GHCR on VPS
  console.log(chalk.yellow('\n🔐 Authenticating to GitHub Container Registry on VPS...\n'));

  const authSpinner = ora('Testing VPS connection...').start();

  try {
    // Test SSH connection
    const connectionTest = await testSSHConnection(deployAnswers.vpsUser, deployAnswers.vpsHost);

    if (!connectionTest.success) {
      authSpinner.warn('Could not connect to VPS');
      console.log(chalk.yellow('\n⚠️  Warning: Unable to authenticate to GHCR on VPS\n'));
      console.log(chalk.gray(`Error: ${connectionTest.error}`));
      console.log(chalk.gray('\nYou can authenticate manually later by running:'));
      console.log(chalk.white(`  ssh ${deployAnswers.vpsUser}@${deployAnswers.vpsHost} "echo 'YOUR_GHCR_TOKEN' | docker login ghcr.io -u ${deployAnswers.githubOrg} --password-stdin"\n`));
    } else {
      authSpinner.text = 'Logging into GitHub Container Registry...';

      // Login to GHCR on VPS
      await executeSSH(
        deployAnswers.vpsUser,
        deployAnswers.vpsHost,
        `echo '${deployAnswers.ghcrToken}' | docker login ghcr.io -u ${deployAnswers.githubOrg} --password-stdin`
      );

      authSpinner.succeed('VPS authenticated to GitHub Container Registry');
      console.log(chalk.gray('  Docker can now pull images from ghcr.io\n'));
    }
  } catch (error) {
    authSpinner.warn('Could not authenticate to GHCR');
    console.log(chalk.yellow('\n⚠️  Warning: Failed to authenticate to GHCR on VPS\n'));
    console.log(chalk.gray(`Error: ${error.message}`));
    console.log(chalk.gray('\nYou can authenticate manually later by running:'));
    console.log(chalk.white(`  ssh ${deployAnswers.vpsUser}@${deployAnswers.vpsHost} "echo 'YOUR_GHCR_TOKEN' | docker login ghcr.io -u ${deployAnswers.githubOrg} --password-stdin"\n`));
  }

  console.log(chalk.green.bold('\n✅ Deployment configuration complete!\n'));
  console.log(chalk.white('Configuration saved to:'));
  console.log(chalk.gray(`  - .launchframe`));
  if (filesUpdated > 0) {
    console.log(chalk.gray(`  - ${filesUpdated} file(s) updated\n`));
  }

  console.log(chalk.white('Prerequisites:\n'));
  console.log(chalk.white('• Docker must be installed and running locally'));
  console.log(chalk.gray('  (Required for building production images during deploy:init)\n'));

  console.log(chalk.white('Next steps:\n'));
  console.log(chalk.white('1. Configure GitHub Secrets (required for CI/CD):'));
  console.log(chalk.gray(`   Repository: https://github.com/${deployAnswers.githubOrg}/${config.projectName}/settings/secrets/actions`));
  console.log(chalk.gray(`   Required secrets:`));
  console.log(chalk.gray(`     - VPS_HOST: ${deployAnswers.vpsHost}`));
  console.log(chalk.gray(`     - VPS_USER: ${deployAnswers.vpsUser}`));
  console.log(chalk.gray(`     - VPS_SSH_KEY: (your private SSH key)`));
  console.log(chalk.gray(`     - GHCR_TOKEN: (use the same token you just provided)`));

  console.log(chalk.white('\n2. Point DNS records to your VPS:'));
  console.log(chalk.gray(`   - A record: ${deployAnswers.primaryDomain} → VPS IP`));
  console.log(chalk.gray(`   - A record: *.${deployAnswers.primaryDomain} → VPS IP`));

  console.log(chalk.white('\n3. Configure production environment variables:'));
  console.log(chalk.gray(`   Run: launchframe deploy:set-env`));

  console.log(chalk.white('\n4. Initial VPS deployment:'));
  console.log(chalk.gray(`   Run: launchframe deploy:init\n`));
}

module.exports = { deployConfigure };
