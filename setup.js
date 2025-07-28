#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import figlet from 'figlet';
import boxen from 'boxen';
import Table from 'cli-table3';
import { PromptManager } from './src/modules/prompts.js';
import { ConfigManager } from './src/modules/configManager.js';
import { validateProjectName, validateDomain } from './src/utils/validation.js';
import { projectStructureCreator } from './src/modules/projectStructureCreator.js';
import { templateEngine } from './src/modules/templateEngine.js';
import { fileGenerator } from './src/modules/fileGenerator.js';
import { sharedWorkerManager } from './src/modules/sharedWorkerManager.js';
import { deploymentPreview } from './src/modules/deploymentPreview.js';
import { configValidator } from './src/modules/configValidator.js';
import { deploymentChecklist } from './src/modules/deploymentChecklist.js';
import { progressIndicator, withProgress, trackFileOperations } from './src/utils/progressIndicator.js';
import { errorHandler, ErrorCodes, handleError } from './src/utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Enhanced banner with figlet
const createBanner = () => {
  const figletText = figlet.textSync('PurAir', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });

  return boxen(
    chalk.cyan(figletText) + '\n\n' +
    chalk.bold.white('Cloudflare Setup Tool') + '\n' +
    chalk.gray(`v${packageJson.version}`),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
      align: 'center'
    }
  );
};

class CloudflareSetupCLI {
  constructor() {
    this.promptManager = new PromptManager();
    this.configManager = new ConfigManager();
    this.spinner = ora();
  }

  async run() {
    console.log(createBanner());

    program
      .version(packageJson.version)
      .description('Automated setup tool for PurAir Cloudflare projects')
      .option('-n, --name <name>', 'Project name')
      .option('-d, --domain <domain>', 'Domain name')
      .option('-t, --type <type>', 'Project type (site, api, app)')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--no-interactive', 'Run in non-interactive mode')
      .option('--save-config', 'Save configuration for reuse')
      .option('--preview', 'Preview what will be created without making changes')
      .option('--validate-only', 'Only validate configuration without creating project')
      .option('--skip-validation', 'Skip validation checks (not recommended)')
      .action(async (options) => {
        try {
          await this.handleCommand(options);
        } catch (error) {
          this.handleError(error);
        }
      });

    program
      .command('init')
      .description('Initialize a new Cloudflare project')
      .action(async () => {
        try {
          await this.initProject();
        } catch (error) {
          this.handleError(error);
        }
      });

    program
      .command('config')
      .description('Manage saved configurations')
      .option('-l, --list', 'List saved configurations')
      .option('-s, --show <name>', 'Show configuration details')
      .option('-d, --delete <name>', 'Delete a saved configuration')
      .action(async (options) => {
        try {
          await this.manageConfig(options);
        } catch (error) {
          this.handleError(error);
        }
      });

    program
      .command('templates')
      .description('List available templates')
      .action(async () => {
        try {
          await this.listTemplates();
        } catch (error) {
          this.handleError(error);
        }
      });

    program.parse(process.argv);

    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  }

