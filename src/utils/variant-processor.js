/**
 * Variant Processor
 *
 * Applies variant modifications to generated projects.
 * Strategy: Copy base → Copy variant FILES → Insert variant SECTIONS
 *
 * Clear distinction:
 * - SECTIONS: Code snippets inserted into base template files
 * - FILES: Complete files/folders copied to the project
 */

const { replaceSection } = require('./section-replacer');
const { copyDirectory } = require('./file-ops');
const { replaceVariables } = require('./variable-replacer');
const { getVariantConfig, getVariantsToApply } = require('../services/variant-config');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * Process service with variant modifications
 *
 * @param {string} serviceName - Service to process (backend, admin-portal, etc.)
 * @param {object} variantChoices - User's variant selections (e.g., { tenancy: 'multi-tenant', userModel: 'b2b' })
 * @param {string} destination - Destination directory for generated code
 * @param {object} replacements - Template variable replacements (e.g., {{PROJECT_NAME}})
 * @param {string} templateRoot - Root directory of templates
 */
async function processServiceVariant(
  serviceName,
  variantChoices,
  destination,
  replacements,
  templateRoot
) {
  logger.detail(`Processing ${serviceName} with choices: ${JSON.stringify(variantChoices)}`, 2);

  const serviceConfig = getVariantConfig(serviceName);
  if (!serviceConfig) {
    throw new Error(`No variant configuration found for service: ${serviceName}`);
  }

  const basePath = path.join(templateRoot, serviceConfig.base);

  // Copy base template
  logger.detail(`Copying base template from ${serviceConfig.base}`, 2);
  await copyDirectory(basePath, destination, {
    exclude: ['node_modules', '.git', 'dist', '.env']
  });

  // Determine which variants to apply
  const variantsToApply = getVariantsToApply(variantChoices);

  if (variantsToApply.length === 0) {
    logger.detail('Using base template (no variants)', 2);
  } else {
    logger.detail(`Applying variants: ${variantsToApply.join(', ')}`, 2);
  }

  // Apply each variant
  for (const variantName of variantsToApply) {
    const variantConfig = serviceConfig.variants[variantName];

    if (!variantConfig) {
      // Silently skip - not every service needs every variant combination
      // (e.g., b2b2c_multi-tenant may only apply to backend, not admin-portal)
      logger.detail(`Skipping ${variantName} (not applicable to this service)`, 3);
      continue;
    }

    logger.detail(`Applying ${variantName} variant`, 2);

    // Copy variant FILES
    await copyVariantFiles(
      variantName,
      variantConfig.files || [],
      serviceConfig.filesDir,
      destination,
      templateRoot
    );

    // Insert variant SECTIONS
    await insertVariantSections(
      variantName,
      variantConfig.sections || {},
      serviceConfig.sectionsDir,
      destination,
      templateRoot
    );
  }

  // Clean up unused section markers
  logger.detail('Cleaning up unused section markers', 2);
  await cleanupSectionMarkers(serviceName, serviceConfig, variantsToApply, destination);

  // Replace template variables
  logger.detail('Replacing template variables', 2);
  await replaceVariables(destination, replacements);

  logger.detail(`${serviceName} complete`, 2);
}

/**
 * Clean up unused section markers from generated files
 * Uses variant configuration to only process files with known sections
 * @param {string} serviceName - Service name (backend, admin-portal, etc.)
 * @param {object} serviceConfig - Service variant configuration
 * @param {string[]} appliedVariants - Variants that were applied
 * @param {string} destination - Destination directory
 */
async function cleanupSectionMarkers(serviceName, serviceConfig, appliedVariants, destination) {
  const allVariants = Object.keys(serviceConfig.variants || {});
  const unappliedVariants = allVariants.filter(v => !appliedVariants.includes(v));

  if (unappliedVariants.length === 0) {
    logger.detail('No unused section markers to clean', 3);
    return;
  }

  // Collect all sections from unapplied variants
  const sectionsToRemove = new Map(); // filePath -> Set of section names

  for (const variantName of unappliedVariants) {
    const variantConfig = serviceConfig.variants[variantName];
    const sections = variantConfig?.sections || {};

    for (const [filePath, sectionNames] of Object.entries(sections)) {
      if (!sectionsToRemove.has(filePath)) {
        sectionsToRemove.set(filePath, new Set());
      }
      sectionNames.forEach(name => sectionsToRemove.get(filePath).add(name));
    }
  }

  let totalCleaned = 0;

  // Process each file that has sections to remove
  for (const [filePath, sectionNames] of sectionsToRemove.entries()) {
    const targetFilePath = path.join(destination, filePath);

    if (!await fs.pathExists(targetFilePath)) {
      continue;
    }

    try {
      let content = await fs.readFile(targetFilePath, 'utf-8');
      let modified = false;

      // Remove each unused section marker (keep content, remove only marker comments)
      for (const sectionName of sectionNames) {
        // Try all comment formats (// for JS/TS, {/* */} for JSX, # for YAML/Shell)
        const slashPattern = new RegExp(
          `^[ \\t]*\\/\\/ ${sectionName}_START\\n([\\s\\S]*?)^[ \\t]*\\/\\/ ${sectionName}_END\\n?`,
          'gm'
        );
        const jsxPattern = new RegExp(
          `^[ \\t]*\\{\\/\\* ${sectionName}_START \\*\\/\\}\\n([\\s\\S]*?)^[ \\t]*\\{\\/\\* ${sectionName}_END \\*\\/\\}\\n?`,
          'gm'
        );
        const hashPattern = new RegExp(
          `^[ \\t]*# ${sectionName}_START\\n([\\s\\S]*?)^[ \\t]*# ${sectionName}_END\\n?`,
          'gm'
        );

        const beforeSlash = content;
        content = content.replace(slashPattern, '$1');
        if (content !== beforeSlash) {
          modified = true;
        }

        const beforeJsx = content;
        content = content.replace(jsxPattern, '$1');
        if (content !== beforeJsx) {
          modified = true;
        }

        const beforeHash = content;
        content = content.replace(hashPattern, '$1');
        if (content !== beforeHash) {
          modified = true;
        }
      }

      if (modified) {
        await fs.writeFile(targetFilePath, content, 'utf-8');
        totalCleaned++;
      }
    } catch (error) {
      logger.warn(`Could not clean markers in ${filePath}: ${error.message}`);
    }
  }

  if (totalCleaned > 0) {
    logger.detail(`Cleaned section markers in ${totalCleaned} file(s)`, 3);
  } else {
    logger.detail('No unused section markers found', 3);
  }
}

