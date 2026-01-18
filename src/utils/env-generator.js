const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a secure random string
 * @param {number} length - Length of the string
 * @returns {string} Random hex string
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate environment file from .env.example
 * @param {string} projectRoot - Root directory of the generated project
 * @param {Object} answers - User answers from prompts
 */
async function generateEnvFile(projectRoot, answers) {
  const envExamplePath = path.join(projectRoot, 'infrastructure', '.env.example');
  const envPath = path.join(projectRoot, 'infrastructure', '.env');

  // Read .env.example
  const envTemplate = await fs.readFile(envExamplePath, 'utf8');

  // Generate secure secrets
  const secrets = {
    BETTER_AUTH_SECRET: generateSecret(32),
    DB_PASSWORD: generateSecret(24),
    BULL_ADMIN_TOKEN: generateSecret(24)
  };

  // Create variable mappings
  const variables = {
    '{{PROJECT_NAME}}': answers.projectName,
    '{{PROJECT_NAME_UPPER}}': answers.projectNameUpper,
    '{{PRIMARY_DOMAIN}}': answers.primaryDomain,
    '{{ADMIN_EMAIL}}': answers.adminEmail,

    // Replace placeholder passwords with generated secrets
    'your_secure_postgres_password': secrets.DB_PASSWORD,
    'your_better_auth_secret_minimum_32_chars': secrets.BETTER_AUTH_SECRET,
    'your_bull_admin_token': secrets.BULL_ADMIN_TOKEN
  };

  // Replace variables in template
  let envContent = envTemplate;
  for (const [placeholder, value] of Object.entries(variables)) {
    envContent = envContent.split(placeholder).join(value);
  }

  // Write .env file
  await fs.writeFile(envPath, envContent, 'utf8');

  return {
    envPath,
    secrets
  };
}

/**
 * Update environment file with component-specific variables
 * @param {string} envPath - Path to .env file
 * @param {string} componentName - Name of the component
 * @param {Object} envVarSchema - Schema of env vars (key: description)
 * @param {Object} values - Actual values for the env vars
 */
async function updateEnvFile(envPath, componentName, envVarSchema, values) {
  // Read existing .env file
  let envContent = await fs.readFile(envPath, 'utf8');

  // Add section header for component
  envContent += `\n\n# ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} Component\n`;

  // Add each env var
  for (const [key, description] of Object.entries(envVarSchema)) {
    envContent += `${key}=${values[key]}\n`;
  }

  // Write back to file
  await fs.writeFile(envPath, envContent, 'utf8');
}

module.exports = {
  generateEnvFile,
  generateSecret,
  updateEnvFile
};
