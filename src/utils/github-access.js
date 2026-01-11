const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Create a clickable terminal link using OSC 8 escape sequence
 * Works in modern terminals (iTerm2, Hyper, Windows Terminal, VS Code, etc.)
 * Falls back gracefully to plain text in unsupported terminals
 * @param {string} text - Display text
 * @param {string} url - Target URL
 * @returns {string} Formatted link
 */
function makeClickable(text, url) {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/**
 * Check if user has SSH access to LaunchFrame services repository
 * @returns {Promise<{hasAccess: boolean, error?: string}>}
 */
async function checkGitHubAccess() {
  try {
    // Test SSH access by checking if we can list remote refs
    execSync(
      'git ls-remote git@github.com:launchframe-dev/services.git HEAD',
      { 
        timeout: 15000,
        stdio: 'pipe' // Don't show output
      }
    );
    return { hasAccess: true };
  } catch (error) {
    return {
      hasAccess: false,
      error: error.message
    };
  }
}

/**
 * Display message when user doesn't have access to services repository
 * Guides them to either purchase or setup SSH keys
 */
function showAccessDeniedMessage() {
  const purchaseUrl = 'https://buy.polar.sh/polar_cl_Zy4YqEwhoIEdUrAH8vHaWuZtwZuv306sYMnq118MbKi';
  const docsUrl = 'https://docs.launchframe.dev/guide/quick-start#add-ssh-key-to-repo';
  
  console.log(chalk.red('\n❌ Cannot access LaunchFrame services repository\n'));
  
  console.log(chalk.white('This could mean:\n'));
  console.log(chalk.gray('  1. You haven\'t purchased LaunchFrame yet'));
  console.log(chalk.gray('  2. You purchased but haven\'t added your SSH key to the repo\n'));
  
  console.log(chalk.cyan('→ New customers:'));
  console.log('  ' + chalk.blue.bold.underline(makeClickable('Purchase LaunchFrame', purchaseUrl)));
  console.log('  ' + chalk.cyan(purchaseUrl + '\n'));
  
  console.log(chalk.cyan('→ Existing customers:'));
  console.log('  ' + chalk.blue.bold.underline(makeClickable('Setup SSH key (docs)', docsUrl)));
  console.log('  ' + chalk.cyan(docsUrl + '\n'));
  
  console.log(chalk.gray('After setup, run: launchframe init\n'));
}

module.exports = {
  checkGitHubAccess,
  showAccessDeniedMessage
};
