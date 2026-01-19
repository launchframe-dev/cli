const chalk = require('chalk');

/**
 * Simple logger with verbose mode support
 *
 * Usage:
 *   logger.setVerbose(true);
 *   logger.info('Main message');    // Always shown
 *   logger.detail('Nested detail'); // Only shown in verbose mode
 */

let verboseMode = false;

/**
 * Enable or disable verbose mode
 * @param {boolean} enabled
 */
function setVerbose(enabled) {
  verboseMode = enabled;
}

/**
 * Check if verbose mode is enabled
 * @returns {boolean}
 */
function isVerbose() {
  return verboseMode;
}

/**
 * Log a main info message (always shown)
 * @param {string} message
 */
function info(message) {
  console.log(message);
}

/**
 * Log a success message (always shown)
 * @param {string} message
 */
function success(message) {
  console.log(chalk.green(message));
}

/**
 * Log an error message (always shown)
 * @param {string} message
 */
function error(message) {
  console.error(chalk.red(message));
}

/**
 * Log a warning message (always shown)
 * @param {string} message
 */
function warn(message) {
  console.warn(chalk.yellow(message));
}

/**
 * Log a detail/nested message (only in verbose mode)
 * @param {string} message
 * @param {number} indent - Indentation level (default 1)
 */
function detail(message, indent = 1) {
  if (verboseMode) {
    const prefix = '  '.repeat(indent);
    console.log(chalk.gray(`${prefix}${message}`));
  }
}

/**
 * Log a step within an operation (only in verbose mode)
 * @param {string} message
 */
function step(message) {
  if (verboseMode) {
    console.log(chalk.gray(`  - ${message}`));
  }
}

module.exports = {
  setVerbose,
  isVerbose,
  info,
  success,
  error,
  warn,
  detail,
  step
};