  async handleCommand(options) {
    let config = {};
    const fileTracker = trackFileOperations();

    try {
      // Step indicator
      const stepIndicator = progressIndicator.createStepIndicator([
        'Load Configuration',
        'Collect Project Info',
        'Validate Settings',
        'Preview Deployment',
        'Generate Project',
        'Complete Setup'
      ]);
      
      stepIndicator.display();

      // Load configuration from file if provided
      if (options.config) {
        await withProgress(
          this.configManager.load(options.config),
          'Loading configuration',
          {
            successMessage: 'Configuration loaded successfully',
            errorMessage: 'Failed to load configuration'
          }
        ).then(loadedConfig => {
          config = loadedConfig;
          stepIndicator.next();
        });
      } else {
        stepIndicator.next();
      }

      // Merge command line options
      if (options.name) config.projectName = options.name;
      if (options.domain) config.domain = options.domain;
      if (options.type) config.projectType = options.type;

      // Interactive mode to fill missing values
      if (!options.noInteractive) {
        config = await this.promptManager.collectProjectInfo(config);
      }
      stepIndicator.next();

      // Validate configuration
      if (!options.skipValidation) {
        const validation = await configValidator.validateConfiguration(config);
        if (!validation.valid) {
          await configValidator.suggestFixes();
          if (!options.force) {
            throw errorHandler.createError(ErrorCodes.INVALID_CONFIG, {
              details: 'Configuration validation failed'
            });
          }
        }
      }
      stepIndicator.next();

      // Preview mode
      if (options.preview || options.validateOnly) {
        await deploymentPreview.generatePreview(
          path.resolve(config.projectPath || config.projectName),
          config
        );
        
        if (options.validateOnly) {
          console.log(chalk.green('\n✓ Configuration is valid'));
          return;
        }
        
        const { proceed } = await this.promptManager.confirmWithDetails(
          'Proceed with project generation?',
          'Review the preview above'
        );
        
        if (!proceed) {
          console.log(chalk.yellow('\nProject generation cancelled'));
          return;
        }
      }
      stepIndicator.next();

      // Save configuration if requested
      if (options.saveConfig) {
        await this.saveConfiguration(config);
      }

      // Generate project with checklist
      await this.generateProjectWithChecklist(config, fileTracker);
      stepIndicator.complete();
      
      // Show comprehensive completion summary
      await this.showCompletionSummary(config, fileTracker.getSummary());
      
    } catch (error) {
      handleError(error, { config, options });
    }
  }

  async initProject() {
    const loadingAnimation = progressIndicator.createLoadingAnimation([
      'Initializing new Cloudflare project...',
      'Preparing setup wizard...',
      'Loading configuration options...'
    ]);

    const fileTracker = trackFileOperations();

    try {
      // Stop loading animation
      loadingAnimation.stop('Ready to configure your project', 'success');

      const config = await this.promptManager.collectProjectInfo();
      
      // Validate configuration with UI
      const validation = await configValidator.validateConfiguration(config);
      if (!validation.valid) {
        await configValidator.suggestFixes();
        const { proceed } = await this.promptManager.confirmAction(
          'Configuration has issues. Proceed anyway?'
        );
        if (!proceed) {
          throw errorHandler.createError(ErrorCodes.INVALID_CONFIG);
        }
      }

      // Preview before proceeding
      await deploymentPreview.generatePreview(
        path.resolve(config.projectPath || config.projectName),
        config
      );

      // Ask if user wants to save config
      const { saveConfig } = await this.promptManager.askSaveConfig();
      if (saveConfig) {
        await this.saveConfiguration(config);
      }

      // Generate project with enhanced UI
      await this.generateProjectWithChecklist(config, fileTracker);
      
      // Show comprehensive completion summary
      await this.showCompletionSummary(config, fileTracker.getSummary());
      
    } catch (error) {
      loadingAnimation.stop('Setup failed', 'fail');
      handleError(error);
    }
  }

  async manageConfig(options) {
    if (options.list) {
      const configs = await this.configManager.list();
      if (configs.length === 0) {
        console.log(chalk.yellow('No saved configurations found.'));
      } else {
        console.log(chalk.blue('\n📁 Saved Configurations:\n'));
        configs.forEach(config => {
          console.log(`  • ${chalk.green(config.name)} - ${chalk.gray(config.description || 'No description')}`);
        });
      }
    } else if (options.show) {
      const config = await this.configManager.get(options.show);
      if (config) {
        console.log(chalk.blue(`\n📋 Configuration: ${options.show}\n`));
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log(chalk.red(`Configuration '${options.show}' not found.`));
      }
    } else if (options.delete) {
      const deleted = await this.configManager.delete(options.delete);
      if (deleted) {
        console.log(chalk.green(`✅ Configuration '${options.delete}' deleted successfully.`));
      } else {
        console.log(chalk.red(`Configuration '${options.delete}' not found.`));
      }
    } else {
      console.log(chalk.yellow('Please specify an action: --list, --show <name>, or --delete <name>'));
    }
  }

