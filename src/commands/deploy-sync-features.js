const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { spawnSync } = require('child_process');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

function localQuery(infrastructurePath, sql) {
  return spawnSync('docker', [
    'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
    'exec', '-T', 'database', 'sh', '-c', 'psql -U $POSTGRES_USER $POSTGRES_DB -t -A'
  ], { cwd: infrastructurePath, input: sql, encoding: 'utf8' });
}

function remoteQuery(vpsUser, vpsHost, vpsAppFolder, sql) {
  return spawnSync('ssh', [
    `${vpsUser}@${vpsHost}`,
    `cd ${vpsAppFolder}/infrastructure && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T database sh -c 'psql -U $POSTGRES_USER $POSTGRES_DB -t -A'`
  ], { input: sql, encoding: 'utf8' });
}

function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function sqlJsonb(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

function sqlBool(val) {
  return val ? 'true' : 'false';
}

async function deploySyncFeatures(flags = {}) {
  requireProject();

  // Step 1 — Project + infrastructure check
  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  // Step 2 — Deployment configured
  const config = getProjectConfig();

  if (!config.deployConfigured || !config.deployment) {
    console.error(chalk.red('\n❌ Deployment is not configured.'));
    console.log(chalk.gray('Run deploy:configure first.\n'));
    process.exit(1);
  }

  const { vpsUser, vpsHost, vpsAppFolder } = config.deployment;

  // Step 3 — Local database container up
  const localPs = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'ps', '--status', 'running', '-q', 'database'
    ],
    { cwd: infrastructurePath, encoding: 'utf8' }
  );

  if (!localPs.stdout || localPs.stdout.trim() === '') {
    console.error(chalk.red('\n❌ Local database container is not running.'));
    console.log(chalk.gray('Run: launchframe docker:up\n'));
    process.exit(1);
  }

  // Step 4 — Remote database container up
  const remoteDockerPsCmd = `cd ${vpsAppFolder}/infrastructure && docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --status running -q database`;
  const remotePs = spawnSync('ssh', [`${vpsUser}@${vpsHost}`, remoteDockerPsCmd], { encoding: 'utf8' });

  if (remotePs.status !== 0 || !remotePs.stdout || remotePs.stdout.trim() === '') {
    console.error(chalk.red('\n❌ Remote database container is not running.'));
    console.log(chalk.gray('Make sure services are running: launchframe deploy:up\n'));
    process.exit(1);
  }

  // Step 5 — Remote Polar sync check
  const polarCountResult = remoteQuery(
    vpsUser, vpsHost, vpsAppFolder,
    'SELECT COUNT(*) FROM subscription_plans WHERE polar_product_id IS NOT NULL;'
  );

  const polarCount = parseInt((polarCountResult.stdout || '').trim(), 10);
  if (!polarCount || polarCount === 0) {
    console.error(chalk.red('\n❌ Remote plans have not been synced from Polar yet.'));
    console.log(chalk.gray('Import plans from the admin portal first.\n'));
    process.exit(1);
  }

  // Step 6 — Compare plans local vs remote
  const planCodesSQL = 'SELECT json_agg(code ORDER BY sort_order) FROM subscription_plans;';

  const localPlansResult = localQuery(infrastructurePath, planCodesSQL);
  const remotePlansResult = remoteQuery(vpsUser, vpsHost, vpsAppFolder, planCodesSQL);

  let localCodes = [];
  let remoteCodes = [];

  try {
    localCodes = JSON.parse((localPlansResult.stdout || '').trim()) || [];
  } catch {
    localCodes = [];
  }

  try {
    remoteCodes = JSON.parse((remotePlansResult.stdout || '').trim()) || [];
  } catch {
    remoteCodes = [];
  }

  const missingOnRemote = localCodes.filter(code => !remoteCodes.includes(code));
  if (missingOnRemote.length > 0) {
    console.error(chalk.red(`\n❌ Some local plans are missing on remote: ${missingOnRemote.join(', ')}`));
    console.log(chalk.gray('Ensure plans are imported from Polar on the remote admin portal.\n'));
    process.exit(1);
  }

  // Step 7 — Query local data (for summary counts)
  const featuresSQL = `SELECT json_agg(row_to_json(t)) FROM (
    SELECT name, code, description, feature_type, default_value, template, is_active, sort_order
    FROM subscription_plan_features ORDER BY sort_order
  ) t;`;

  const featureValuesSQL = `SELECT json_agg(row_to_json(t)) FROM (
    SELECT sp.code AS plan_code, spf.code AS feature_code, spfv.value
    FROM subscription_plan_feature_values spfv
    JOIN subscription_plans sp ON sp.id = spfv.subscription_plan_id
    JOIN subscription_plan_features spf ON spf.id = spfv.feature_id
  ) t;`;

  const featuresResult = localQuery(infrastructurePath, featuresSQL);
  const featureValuesResult = localQuery(infrastructurePath, featureValuesSQL);

  let features = [];
  let featureValues = [];

  try {
    features = JSON.parse((featuresResult.stdout || '').trim()) || [];
  } catch {
    features = [];
  }

  try {
    featureValues = JSON.parse((featureValuesResult.stdout || '').trim()) || [];
  } catch {
    featureValues = [];
  }

  // Step 7 cont — Show summary + confirm
  console.log(chalk.yellow.bold('\n⚠️  You are about to overwrite ALL features on the PRODUCTION database.\n'));
  console.log(chalk.gray(`  Local features:             ${features.length}`));
  console.log(chalk.gray(`  Local feature-plan values:  ${featureValues.length}`));
  console.log(chalk.gray(`  Remote host:                ${vpsHost}\n`));
  console.log(chalk.red('This will TRUNCATE subscription_plan_features (cascades to feature values).\n'));

  if (!flags.yes) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to sync features to production?',
        default: false
      }
    ]);

    if (!confirmed) {
      console.log(chalk.gray('\nAborted.\n'));
      process.exit(0);
    }
  }

  // Step 9 — Build sync SQL transaction
  const featureRows = features.map(f =>
    `(${sqlStr(f.name)}, ${sqlStr(f.code)}, ${sqlStr(f.description)}, ${sqlStr(f.feature_type)}, ${sqlJsonb(f.default_value)}, ${sqlStr(f.template)}, ${sqlBool(f.is_active)}, ${f.sort_order !== null && f.sort_order !== undefined ? f.sort_order : 'NULL'}, NOW(), NOW())`
  ).join(',\n  ');

  const featureValueRows = featureValues.map(v =>
    `(${sqlStr(v.plan_code)}, ${sqlStr(v.feature_code)}, ${sqlJsonb(v.value)})`
  ).join(',\n  ');

  let syncSql = `BEGIN;\n\nTRUNCATE subscription_plan_features CASCADE;\n`;

  if (features.length > 0) {
    syncSql += `
INSERT INTO subscription_plan_features
  (name, code, description, feature_type, default_value, template, is_active, sort_order, created_at, updated_at)
VALUES
  ${featureRows};
`;
  }

  if (featureValues.length > 0) {
    syncSql += `
INSERT INTO subscription_plan_feature_values (subscription_plan_id, feature_id, value, created_at, updated_at)
SELECT p.id, f.id, v.value, NOW(), NOW()
FROM (VALUES
  ${featureValueRows}
) AS v(plan_code, feature_code, value)
JOIN subscription_plans p ON p.code = v.plan_code
JOIN subscription_plan_features f ON f.code = v.feature_code;
`;
  }

  syncSql += `\nCOMMIT;\n`;

  // Step 10 — Execute on remote with spinner
  const spinner = ora('Syncing features to production...').start();

  const execResult = spawnSync('ssh', [
    `${vpsUser}@${vpsHost}`,
    `cd ${vpsAppFolder}/infrastructure && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T database sh -c 'psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER $POSTGRES_DB'`
  ], { input: syncSql, encoding: 'utf8' });

  if (execResult.status !== 0) {
    spinner.fail('Failed to sync features to production.');
    if (execResult.stderr) {
      console.error(chalk.gray(execResult.stderr));
    }
    process.exit(1);
  }

  spinner.succeed(chalk.green(`Synced ${features.length} features and ${featureValues.length} feature-plan values to production.`));
  console.log();
}

module.exports = { deploySyncFeatures };
