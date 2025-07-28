#!/usr/bin/env node

/**
 * Example usage of the PurAir Cloudflare Deployment Automation Suite
 * 
 * This file demonstrates various deployment scenarios and how to use
 * the deployment automation tools.
 */

import chalk from 'chalk';
import { 
  deployProject, 
  runCIDeployment, 
  verifyDeployment,
  deployAndVerify,
  generateDeploymentFiles,
  healthCheck
} from './index.js';

async function demonstrateDeploymentScenarios() {
  console.log(chalk.blue.bold('🚀 PurAir Cloudflare Deployment Automation Examples\n'));

  // Example 1: Basic deployment
  console.log(chalk.yellow.bold('1. Basic Project Deployment'));
  console.log(chalk.gray('Deploy a project with standard options\n'));
  
  try {
    console.log(chalk.cyan('Example command:'));
    console.log(chalk.gray('const result = await deployProject("/path/to/project", {\n' +
                          '  environment: "staging",\n' +
                          '  runTests: true,\n' +
                          '  enableRollback: true\n' +
                          '});\n'));

    // Uncomment to actually run:
    // const basicResult = await deployProject(process.cwd(), {
    //   environment: 'staging',
    //   dryRun: true, // Safe to run as example
    //   runTests: false // Skip tests for demo
    // });
    // console.log('Result:', basicResult);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }

  // Example 2: CI Deployment
  console.log(chalk.yellow.bold('2. CI/CD Deployment'));
  console.log(chalk.gray('Automated deployment in CI environment\n'));
  
  try {
    console.log(chalk.cyan('Example CI usage:'));
    console.log(chalk.gray('# Environment variables should be set:\n' +
                          '# CLOUDFLARE_API_TOKEN=your_token\n' +
                          '# CLOUDFLARE_ACCOUNT_ID=your_account_id\n' +
                          '# NODE_ENV=production\n\n' +
                          'const ciResult = await runCIDeployment({\n' +
                          '  projectPath: process.cwd(),\n' +
                          '  dryRun: false\n' +
                          '});\n'));

    // Uncomment to actually run in CI:
    // if (process.env.CI === 'true') {
    //   const ciResult = await runCIDeployment({
    //     projectPath: process.cwd(),
    //     dryRun: true
    //   });
    //   console.log('CI Result:', ciResult);
    // } else {
    //   console.log(chalk.yellow('Skipping CI deployment (not in CI environment)'));
    // }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }

  // Example 3: Deployment Verification
  console.log(chalk.yellow.bold('3. Deployment Verification'));
  console.log(chalk.gray('Verify a deployed application\n'));
  
  try {
    console.log(chalk.cyan('Example verification:'));
    console.log(chalk.gray('const verifyResult = await verifyDeployment("https://your-app.pages.dev", {\n' +
                          '  responseTimeThreshold: 2000,\n' +
                          '  runSecurityChecks: true,\n' +
                          '  apiTests: [\n' +
                          '    {\n' +
                          '      name: "Custom API Test",\n' +
                          '      url: "https://your-app.pages.dev/api/test",\n' +
                          '      method: "GET",\n' +
                          '      expectedStatus: [200]\n' +
                          '    }\n' +
                          '  ]\n' +
                          '});\n'));

    // Example with a real URL (replace with actual deployment)
    const exampleUrl = 'https://example.com';
    console.log(chalk.cyan(`Running quick health check on ${exampleUrl}...`));
    
    const healthResult = await healthCheck(exampleUrl);
    console.log(chalk.green('Health check result:'), healthResult);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }

  // Example 4: Combined Deploy and Verify
  console.log(chalk.yellow.bold('4. Deploy and Verify Workflow'));
  console.log(chalk.gray('Deploy a project and automatically verify it\n'));
  
  try {
    console.log(chalk.cyan('Example combined workflow:'));
    console.log(chalk.gray('const result = await deployAndVerify("/path/to/project", {\n' +
                          '  environment: "production",\n' +
                          '  runTests: true,\n' +
                          '  enableRollback: true,\n' +
                          '  responseTimeThreshold: 1500,\n' +
                          '  stopOnVerificationFailure: false\n' +
                          '});\n'));

    // Uncomment to actually run:
    // const combinedResult = await deployAndVerify(process.cwd(), {
    //   environment: 'staging',
    //   dryRun: true,
    //   runTests: false
    // });
    // console.log('Combined Result:', combinedResult);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }

  // Example 5: Generate Deployment Files
  console.log(chalk.yellow.bold('5. Generate Deployment Automation Files'));
  console.log(chalk.gray('Generate all necessary deployment scripts and configurations\n'));
  
  try {
    console.log(chalk.cyan('Example file generation:'));
    console.log(chalk.gray('const generated = await generateDeploymentFiles("/path/to/project", {\n' +
                          '  projectName: "my-purair-app",\n' +
                          '  environment: "production"\n' +
                          '});\n'));

    // Uncomment to actually generate files:
    // const generatedFiles = await generateDeploymentFiles(process.cwd(), {
    //   projectName: 'example-purair-app',
    //   environment: 'production'
    // });
    // console.log('Generated Files:', generatedFiles);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }

  console.log(chalk.green.bold('\n✅ All examples completed!\n'));
}

// Configuration Examples
function showConfigurationExamples() {
  console.log(chalk.blue.bold('📋 Configuration Examples\n'));

  console.log(chalk.yellow.bold('Environment Variables for CI:'));
  console.log(chalk.gray(`
# Required
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Optional
NODE_ENV=production
ENVIRONMENT=production
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DEPLOYMENT_WEBHOOK_URL=https://your-webhook-endpoint.com/deploy

# Project-specific secrets
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=your_base_id
DATABASE_URL=your_database_url
`));

  console.log(chalk.yellow.bold('Package.json Scripts:'));
  console.log(chalk.gray(`
{
  "scripts": {
    "deploy": "node src/deployment/deploy.js",
    "deploy:ci": "node src/deployment/ci-deploy.js",
    "deploy:staging": "ENVIRONMENT=staging npm run deploy",
    "deploy:production": "ENVIRONMENT=production npm run deploy",
    "verify": "node src/deployment/verify-deployment.js",
    "deploy:verify": "npm run deploy && npm run verify:last"
  }
}
`));

  console.log(chalk.yellow.bold('GitHub Actions Secrets:'));
  console.log(chalk.gray(`
Required secrets in your GitHub repository:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- AIRTABLE_API_KEY (if using Airtable)
- AIRTABLE_BASE_ID (if using Airtable)
- SLACK_WEBHOOK_URL (optional, for notifications)
`));

  console.log(chalk.yellow.bold('Wrangler.toml Example:'));
  console.log(chalk.gray(`
name = "purair-app"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
name = "purair-app-production"
vars = { ENVIRONMENT = "production" }

[env.staging]  
name = "purair-app-staging"
vars = { ENVIRONMENT = "staging" }
`));
}

// Performance Tips
function showPerformanceTips() {
  console.log(chalk.blue.bold('⚡ Performance Tips\n'));

  console.log(chalk.yellow.bold('Deployment Optimization:'));
  console.log(chalk.gray(`
1. Use npm ci instead of npm install in CI
2. Enable caching for node_modules in CI
3. Run tests in parallel when possible
4. Use --dry-run flag for testing deployment scripts
5. Set appropriate timeouts for network requests
6. Enable rollback only for production deployments
`));

  console.log(chalk.yellow.bold('Verification Optimization:'));
  console.log(chalk.gray(`
1. Set reasonable response time thresholds
2. Use concurrent request testing sparingly
3. Skip optional security headers in development
4. Cache DNS resolution results when possible
5. Use HEAD requests for basic connectivity tests
6. Set appropriate timeouts for health checks
`));
}

// Error Handling Examples
function showErrorHandlingExamples() {
  console.log(chalk.blue.bold('🚨 Error Handling Examples\n'));

  console.log(chalk.yellow.bold('Common Error Scenarios:'));
  console.log(chalk.gray(`
1. Authentication Failures:
   - Invalid Cloudflare API token
   - Missing environment variables
   - Expired credentials

2. Network Issues:
   - Request timeouts
   - DNS resolution failures
   - SSL certificate problems

3. Configuration Errors:
   - Invalid wrangler.toml
   - Missing required files
   - Incorrect project structure

4. Deployment Failures:
   - Build process errors
   - Test failures
   - Quota exceeded
`));

  console.log(chalk.yellow.bold('Error Recovery:'));
  console.log(chalk.gray(`
try {
  const result = await deployProject(projectPath, options);
  console.log('Deployment successful:', result);
} catch (error) {
  console.error('Deployment failed:', error.message);
  
  // Check if rollback is available
  if (error.rollbackAvailable) {
    console.log('Attempting rollback...');
    // Rollback logic is handled automatically if enabled
  }
  
  // Log error details for debugging
  console.error('Error details:', error.details);
  
  // Send notifications
  if (process.env.SLACK_WEBHOOK_URL) {
    // Notification sending is handled automatically
  }
}
`));
}

// CLI Interface
async function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'examples':
      await demonstrateDeploymentScenarios();
      break;
    case 'config':
      showConfigurationExamples();
      break;
    case 'performance':
      showPerformanceTips();
      break;
    case 'errors':
      showErrorHandlingExamples();
      break;
    case 'health':
      if (args[1]) {
        const result = await healthCheck(args[1]);
        console.log(chalk.green('Health Check Result:'), result);
      } else {
        console.error(chalk.red('Usage: node example-usage.js health <url>'));
      }
      break;
    default:
      console.log(chalk.blue.bold('PurAir Cloudflare Deployment Automation Examples\n'));
      console.log(chalk.cyan('Available commands:'));
      console.log(chalk.gray('  examples    - Show deployment examples'));
      console.log(chalk.gray('  config      - Show configuration examples'));
      console.log(chalk.gray('  performance - Show performance tips'));
      console.log(chalk.gray('  errors      - Show error handling examples'));
      console.log(chalk.gray('  health <url> - Run quick health check'));
      console.log('');
      console.log(chalk.yellow('Usage: node example-usage.js <command>'));
      break;
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(error => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  });
}

export {
  demonstrateDeploymentScenarios,
  showConfigurationExamples,
  showPerformanceTips,
  showErrorHandlingExamples
};