  async listTemplates() {
    console.log(chalk.blue('\n📄 Available Templates:\n'));
    
    const templates = await templateEngine.getAvailableTemplates();
    const grouped = {};
    
    // Group templates by category
    Object.entries(templates).forEach(([name, path]) => {
      const parts = name.split('/');
      const category = parts.length > 1 ? parts[0] : 'root';
      const fileName = parts[parts.length - 1];
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      grouped[category].push(fileName);
    });
    
    // Display grouped templates
    Object.entries(grouped).forEach(([category, files]) => {
      console.log(chalk.yellow(`  ${category}/`));
      files.forEach(file => {
        console.log(chalk.gray(`    - ${file.replace('.template', '')}`));
      });
    });
    
    console.log(chalk.blue('\n📊 Template Statistics:\n'));
    console.log(chalk.gray(`  Total templates: ${Object.keys(templates).length}`));
    console.log(chalk.gray(`  Categories: ${Object.keys(grouped).length}`));
  }

  validateConfig(config) {
    const errors = [];

    if (!config.projectName || !validateProjectName(config.projectName)) {
      errors.push('Invalid project name. Use lowercase letters, numbers, and hyphens only.');
    }

    if (!config.domain || !validateDomain(config.domain)) {
      errors.push('Invalid domain name.');
    }

    if (!config.projectType || !['site', 'api', 'app'].includes(config.projectType)) {
      errors.push('Invalid project type. Must be: site, api, or app.');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  async saveConfiguration(config) {
    this.spinner.start('Saving configuration...');
    try {
      const { configName } = await this.promptManager.askConfigName();
      await this.configManager.save(configName, config);
      this.spinner.succeed(`Configuration saved as '${configName}'`);
    } catch (error) {
      this.spinner.fail('Failed to save configuration');
      throw error;
    }
  }

  displaySummary(config) {
    console.log(chalk.blue('\n📋 Project Configuration Summary:\n'));
    console.log(`  ${chalk.bold('Project Name:')}  ${config.projectName}`);
    console.log(`  ${chalk.bold('Domain:')}        ${config.domain}`);
    console.log(`  ${chalk.bold('Project Type:')}  ${config.projectType}`);
    
    if (config.features && config.features.length > 0) {
      console.log(`  ${chalk.bold('Features:')}      ${config.features.join(', ')}`);
    }
    
    if (config.environment) {
      console.log(`  ${chalk.bold('Environment:')}   ${config.environment}`);
    }
  }

  async generateProjectWithChecklist(config, fileTracker) {
    // Initialize deployment checklist
    deploymentChecklist.initializeChecklist(config);
    await deploymentChecklist.displayChecklist();

    try {
      // Validate configuration
      await deploymentChecklist.executeStep('validate-config', async () => {
        const validation = await configValidator.validateConfiguration(config);
        if (!validation.valid) {
          throw new Error('Configuration validation failed');
        }
      });

      // Check if using shared worker
      if (config.useSharedWorker && sharedWorkerManager.canUseSharedWorker(config)) {
        const sharedConfig = await this.promptManager.collectSharedWorkerConfig();
        config = { ...config, ...sharedConfig };
      }
      
      const projectPath = path.resolve(config.projectPath || config.projectName);
      
      // Create directories with progress
      await deploymentChecklist.executeStep('create-directories', async () => {
        await withProgress(
          projectStructureCreator.createDirectories(projectPath, config),
          'Creating project directories'
        );
      });

      // Generate files with progress bar
      await deploymentChecklist.executeStep('generate-files', async () => {
        const templates = await templateEngine.getTemplatesForProject(config);
        const progressBar = progressIndicator.createProgressBar(
          'file-generation',
          templates.length,
          { unit: 'Files' }
        );

        for (const template of templates) {
          progressIndicator.updateProgress(
            'file-generation',
            1,
            `Generating ${path.basename(template.output)}`
          );
          
          await fileGenerator.generateFile(template.output, template.content);
          fileTracker.fileCreated();
        }

        progressIndicator.completeProgress('file-generation');
      });

      // Worker setup if needed
      if (config.useWorkers) {
        await deploymentChecklist.executeStep('setup-worker', async () => {
          // Worker setup logic here
          console.log(chalk.gray('Setting up Cloudflare Worker...'));
        });
      }

      // Handle shared worker registration
      if (config.useSharedWorker && config.needsWorkerSetup) {
        await this.handleSharedWorkerSetup(config, projectPath);
      }
      
      // Final checks
      await deploymentChecklist.executeStep('final-checks', async () => {
        const validation = await projectStructureCreator.validateProjectStructure(projectPath, config);
        if (!validation.valid) {
          throw new Error('Project structure validation failed');
        }
      });

      // Generate deployment report
      const report = deploymentChecklist.generateReport();
      
      return {
        projectPath,
        report,
        config
      };
      
    } catch (error) {
      const report = deploymentChecklist.generateReport();
      throw error;
    }
  }

  async generateProject(config) {
    // This method is now a wrapper for backward compatibility
    const fileTracker = trackFileOperations();
    const result = await this.generateProjectWithChecklist(config, fileTracker);
    
    // Show completion summary
    await this.showCompletionSummary(config, fileTracker.getSummary());
    
    return result;
  }

  async handleSharedWorkerSetup(config, projectPath) {
    console.log(chalk.blue('\n🔗 Shared Worker Setup\n'));
    
    // Generate registration instructions
    const instructions = sharedWorkerManager.generateRegistrationInstructions(config);
    sharedWorkerManager.displayRegistrationInstructions(instructions);
    
    // Generate registration script
    const scriptPath = path.join(projectPath, 'register-with-shared-worker.sh');
    const script = sharedWorkerManager.generateRegistrationScript(config);
    await fileGenerator.generateFile(scriptPath, script);
    
    // Generate checklist
    const checklistPath = path.join(projectPath, 'docs', 'shared-worker-checklist.md');
    const checklist = sharedWorkerManager.generateChecklist(config);
    await fileGenerator.generateFile(checklistPath, checklist);
    
    console.log(chalk.green('\n✅ Generated shared worker setup files:'));
    console.log(chalk.gray(`  - ${path.basename(scriptPath)} - Registration script`));
    console.log(chalk.gray(`  - docs/shared-worker-checklist.md - Setup checklist`));
  }

  async showCompletionSummary(config, fileSummary) {
    const projectPath = path.resolve(config.projectPath || config.projectName);
    
    // Create comprehensive summary
    console.log(boxen(
      chalk.bold.green('✨ Project Created Successfully!') + '\n\n' +
      chalk.bold('Project Details:') + '\n' +
      `  ${chalk.gray('Name:')} ${config.projectName}\n` +
      `  ${chalk.gray('Type:')} ${config.projectType}\n` +
      `  ${chalk.gray('Domain:')} ${config.domain}\n` +
      `  ${chalk.gray('Location:')} ${projectPath}\n\n` +
      chalk.bold('Summary:') + '\n' +
      `  ${chalk.green('✓')} ${fileSummary.filesCreated} files created\n` +
      `  ${chalk.green('✓')} ${config.features?.length || 0} features configured\n` +
      (fileSummary.errors.length > 0 ? 
        `  ${chalk.red('✗')} ${fileSummary.errors.length} errors occurred\n` : ''),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        align: 'left'
      }
    ));

    // Next steps table
    const stepsTable = new Table({
      head: ['Step', 'Command', 'Description'],
      colWidths: [5, 40, 40],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    const nextSteps = [
      ['1', `cd ${path.basename(projectPath)}`, 'Navigate to project directory'],
      ['2', 'npm install', 'Install dependencies'],
      ['3', 'cp .env.example .env', 'Create environment file'],
      ['4', 'nano .env', 'Add your API credentials']
    ];

    if (config.useWrangler) {
      nextSteps.push(
        ['5', 'wrangler login', 'Authenticate with Cloudflare'],
        ['6', 'npm run deploy', 'Deploy to Cloudflare']
      );
    } else {
      nextSteps.push(
        ['5', 'npm run dev', 'Start development server']
      );
    }

    nextSteps.forEach(step => stepsTable.push(step));

    console.log(chalk.bold('\n📝 Next Steps:\n'));
    console.log(stepsTable.toString());

    // Resources section
    console.log(chalk.bold('\n📚 Resources:\n'));
    
    const resources = [
      { file: 'README.md', desc: 'Project documentation and setup guide' },
      { file: '.env.example', desc: 'Environment variables reference' },
      { file: 'docs/', desc: 'Additional documentation' }
    ];

    if (config.useWrangler) {
      resources.push({ file: 'wrangler.toml', desc: 'Cloudflare Worker configuration' });
    }

    resources.forEach(resource => {
      console.log(`  ${chalk.cyan('•')} ${chalk.white(resource.file)} - ${chalk.gray(resource.desc)}`);
    });

    // Quick commands
    console.log(chalk.bold('\n⚡ Quick Commands:\n'));
    console.log(chalk.gray('  Development:'));
    console.log(`    ${chalk.yellow('npm run dev')} - Start local development`);
    console.log(`    ${chalk.yellow('npm test')} - Run tests`);
    
    if (config.useWrangler) {
      console.log(chalk.gray('\n  Deployment:'));
      console.log(`    ${chalk.yellow('npm run deploy:staging')} - Deploy to staging`);
      console.log(`    ${chalk.yellow('npm run deploy:production')} - Deploy to production`);
    }

    // Tips section
    console.log(boxen(
      chalk.bold('💡 Pro Tips:') + '\n\n' +
      '• Use environment variables for sensitive data\n' +
      '• Test locally before deploying\n' +
      '• Check the README for detailed instructions\n' +
      (config.useSharedWorker ? '• Register with shared worker before deploying\n' : '') +
      '• Join our Discord for support: discord.gg/purair',
      {
        padding: 1,
        borderStyle: 'single',
        borderColor: 'yellow'
      }
    ));

    // Save summary to file
    const summaryPath = path.join(projectPath, 'setup-summary.txt');
    const summaryContent = this.generateTextSummary(config, fileSummary, projectPath);
    await fileGenerator.generateFile(summaryPath, summaryContent);
    
    console.log(chalk.gray(`\n📄 Setup summary saved to: ${summaryPath}\n`));
  }

  generateTextSummary(config, fileSummary, projectPath) {
    const timestamp = new Date().toISOString();
    return `PurAir Cloudflare Setup Summary
${'='.repeat(50)}

Generated: ${timestamp}

Project Configuration:
- Name: ${config.projectName}
- Type: ${config.projectType}
- Domain: ${config.domain}
- Environment: ${config.environment}
- Features: ${config.features?.join(', ') || 'None'}

Files Created: ${fileSummary.filesCreated}
Project Location: ${projectPath}

Next Steps:
1. cd ${path.basename(projectPath)}
2. npm install
3. cp .env.example .env
4. Update .env with your credentials
5. ${config.useWrangler ? 'wrangler login && npm run deploy' : 'npm run dev'}

For support: https://docs.purair.com
`;
  }

  showNextSteps(projectPath, config) {
    // This method is now deprecated in favor of showCompletionSummary
    // Kept for backward compatibility
    this.showCompletionSummary(config, { filesCreated: 0, errors: [] });
  }

  handleError(error) {
    // Now uses the enhanced error handler
    handleError(error);
  }
}

// Run the CLI
const cli = new CloudflareSetupCLI();
cli.run();