const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { replaceSection } = require('./section-replacer');

/**
 * Install a module into a project
 * @param {string} moduleName - Name of the module to install
 * @param {Object} moduleConfig - Config object from MODULE_CONFIG[moduleName]
 */
async function installModule(moduleName, moduleConfig) {
  const templateRoot = path.resolve(__dirname, '../../../services');
  const cwd = process.cwd();

  for (const [serviceName, config] of Object.entries(moduleConfig)) {
    const moduleFilesDir = path.join(templateRoot, serviceName, 'modules', config.modulesDir, 'files');
    const moduleSectionsDir = path.join(templateRoot, serviceName, 'modules', config.modulesDir, 'sections');
    const serviceDir = path.join(cwd, serviceName);

    // Copy files
    for (const filePath of config.files) {
      const src = path.join(moduleFilesDir, filePath);
      const dest = path.join(serviceDir, filePath);
      console.log(`  Adding ${filePath}`);
      await fs.copy(src, dest, { overwrite: true });
    }

    // Inject sections
    for (const [targetFile, markerNames] of Object.entries(config.sections)) {
      const targetFilePath = path.join(serviceDir, targetFile);
      const targetBasename = path.basename(targetFile);

      for (const markerName of markerNames) {
        const sectionFile = path.join(moduleSectionsDir, `${targetBasename}.${markerName}`);
        console.log(`  Injecting ${markerName} into ${targetFile}`);
        const sectionContent = await fs.readFile(sectionFile, 'utf8');
        await replaceSection(targetFilePath, markerName, sectionContent);
      }
    }

    // Merge dependencies into package.json and sync lockfile
    if (config.dependencies && Object.keys(config.dependencies).length > 0) {
      const packageJsonPath = path.join(serviceDir, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...config.dependencies,
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

      // Run npm install to sync package-lock.json, otherwise `npm ci` will fail on rebuild
      console.log(`\nRunning npm install in ${serviceName}...`);
      execSync('npm install', { cwd: serviceDir, stdio: 'inherit' });
    }
  }
}

module.exports = { installModule };
