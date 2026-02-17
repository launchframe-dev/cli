const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const MIXPANEL_TOKEN = '3e6214f33ba535dec14021547039427c';
const CONFIG_DIR = path.join(os.homedir(), '.launchframe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

let config = null;

/**
 * Sanitize error messages by stripping file paths and capping length
 * @param {string} message - Raw error message
 * @returns {string} Sanitized message
 */
function sanitize(message) {
  if (!message) return 'unknown';
  return message
    .replace(/\/[\w\-\/.]+/g, '<path>')
    .replace(/[A-Z]:\\[\w\-\\.\\]+/g, '<path>')
    .substring(0, 200);
}

/**
 * Read config from disk, or return defaults
 * @returns {Object} Config object
 */
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted config — start fresh
  }
  return {};
}

/**
 * Write config to disk
 * @param {Object} cfg - Config object to write
 */
function writeConfig(cfg) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Check if telemetry is disabled via environment variables
 * @returns {boolean} True if disabled via env
 */
function isDisabledByEnv() {
  return process.env.DO_NOT_TRACK === '1' || process.env.LAUNCHFRAME_TELEMETRY_DISABLED === '1';
}

/**
 * Check if running from a locally linked (dev) version
 * @returns {boolean} True if running via npm link
 */
function isDevMode() {
  return !__dirname.includes('node_modules');
}

/**
 * Check if telemetry is enabled
 * @returns {boolean} True if telemetry is enabled
 */
function isEnabled() {
  if (isDevMode()) return false;
  if (isDisabledByEnv()) return false;
  if (!config || !config.telemetry) return false;
  return config.telemetry.enabled !== false;
}

/**
 * Initialize telemetry — call once at CLI startup.
 * Reads/creates config, shows first-run notice if needed.
 * Synchronous and fast.
 */
function initTelemetry() {
  try {
    config = readConfig();

    if (!config.telemetry) {
      config.telemetry = {
        enabled: true,
        noticeShown: false,
        anonymousId: crypto.randomUUID()
      };
      writeConfig(config);
    }

    if (!config.telemetry.anonymousId) {
      config.telemetry.anonymousId = crypto.randomUUID();
      writeConfig(config);
    }

    if (!config.telemetry.noticeShown && !isDisabledByEnv() && !isDevMode()) {
      console.log(
        chalk.gray(
          '\nLaunchFrame collects anonymous usage data to improve the CLI.\n' +
            'No personal information is collected. Run `launchframe telemetry --disable` to opt out.\n' +
            'Learn more: https://launchframe.dev/privacy\n'
        )
      );
      config.telemetry.noticeShown = true;
      writeConfig(config);
    }
  } catch {
    // Telemetry init must never break the CLI
  }
}

/**
 * Fire-and-forget event tracking.
 * @param {string} name - Event name
 * @param {Object} properties - Event properties
 */
function trackEvent(name, properties = {}) {
  try {
    if (!isEnabled()) return;

    const cliVersion = (() => {
      try {
        return require('../../package.json').version;
      } catch {
        return 'unknown';
      }
    })();

    const payload = JSON.stringify([
      {
        event: name,
        properties: {
          token: MIXPANEL_TOKEN,
          distinct_id: config.telemetry.anonymousId,
          cli_version: cliVersion,
          node_version: process.version,
          os: process.platform,
          os_arch: process.arch,
          ...properties
        }
      }
    ]);

    const req = https.request(
      {
        hostname: 'api-eu.mixpanel.com',
        path: '/track',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => { res.resume(); }
    );

    req.on('error', () => {});
    req.write(payload);
    req.end();
    req.unref();
  } catch {
    // Telemetry must never break the CLI
  }
}

/**
 * Enable or disable telemetry
 * @param {boolean} enabled - Whether to enable telemetry
 */
function setTelemetryEnabled(enabled) {
  config = readConfig();

  if (!config.telemetry) {
    config.telemetry = {
      enabled,
      noticeShown: true,
      anonymousId: crypto.randomUUID()
    };
  } else {
    config.telemetry.enabled = enabled;
    config.telemetry.noticeShown = true;
  }

  writeConfig(config);

  if (enabled) {
    console.log(chalk.green('\nTelemetry enabled. Thank you for helping improve LaunchFrame!\n'));
  } else {
    console.log(chalk.yellow('\nTelemetry disabled. No data will be collected.\n'));
  }
}

/**
 * Show current telemetry status
 */
function showTelemetryStatus() {
  config = readConfig();
  const envDisabled = isDisabledByEnv();

  console.log(chalk.blue.bold('\nTelemetry Status\n'));

  if (envDisabled) {
    console.log(chalk.yellow('  Disabled via environment variable'));
    if (process.env.DO_NOT_TRACK === '1') {
      console.log(chalk.gray('  DO_NOT_TRACK=1'));
    }
    if (process.env.LAUNCHFRAME_TELEMETRY_DISABLED === '1') {
      console.log(chalk.gray('  LAUNCHFRAME_TELEMETRY_DISABLED=1'));
    }
  } else if (config.telemetry && config.telemetry.enabled !== false) {
    console.log(chalk.green('  Enabled'));
  } else {
    console.log(chalk.yellow('  Disabled'));
  }

  if (config.telemetry && config.telemetry.anonymousId) {
    console.log(chalk.gray(`  Anonymous ID: ${config.telemetry.anonymousId}`));
  }

  console.log(chalk.gray('\n  To disable: launchframe telemetry --disable'));
  console.log(chalk.gray('  To enable:  launchframe telemetry --enable'));
  console.log(chalk.gray('  Env vars:   DO_NOT_TRACK=1 or LAUNCHFRAME_TELEMETRY_DISABLED=1\n'));
}

module.exports = { initTelemetry, trackEvent, sanitize, setTelemetryEnabled, showTelemetryStatus };
