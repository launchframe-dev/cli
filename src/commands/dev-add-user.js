const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');
const bcrypt = require('bcryptjs');
const { spawnSync } = require('child_process');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry',
  'Iris', 'Jack', 'Karen', 'Leo', 'Mia', 'Nathan', 'Olivia'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White'
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDummyUser() {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@example.com`;
  return { firstName, lastName, name: `${firstName} ${lastName}`, email, suffix };
}

function checkEmailExists(infrastructurePath, email) {
  const composeArgs = [
    'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
    'exec', '-T', 'database', 'sh', '-c', 'psql -U $POSTGRES_USER $POSTGRES_DB -t -c "SELECT COUNT(*) FROM users WHERE email = \'__EMAIL__\'"'
      .replace('__EMAIL__', email.replace(/'/g, "''"))
  ];

  const result = spawnSync('docker', composeArgs, { cwd: infrastructurePath, encoding: 'utf8' });
  if (result.status !== 0) return false;
  const count = parseInt((result.stdout || '').trim(), 10);
  return count > 0;
}

async function devAddUser() {
  requireProject();

  const infrastructurePath = path.join(process.cwd(), 'infrastructure');

  if (!fs.existsSync(infrastructurePath)) {
    console.error(chalk.red('\n❌ Error: infrastructure/ directory not found'));
    console.log(chalk.gray('Make sure you are in the root of your LaunchFrame project.\n'));
    process.exit(1);
  }

  // Check database container is running
  const psResult = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'ps', '--status', 'running', '-q', 'database'
    ],
    { cwd: infrastructurePath, encoding: 'utf8' }
  );

  if (!psResult.stdout || psResult.stdout.trim() === '') {
    console.error(chalk.red('\n❌ Database container is not running.'));
    console.log(chalk.gray('Start local services first:'));
    console.log(chalk.white('  launchframe docker:up\n'));
    process.exit(1);
  }

  // Generate user with unique email (up to 5 attempts)
  let user = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateDummyUser();
    if (!checkEmailExists(infrastructurePath, candidate.email)) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    console.error(chalk.red('\n❌ Could not generate a unique email after 5 attempts.'));
    process.exit(1);
  }

  const config = getProjectConfig();
  const isMultiTenant = config.variants?.tenancy === 'multi-tenant';

  const passwordHash = await bcrypt.hash('test123', 10);
  const accountId = crypto.randomUUID();

  const projectTitle = `Demo Project`;
  const projectSlug = `demo-project-${user.suffix}`;

  const projectInsert = isMultiTenant ? `
  INSERT INTO projects (user_id, title, slug, description, created_at, updated_at)
  VALUES (
    new_user_id,
    '${projectTitle}',
    '${projectSlug}',
    'Auto-generated demo project',
    NOW(),
    NOW()
  );` : '';

  const sqlScript = `
DO $$
DECLARE
  new_user_id INT;
BEGIN
  INSERT INTO users (email, name, role, email_verified, is_active, created_at, updated_at)
  VALUES (
    '${user.email.replace(/'/g, "''")}',
    '${user.name.replace(/'/g, "''")}',
    'business_user',
    true,
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;

  INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
  VALUES (
    '${accountId}',
    new_user_id,
    new_user_id::text,
    'credential',
    '${passwordHash.replace(/'/g, "''")}',
    NOW(),
    NOW()
  );
${projectInsert}
END $$;
`;

  const execResult = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml',
      'exec', '-T', 'database', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER $POSTGRES_DB'
    ],
    { cwd: infrastructurePath, input: sqlScript, encoding: 'utf8' }
  );

  if (execResult.status !== 0) {
    console.error(chalk.red('\n❌ Failed to insert user into database.'));
    if (execResult.stderr) {
      console.error(chalk.gray(execResult.stderr));
    }
    process.exit(1);
  }

  console.log(chalk.green('\n✅ User created!'));
  console.log(chalk.gray(`   Name:     ${user.name}`));
  console.log(chalk.gray(`   Email:    ${user.email}`));
  console.log(chalk.gray(`   Password: test123`));
  if (isMultiTenant) {
    console.log(chalk.gray(`   Project:  ${projectTitle} (${projectSlug})`));
  }
  console.log();
}

module.exports = { devAddUser };
