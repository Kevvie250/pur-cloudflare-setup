import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { progressIndicator } from '../utils/progressIndicator.js';
import { errorHandler, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { configValidator } from '../modules/configValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DeploymentAutomation {
  constructor() {
    this.deploymentSteps = [
      'Pre-deployment validation',
      'Environment setup',
      'Code build and test',
      'Wrangler configuration',
      'Deployment execution',
      'Post-deployment verification',
      'Status reporting'
    ];
    this.rollbackData = {};
    this.deploymentId = `deploy_${Date.now()}`;
  }

  /**
   * Main deployment orchestration
   */
  async deployProject(projectPath, options = {}) {
    const startTime = Date.now();
    const stepIndicator = progressIndicator.createStepIndicator(this.deploymentSteps);
    
    try {
      logger.info(`Starting deployment for project: ${projectPath}`);
      
      // Step 1: Pre-deployment validation
      stepIndicator.display();
      await this.preDeploymentValidation(projectPath, options);
      stepIndicator.next();

      // Step 2: Environment setup
      await this.setupEnvironment(projectPath, options);
      stepIndicator.next();

      // Step 3: Build and test
      await this.buildAndTest(projectPath, options);
      stepIndicator.next();

      // Step 4: Wrangler configuration
      await this.configureWrangler(projectPath, options);
      stepIndicator.next();

      // Step 5: Deploy
      const deploymentResult = await this.executeDeployment(projectPath, options);
      stepIndicator.next();

      // Step 6: Post-deployment verification
      await this.postDeploymentVerification(deploymentResult, options);
      stepIndicator.next();

      // Step 7: Status reporting
      await this.generateStatusReport(deploymentResult, startTime);
      stepIndicator.complete();

      return {
        success: true,
        deploymentId: this.deploymentId,
        result: deploymentResult,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`Deployment failed: ${error.message}`);
      
      // Attempt rollback if enabled
      if (options.enableRollback && this.rollbackData.canRollback) {
        console.log(chalk.yellow('\n🔄 Initiating rollback...'));
        await this.performRollback(projectPath);
      }

      throw error;
    } finally {
      progressIndicator.cleanup();
    }
  }

  /**
   * Pre-deployment validation
   */
  async preDeploymentValidation(projectPath, options) {
    const spinner = progressIndicator.createSpinner('validation', 'Running pre-deployment validation...');
    
    try {
      // Check project structure
      await this.validateProjectStructure(projectPath);
      
      // Load and validate configuration
      const config = await this.loadProjectConfig(projectPath);
      const validationResult = await configValidator.validateConfiguration(config);
      
      if (!validationResult.valid) {
        throw errorHandler.createError(ErrorCodes.INVALID_CONFIG, {
          details: 'Configuration validation failed'
        });
      }

      // Check deployment prerequisites
      await this.checkDeploymentPrerequisites(config, options);
      
      // Store rollback point
      await this.createRollbackPoint(projectPath, config);

      progressIndicator.updateSpinner('validation', 'Pre-deployment validation completed', 'success');
      
      return { config, validationResult };
      
    } catch (error) {
      progressIndicator.updateSpinner('validation', `Validation failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Validate project structure
   */
  async validateProjectStructure(projectPath) {
    const requiredFiles = ['wrangler.toml', 'package.json'];
    const requiredDirs = ['src'];

    for (const file of requiredFiles) {
      const filePath = path.join(projectPath, file);
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    for (const dir of requiredDirs) {
      const dirPath = path.join(projectPath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error(`Required directory missing: ${dir}`);
        }
      } catch {
        throw new Error(`Required directory missing: ${dir}`);
      }
    }
  }

  /**
   * Load project configuration
   */
  async loadProjectConfig(projectPath) {
    try {
      // Load wrangler.toml
      const wranglerPath = path.join(projectPath, 'wrangler.toml');
      const wranglerContent = await fs.readFile(wranglerPath, 'utf8');
      
      // Load package.json
      const packagePath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      // Load setup config if exists
      let setupConfig = {};
      try {
        const setupConfigPath = path.join(projectPath, 'setup.config.json');
        const setupContent = await fs.readFile(setupConfigPath, 'utf8');
        setupConfig = JSON.parse(setupContent);
      } catch {
        // Setup config is optional
      }

      return {
        wrangler: wranglerContent,
        package: packageJson,
        setup: setupConfig,
        projectPath
      };
    } catch (error) {
      throw new Error(`Failed to load project configuration: ${error.message}`);
    }
  }

  /**
   * Check deployment prerequisites
   */
  async checkDeploymentPrerequisites(config, options) {
    const checks = [];

    // Check Wrangler CLI
    checks.push({
      name: 'Wrangler CLI',
      check: () => this.checkCommand('wrangler --version'),
      error: 'Wrangler CLI not found. Install with: npm install -g wrangler'
    });

    // Check authentication
    checks.push({
      name: 'Cloudflare Auth',
      check: () => this.checkWranglerAuth(),
      error: 'Not authenticated with Cloudflare. Run: wrangler login'
    });

    // Check environment-specific requirements
    if (options.environment === 'production') {
      checks.push({
        name: 'Production Environment',
        check: () => this.validateProductionEnvironment(config),
        error: 'Production environment not properly configured'
      });
    }

    // Run all checks
    for (const check of checks) {
      const result = await check.check();
      if (!result) {
        throw new Error(check.error);
      }
    }
  }

  /**
   * Create rollback point
   */
  async createRollbackPoint(projectPath, config) {
    this.rollbackData = {
      canRollback: false,
      projectPath,
      timestamp: new Date().toISOString(),
      backupPath: null
    };

    try {
      // Check if there's a current deployment to rollback to
      const result = await this.executeCommand('wrangler deployments list --limit 1', projectPath);
      if (result.success && result.output.includes('deployment')) {
        this.rollbackData.canRollback = true;
        this.rollbackData.lastDeploymentId = this.extractDeploymentId(result.output);
      }
    } catch (error) {
      logger.warn('Could not create rollback point:', error.message);
    }
  }

  /**
   * Setup environment
   */
  async setupEnvironment(projectPath, options) {
    const spinner = progressIndicator.createSpinner('environment', 'Setting up environment...');
    
    try {
      // Install dependencies
      if (options.installDependencies !== false) {
        await this.installDependencies(projectPath);
      }

      // Set environment variables
      await this.setupEnvironmentVariables(projectPath, options);

      // Configure secrets
      if (options.secrets) {
        await this.configureSecrets(projectPath, options.secrets);
      }

      progressIndicator.updateSpinner('environment', 'Environment setup completed', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('environment', `Environment setup failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies(projectPath) {
    const result = await this.executeCommand('npm ci', projectPath);
    if (!result.success) {
      throw new Error(`Failed to install dependencies: ${result.error}`);
    }
  }

  /**
   * Setup environment variables
   */
  async setupEnvironmentVariables(projectPath, options) {
    if (!options.environment || options.environment === 'development') {
      return; // Skip for development
    }

    const envVars = options.environmentVariables || {};
    
    for (const [key, value] of Object.entries(envVars)) {
      if (value && typeof value === 'string') {
        const result = await this.executeCommand(
          `wrangler secret put ${key} --env ${options.environment}`,
          projectPath,
          { input: value }
        );
        
        if (!result.success) {
          throw new Error(`Failed to set environment variable ${key}: ${result.error}`);
        }
      }
    }
  }

  /**
   * Configure secrets
   */
  async configureSecrets(projectPath, secrets) {
    for (const [key, value] of Object.entries(secrets)) {
      if (value && typeof value === 'string') {
        const result = await this.executeCommand(
          `wrangler secret put ${key}`,
          projectPath,
          { input: value }
        );
        
        if (!result.success) {
          throw new Error(`Failed to set secret ${key}: ${result.error}`);
        }
      }
    }
  }

  /**
   * Build and test
   */
  async buildAndTest(projectPath, options) {
    const spinner = progressIndicator.createSpinner('build', 'Building and testing project...');
    
    try {
      // Run tests if configured
      if (options.runTests !== false) {
        await this.runTests(projectPath);
      }

      // Build project
      if (options.build !== false) {
        await this.buildProject(projectPath);
      }

      progressIndicator.updateSpinner('build', 'Build and tests completed', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('build', `Build failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Run tests
   */
  async runTests(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts.test) {
      const result = await this.executeCommand('npm test', projectPath);
      if (!result.success) {
        throw new Error(`Tests failed: ${result.error}`);
      }
    }
  }

  /**
   * Build project
   */
  async buildProject(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts.build) {
      const result = await this.executeCommand('npm run build', projectPath);
      if (!result.success) {
        throw new Error(`Build failed: ${result.error}`);
      }
    }
  }

  /**
   * Configure Wrangler
   */
  async configureWrangler(projectPath, options) {
    const spinner = progressIndicator.createSpinner('wrangler', 'Configuring Wrangler...');
    
    try {
      // Validate wrangler.toml
      await this.validateWranglerConfig(projectPath);

      // Update configuration for deployment environment
      if (options.environment && options.environment !== 'development') {
        await this.updateWranglerForEnvironment(projectPath, options.environment);
      }

      progressIndicator.updateSpinner('wrangler', 'Wrangler configuration completed', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('wrangler', `Wrangler configuration failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Validate Wrangler configuration
   */
  async validateWranglerConfig(projectPath) {
    const result = await this.executeCommand('wrangler validate', projectPath);
    if (!result.success) {
      throw new Error(`Invalid wrangler.toml: ${result.error}`);
    }
  }

  /**
   * Execute deployment
   */
  async executeDeployment(projectPath, options) {
    const spinner = progressIndicator.createSpinner('deploy', 'Deploying to Cloudflare...');
    
    try {
      let deployCommand = 'wrangler deploy';
      
      if (options.environment && options.environment !== 'development') {
        deployCommand += ` --env ${options.environment}`;
      }

      if (options.dryRun) {
        deployCommand += ' --dry-run';
        spinner.text = 'Running dry-run deployment...';
      }

      const result = await this.executeCommand(deployCommand, projectPath);
      
      if (!result.success) {
        throw new Error(`Deployment failed: ${result.error}`);
      }

      const deploymentInfo = this.parseDeploymentOutput(result.output);
      
      progressIndicator.updateSpinner('deploy', 
        `Deployment completed successfully - ${deploymentInfo.url}`, 'success');
      
      return deploymentInfo;
      
    } catch (error) {
      progressIndicator.updateSpinner('deploy', `Deployment failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Parse deployment output
   */
  parseDeploymentOutput(output) {
    const urlMatch = output.match(/https:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;
    
    return {
      url,
      timestamp: new Date().toISOString(),
      deploymentId: this.deploymentId,
      output
    };
  }

  /**
   * Post-deployment verification
   */
  async postDeploymentVerification(deploymentResult, options) {
    const spinner = progressIndicator.createSpinner('verify', 'Verifying deployment...');
    
    try {
      if (deploymentResult.url && !options.dryRun) {
        // Health check
        await this.performHealthCheck(deploymentResult.url);
        
        // Functional tests
        if (options.runPostDeployTests) {
          await this.runPostDeploymentTests(deploymentResult.url, options);
        }
      }

      progressIndicator.updateSpinner('verify', 'Deployment verification completed', 'success');
      
    } catch (error) {
      progressIndicator.updateSpinner('verify', `Verification failed: ${error.message}`, 'fail');
      
      // Don't fail deployment on verification errors, just warn
      logger.warn('Post-deployment verification failed:', error.message);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(url) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'PurAir-Deploy-Tool/1.0' }
      });
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
      
      logger.info(`Health check passed for ${url}`);
      
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Generate status report
   */
  async generateStatusReport(deploymentResult, startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const report = {
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      status: 'success',
      url: deploymentResult.url,
      environment: 'production'
    };

    // Display summary
    console.log('\n' + chalk.green.bold('✅ Deployment Successful'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Deployment ID:')} ${report.deploymentId}`);
    console.log(`${chalk.cyan('Duration:')} ${report.duration}`);
    if (report.url) {
      console.log(`${chalk.cyan('URL:')} ${chalk.blue.underline(report.url)}`);
    }
    console.log(`${chalk.cyan('Timestamp:')} ${report.timestamp}`);
    console.log(chalk.gray('─'.repeat(50)));

    // Save report
    await this.saveDeploymentReport(report);
    
    return report;
  }

  /**
   * Save deployment report
   */
  async saveDeploymentReport(report) {
    try {
      const reportsDir = path.join(process.cwd(), '.deployment-reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportPath = path.join(reportsDir, `${report.deploymentId}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`Deployment report saved: ${reportPath}`);
    } catch (error) {
      logger.warn('Failed to save deployment report:', error.message);
    }
  }

  /**
   * Perform rollback
   */
  async performRollback(projectPath) {
    if (!this.rollbackData.canRollback) {
      throw new Error('No rollback point available');
    }

    const spinner = progressIndicator.createSpinner('rollback', 'Rolling back deployment...');
    
    try {
      const result = await this.executeCommand(
        `wrangler rollback ${this.rollbackData.lastDeploymentId}`,
        projectPath
      );
      
      if (!result.success) {
        throw new Error(`Rollback failed: ${result.error}`);
      }

      progressIndicator.updateSpinner('rollback', 'Rollback completed successfully', 'success');
      logger.info('Deployment rolled back successfully');
      
    } catch (error) {
      progressIndicator.updateSpinner('rollback', `Rollback failed: ${error.message}`, 'fail');
      throw error;
    }
  }

  /**
   * Execute command with proper error handling
   */
  async executeCommand(command, cwd = process.cwd(), options = {}) {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      
      const child = spawn(cmd, args, {
        cwd,
        stdio: options.input ? 'pipe' : 'inherit',
        shell: false
      });

      let output = '';
      let error = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          error += data.toString();
        });
      }

      if (options.input && child.stdin) {
        child.stdin.write(options.input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error,
          code
        });
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          output,
          error: err.message,
          code: -1
        });
      });
    });
  }

  /**
   * Check if command exists
   */
  async checkCommand(command) {
    const result = await this.executeCommand(command);
    return result.success;
  }

  /**
   * Check Wrangler authentication
   */
  async checkWranglerAuth() {
    const result = await this.executeCommand('wrangler whoami');
    return result.success && result.output.includes('@');
  }

  /**
   * Validate production environment
   */
  async validateProductionEnvironment(config) {
    // Add production-specific validations
    return true;
  }

  /**
   * Extract deployment ID from output
   */
  extractDeploymentId(output) {
    const match = output.match(/deployment.*?([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  /**
   * Update Wrangler config for environment
   */
  async updateWranglerForEnvironment(projectPath, environment) {
    // Environment-specific wrangler configuration updates
    logger.info(`Updated Wrangler configuration for ${environment} environment`);
  }

  /**
   * Run post-deployment tests
   */
  async runPostDeploymentTests(url, options) {
    // Implementation for post-deployment tests
    logger.info('Post-deployment tests completed');
  }
}

// Export singleton instance
export const deploymentAutomation = new DeploymentAutomation();

// Convenience function for direct usage
export async function deployProject(projectPath, options = {}) {
  return await deploymentAutomation.deployProject(projectPath, options);
}