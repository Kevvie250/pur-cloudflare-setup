import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import ora from 'ora';
import dns from 'dns/promises';
import https from 'https';
import { errorHandler, ErrorCodes } from '../utils/errors.js';
import { validateProjectName, validateDomain } from '../utils/validation.js';

export class ConfigValidator {
  constructor() {
    this.validationResults = [];
    this.spinner = ora();
  }

  // Main validation function
  async validateConfiguration(config) {
    console.log(boxen(
      chalk.bold.cyan('🔍 Configuration Validation') + '\n' +
      chalk.gray('Checking all settings and connections'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));

    this.validationResults = [];

    // Run all validations
    await this.validateBasicConfig(config);
    await this.validateApiConnections(config);
    await this.validateDomainSettings(config);
    await this.validateNamingConflicts(config);
    await this.validateDependencies(config);

    // Display results
    this.displayValidationResults();

    // Return validation summary
    const hasErrors = this.validationResults.some(r => r.status === 'error');
    const hasWarnings = this.validationResults.some(r => r.status === 'warning');

    return {
      valid: !hasErrors,
      hasWarnings,
      results: this.validationResults
    };
  }

  // Validate basic configuration
  async validateBasicConfig(config) {
    this.spinner.start('Validating basic configuration...');

    const checks = [
      {
        name: 'Project Name',
        check: () => validateProjectName(config.projectName),
        error: 'Invalid project name format'
      },
      {
        name: 'Domain',
        check: () => validateDomain(config.domain),
        error: 'Invalid domain format'
      },
      {
        name: 'Project Type',
        check: () => ['site', 'api', 'app'].includes(config.projectType),
        error: 'Invalid project type'
      },
      {
        name: 'Required Fields',
        check: () => config.projectName && config.domain && config.projectType,
        error: 'Missing required fields'
      }
    ];

    for (const check of checks) {
      try {
        const isValid = await check.check();
        this.validationResults.push({
          category: 'Basic Configuration',
          item: check.name,
          status: isValid ? 'success' : 'error',
          message: isValid ? 'Valid' : check.error
        });
      } catch (error) {
        this.validationResults.push({
          category: 'Basic Configuration',
          item: check.name,
          status: 'error',
          message: error.message
        });
      }
    }

    this.spinner.succeed('Basic configuration validated');
  }

  // Validate API connections
  async validateApiConnections(config) {
    if (!config.useWorkers && !config.apiType) {
      return; // Skip if no API features
    }

    this.spinner.start('Testing API connections...');

    // Cloudflare API validation
    if (config.cloudflareApiToken) {
      const cfResult = await this.validateCloudflareAPI(config.cloudflareApiToken);
      this.validationResults.push({
        category: 'API Connections',
        item: 'Cloudflare API',
        status: cfResult.valid ? 'success' : 'error',
        message: cfResult.message
      });
    }

    // Airtable API validation
    if (config.apiType === 'airtable' && config.airtableApiKey) {
      const atResult = await this.validateAirtableAPI(config.airtableApiKey, config.airtableBaseId);
      this.validationResults.push({
        category: 'API Connections',
        item: 'Airtable API',
        status: atResult.valid ? 'success' : 'error',
        message: atResult.message
      });
    }

    this.spinner.succeed('API connections tested');
  }

  // Validate Cloudflare API (SECURE)
  async validateCloudflareAPI(token) {
    try {
      // Validate token format first
      if (!token || typeof token !== 'string' || token.length < 10) {
        return { valid: false, message: 'Invalid API token format' };
      }
      
      const response = await this.makeAPIRequest(
        'api.cloudflare.com',
        '/client/v4/user',
        {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      );

      if (response.success) {
        return { valid: true, message: 'Connected successfully' };
      } else {
        return { valid: false, message: 'Invalid API token' };
      }
    } catch (error) {
      // SECURITY: Never expose full error messages that might contain tokens
      const safeMessage = this.sanitizeErrorMessage(error.message);
      return { valid: false, message: `Connection failed: ${safeMessage}` };
    }
  }

  // Validate Airtable API (SECURE)
  async validateAirtableAPI(apiKey, baseId) {
    try {
      // Validate input format first
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
        return { valid: false, message: 'Invalid API key format' };
      }
      
      if (!baseId || typeof baseId !== 'string' || !baseId.startsWith('app')) {
        return { valid: false, message: 'Invalid base ID format' };
      }
      
      const response = await this.makeAPIRequest(
        'api.airtable.com',
        `/v0/${baseId}/`,
        {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      );

      if (response.error) {
        return { valid: false, message: 'Invalid credentials' };
      }
      
      return { valid: true, message: 'Connected successfully' };
    } catch (error) {
      // SECURITY: Never expose full error messages that might contain tokens
      const safeMessage = this.sanitizeErrorMessage(error.message);
      return { valid: false, message: `Connection failed: ${safeMessage}` };
    }
  }

  // Validate domain settings
  async validateDomainSettings(config) {
    this.spinner.start('Validating domain settings...');

    // DNS resolution check
    try {
      const addresses = await dns.resolve4(config.domain);
      this.validationResults.push({
        category: 'Domain Settings',
        item: 'DNS Resolution',
        status: 'success',
        message: `Resolves to ${addresses[0]}`
      });
    } catch (error) {
      this.validationResults.push({
        category: 'Domain Settings',
        item: 'DNS Resolution',
        status: 'warning',
        message: 'Domain does not resolve (may need configuration)'
      });
    }

    // Check if domain uses Cloudflare
    try {
      const ns = await dns.resolveNs(config.domain);
      const usesCloudflare = ns.some(server => server.includes('cloudflare'));
      
      this.validationResults.push({
        category: 'Domain Settings',
        item: 'Cloudflare DNS',
        status: usesCloudflare ? 'success' : 'warning',
        message: usesCloudflare ? 'Using Cloudflare DNS' : 'Not using Cloudflare DNS'
      });
    } catch (error) {
      this.validationResults.push({
        category: 'Domain Settings',
        item: 'Cloudflare DNS',
        status: 'warning',
        message: 'Could not verify DNS provider'
      });
    }

    this.spinner.succeed('Domain settings validated');
  }

  // Check for naming conflicts
  async validateNamingConflicts(config) {
    this.spinner.start('Checking for naming conflicts...');

    const reservedNames = [
      'api', 'www', 'admin', 'dashboard', 'app', 'mail', 
      'ftp', 'blog', 'shop', 'store', 'cdn', 'static'
    ];

    // Check project name
    if (reservedNames.includes(config.projectName.toLowerCase())) {
      this.validationResults.push({
        category: 'Naming',
        item: 'Project Name',
        status: 'warning',
        message: `"${config.projectName}" is a commonly reserved name`
      });
    } else {
      this.validationResults.push({
        category: 'Naming',
        item: 'Project Name',
        status: 'success',
        message: 'No conflicts detected'
      });
    }

    // Check subdomain conflicts
    const subdomain = config.domain.split('.')[0];
    if (reservedNames.includes(subdomain.toLowerCase()) && subdomain !== config.projectName) {
      this.validationResults.push({
        category: 'Naming',
        item: 'Subdomain',
        status: 'warning',
        message: 'Subdomain uses a commonly reserved name'
      });
    }

    this.spinner.succeed('Naming conflicts checked');
  }

  // Validate required dependencies
  async validateDependencies(config) {
    this.spinner.start('Checking dependencies...');

    const checks = [];

    // Check for Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    checks.push({
      name: 'Node.js Version',
      valid: majorVersion >= 18,
      message: majorVersion >= 18 ? `v${nodeVersion} (Compatible)` : `v${nodeVersion} (Requires v18+)`
    });

    // Check for Wrangler if needed
    if (config.useWrangler) {
      const wranglerInstalled = await this.checkCommand('wrangler --version');
      checks.push({
        name: 'Wrangler CLI',
        valid: wranglerInstalled,
        message: wranglerInstalled ? 'Installed' : 'Not installed (run: npm install -g wrangler)'
      });
    }

    // Check for Git
    const gitInstalled = await this.checkCommand('git --version');
    checks.push({
      name: 'Git',
      valid: gitInstalled,
      message: gitInstalled ? 'Installed' : 'Not installed'
    });

    // Add results
    checks.forEach(check => {
      this.validationResults.push({
        category: 'Dependencies',
        item: check.name,
        status: check.valid ? 'success' : 'warning',
        message: check.message
      });
    });

    this.spinner.succeed('Dependencies checked');
  }

