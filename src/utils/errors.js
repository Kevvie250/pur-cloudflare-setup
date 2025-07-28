import chalk from 'chalk';
import boxen from 'boxen';

export class SetupError extends Error {
  constructor(message, code, solution, docs) {
    super(message);
    this.name = 'SetupError';
    this.code = code;
    this.solution = solution;
    this.docs = docs;
    this.timestamp = new Date().toISOString();
  }
}

export const ErrorCodes = {
  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_PROJECT_NAME: 'INVALID_PROJECT_NAME',
  INVALID_DOMAIN: 'INVALID_DOMAIN',
  
  // API errors
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_CONNECTION_FAILED: 'API_CONNECTION_FAILED',
  CLOUDFLARE_AUTH_FAILED: 'CLOUDFLARE_AUTH_FAILED',
  AIRTABLE_AUTH_FAILED: 'AIRTABLE_AUTH_FAILED',
  
  // File system errors
  DIRECTORY_EXISTS: 'DIRECTORY_EXISTS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
  
  // Deployment errors
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED',
  WRANGLER_NOT_FOUND: 'WRANGLER_NOT_FOUND',
  BUILD_FAILED: 'BUILD_FAILED',
  
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  DNS_RESOLUTION_FAILED: 'DNS_RESOLUTION_FAILED',
  
  // Validation errors
  DOMAIN_NOT_VERIFIED: 'DOMAIN_NOT_VERIFIED',
  NAMING_CONFLICT: 'NAMING_CONFLICT',
  RESERVED_NAME: 'RESERVED_NAME'
};

