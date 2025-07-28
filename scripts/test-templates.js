#!/usr/bin/env node

/**
 * Test script for template system
 * 
 * This script tests the template engine and file generation
 */

import { templateEngine } from '../src/modules/templateEngine.js';
import { fileGenerator } from '../src/modules/fileGenerator.js';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testTemplateEngine() {
  console.log(chalk.blue('\n🧪 Testing Template Engine...\n'));
  
  try {
    // Test 1: Simple variable substitution
    console.log(chalk.yellow('Test 1: Variable substitution'));
    const result1 = await templateEngine.processTemplate(
      'Hello {{name}}, welcome to {{project}}!',
      { name: 'World', project: 'Cloudflare' }
    );
    console.log('Result:', result1);
    console.log(chalk.green('✓ Passed\n'));
    
    // Test 2: Conditionals
    console.log(chalk.yellow('Test 2: Conditionals'));
    const result2 = await templateEngine.processTemplate(
      '{{#if enabled}}Feature is enabled{{else}}Feature is disabled{{/if}}',
      { enabled: true }
    );
    console.log('Result:', result2);
    console.log(chalk.green('✓ Passed\n'));
    
    // Test 3: Loops
    console.log(chalk.yellow('Test 3: Loops'));
    const result3 = await templateEngine.processTemplate(
      'Items: {{#each items}}- {{this}}\n{{/each}}',
      { items: ['Apple', 'Banana', 'Orange'] }
    );
    console.log('Result:\n' + result3);
    console.log(chalk.green('✓ Passed\n'));
    
    // Test 4: Helper functions
    console.log(chalk.yellow('Test 4: Helper functions'));
    const result4 = await templateEngine.processTemplate(
      'Equal: {{eq type "api"}}, Uppercase: {{uppercase name}}',
      { type: 'api', name: 'test' }
    );
    console.log('Result:', result4);
    console.log(chalk.green('✓ Passed\n'));
    
    // Test 5: List available templates
    console.log(chalk.yellow('Test 5: Available templates'));
    const templates = await templateEngine.getAvailableTemplates();
    console.log(`Found ${Object.keys(templates).length} templates`);
    console.log(chalk.green('✓ Passed\n'));
    
    return true;
  } catch (error) {
    console.error(chalk.red('✗ Failed:'), error.message);
    return false;
  }
}

async function testFileGeneration() {
  console.log(chalk.blue('\n🧪 Testing File Generation...\n'));
  
  try {
    const testDir = path.join(__dirname, '../.tmp-test');
    
    // Test generating a simple file
    console.log(chalk.yellow('Test: Generate test file'));
    
    // Create a test template
    const testTemplate = `# {{title}}

This is a test file for {{project}}.

{{#if features}}
Features:
{{#each features}}
- {{this}}
{{/each}}
{{/if}}`;

    // Process and generate
    const content = await templateEngine.processTemplate(testTemplate, {
      title: 'Test Project',
      project: 'Template System',
      features: ['Fast', 'Reliable', 'Easy to use']
    });
    
    console.log('Generated content:');
    console.log(chalk.gray(content));
    console.log(chalk.green('✓ Passed\n'));
    
    return true;
  } catch (error) {
    console.error(chalk.red('✗ Failed:'), error.message);
    return false;
  }
}

async function main() {
  console.log(chalk.cyan('\n═══════════════════════════════════════'));
  console.log(chalk.cyan('  Template System Test Suite'));
  console.log(chalk.cyan('═══════════════════════════════════════'));
  
  const results = {
    templateEngine: await testTemplateEngine(),
    fileGeneration: await testFileGeneration()
  };
  
  // Summary
  console.log(chalk.blue('\n📊 Test Summary:\n'));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([name, passed]) => {
    console.log(`  ${passed ? chalk.green('✓') : chalk.red('✗')} ${name}`);
  });
  
  console.log(`\nTotal: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log(chalk.green('\n✅ All tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n❌ Some tests failed!'));
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error(chalk.red('\n💥 Test suite failed:'), error);
  process.exit(1);
});