/**
 * Copy variant files to destination
 * @param {string} variantName - Variant name (e.g., 'multi-tenant')
 * @param {string[]} files - List of files/folders to copy
 * @param {string} filesDir - Variant files directory
 * @param {string} destination - Destination directory
 * @param {string} templateRoot - Template root directory
 */
async function copyVariantFiles(variantName, files, filesDir, destination, templateRoot) {
  if (!files || files.length === 0) {
    logger.detail(`No files to copy for ${variantName}`, 3);
    return;
  }

  logger.detail(`Copying ${files.length} file(s) for ${variantName}`, 3);

  const variantFilesPath = path.join(templateRoot, filesDir, variantName);

  for (const filePath of files) {
    const sourcePath = path.join(variantFilesPath, filePath);
    const destPath = path.join(destination, filePath);

    try {
      if (!await fs.pathExists(sourcePath)) {
        logger.warn(`Source not found: ${filePath}, skipping`);
        continue;
      }

      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(sourcePath, destPath, { overwrite: true });

      const isDir = (await fs.stat(sourcePath)).isDirectory();
      logger.detail(`Copied ${isDir ? 'folder' : 'file'}: ${filePath}`, 4);
    } catch (error) {
      logger.warn(`Could not copy ${filePath}: ${error.message}`);
    }
  }
}

/**
 * Insert variant section content into base template files
 * @param {string} variantName - Variant name (e.g., 'multi-tenant')
 * @param {object} sections - Section configuration { 'file.ts': ['SECTION1', 'SECTION2'] }
 * @param {string} sectionsDir - Variant sections directory
 * @param {string} destination - Destination directory
 * @param {string} templateRoot - Template root directory
 */
async function insertVariantSections(variantName, sections, sectionsDir, destination, templateRoot) {
  if (!sections || Object.keys(sections).length === 0) {
    logger.detail(`No sections to insert for ${variantName}`, 3);
    return;
  }

  const sectionFiles = Object.keys(sections);
  logger.detail(`Inserting sections into ${sectionFiles.length} file(s)`, 3);

  const variantSectionsPath = path.join(templateRoot, sectionsDir, variantName);

  for (const [filePath, sectionNames] of Object.entries(sections)) {
    const targetFilePath = path.join(destination, filePath);

    if (!await fs.pathExists(targetFilePath)) {
      logger.warn(`Target file not found: ${filePath}, skipping sections`);
      continue;
    }

    logger.detail(`Processing ${filePath}`, 4);

    for (const sectionName of sectionNames) {
      try {
        const fileName = path.basename(filePath);
        const sectionFileName = `${fileName}.${sectionName}`;
        const sectionFilePath = path.join(variantSectionsPath, sectionFileName);

        if (!await fs.pathExists(sectionFilePath)) {
          logger.warn(`Section file not found: ${sectionFileName}, skipping`);
          continue;
        }

        const sectionContent = await fs.readFile(sectionFilePath, 'utf-8');
        await replaceSection(targetFilePath, sectionName, sectionContent);
        logger.detail(`Inserted [${sectionName}]`, 5);
      } catch (error) {
        logger.warn(`Could not insert section ${sectionName}: ${error.message}`);
      }
    }
  }
}

/**
 * Validate variant choices
 * @param {object} variantChoices - User's variant selections
 * @returns {object} Validation result { valid: boolean, errors: string[] }
 */
function validateVariantChoices(variantChoices) {
  const errors = [];

  // Validate tenancy choice
  const tenancy = variantChoices.tenancy;
  if (tenancy && !['multi-tenant', 'single-tenant'].includes(tenancy)) {
    errors.push(`Invalid tenancy choice: ${tenancy}`);
  }

  // Validate user model choice
  const userModel = variantChoices.userModel;
  if (userModel && !['b2b', 'b2b2c'].includes(userModel)) {
    errors.push(`Invalid user model choice: ${userModel}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  processServiceVariant,
  validateVariantChoices
};