export const ErrorMessages = {
  [ErrorCodes.INVALID_CONFIG]: {
    message: 'Invalid configuration file',
    solution: 'Check that your configuration file is valid JSON and contains all required fields',
    docs: 'https://docs.purair.com/setup/configuration'
  },
  
  [ErrorCodes.MISSING_REQUIRED_FIELD]: {
    message: 'Missing required configuration field',
    solution: 'Ensure all required fields are provided in your configuration',
    docs: 'https://docs.purair.com/setup/required-fields'
  },
  
  [ErrorCodes.INVALID_PROJECT_NAME]: {
    message: 'Invalid project name format',
    solution: 'Use only lowercase letters, numbers, and hyphens. Must start with a letter.',
    docs: 'https://docs.purair.com/setup/naming-conventions'
  },
  
  [ErrorCodes.INVALID_DOMAIN]: {
    message: 'Invalid domain name format',
    solution: 'Enter a valid domain name (e.g., example.com or subdomain.example.com)',
    docs: 'https://docs.purair.com/setup/domains'
  },
  
  [ErrorCodes.API_KEY_INVALID]: {
    message: 'Invalid API key',
    solution: 'Check your API key in the Cloudflare dashboard and ensure it has the correct permissions',
    docs: 'https://developers.cloudflare.com/api/tokens'
  },
  
  [ErrorCodes.API_CONNECTION_FAILED]: {
    message: 'Failed to connect to API',
    solution: 'Check your internet connection and try again. If the problem persists, check the service status.',
    docs: 'https://www.cloudflarestatus.com'
  },
  
  [ErrorCodes.CLOUDFLARE_AUTH_FAILED]: {
    message: 'Cloudflare authentication failed',
    solution: 'Verify your Cloudflare API token has the correct permissions:\n  - Zone:Read\n  - Zone:Edit\n  - Workers Scripts:Edit',
    docs: 'https://dash.cloudflare.com/profile/api-tokens'
  },
  
  [ErrorCodes.AIRTABLE_AUTH_FAILED]: {
    message: 'Airtable authentication failed',
    solution: 'Check your Airtable API key and ensure it has access to the specified base',
    docs: 'https://airtable.com/account'
  },
  
  [ErrorCodes.DIRECTORY_EXISTS]: {
    message: 'Directory already exists',
    solution: 'Choose a different project name or remove the existing directory',
    docs: 'https://docs.purair.com/setup/troubleshooting#directory-exists'
  },
  
  [ErrorCodes.PERMISSION_DENIED]: {
    message: 'Permission denied',
    solution: 'Check that you have write permissions in the current directory',
    docs: 'https://docs.purair.com/setup/permissions'
  },
  
  [ErrorCodes.TEMPLATE_NOT_FOUND]: {
    message: 'Template file not found',
    solution: 'Ensure the setup tool is installed correctly. Try reinstalling with: npm install -g pur-cloudflare-setup',
    docs: 'https://docs.purair.com/setup/installation'
  },
  
  [ErrorCodes.FILE_WRITE_FAILED]: {
    message: 'Failed to write file',
    solution: 'Check disk space and file permissions',
    docs: 'https://docs.purair.com/setup/troubleshooting#file-write'
  },
  
  [ErrorCodes.DEPLOYMENT_FAILED]: {
    message: 'Deployment failed',
    solution: 'Check the deployment logs for specific errors. Common issues:\n  - Invalid wrangler.toml configuration\n  - Missing environment variables\n  - API quota exceeded',
    docs: 'https://developers.cloudflare.com/workers/platform/deployments'
  },
  
  [ErrorCodes.WRANGLER_NOT_FOUND]: {
    message: 'Wrangler CLI not found',
    solution: 'Install Wrangler globally: npm install -g wrangler',
    docs: 'https://developers.cloudflare.com/workers/wrangler/install-and-update'
  },
  
  [ErrorCodes.BUILD_FAILED]: {
    message: 'Build process failed',
    solution: 'Check the build logs for specific errors. Common issues:\n  - Missing dependencies\n  - Syntax errors\n  - Invalid configuration',
    docs: 'https://docs.purair.com/setup/build-errors'
  },
  
  [ErrorCodes.NETWORK_TIMEOUT]: {
    message: 'Network request timed out',
    solution: 'Check your internet connection and try again. If on a corporate network, check proxy settings.',
    docs: 'https://docs.purair.com/setup/network-issues'
  },
  
  [ErrorCodes.DNS_RESOLUTION_FAILED]: {
    message: 'DNS resolution failed',
    solution: 'Verify the domain exists and DNS is properly configured',
    docs: 'https://developers.cloudflare.com/dns'
  },
  
  [ErrorCodes.DOMAIN_NOT_VERIFIED]: {
    message: 'Domain ownership not verified',
    solution: 'Add the domain to your Cloudflare account and verify ownership',
    docs: 'https://developers.cloudflare.com/fundamentals/get-started/setup/add-site'
  },
  
  [ErrorCodes.NAMING_CONFLICT]: {
    message: 'Name conflicts with existing resource',
    solution: 'Choose a different name for your project or worker',
    docs: 'https://docs.purair.com/setup/naming-conflicts'
  },
  
  [ErrorCodes.RESERVED_NAME]: {
    message: 'Project name uses reserved word',
    solution: 'Avoid using reserved words like: api, www, admin, dashboard, etc.',
    docs: 'https://docs.purair.com/setup/reserved-names'
  }
};

export class ErrorHandler {
  constructor() {
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }

  // Create a formatted error with context
  createError(code, context = {}) {
    const errorInfo = ErrorMessages[code] || {
      message: 'Unknown error',
      solution: 'Please check the documentation',
      docs: 'https://docs.purair.com'
    };

    let message = errorInfo.message;
    if (context.details) {
      message += `\n${chalk.gray(context.details)}`;
    }

    return new SetupError(
      message,
      code,
      errorInfo.solution,
      errorInfo.docs
    );
  }

