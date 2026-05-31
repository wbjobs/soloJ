const fs = require('fs');
const path = require('path');

class VulnerabilityScanner {
  constructor(dbPath, lockedVersions = {}) {
    this.dbPath = dbPath;
    this.vulnDB = this._loadDB();
    this.lockedVersions = lockedVersions;
  }

  _loadDB() {
    if (fs.existsSync(this.dbPath)) {
      return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
    }
    return {};
  }

  reload() {
    this.vulnDB = this._loadDB();
  }

  _extractDependencies(lockData) {
    const deps = [];

    if (lockData.dependencies) {
      for (const [name, info] of Object.entries(lockData.dependencies)) {
        deps.push({ name, version: info.version });
        if (info.dependencies) {
          this._extractNestedDeps(info.dependencies, deps, name);
        }
      }
    }

    if (lockData.packages) {
      for (const [pkgPath, info] of Object.entries(lockData.packages)) {
        if (pkgPath === '') continue;
        const name = info.name || pkgPath.replace(/^node_modules\//, '').split('/node_modules/').pop();
        if (info.version) {
          const exists = deps.some(d => d.name === name && d.version === info.version);
          if (!exists) {
            deps.push({ name, version: info.version });
          }
        }
      }
    }

    return deps;
  }

  _extractNestedDeps(dependencies, result, parent) {
    for (const [name, info] of Object.entries(dependencies)) {
      result.push({ name, version: info.version, parent });
      if (info.dependencies) {
        this._extractNestedDeps(info.dependencies, result, name);
      }
    }
  }

  _semverMatch(version, vulnVersion) {
    return version === vulnVersion;
  }

  scanLockFile(lockContent) {
    let lockData;
    try {
      lockData = typeof lockContent === 'string' ? JSON.parse(lockContent) : lockContent;
    } catch (e) {
      throw new Error('Invalid package-lock.json format');
    }

    const dependencies = this._extractDependencies(lockData);
    const vulnerabilities = [];
    const lockedPackages = [];
    const scanned = new Set();

    for (const dep of dependencies) {
      const key = `${dep.name}@${dep.version}`;
      if (scanned.has(key)) continue;
      scanned.add(key);

      const lockedVersion = this.lockedVersions[dep.name];
      if (lockedVersion) {
        const isMatch = this._semverMatch(dep.version, lockedVersion);
        lockedPackages.push({
          package: dep.name,
          version: dep.version,
          lockedVersion: lockedVersion,
          matchesLock: isMatch,
          parent: dep.parent || null
        });
      }

      const vulnPackage = this.vulnDB[dep.name];
      if (vulnPackage) {
        for (const [vulnVersion, vulnInfo] of Object.entries(vulnPackage)) {
          if (this._semverMatch(dep.version, vulnVersion)) {
            vulnerabilities.push({
              package: dep.name,
              version: dep.version,
              severity: vulnInfo.severity,
              title: vulnInfo.title,
              description: vulnInfo.description,
              fixedVersion: vulnInfo.fixedVersion,
              parent: dep.parent || null
            });
          }
        }
      }
    }

    const highRisk = vulnerabilities.filter(v => v.severity === 'high');
    const mediumRisk = vulnerabilities.filter(v => v.severity === 'medium');
    const lowRisk = vulnerabilities.filter(v => v.severity === 'low');

    return {
      scanned: dependencies.length,
      totalVulnerabilities: vulnerabilities.length,
      highRisk: highRisk.length,
      mediumRisk: mediumRisk.length,
      lowRisk: lowRisk.length,
      vulnerabilities: vulnerabilities,
      warnings: highRisk.map(v =>
        `[HIGH] ${v.package}@${v.version}: ${v.title} - ${v.description}. Fix: upgrade to ${v.fixedVersion}`
      ),
      lockedPackages: lockedPackages,
      lockedWarnings: lockedPackages.map(lp =>
        lp.matchesLock
          ? `[LOCKED] ${lp.package}@${lp.version} (matches locked version)`
          : `[LOCKED MISMATCH] ${lp.package}@${lp.version} (locked to ${lp.lockedVersion}, but using ${lp.version})`
      )
    };
  }

  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.scanLockFile(content);
  }
}

module.exports = {
  VulnerabilityScanner
};
