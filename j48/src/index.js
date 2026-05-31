#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const Diff = require('diff');

const program = new Command();

program
  .name('js-upgrade')
  .description('CLI tool to upgrade old JavaScript code by converting var to let/const and migrating APIs')
  .version('2.0.0')
  .argument('<directory>', 'directory to scan for .js files')
  .option('--api-rules <rulesFile>', 'path to API migration rules JSON file')
  .option('--skip-var-upgrade', 'skip var to let/const conversion')
  .option('--show-diff', 'show unified diff of changes')
  .option('--dry-run', 'preview changes without writing files')
  .action((directory, options) => {
    runUpgrade(directory, options);
  });

program.parse();

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        scanDirectory(filePath, fileList);
      }
    } else if (stat.isFile() && file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function loadApiRules(rulesPath) {
  if (!rulesPath) return null;
  const absolutePath = path.resolve(rulesPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`API rules file not found: ${rulesPath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rulesConfig = JSON.parse(content);
  return rulesConfig.rules || [];
}

function buildApiMatcher(rules) {
  const apiMap = new Map();
  rules.forEach(rule => {
    apiMap.set(rule.oldApi, rule);
  });
  return apiMap;
}

function matchApiPath(callExpr, apiMap) {
  const callee = callExpr.callee;
  const parts = [];

  function traverseCallee(node) {
    if (t.isIdentifier(node)) {
      parts.unshift(node.name);
      return true;
    } else if (t.isMemberExpression(node)) {
      const propertyName = t.isIdentifier(node.property)
        ? node.property.name
        : t.isStringLiteral(node.property)
          ? node.property.value
          : null;
      if (propertyName === null) return false;
      parts.unshift(propertyName);
      return traverseCallee(node.object);
    }
    return false;
  }

  if (!traverseCallee(callee)) return null;

  const apiPath = parts.join('.');
  return apiMap.get(apiPath) || null;
}

function createNewCallee(newApiPath) {
  const parts = newApiPath.split('.');
  if (parts.length === 1) {
    return t.identifier(parts[0]);
  }

  let callee = t.identifier(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    callee = t.memberExpression(callee, t.identifier(parts[i]));
  }
  return callee;
}

function remapParams(oldParams, rule) {
  const { paramMapping, removeParams = [], addParams = [] } = rule;
  let params = [...oldParams];

  if (removeParams.length > 0) {
    const sortedRemove = [...removeParams].sort((a, b) => b - a);
    sortedRemove.forEach(idx => {
      if (idx >= 0 && idx < params.length) {
        params.splice(idx, 1);
      }
    });
  }

  if (paramMapping && paramMapping.length > 0) {
    const mapped = [];
    paramMapping.forEach(oldIdx => {
      if (oldIdx >= 0 && oldIdx < params.length) {
        mapped.push(params[oldIdx]);
      }
    });
    params = mapped;
  }

  addParams.forEach(param => {
    if (param.type === 'literal') {
      params.push(t.valueToNode(param.value));
    } else if (param.type === 'identifier') {
      params.push(t.identifier(param.name));
    }
  });

  return params;
}

function generateDiff(oldCode, newCode, filePath) {
  const diff = Diff.createTwoFilesPatch(
    `--- ${filePath}`,
    `+++ ${filePath}`,
    oldCode,
    newCode,
    '',
    '',
    { context: 3 }
  );

  if (!diff) return '';

  const lines = diff.split('\n');
  return lines.map(line => {
    if (line.startsWith('+')) return `\x1b[32m${line}\x1b[0m`;
    if (line.startsWith('-')) return `\x1b[31m${line}\x1b[0m`;
    if (line.startsWith('@@')) return `\x1b[36m${line}\x1b[0m`;
    return line;
  }).join('\n');
}

function isForLoopInit(varDeclPath) {
  return varDeclPath.parent.type === 'ForStatement' ||
         varDeclPath.parent.type === 'ForInStatement' ||
         varDeclPath.parent.type === 'ForOfStatement';
}

function getBlockBoundary(varDeclPath) {
  const parent = varDeclPath.parent;
  if (parent.type === 'ForStatement' ||
      parent.type === 'ForInStatement' ||
      parent.type === 'ForOfStatement') {
    return varDeclPath.parentPath;
  }
  if (parent.type === 'BlockStatement') {
    const grandparent = varDeclPath.parentPath.parent;
    if (grandparent.type === 'FunctionDeclaration' ||
        grandparent.type === 'FunctionExpression' ||
        grandparent.type === 'ArrowFunctionExpression' ||
        grandparent.type === 'ObjectMethod' ||
        grandparent.type === 'ClassMethod') {
      return null;
    }
    return varDeclPath.parentPath;
  }
  if (parent.type === 'Program') {
    return null;
  }
  return varDeclPath.parentPath;
}

function isReferenceOutsideBlock(refPath, blockPath) {
  if (!blockPath) return false;
  let current = refPath.parentPath;
  while (current) {
    if (current.node === blockPath.node) return false;
    current = current.parentPath;
  }
  return true;
}

function hasTDZViolation(varDeclPath, binding) {
  if (!binding || !varDeclPath.node.loc) return false;
  const declLine = varDeclPath.node.loc.start.line;
  const declCol = varDeclPath.node.loc.start.column;

  return binding.referencePaths.some(refPath => {
    if (!refPath.node.loc) return false;
    const refLine = refPath.node.loc.start.line;
    const refCol = refPath.node.loc.start.column;
    if (refLine < declLine) return true;
    if (refLine === declLine && refCol < declCol) return true;
    return false;
  });
}

function hasHoistingViolation(varDeclPath, binding) {
  if (!binding) return false;
  const blockBoundary = getBlockBoundary(varDeclPath);
  if (!blockBoundary) return false;

  return binding.referencePaths.some(refPath =>
    isReferenceOutsideBlock(refPath, blockBoundary)
  );
}

function determineKind(varName, varDeclPath, warnings) {
  const binding = varDeclPath.scope.getBinding(varName);

  if (isForLoopInit(varDeclPath)) {
    if (hasHoistingViolation(varDeclPath, binding)) {
      warnings.push({
        variable: varName,
        line: varDeclPath.node.loc ? varDeclPath.node.loc.start.line : 0,
        reason: `Variable '${varName}' is referenced outside the for-loop (var hoisting); keeping as 'var'`
      });
      return 'var';
    }
    return 'let';
  }

  if (hasTDZViolation(varDeclPath, binding)) {
    warnings.push({
      variable: varName,
      line: varDeclPath.node.loc ? varDeclPath.node.loc.start.line : 0,
      reason: `Variable '${varName}' is referenced before declaration (var hoisting / TDZ); keeping as 'var'`
    });
    return 'var';
  }

  if (hasHoistingViolation(varDeclPath, binding)) {
    warnings.push({
      variable: varName,
      line: varDeclPath.node.loc ? varDeclPath.node.loc.start.line : 0,
      reason: `Variable '${varName}' is referenced outside its declaration block (var hoisting); keeping as 'var'`
    });
    return 'var';
  }

  if (binding && !binding.constant) {
    return 'let';
  }

  return 'const';
}

function processFile(filePath, options) {
  try {
    const originalCode = fs.readFileSync(filePath, 'utf-8');
    const ast = parser.parse(originalCode, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true
    });

    const modifiedLines = new Set();
    const warnings = [];
    const apiMigrations = [];

    if (options.apiRules) {
      const apiMap = buildApiMatcher(options.apiRules);

      traverse(ast, {
        CallExpression(callPath) {
          const matchedRule = matchApiPath(callPath.node, apiMap);
          if (!matchedRule) return;

          const oldApi = matchedRule.oldApi;
          const newApi = matchedRule.newApi;
          const oldParams = [...callPath.node.arguments];
          const newParams = remapParams(oldParams, matchedRule);

          const newCallee = createNewCallee(newApi);
          callPath.node.callee = newCallee;
          callPath.node.arguments = newParams;

          const line = callPath.node.loc ? callPath.node.loc.start.line : 0;
          apiMigrations.push({
            oldApi,
            newApi,
            line,
            paramsChanged: matchedRule.paramMapping && matchedRule.paramMapping.length > 1
          });

          if (callPath.node.loc) {
            modifiedLines.add(callPath.node.loc.start.line);
          }
        }
      });
    }

    if (!options.skipVarUpgrade) {
      traverse(ast, {
        VariableDeclaration(varDeclPath) {
          if (varDeclPath.node.kind !== 'var') return;

          const declarators = varDeclPath.node.declarations;
          const analyzed = declarators.map(declarator => {
            if (declarator.id.type !== 'Identifier') {
              return { kind: 'let', declarator, action: 'convert' };
            }
            const varName = declarator.id.name;
            const kind = determineKind(varName, varDeclPath, warnings);
            return {
              kind,
              declarator,
              action: kind === 'var' ? 'keep' : 'convert'
            };
          });

          const hasKeep = analyzed.some(a => a.action === 'keep');
          const hasConvert = analyzed.some(a => a.action === 'convert');

          if (hasKeep && !hasConvert) {
            return;
          }

          if (varDeclPath.node.loc) {
            modifiedLines.add(varDeclPath.node.loc.start.line);
          }

          if (hasKeep && hasConvert) {
            const groups = [
              { kind: 'var', declarators: analyzed.filter(a => a.action === 'keep').map(a => a.declarator) },
              { kind: 'let', declarators: analyzed.filter(a => a.action === 'convert' && a.kind === 'let').map(a => a.declarator) },
              { kind: 'const', declarators: analyzed.filter(a => a.action === 'convert' && a.kind === 'const').map(a => a.declarator) }
            ].filter(g => g.declarators.length > 0);

            const newNodes = groups.map(group =>
              t.variableDeclaration(group.kind, group.declarators)
            );
            varDeclPath.replaceWithMultiple(newNodes);
            return;
          }

          const kinds = new Set(analyzed.map(a => a.kind));

          if (kinds.size === 1) {
            varDeclPath.node.kind = analyzed[0].kind;
            return;
          }

          const groups = [];
          let currentGroup = { kind: analyzed[0].kind, declarators: [analyzed[0].declarator] };

          for (let i = 1; i < analyzed.length; i++) {
            if (analyzed[i].kind === currentGroup.kind) {
              currentGroup.declarators.push(analyzed[i].declarator);
            } else {
              groups.push(currentGroup);
              currentGroup = { kind: analyzed[i].kind, declarators: [analyzed[i].declarator] };
            }
          }
          groups.push(currentGroup);

          const newNodes = groups.map(group =>
            t.variableDeclaration(group.kind, group.declarators)
          );
          varDeclPath.replaceWithMultiple(newNodes);
        }
      });
    }

    let newCode = originalCode;
    if (modifiedLines.size > 0) {
      const output = generate(ast, {}, originalCode);
      newCode = output.code;
    }

    const hasChanges = modifiedLines.size > 0;

    if (hasChanges && options.showDiff) {
      const diffOutput = generateDiff(originalCode, newCode, filePath);
      if (diffOutput) {
        console.log(`\n\x1b[1m--- Diff for ${filePath} ---\x1b[0m\n`);
        console.log(diffOutput);
        console.log('\n' + '='.repeat(70) + '\n');
      }
    }

    if (hasChanges && !options.dryRun) {
      fs.writeFileSync(filePath, newCode, 'utf-8');
    }

    return {
      file: filePath,
      modified: hasChanges,
      linesModified: Array.from(modifiedLines).sort((a, b) => a - b),
      lineCount: modifiedLines.size,
      warnings,
      apiMigrations,
      dryRun: options.dryRun
    };
  } catch (error) {
    return {
      file: filePath,
      modified: false,
      error: error.message,
      lineCount: 0,
      linesModified: [],
      warnings: [],
      apiMigrations: [],
      dryRun: options.dryRun
    };
  }
}

function runUpgrade(directory, options) {
  const absoluteDir = path.resolve(directory);

  if (!fs.existsSync(absoluteDir)) {
    console.error(`Error: Directory '${directory}' does not exist.`);
    process.exit(1);
  }

  let apiRules = null;
  if (options.apiRules) {
    try {
      apiRules = loadApiRules(options.apiRules);
      console.log(`Loaded ${apiRules.length} API migration rule(s)`);
    } catch (err) {
      console.error(`Error loading API rules: ${err.message}`);
      process.exit(1);
    }
  }

  const processOptions = {
    ...options,
    apiRules
  };

  console.log(`Scanning directory: ${absoluteDir}`);
  if (options.dryRun) {
    console.log(`\x1b[33m⚠ DRY RUN MODE - no files will be modified\x1b[0m`);
  }

  const jsFiles = scanDirectory(absoluteDir);
  console.log(`Found ${jsFiles.length} .js file(s)`);

  const report = {
    timestamp: new Date().toISOString(),
    directory: absoluteDir,
    totalFiles: jsFiles.length,
    modifiedFiles: [],
    totalLinesModified: 0,
    warnings: [],
    apiMigrations: [],
    totalApiMigrations: 0,
    dryRun: options.dryRun,
    options: {
      skipVarUpgrade: options.skipVarUpgrade || false,
      apiRulesFile: options.apiRules || null
    }
  };

  jsFiles.forEach(filePath => {
    const result = processFile(filePath, processOptions);
    if (result.modified) {
      report.modifiedFiles.push(result);
      report.totalLinesModified += result.lineCount;
      const mode = result.dryRun ? ' (DRY RUN)' : '';
      console.log(`\x1b[32m✓\x1b[0m Modified: ${filePath} (${result.lineCount} line(s))${mode}`);
    } else if (result.error) {
      console.log(`\x1b[31m✗\x1b[0m Error in ${filePath}: ${result.error}`);
    } else {
      console.log(`  Skipped: ${filePath}`);
    }

    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(w => {
        report.warnings.push({ ...w, file: filePath });
        console.log(`\x1b[33m⚠\x1b[0m Line ${w.line}: ${w.reason}`);
      });
    }

    if (result.apiMigrations && result.apiMigrations.length > 0) {
      result.apiMigrations.forEach(m => {
        report.apiMigrations.push({ ...m, file: filePath });
        report.totalApiMigrations++;
        const paramNote = m.paramsChanged ? ' (params reordered)' : '';
        console.log(`  \x1b[36m→\x1b[0m Line ${m.line}: ${m.oldApi} → ${m.newApi}${paramNote}`);
      });
    }
  });

  const reportPath = path.join(absoluteDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(`Upgrade complete!`);
  console.log(`Total files scanned: ${report.totalFiles}`);
  console.log(`Files modified: ${report.modifiedFiles.length}`);
  console.log(`Total lines modified: ${report.totalLinesModified}`);
  if (report.totalApiMigrations > 0) {
    console.log(`API migrations: ${report.totalApiMigrations}`);
  }
  if (report.warnings.length > 0) {
    console.log(`\x1b[33mWarnings: ${report.warnings.length}\x1b[0m`);
  }
  console.log(`Report saved to: ${reportPath}`);
  console.log('='.repeat(60));
}

module.exports = { runUpgrade, processFile, scanDirectory, loadApiRules, remapParams };
