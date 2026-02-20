const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { requireProject } = require('../utils/project-helpers');

async function migrateRevert() {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  console.log(chalk.blue.bold('\n🗄️  Reverting last database migration\n'));

  try {
    execSync('docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run migration:revert', {
      cwd: infrastructurePath,
      stdio: 'inherit'
    });
    console.log(chalk.green.bold('\n✅ Migration reverted successfully.\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Error reverting migration:'), error.message);
    process.exit(1);
  }
}

module.exports = { migrateRevert };
