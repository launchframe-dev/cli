const fs = require('fs-extra');

/**
 * Check if a file contains any template placeholders ({{VAR}})
 * @param {string} filePath - Path to file to check
 * @returns {Promise<{hasPlaceholders: boolean, placeholders: string[]}>}
 */
async function checkForPlaceholders(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Regex to find {{VAR}} patterns (but not ${{VAR}} which is GitHub Actions)
    const placeholderRegex = /(?<!\$)\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
    const placeholders = [];
    let match;

    while ((match = placeholderRegex.exec(content)) !== null) {
      const placeholder = match[0]; // Full match including {{ }}
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return {
      hasPlaceholders: placeholders.length > 0,
      placeholders
    };
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Validate that .env.prod file exists and has no placeholders
 * @param {string} envProdPath - Path to .env.prod file
 * @returns {Promise<{valid: boolean, error?: string, placeholders?: string[]}>}
 */
async function validateEnvProd(envProdPath) {
  // Check if file exists
  if (!await fs.pathExists(envProdPath)) {
    return {
      valid: false,
      error: 'File does not exist'
    };
  }

  // Check for placeholders
  const { hasPlaceholders, placeholders } = await checkForPlaceholders(envProdPath);

  if (hasPlaceholders) {
    return {
      valid: false,
      error: 'File contains placeholder variables',
      placeholders
    };
  }

  return { valid: true };
}

/**
 * Generate a secure random string for secrets (URL-safe)
 * @param {number} length - Length of string to generate
 * @returns {string}
 */
function generateSecret(length = 32) {
  const crypto = require('crypto');
  // Use hex encoding to avoid URL-unsafe characters (+, /, =)
  // Hex produces 2 chars per byte, so divide by 2
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = {
  checkForPlaceholders,
  validateEnvProd,
  generateSecret
};