  // Display error in a formatted box
  displayError(error) {
    const isSetupError = error instanceof SetupError;
    
    const errorBox = boxen(
      chalk.red.bold('❌ Error') + '\n\n' +
      chalk.white(error.message) + '\n\n' +
      (isSetupError && error.solution ? 
        chalk.yellow.bold('💡 Solution:') + '\n' + 
        chalk.yellow(error.solution) + '\n\n' : '') +
      (isSetupError && error.docs ? 
        chalk.blue('📚 Documentation:') + '\n' + 
        chalk.blue.underline(error.docs) : ''),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    );

    console.error(errorBox);

    if (error.code) {
      console.error(chalk.gray(`Error Code: ${error.code}`));
    }

    if (process.env.DEBUG === 'true' && error.stack) {
      console.error(chalk.gray('\nStack Trace:'));
      console.error(chalk.gray(error.stack));
    }
  }

  // Retry logic for transient failures
  async retryOperation(operation, operationName, options = {}) {
    const maxAttempts = options.maxRetries || this.maxRetries;
    const delay = options.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        
        if (isLastAttempt || !this.isRetryableError(error)) {
          throw error;
        }

        console.log(chalk.yellow(`\n⚠️  ${operationName} failed (attempt ${attempt}/${maxAttempts})`));
        console.log(chalk.gray(`Retrying in ${delay/1000}s...`));
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  // Check if error is retryable
  isRetryableError(error) {
    const retryableCodes = [
      ErrorCodes.API_CONNECTION_FAILED,
      ErrorCodes.NETWORK_TIMEOUT,
      ErrorCodes.DNS_RESOLUTION_FAILED
    ];

    if (error instanceof SetupError) {
      return retryableCodes.includes(error.code);
    }

    // Check for common network errors
    const networkErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
    return networkErrors.some(code => error.code === code || error.message.includes(code));
  }

  // Suggest fixes based on error patterns
  suggestFixes(error) {
    const suggestions = [];

    if (error.message.includes('EACCES') || error.message.includes('permission')) {
      suggestions.push('Try running with sudo (on macOS/Linux)');
      suggestions.push('Check folder permissions');
    }

    if (error.message.includes('ENOENT')) {
      suggestions.push('Check if the file or directory exists');
      suggestions.push('Verify the path is correct');
    }

    if (error.message.includes('npm') || error.message.includes('node_modules')) {
      suggestions.push('Try running: npm install');
      suggestions.push('Delete node_modules and package-lock.json, then reinstall');
    }

    if (suggestions.length > 0) {
      console.log(chalk.cyan('\n💡 Additional suggestions:'));
      suggestions.forEach(suggestion => {
        console.log(chalk.cyan(`  • ${suggestion}`));
      });
    }
  }

  // Recovery options for failed operations
  async handleRecovery(error, context) {
    const recoveryOptions = [];

    if (error.code === ErrorCodes.DIRECTORY_EXISTS) {
      recoveryOptions.push({
        name: 'Overwrite existing directory',
        value: 'overwrite',
        action: async () => {
          // Implementation would go here
          console.log(chalk.yellow('Overwriting existing directory...'));
        }
      });
      
      recoveryOptions.push({
        name: 'Choose different name',
        value: 'rename',
        action: async () => {
          // Implementation would go here
          console.log(chalk.yellow('Please choose a different project name'));
        }
      });
    }

    if (error.code === ErrorCodes.API_KEY_INVALID) {
      recoveryOptions.push({
        name: 'Re-enter API credentials',
        value: 'reauth',
        action: async () => {
          console.log(chalk.yellow('Please provide valid API credentials'));
        }
      });
    }

    return recoveryOptions;
  }

  // Log errors for debugging
  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context,
      environment: {
        node: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };

    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray('\nError Log:'));
      console.log(chalk.gray(JSON.stringify(errorLog, null, 2)));
    }

    // In production, this could write to a log file
    return errorLog;
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

// Convenience function for handling errors
export function handleError(error, context = {}) {
  errorHandler.logError(error, context);
  errorHandler.displayError(error);
  errorHandler.suggestFixes(error);
  
  process.exit(1);
}