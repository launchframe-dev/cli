const fs = require('fs-extra');

/**
 * Replace a marked section in a file
 * @param {string} filePath - Path to file
 * @param {string} sectionName - Name of section (e.g., 'CORS_CONFIG')
 * @param {string} newContent - New content to insert
 */
async function replaceSection(filePath, sectionName, newContent) {
  const content = await fs.readFile(filePath, 'utf8');

  // Try all comment formats (// for JS/TS, {/* */} for JSX, # for YAML/Shell)
  const startMarkerSlash = `// ${sectionName}_START`;
  const endMarkerSlash = `// ${sectionName}_END`;
  const startMarkerJSX = `{/* ${sectionName}_START */}`;
  const endMarkerJSX = `{/* ${sectionName}_END */}`;
  const startMarkerHash = `# ${sectionName}_START`;
  const endMarkerHash = `# ${sectionName}_END`;

  let startIndex = content.indexOf(startMarkerSlash);
  let endIndex = content.indexOf(endMarkerSlash);

  // If not found with // comments, try JSX comments
  if (startIndex === -1 || endIndex === -1) {
    startIndex = content.indexOf(startMarkerJSX);
    endIndex = content.indexOf(endMarkerJSX);
  }

  // If not found with JSX comments, try # comments (YAML/Shell)
  if (startIndex === -1 || endIndex === -1) {
    startIndex = content.indexOf(startMarkerHash);
    endIndex = content.indexOf(endMarkerHash);
  }

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Section markers not found: ${sectionName} in ${filePath}`);
  }

  // Find the start of the start marker line (beginning of line, not just the marker)
  let lineStart = content.lastIndexOf('\n', startIndex - 1);
  if (lineStart === -1) {
    lineStart = 0; // Marker is on first line
  } else {
    lineStart += 1; // Move past the newline to the start of the line
  }

  // Find the end of the end marker line
  const endLineEnd = content.indexOf('\n', endIndex);

  // Construct new content - exclude both marker lines (including leading whitespace)
  const before = content.substring(0, lineStart);
  const after = content.substring(endLineEnd + 1);
  const replaced = before + newContent + after;

  await fs.writeFile(filePath, replaced, 'utf8');
}

/**
 * Check if a file contains a specific section marker
 * @param {string} filePath - Path to file
 * @param {string} sectionName - Name of section
 * @returns {Promise<boolean>} - True if section exists
 */
async function hasSection(filePath, sectionName) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const startMarkerSlash = `// ${sectionName}_START`;
    const endMarkerSlash = `// ${sectionName}_END`;
    const startMarkerJSX = `{/* ${sectionName}_START */}`;
    const endMarkerJSX = `{/* ${sectionName}_END */}`;
    const startMarkerHash = `# ${sectionName}_START`;
    const endMarkerHash = `# ${sectionName}_END`;

    // Check all comment formats
    const hasSlash = content.includes(startMarkerSlash) && content.includes(endMarkerSlash);
    const hasJSX = content.includes(startMarkerJSX) && content.includes(endMarkerJSX);
    const hasHash = content.includes(startMarkerHash) && content.includes(endMarkerHash);

    return hasSlash || hasJSX || hasHash;
  } catch (error) {
    return false;
  }
}

module.exports = {
  replaceSection,
  hasSection
};
