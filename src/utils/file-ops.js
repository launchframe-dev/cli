const fs = require('fs-extra');
const path = require('path');

/**
 * Copy a directory recursively with whitelist or blacklist filtering
 * @param {string} source - Source directory path
 * @param {string} destination - Destination directory path
 * @param {Object} options - Options object
 * @param {string[]} options.exclude - Array of directory names to exclude (blacklist approach)
 * @param {string[]} options.include - Array of directory names to include (whitelist approach, takes precedence)
 */
async function copyDirectory(source, destination, options = {}) {
  const { exclude = ['node_modules', '.git', '.next', 'dist', 'build', '.env'], include = null } = options;

  // Ensure destination exists
  await fs.ensureDir(destination);

  // Read directory contents
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    // Always check exclude list first (applies at all levels)
    if (exclude.includes(entry.name)) {
      continue;
    }

    // Whitelist approach: if include array is provided, only copy items in the list (only at top level)
    if (include !== null && include.length > 0) {
      if (!include.includes(entry.name)) {
        continue;
      }
    }

    if (entry.isDirectory()) {
      // Recursively copy directory (pass exclude, remove include for nested levels)
      await copyDirectory(sourcePath, destPath, { exclude });
    } else {
      // Copy file
      await fs.copy(sourcePath, destPath);
    }
  }
}

/**
 * Delete a file
 * @param {string} filePath - Path to file
 */
async function deleteFile(filePath) {
  await fs.remove(filePath);
}

/**
 * Delete a directory
 * @param {string} dirPath - Path to directory
 */
async function deleteDirectory(dirPath) {
  await fs.remove(dirPath);
}

/**
 * Copy a single file
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 */
async function copyFile(source, destination) {
  await fs.copy(source, destination);
}

/**
 * Move a file
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 */
async function moveFile(source, destination) {
  await fs.move(source, destination);
}

module.exports = {
  copyDirectory,
  deleteFile,
  deleteDirectory,
  copyFile,
  moveFile
};
