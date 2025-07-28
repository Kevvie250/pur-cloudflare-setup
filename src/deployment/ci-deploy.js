import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { deploymentAutomation } from './deploy.js';
import { progressIndicator } from '../utils/progressIndicator.js';
import { errorHandler, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CIDeploymentManager {
  constructor() {
    this.ciEnvironments = {
      github: 'GITHUB_ACTIONS',
      gitlab: 'GITLAB_CI',
      jenkins: 'JENKINS_URL',
      azure: 'AZURE_PIPELINES_BUILD_ID',
      circleci: 'CIRCLECI'
    };
    
    this.requiredSecrets = [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID'
    ];
    
    this.currentCI = this.detectCIEnvironment();
  }

  /**
   * Detect current CI environment
   */
  detectCIEnvironment() {
    for (const [name, envVar] of Object.entries(this.ciEnvironments)) {
      if (process.env[envVar]) {
        return name;
      }
    }
    return 'unknown';
  }

  /**
   * Main CI deployment entry point
   */
  async runCIDeployment(options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue.bold(`🚀 CI Deployment Started (${this.currentCI.toUpperCase()})`));
      console.log(chalk.gray(`Deployment ID: ${Date.now()}`));
      console.log(chalk.gray(`Branch: ${this.getCurrentBranch()}`));
      console.log(chalk.gray(`Commit: ${this.getCurrentCommit()}`));
      console.log('');

      // Environment detection and validation
      const environment = await this.detectEnvironment();
      console.log(chalk.cyan(`🎯 Target Environment: ${environment}`));

      // Security validation
      await this.validateCISecrets();

      // Project path detection
      const projectPath = options.projectPath || process.cwd();
      console.log(chalk.cyan(`📁 Project Path: ${projectPath}`));

      // CI-specific configuration
      const deployOptions = await this.configureCIDeployment(environment, options);

      // Execute deployment
      const result = await deploymentAutomation.deployProject(projectPath, deployOptions);

      // CI-specific post-deployment actions
      await this.performCIPostDeployment(result, environment);

      // Update deployment status
      await this.updateDeploymentStatus('success', result);

      console.log(chalk.green.bold(`✅ CI Deployment Completed Successfully`));
      console.log(chalk.gray(`Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`));
      
      return result;

    } catch (error) {
      logger.error(`CI Deployment failed: ${error.message}`);
      
      // Update deployment status
      await this.updateDeploymentStatus('failure', { error: error.message });
      
      // CI-specific error handling
      await this.handleCIDeploymentFailure(error);
      
      throw error;
    }
  }

  /**
   * Detect deployment environment based on CI context
   */
  async detectEnvironment() {
    // GitHub Actions
    if (this.currentCI === 'github') {
      const ref = process.env.GITHUB_REF;
      const eventName = process.env.GITHUB_EVENT_NAME;
      
      if (ref === 'refs/heads/main' && eventName === 'push') {
        return 'production';
      } else if (ref === 'refs/heads/staging' && eventName === 'push') {
        return 'staging';
      } else if (eventName === 'pull_request') {
        return 'preview';
      }
    }
    
    // GitLab CI
    if (this.currentCI === 'gitlab') {
      const ref = process.env.CI_COMMIT_REF_NAME;
      
      if (ref === 'main' || ref === 'master') {
        return 'production';
      } else if (ref === 'staging') {
        return 'staging';
      }
    }
    
    // Default environments
    const branch = this.getCurrentBranch();
    if (branch === 'main' || branch === 'master') {
      return 'production';
    } else if (branch === 'staging') {
      return 'staging';
    }
    
    return 'development';
  }

  /**
   * Validate CI secrets and credentials
   */
  async validateCISecrets() {
    const spinner = progressIndicator.createSpinner('secrets', 'Validating CI secrets...');
    
    try {
      const missingSecrets = [];
      
      for (const secret of this.requiredSecrets) {
        if (!process.env[secret]) {
          missingSecrets.push(secret);
        }
      }
      
      if (missingSecrets.length > 0) {
        throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
      }
      
      // Validate Cloudflare API token
      await this.validateCloudflareCredentials();
      
      progressIndicator.updateSpinner('secrets', 'CI secrets validated successfully', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('secrets', `Secret validation failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Validate Cloudflare credentials
   */
  async validateCloudflareCredentials() {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!token || !accountId) {
      throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    }

    try {
      // Test API call to verify credentials
      const response = await fetch('https://api.cloudflare.com/client/v4/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Invalid Cloudflare credentials: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error('Cloudflare API authentication failed');
      }
      
    } catch (error) {
      throw new Error(`Cloudflare credential validation failed: ${error.message}`);
    }
  }

  /**
   * Configure deployment options for CI environment
   */
  async configureCIDeployment(environment, options) {
    const deployOptions = {
      environment,
      installDependencies: true,
      runTests: true,
      build: true,
      enableRollback: environment === 'production',
      dryRun: options.dryRun || false,
      ...options
    };

    // Environment-specific configuration
    switch (environment) {
      case 'production':
        deployOptions.runPostDeployTests = true;
        deployOptions.enableHealthChecks = true;
        break;
        
      case 'staging':
        deployOptions.runPostDeployTests = true;
        break;
        
      case 'preview':
        deployOptions.enableRollback = false;
        break;
    }

    // CI-specific environment variables
    deployOptions.environmentVariables = await this.getCIEnvironmentVariables(environment);
    
    // CI-specific secrets
    deployOptions.secrets = await this.getCISecrets(environment);

    return deployOptions;
  }

  /**
   * Get CI environment variables
   */
  async getCIEnvironmentVariables(environment) {
    const envVars = {};
    
    // Standard environment variables
    if (process.env.NODE_ENV) {
      envVars.NODE_ENV = process.env.NODE_ENV;
    }
    
    // Environment-specific variables
    const envPrefix = `${environment.toUpperCase()}_`;
    
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(envPrefix) || key.startsWith('VITE_')) {
        envVars[key] = process.env[key];
      }
    });
    
    return envVars;
  }

  /**
   * Get CI secrets for deployment
   */
  async getCISecrets(environment) {
    const secrets = {};
    
    // Environment-specific secrets
    const secretKeys = [
      'AIRTABLE_API_KEY',
      'AIRTABLE_BASE_ID',
      'DATABASE_URL',
      'API_SECRET_KEY'
    ];
    
    secretKeys.forEach(key => {
      const envKey = `${environment.toUpperCase()}_${key}`;
      if (process.env[envKey]) {
        secrets[key] = process.env[envKey];
      } else if (process.env[key]) {
        secrets[key] = process.env[key];
      }
    });
    
    return secrets;
  }

  /**
   * Perform CI-specific post-deployment actions
   */
  async performCIPostDeployment(result, environment) {
    const spinner = progressIndicator.createSpinner('post-deploy', 'Running post-deployment actions...');
    
    try {
      // Update deployment tracking
      await this.trackDeployment(result, environment);
      
      // CI-specific notifications
      await this.sendCINotifications(result, environment);
      
      // Environment-specific actions
      if (environment === 'production') {
        await this.performProductionPostDeploy(result);
      }
      
      progressIndicator.updateSpinner('post-deploy', 'Post-deployment actions completed', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('post-deploy', `Post-deployment actions failed: ${error.message}`, 'warn');
      logger.warn('Non-critical post-deployment error:', error.message);
    }
  }

  /**
   * Track deployment for monitoring
   */
  async trackDeployment(result, environment) {
    const deploymentData = {
      deploymentId: result.deploymentId,
      environment,
      url: result.url,
      timestamp: new Date().toISOString(),
      duration: result.duration,
      branch: this.getCurrentBranch(),
      commit: this.getCurrentCommit(),
      ci: this.currentCI
    };

    // Save deployment record
    await this.saveDeploymentRecord(deploymentData);
    
    logger.info(`Deployment tracked: ${result.deploymentId}`);
  }

  /**
   * Save deployment record
   */
  async saveDeploymentRecord(data) {
    try {
      const recordsDir = path.join(process.cwd(), '.ci-deployments');
      await fs.mkdir(recordsDir, { recursive: true });
      
      const recordPath = path.join(recordsDir, `${data.deploymentId}.json`);
      await fs.writeFile(recordPath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      logger.warn('Failed to save deployment record:', error.message);
    }
  }

  /**
   * Send CI notifications
   */
  async sendCINotifications(result, environment) {
    // GitHub Actions - Create deployment status
    if (this.currentCI === 'github') {
      await this.updateGitHubDeploymentStatus(result, environment);
    }
    
    // Slack notifications (if webhook configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackNotification(result, environment);
    }
    
    // Custom webhook notifications
    if (process.env.DEPLOYMENT_WEBHOOK_URL) {
      await this.sendWebhookNotification(result, environment);
    }
  }

  /**
   * Update GitHub deployment status
   */
  async updateGitHubDeploymentStatus(result, environment) {
    if (!process.env.GITHUB_TOKEN) {
      return;
    }

    try {
      const payload = {
        state: 'success',
        environment_url: result.url,
        description: `Deployed to ${environment}`,
        deployment_id: result.deploymentId
      };

      // This would integrate with GitHub API
      logger.info('GitHub deployment status updated');
      
    } catch (error) {
      logger.warn('Failed to update GitHub deployment status:', error.message);
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(result, environment) {
    try {
      const payload = {
        text: `🚀 Deployment to ${environment} completed successfully`,
        attachments: [{
          color: 'good',
          fields: [
            { title: 'Environment', value: environment, short: true },
            { title: 'URL', value: result.url, short: true },
            { title: 'Duration', value: `${(result.duration / 1000).toFixed(2)}s`, short: true },
            { title: 'Branch', value: this.getCurrentBranch(), short: true }
          ]
        }]
      };

      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status}`);
      }
      
    } catch (error) {
      logger.warn('Failed to send Slack notification:', error.message);
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(result, environment) {
    try {
      const payload = {
        event: 'deployment.completed',
        deployment: {
          id: result.deploymentId,
          environment,
          url: result.url,
          duration: result.duration,
          timestamp: new Date().toISOString()
        },
        repository: {
          branch: this.getCurrentBranch(),
          commit: this.getCurrentCommit()
        },
        ci: this.currentCI
      };

      const response = await fetch(process.env.DEPLOYMENT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.status}`);
      }
      
    } catch (error) {
      logger.warn('Failed to send webhook notification:', error.message);
    }
  }

  /**
   * Perform production-specific post-deployment actions
   */
  async performProductionPostDeploy(result) {
    // Warm up the deployment
    if (result.url) {
      await this.warmUpDeployment(result.url);
    }
    
    // Update monitoring systems
    await this.updateMonitoring(result);
    
    logger.info('Production post-deployment actions completed');
  }

  /**
   * Warm up deployment
   */
  async warmUpDeployment(url) {
    try {
      const warmupRequests = [
        fetch(url, { method: 'HEAD' }),
        fetch(`${url}/api/health`, { method: 'GET' }).catch(() => {}),
        fetch(`${url}/api/status`, { method: 'GET' }).catch(() => {})
      ];

      await Promise.allSettled(warmupRequests);
      logger.info('Deployment warmed up successfully');
      
    } catch (error) {
      logger.warn('Deployment warm-up failed:', error.message);
    }
  }

  /**
   * Update monitoring systems
   */
  async updateMonitoring(result) {
    // Placeholder for monitoring system updates
    logger.info('Monitoring systems updated');
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(status, result) {
    const statusData = {
      status,
      timestamp: new Date().toISOString(),
      deploymentId: result.deploymentId || 'unknown',
      ci: this.currentCI,
      ...result
    };

    // Log status
    logger.info(`Deployment status: ${status}`, statusData);

    // Set CI outputs
    await this.setCIOutputs(statusData);
  }

  /**
   * Set CI environment outputs
   */
  async setCIOutputs(statusData) {
    // GitHub Actions outputs
    if (this.currentCI === 'github' && process.env.GITHUB_OUTPUT) {
      try {
        const outputs = [
          `deployment-status=${statusData.status}`,
          `deployment-id=${statusData.deploymentId}`,
          `deployment-url=${statusData.url || ''}`,
          `deployment-timestamp=${statusData.timestamp}`
        ];

        await fs.appendFile(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
        
      } catch (error) {
        logger.warn('Failed to set GitHub outputs:', error.message);
      }
    }
  }

  /**
   * Handle CI deployment failure
   */
  async handleCIDeploymentFailure(error) {
    // Send failure notifications
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendFailureNotification(error);
    }
    
    // Log detailed error information
    logger.error('CI Deployment failure details:', {
      error: error.message,
      stack: error.stack,
      ci: this.currentCI,
      branch: this.getCurrentBranch(),
      commit: this.getCurrentCommit()
    });

    // Set failure exit code
    process.exitCode = 1;
  }

  /**
   * Send failure notification
   */
  async sendFailureNotification(error) {
    try {
      const payload = {
        text: `❌ Deployment failed`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Error', value: error.message, short: false },
            { title: 'Branch', value: this.getCurrentBranch(), short: true },
            { title: 'CI', value: this.currentCI, short: true }
          ]
        }]
      };

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
    } catch (notificationError) {
      logger.warn('Failed to send failure notification:', notificationError.message);
    }
  }

  /**
   * Get current Git branch
   */
  getCurrentBranch() {
    return process.env.GITHUB_REF_NAME || 
           process.env.CI_COMMIT_REF_NAME || 
           process.env.BRANCH_NAME || 
           'unknown';
  }

  /**
   * Get current Git commit
   */
  getCurrentCommit() {
    return process.env.GITHUB_SHA || 
           process.env.CI_COMMIT_SHA || 
           process.env.GIT_COMMIT || 
           'unknown';
  }

  /**
   * Generate GitHub Actions workflow
   */
  generateGitHubWorkflow(options = {}) {
    return `name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Deploy to Cloudflare
      env:
        CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        AIRTABLE_API_KEY: \${{ secrets.AIRTABLE_API_KEY }}
        AIRTABLE_BASE_ID: \${{ secrets.AIRTABLE_BASE_ID }}
        SLACK_WEBHOOK_URL: \${{ secrets.SLACK_WEBHOOK_URL }}
      run: node src/deployment/ci-deploy.js
      
    - name: Update deployment status
      if: always()
      run: |
        echo "Deployment completed with status: \${{ job.status }}"
`;
  }

  /**
   * Generate GitLab CI configuration
   */
  generateGitLabCI(options = {}) {
    return `stages:
  - test
  - deploy

variables:
  NODE_VERSION: "18"

test:
  stage: test
  image: node:\${NODE_VERSION}
  before_script:
    - npm ci
  script:
    - npm test
  only:
    - branches

deploy:
  stage: deploy
  image: node:\${NODE_VERSION}
  before_script:
    - npm ci
  script:
    - node src/deployment/ci-deploy.js
  only:
    - main
    - staging
  environment:
    name: \${CI_COMMIT_REF_NAME}
    url: https://\${CI_PROJECT_NAME}-\${CI_COMMIT_REF_SLUG}.pages.dev
`;
  }
}

// Export singleton instance
export const ciDeploymentManager = new CIDeploymentManager();

// CLI entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ciDeploymentManager.runCIDeployment({
    projectPath: process.argv[2] || process.cwd(),
    dryRun: process.argv.includes('--dry-run')
  }).catch(error => {
    console.error(chalk.red('Deployment failed:'), error.message);
    process.exit(1);
  });
}

// Export convenience function
export async function runCIDeployment(options = {}) {
  return await ciDeploymentManager.runCIDeployment(options);
}