  // Display validation results in a table
  displayValidationResults() {
    console.log('\n' + chalk.bold('Validation Results:'));
    
    const table = new Table({
      head: ['Category', 'Item', 'Status', 'Details'],
      colWidths: [20, 20, 10, 40],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    // Group results by category
    const grouped = {};
    this.validationResults.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = [];
      }
      grouped[result.category].push(result);
    });

    // Add to table
    Object.entries(grouped).forEach(([category, results]) => {
      results.forEach((result, index) => {
        const statusIcon = result.status === 'success' ? chalk.green('✓') :
                          result.status === 'warning' ? chalk.yellow('⚠') :
                          chalk.red('✗');
        
        const statusText = result.status === 'success' ? chalk.green('PASS') :
                          result.status === 'warning' ? chalk.yellow('WARN') :
                          chalk.red('FAIL');

        table.push([
          index === 0 ? chalk.cyan.bold(category) : '',
          result.item,
          `${statusIcon} ${statusText}`,
          chalk.gray(result.message)
        ]);
      });
    });

    console.log(table.toString());

    // Summary
    const successCount = this.validationResults.filter(r => r.status === 'success').length;
    const warningCount = this.validationResults.filter(r => r.status === 'warning').length;
    const errorCount = this.validationResults.filter(r => r.status === 'error').length;

    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`  ✓ Passed: ${successCount}`));
    if (warningCount > 0) console.log(chalk.yellow(`  ⚠ Warnings: ${warningCount}`));
    if (errorCount > 0) console.log(chalk.red(`  ✗ Failed: ${errorCount}`));
    console.log('');
  }

  // Interactive fix suggestions
  async suggestFixes() {
    const errors = this.validationResults.filter(r => r.status === 'error');
    const warnings = this.validationResults.filter(r => r.status === 'warning');

    if (errors.length > 0) {
      console.log(boxen(
        chalk.red.bold('❌ Validation Errors') + '\n' +
        chalk.white('The following issues must be fixed:'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red'
        }
      ));

      errors.forEach(error => {
        console.log(`\n${chalk.red('Issue:')} ${error.item} - ${error.message}`);
        console.log(`${chalk.yellow('Fix:')} ${this.getSuggestedFix(error)}`);
      });
    }

    if (warnings.length > 0) {
      console.log(boxen(
        chalk.yellow.bold('⚠️  Warnings') + '\n' +
        chalk.white('Consider addressing these issues:'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      ));

      warnings.forEach(warning => {
        console.log(`\n${chalk.yellow('Warning:')} ${warning.item} - ${warning.message}`);
        console.log(`${chalk.gray('Suggestion:')} ${this.getSuggestedFix(warning)}`);
      });
    }
  }

  // Get suggested fix for validation issue
  getSuggestedFix(result) {
    const fixes = {
      'Invalid project name format': 'Use only lowercase letters, numbers, and hyphens',
      'Invalid domain format': 'Enter a valid domain (e.g., example.com)',
      'Invalid API token': 'Check your Cloudflare dashboard for the correct API token',
      'Domain does not resolve': 'Add DNS records for your domain',
      'Not using Cloudflare DNS': 'Consider moving your domain to Cloudflare for full integration',
      'Not installed': 'Install the missing dependency using the provided command'
    };

    for (const [key, fix] of Object.entries(fixes)) {
      if (result.message.includes(key)) {
        return fix;
      }
    }

    return 'Check the documentation for more information';
  }

  // SECURITY: Sanitize error messages to prevent token exposure
  sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'Network error';
    }
    
    // Remove potential sensitive data patterns
    const sensitivePatterns = [
      /Bearer\s+[A-Za-z0-9\-_]+/gi,  // Bearer tokens
      /api[_-]?key[s]?[:\s=]+[A-Za-z0-9\-_]+/gi,  // API keys
      /token[s]?[:\s=]+[A-Za-z0-9\-_]+/gi,  // Generic tokens
      /password[s]?[:\s=]+\S+/gi,  // Passwords
      /secret[s]?[:\s=]+\S+/gi,  // Secrets
      /[A-Za-z0-9]{32,}/g  // Long hex strings (potential keys)
    ];
    
    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // Generic network errors
    if (sanitized.includes('ENOTFOUND') || sanitized.includes('ECONNREFUSED')) {
      return 'Network connection error';
    }
    
    if (sanitized.includes('timeout') || sanitized.includes('ETIMEDOUT')) {
      return 'Request timeout';
    }
    
    if (sanitized.includes('401') || sanitized.includes('403')) {
      return 'Authentication failed';
    }
    
    return sanitized.substring(0, 100); // Limit message length
  }

  // Helper: Make HTTPS API request
  async makeAPIRequest(hostname, path, headers) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname,
        path,
        method: 'GET',
        headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve({ error: { message: 'Invalid response' } });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  // Helper: Check if command exists (SECURE)
  async checkCommand(command) {
    const { spawn } = await import('child_process');
    
    // Input validation - only allow whitelisted commands
    const allowedCommands = ['wrangler', 'git', 'node', 'npm'];
    const [commandName] = command.split(' ');
    
    if (!allowedCommands.includes(commandName)) {
      console.warn(`Security warning: Command "${commandName}" not in whitelist`);
      return false;
    }
    
    // Split command safely - no shell interpretation
    const args = command.split(' ').slice(1);
    
    return new Promise((resolve) => {
      const child = spawn(commandName, args, {
        stdio: 'ignore',
        shell: false, // CRITICAL: Never use shell
        timeout: 5000 // 5 second timeout
      });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
      
      // Force cleanup after timeout
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          resolve(false);
        }
      }, 5000);
    });
  }
}

// Singleton instance
export const configValidator = new ConfigValidator();