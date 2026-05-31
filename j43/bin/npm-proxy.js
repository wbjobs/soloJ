#!/usr/bin/env node

const { Command } = require('commander');
const { loadConfig, setRegistry, getUpstreamRegistry, lockVersion, unlockVersion, getLockedVersions } = require('../src/config');
const { startServer } = require('../src/server');
const { VulnerabilityScanner } = require('../src/audit');
const path = require('path');
const fs = require('fs');

const program = new Command();

program
  .name('npm-proxy')
  .description('A private npm proxy with caching and vulnerability scanning')
  .version('1.0.0');

program
  .command('start')
  .description('Start the npm proxy server')
  .option('-p, --port <number>', 'Port to listen on', '4873')
  .action((options) => {
    const port = parseInt(options.port, 10);
    console.log('Starting npm proxy server...');
    startServer(port);
  });

program
  .command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('get')
      .description('Get a configuration value')
      .argument('[key]', 'Configuration key (e.g., registry)')
      .action((key) => {
        const config = loadConfig();
        if (key) {
          if (key === 'registry') {
            console.log(config.upstreamRegistry);
          } else if (config[key] !== undefined) {
            console.log(config[key]);
          } else {
            console.error(`Unknown config key: ${key}`);
            process.exit(1);
          }
        } else {
          console.log(JSON.stringify(config, null, 2));
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set a configuration value')
      .argument('<key>', 'Configuration key')
      .argument('<value>', 'Configuration value')
      .action((key, value) => {
        const { saveConfig } = require('../src/config');
        if (key === 'registry') {
          const updated = setRegistry(value);
          console.log(`Upstream registry set to: ${updated.upstreamRegistry}`);
        } else {
          const updated = saveConfig({ [key]: value });
          console.log(`${key} set to: ${updated[key]}`);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configuration')
      .action(() => {
        const config = loadConfig();
        console.log('Current configuration:');
        console.log(JSON.stringify(config, null, 2));
      })
  );

program
  .command('set-registry')
  .description('Set the upstream npm registry')
  .argument('<url>', 'Registry URL (e.g., https://registry.npmmirror.com)')
  .action((url) => {
    const updated = setRegistry(url);
    console.log(`Upstream registry has been set to: ${updated.upstreamRegistry}`);
    console.log('Run `npm-proxy start` to start the server with the new configuration.');
  });

program
  .command('get-registry')
  .description('Get the current upstream npm registry')
  .action(() => {
    const registry = getUpstreamRegistry();
    console.log(`Current upstream registry: ${registry}`);
  });

program
  .command('audit')
  .description('Audit a package-lock.json file for vulnerabilities')
  .argument('[file]', 'Path to package-lock.json', './package-lock.json')
  .option('-j, --json', 'Output as JSON')
  .action((file, options) => {
    const config = loadConfig();
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    try {
      const scanner = new VulnerabilityScanner(config.vulnerabilityDB, config.lockedVersions);
      const result = scanner.scanFile(filePath);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                Vulnerability Audit Report                    ║
╠══════════════════════════════════════════════════════════════╣
║  Scanned dependencies:  ${String(result.scanned).padEnd(41)}║
║  Total vulnerabilities: ${String(result.totalVulnerabilities).padEnd(41)}║
║  High risk:             ${String(result.highRisk).padEnd(41)}║
║  Medium risk:           ${String(result.mediumRisk).padEnd(41)}║
║  Low risk:              ${String(result.lowRisk).padEnd(41)}║
║  Locked packages:       ${String(result.lockedPackages.length).padEnd(41)}║
╚══════════════════════════════════════════════════════════════╝
`);

        if (result.lockedPackages.length > 0) {
          console.log('\x1b[35m%s\x1b[0m', '🔒 LOCKED PACKAGES (version enforced by proxy):');
          console.log('');
          result.lockedPackages.forEach(lp => {
            const statusColor = lp.matchesLock ? '\x1b[32m' : '\x1b[33m';
            const status = lp.matchesLock ? '✓ matches lock' : `⚠ using ${lp.version}, locked to ${lp.lockedVersion}`;
            console.log(`  \x1b[35m🔒 ${lp.package}@${lp.lockedVersion}\x1b[0m ${statusColor}(${status})\x1b[0m`);
          });
          console.log('');
        }

        if (result.warnings.length > 0) {
          console.log('\x1b[31m%s\x1b[0m', '⚠️  HIGH RISK VULNERABILITIES FOUND:');
          console.log('');
          result.warnings.forEach((warning, i) => {
            console.log(`  ${i + 1}. ${warning}`);
          });
          console.log('');
        }

        if (result.vulnerabilities.length > 0) {
          console.log('\x1b[33m%s\x1b[0m', '📋 All vulnerabilities:');
          console.log('');
          result.vulnerabilities.forEach(v => {
            const color = v.severity === 'high' ? '\x1b[31m' : v.severity === 'medium' ? '\x1b[33m' : '\x1b[36m';
            console.log(`  ${color}[${v.severity.toUpperCase()}]\x1b[0m ${v.package}@${v.version}`);
            console.log(`      ${v.title}`);
            console.log(`      Fix: upgrade to ${v.fixedVersion}`);
            console.log('');
          });
        }

        if (result.totalVulnerabilities === 0) {
          console.log('\x1b[32m%s\x1b[0m', '✅ No vulnerabilities found!');
        }
      }
    } catch (error) {
      console.error(`Audit failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('lock')
  .description('Lock a package to a specific version')
  .argument('<package>', 'Package name with version (e.g., lodash@4.17.20)')
  .action((pkg) => {
    const parts = pkg.split('@');
    if (parts.length < 2 || !parts[1]) {
      console.error('Please specify package with version, e.g., lodash@4.17.20');
      process.exit(1);
    }
    const packageName = parts.slice(0, -1).join('@');
    const version = parts[parts.length - 1];
    
    const updated = lockVersion(packageName, version);
    console.log(`✅ Locked ${packageName}@${version}`);
    console.log('Restart the server for changes to take effect.');
  });

program
  .command('unlock')
  .description('Unlock a package version')
  .argument('<package>', 'Package name')
  .action((packageName) => {
    const locked = getLockedVersions();
    if (!locked[packageName]) {
      console.log(`⚠️  ${packageName} is not locked`);
      return;
    }
    
    unlockVersion(packageName);
    console.log(`✅ Unlocked ${packageName}`);
    console.log('Restart the server for changes to take effect.');
  });

program
  .command('list-locks')
  .description('List all locked package versions')
  .action(() => {
    const locked = getLockedVersions();
    const entries = Object.entries(locked);
    
    if (entries.length === 0) {
      console.log('No locked packages.');
      return;
    }
    
    console.log('Locked packages:');
    console.log('');
    entries.forEach(([name, version]) => {
      console.log(`  🔒 ${name}@${version}`);
    });
    console.log('');
    console.log(`Total: ${entries.length} locked package(s)`);
  });

program
  .command('help')
  .description('Display help information')
  .action(() => {
    program.outputHelp();
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.outputHelp();
}
