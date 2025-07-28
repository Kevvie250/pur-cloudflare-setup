#!/usr/bin/env node

import { isValidPath, resolveSafePath } from './src/utils/validation.js';
import { templateEngine } from './src/modules/templateEngine.js';
import { ConfigManager } from './src/modules/configManager.js';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🔒 Security Fix Verification Tests\n'));

// Test 1: Path Traversal Prevention
console.log(chalk.yellow('Test 1: Path Traversal Prevention'));
const pathTests = [
  { path: 'normal/path/file.js', expected: true },
  { path: '../../../etc/passwd', expected: false },
  { path: '..\\..\\windows\\system32', expected: false },
  { path: 'path/with/../traversal', expected: false },
  { path: '/absolute/path', expected: false },
  { path: 'C:\\Windows\\System32', expected: false },
  { path: 'path/with/null\0byte', expected: false },
  { path: 'path/with|pipe', expected: false },
  { path: 'path/with$variable', expected: false },
  { path: 'path/with`backticks`', expected: false },
];

let pathTestsPassed = 0;
pathTests.forEach(({ path, expected }) => {
  const result = isValidPath(path);
  const passed = result === expected;
  console.log(`  ${passed ? '✅' : '❌'} "${path}" - ${result ? 'valid' : 'invalid'}`);
  if (passed) pathTestsPassed++;
});

console.log(`  Result: ${pathTestsPassed}/${pathTests.length} tests passed\n`);

// Test 2: Secure Path Resolution
console.log(chalk.yellow('Test 2: Secure Path Resolution'));
try {
  const safePath = resolveSafePath('test/file.js');
  console.log(`  ✅ Safe path resolved: ${safePath}`);
} catch (error) {
  console.log(`  ❌ Safe path resolution failed: ${error.message}`);
}

try {
  resolveSafePath('../../../etc/passwd');
  console.log(`  ❌ Path traversal was not blocked!`);
} catch (error) {
  console.log(`  ✅ Path traversal blocked: ${error.message}`);
}
console.log();

// Test 3: Template Injection Prevention
console.log(chalk.yellow('Test 3: Template Injection Prevention'));
const injectionTests = [
  {
    name: 'HTML Context',
    template: '<div>Hello {{name}}</div>',
    vars: { name: '<script>alert("XSS")</script>' },
    context: 'html',
    shouldContain: '&lt;script&gt;'
  },
  {
    name: 'JavaScript Context',
    template: 'const message = "{{message}}";',
    vars: { message: '"; alert("XSS"); //' },
    context: 'js',
    shouldContain: '\\"'
  },
  {
    name: 'Shell Context',
    template: 'echo {{command}}',
    vars: { command: '; rm -rf /' },
    context: 'shell',
    shouldContain: "'; rm -rf /'"
  },
  {
    name: 'Raw/Unescaped Variable',
    template: '<div>{{{rawHtml}}}</div>',
    vars: { rawHtml: '<b>Bold Text</b>' },
    context: 'html',
    shouldContain: '<b>Bold Text</b>'
  }
];

async function testTemplateInjection() {
  for (const test of injectionTests) {
    try {
      const result = await templateEngine.processTemplate(
        test.template, 
        test.vars,
        { context: test.context }
      );
      const passed = result.includes(test.shouldContain);
      console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
      if (!passed) {
        console.log(`     Expected to contain: "${test.shouldContain}"`);
        console.log(`     Actual result: "${result}"`);
      }
    } catch (error) {
      console.log(`  ❌ ${test.name} - Error: ${error.message}`);
    }
  }
  console.log();
}

await testTemplateInjection();

// Test 4: Error Handling in ConfigManager
console.log(chalk.yellow('Test 4: ConfigManager Error Handling'));
const configManager = new ConfigManager();

try {
  // Force an initialization error by setting invalid config directory
  configManager.configDir = '/root/.pur-cloudflare-setup-test-invalid';
  await configManager.initialize();
  console.log('  ❌ ConfigManager should have thrown an error');
} catch (error) {
  console.log('  ✅ ConfigManager properly threw error:', error.message);
}

// Test loading with invalid path
try {
  await configManager.loadFromFile('../../etc/passwd');
  console.log('  ❌ loadFromFile should have blocked path traversal');
} catch (error) {
  console.log('  ✅ loadFromFile blocked path traversal:', error.message);
}

console.log(chalk.green.bold('\n✨ Security verification complete!\n'));