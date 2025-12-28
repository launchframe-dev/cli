const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

/**
 * Replace template variables in all files within a directory
 * @param {string} directory - Root directory to search
 * @param {Object} variables - Object with variable mappings (e.g., {'{{VAR}}': 'value'})
 */
async function replaceVariables(directory, variables) {
  // Find all files (excluding node_modules, .git, binary files)
  const files = await glob('**/*', {
    cwd: directory,
    nodir: true,
    dot: true, // Include hidden files/directories like .vitepress
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.ico',
      '**/*.pdf',
      '**/*.woff',
      '**/*.woff2',
      '**/*.ttf',
      '**/*.eot'
    ]
  });

  for (const file of files) {
    const filePath = path.join(directory, file);
    await replaceVariablesInFile(filePath, variables);
  }
}

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} Escaped string safe for use in regex
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace template variables in a single file
 * Uses negative lookbehind to avoid replacing GitHub Actions syntax (${{ }})
 * @param {string} filePath - Path to file
 * @param {Object} variables - Object with variable mappings
 */
async function replaceVariablesInFile(filePath, variables) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Replace each variable using regex with negative lookbehind
    for (const [placeholder, value] of Object.entries(variables)) {
      // Create regex that matches {{VAR}} but NOT ${{VAR}}
      // Negative lookbehind: (?<!\$) means "not preceded by $"
      const escapedPlaceholder = escapeRegex(placeholder);
      const regex = new RegExp(`(?<!\\$)${escapedPlaceholder}`, 'g');

      if (regex.test(content)) {
        // Reset regex lastIndex after test
        regex.lastIndex = 0;
        content = content.replace(regex, value);
        modified = true;
      }
    }

    // Only write if changes were made
    if (modified) {
      await fs.writeFile(filePath, content, 'utf8');
    }

    return modified;
  } catch (error) {
    // Skip binary files or files that can't be read as text
    if (error.code !== 'EISDIR') {
      // Log warning but continue
      console.warn(`Warning: Could not process ${filePath}`);
    }
    return false;
  }
}

module.exports = {
  replaceVariables,
  replaceVariablesInFile
};
