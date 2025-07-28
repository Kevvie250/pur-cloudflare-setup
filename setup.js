#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { PromptManager } from './src/modules/prompts.js';
import { ConfigManager } from './src/modules/configManager.js';
import { validateProjectName, validateDomain } from './src/utils/validation.js';
import { projectStructureCreator } from './src/modules/projectStructureCreator.js';
import { templateEngine } from './src/modules/templateEngine.js';
import { fileGenerator } from './src/modules/fileGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('PurAir Cloudflare Setup Tool')}       ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray(`v${packageJson.version}`)}                              ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

class CloudflareSetupCLI {
  constructor() {
    this.promptManager = new PromptManager();
    this.configManager = new ConfigManager();
    this.spinner = ora();
  }

  async run() {
    console.log(banner);

    program
      .version(packageJson.version)
      .description('Automated setup tool for PurAir Cloudflare projects')
      .option('-n, --name <name>', 'Project name')
      .option('-d, --domain <domain>', 'Domain name')
      .option('-t, --type <type>', 'Project type (site, api, app)')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--no-interactive', 'Run in non-interactive mode')
      .option('--save-config', 'Save configuration for reuse')
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

    // Load configuration from file if provided
    if (options.config) {
      this.spinner.start('Loading configuration...');
      config = await this.configManager.load(options.config);
      this.spinner.succeed('Configuration loaded');
    }

    // Merge command line options
    if (options.name) config.projectName = options.name;
    if (options.domain) config.domain = options.domain;
    if (options.type) config.projectType = options.type;

    // Interactive mode to fill missing values
    if (!options.noInteractive) {
      config = await this.promptManager.collectProjectInfo(config);
    }

    // Validate configuration
    this.validateConfig(config);

    // Save configuration if requested
    if (options.saveConfig) {
      await this.saveConfiguration(config);
    }

    // Display configuration summary
    this.displaySummary(config);

    // Generate project
    await this.generateProject(config);
  }

  async initProject() {
    console.log(chalk.blue('\n🚀 Initializing new Cloudflare project...\n'));

    const config = await this.promptManager.collectProjectInfo();
    
    // Validate configuration
    this.validateConfig(config);

    // Ask if user wants to save config
    const { saveConfig } = await this.promptManager.askSaveConfig();
    if (saveConfig) {
      await this.saveConfiguration(config);
    }

    // Display configuration summary
    this.displaySummary(config);

    // Generate project
    await this.generateProject(config);
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

  async generateProject(config) {
    console.log(chalk.blue('\n🔨 Generating project...\n'));
    
    try {
      // Determine project path
      const projectPath = path.resolve(config.projectPath || config.projectName);
      
      // Create project structure
      const result = await projectStructureCreator.createProjectStructure(projectPath, config);
      
      console.log(chalk.green('\n✅ Project generated successfully!\n'));
      console.log(chalk.white('📁 Project location:'), chalk.cyan(projectPath));
      console.log(chalk.white('📄 Files created:'), chalk.cyan(result.filesGenerated));
      
      // Show next steps
      this.showNextSteps(projectPath, config);
      
      // Validate the generated structure
      const validation = await projectStructureCreator.validateProjectStructure(projectPath, config);
      if (!validation.valid) {
        console.log(chalk.yellow('\n⚠️  Validation warnings:'));
        validation.errors.forEach(error => console.log(chalk.yellow(`   - ${error}`)));
      }
      
    } catch (error) {
      this.spinner.fail('Failed to generate project');
      throw error;
    }
  }

  showNextSteps(projectPath, config) {
    console.log(chalk.blue('\n📝 Next Steps:\n'));
    
    const steps = [
      `cd ${path.basename(projectPath)}`,
      'npm install',
      'cp .env.example .env',
      'Update .env with your credentials'
    ];
    
    if (config.projectType === 'worker-only' || config.projectType === 'fullstack') {
      steps.push('wrangler login');
      steps.push('npm run worker:deploy');
    } else {
      steps.push('npm run dev');
    }
    
    steps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}.`), step);
    });
    
    console.log(chalk.blue('\n📚 Documentation:\n'));
    console.log(chalk.gray('  • README.md - Project documentation'));
    console.log(chalk.gray('  • .env.example - Environment variables reference'));
    
    if (config.enableCloudflareWorker) {
      console.log(chalk.gray('  • wrangler.toml - Cloudflare Worker configuration'));
    }
  }

  handleError(error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the CLI
const cli = new CloudflareSetupCLI();
cli.run();