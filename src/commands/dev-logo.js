const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { requireProject, getProjectConfig } = require('../utils/project-helpers');

/**
 * Render SVG to PNG buffer at a given size using @resvg/resvg-js
 * @param {Buffer} svgBuffer - SVG file buffer
 * @param {number} size - Width/height in pixels
 * @returns {Buffer} PNG buffer
 */
function renderPng(Resvg, svgBuffer, size) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

/**
 * Write a file, creating directories as needed
 * @param {string} filePath - Absolute path to write
 * @param {Buffer|string} data - File content
 */
function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
  console.log(chalk.gray(`  ✓ ${filePath.replace(process.cwd() + '/', '')}`));
}

/**
 * Generate and inject logo/favicon assets across all relevant frontend services
 * @param {string} svgPath - Optional path to SVG file (defaults to <projectRoot>/logo.svg)
 */
async function devLogo(svgPath) {
  requireProject();

  const cwd = process.cwd();
  const logoPath = svgPath || path.join(cwd, 'logo.svg');

  if (!fs.existsSync(logoPath)) {
    console.error(chalk.red('\n❌ Error: logo.svg not found'));
    console.log(chalk.gray('Place your logo.svg file in the project root:'));
    console.log(chalk.white(`  ${cwd}/logo.svg`));
    console.log();
    console.log(chalk.gray('Then run:'));
    console.log(chalk.white('  launchframe dev:logo\n'));
    process.exit(1);
  }

  const config = getProjectConfig();
  const hasCustomersPortal = (config.installedServices || []).includes('customers-portal');

  // Lazy load heavy dependencies
  const { Resvg } = require('@resvg/resvg-js');
  const toIco = require('to-ico');

  const svgBuffer = fs.readFileSync(logoPath);
  const svgContent = svgBuffer.toString('utf8');

  console.log(chalk.blue.bold('\nGenerating logo assets...\n'));

  // ─── Website ─────────────────────────────────────────────────────────────
  const websitePath = path.join(cwd, 'website');
  if (!fs.existsSync(websitePath)) {
    console.log(chalk.yellow('⚠ website not found — skipping'));
  } else {
    console.log(chalk.white('website/public/'));
    const pub = path.join(websitePath, 'public');
    const images = path.join(pub, 'images');

    const png16 = renderPng(Resvg, svgBuffer, 16);
    const png32 = renderPng(Resvg, svgBuffer, 32);
    const png96 = renderPng(Resvg, svgBuffer, 96);
    const png180 = renderPng(Resvg, svgBuffer, 180);
    const png512 = renderPng(Resvg, svgBuffer, 512);
    const icoBuffer = await toIco([png16, png32]);

    writeFile(path.join(pub, 'favicon.ico'), icoBuffer);
    writeFile(path.join(pub, 'favicon.svg'), svgContent);
    writeFile(path.join(pub, 'favicon.png'), png32);
    writeFile(path.join(pub, 'favicon-96x96.png'), png96);
    writeFile(path.join(pub, 'apple-touch-icon.png'), png180);
    writeFile(path.join(images, 'logo.svg'), svgContent);
    writeFile(path.join(images, 'logo.png'), png512);
  }

  // ─── Admin Portal ─────────────────────────────────────────────────────────
  const adminPath = path.join(cwd, 'admin-portal');
  if (!fs.existsSync(adminPath)) {
    console.log(chalk.yellow('⚠ admin-portal not found — skipping'));
  } else {
    console.log(chalk.white('\nadmin-portal/public/'));
    const pub = path.join(adminPath, 'public');
    const favicons = path.join(pub, 'favicons');
    const srcAssets = path.join(adminPath, 'src', 'assets');

    const png16 = renderPng(Resvg, svgBuffer, 16);
    const png24 = renderPng(Resvg, svgBuffer, 24);
    const png32 = renderPng(Resvg, svgBuffer, 32);
    const png64 = renderPng(Resvg, svgBuffer, 64);
    const png96 = renderPng(Resvg, svgBuffer, 96);
    const png180 = renderPng(Resvg, svgBuffer, 180);
    const png192 = renderPng(Resvg, svgBuffer, 192);
    const png512 = renderPng(Resvg, svgBuffer, 512);
    const icoBuffer = await toIco([png16, png32]);
    const icoFavicons = await toIco([png16, png24, png32, png64]);

    writeFile(path.join(pub, 'favicon.ico'), icoBuffer);
    writeFile(path.join(pub, 'favicon.svg'), svgContent);
    writeFile(path.join(pub, 'favicon.png'), png32);
    writeFile(path.join(favicons, 'favicon.svg'), svgContent);
    writeFile(path.join(favicons, 'favicon.ico'), icoFavicons);
    writeFile(path.join(favicons, 'favicon-16x16.png'), png16);
    writeFile(path.join(favicons, 'favicon-32x32.png'), png32);
    writeFile(path.join(favicons, 'favicon-96x96.png'), png96);
    writeFile(path.join(favicons, 'web-app-manifest-192x192.png'), png192);
    writeFile(path.join(favicons, 'web-app-manifest-96x96.png'), png96);
    writeFile(path.join(favicons, 'web-app-manifest-512x512.png'), png512);
    writeFile(path.join(favicons, 'apple-touch-icon.png'), png180);
    writeFile(path.join(pub, 'logo.svg'), svgContent);
    writeFile(path.join(pub, 'logo.png'), png512);
    writeFile(path.join(pub, 'logo192.png'), png192);
    writeFile(path.join(pub, 'logo512.png'), png512);
    writeFile(path.join(srcAssets, 'logo.svg'), svgContent);
  }

  // ─── Customers Portal (B2B2C only) ────────────────────────────────────────
  if (hasCustomersPortal) {
    const customersPath = path.join(cwd, 'customers-portal');
    if (!fs.existsSync(customersPath)) {
      console.log(chalk.yellow('\n⚠ customers-portal not found — skipping'));
    } else {
      console.log(chalk.white('\ncustomers-portal/public/'));
      const pub = path.join(customersPath, 'public');
      const favicons = path.join(pub, 'favicons');

      const png16 = renderPng(Resvg, svgBuffer, 16);
      const png32 = renderPng(Resvg, svgBuffer, 32);
      const png96 = renderPng(Resvg, svgBuffer, 96);
      const png180 = renderPng(Resvg, svgBuffer, 180);
      const png512 = renderPng(Resvg, svgBuffer, 512);
      const icoBuffer = await toIco([png16, png32]);

      writeFile(path.join(pub, 'favicon.ico'), icoBuffer);
      writeFile(path.join(pub, 'favicon.svg'), svgContent);
      writeFile(path.join(pub, 'favicon.png'), png32);
      writeFile(path.join(favicons, 'favicon.svg'), svgContent);
      writeFile(path.join(favicons, 'favicon-16x16.png'), png16);
      writeFile(path.join(favicons, 'favicon-32x32.png'), png32);
      writeFile(path.join(favicons, 'favicon-96x96.png'), png96);
      writeFile(path.join(favicons, 'apple-touch-icon.png'), png180);
      writeFile(path.join(pub, 'logo.svg'), svgContent);
      writeFile(path.join(pub, 'logo.png'), png512);
    }
  }

  console.log(chalk.green('\n✅ Logo assets generated successfully!\n'));
}

module.exports = { devLogo };
