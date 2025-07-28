import inquirer from 'inquirer';
import chalk from 'chalk';
import { validateProjectName, validateDomain, validateEmail } from '../utils/validation.js';

export class PromptManager {
  constructor() {
    this.projectTypes = [
      { name: 'Static Website', value: 'site' },
      { name: 'API Service', value: 'api' },
      { name: 'Full Stack Application', value: 'app' }
    ];

    this.commonFeatures = [
      { name: 'Custom error pages', value: 'error-pages' },
      { name: 'Redirects configuration', value: 'redirects' },
      { name: 'Headers configuration', value: 'headers' },
      { name: 'Environment variables', value: 'env-vars' },
      { name: 'Rate limiting', value: 'rate-limiting' },
      { name: 'CORS configuration', value: 'cors' }
    ];

    this.environments = [
      { name: 'Development', value: 'development' },
      { name: 'Staging', value: 'staging' },
      { name: 'Production', value: 'production' }
    ];
  }

  async collectProjectInfo(existingConfig = {}) {
    console.log(chalk.blue('Please provide project information:\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: existingConfig.projectName,
        validate: (input) => {
          if (!input) return 'Project name is required';
          if (!validateProjectName(input)) {
            return 'Invalid project name. Use lowercase letters, numbers, and hyphens only.';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'domain',
        message: 'Domain name:',
        default: existingConfig.domain,
        validate: (input) => {
          if (!input) return 'Domain name is required';
          if (!validateDomain(input)) {
            return 'Invalid domain name format.';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'Project type:',
        choices: this.projectTypes,
        default: existingConfig.projectType || 'site'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: this.commonFeatures,
        default: existingConfig.features || []
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Initial environment:',
        choices: this.environments,
        default: existingConfig.environment || 'development'
      },
      {
        type: 'confirm',
        name: 'useWrangler',
        message: 'Use Wrangler for deployment?',
        default: existingConfig.useWrangler !== false
      }
    ]);

    // Additional prompts based on project type
    const typeSpecificAnswers = await this.getTypeSpecificPrompts(answers.projectType, existingConfig);

    return { ...answers, ...typeSpecificAnswers };
  }

  async getTypeSpecificPrompts(projectType, existingConfig = {}) {
    const prompts = [];

    switch (projectType) {
      case 'api':
        prompts.push(
          {
            type: 'confirm',
            name: 'useWorkers',
            message: 'Use Cloudflare Workers?',
            default: existingConfig.useWorkers !== false
          },
          {
            type: 'confirm',
            name: 'useKV',
            message: 'Include KV storage?',
            default: existingConfig.useKV || false
          },
          {
            type: 'confirm',
            name: 'useDurableObjects',
            message: 'Include Durable Objects?',
            default: existingConfig.useDurableObjects || false
          }
        );
        break;

      case 'app':
        prompts.push(
          {
            type: 'list',
            name: 'framework',
            message: 'Frontend framework:',
            choices: [
              { name: 'React', value: 'react' },
              { name: 'Vue', value: 'vue' },
              { name: 'Next.js', value: 'nextjs' },
              { name: 'Nuxt', value: 'nuxt' },
              { name: 'SvelteKit', value: 'sveltekit' },
              { name: 'None (Vanilla)', value: 'vanilla' }
            ],
            default: existingConfig.framework || 'react'
          },
          {
            type: 'confirm',
            name: 'usePages',
            message: 'Deploy with Cloudflare Pages?',
            default: existingConfig.usePages !== false
          }
        );
        break;

      case 'site':
        prompts.push(
          {
            type: 'confirm',
            name: 'usePages',
            message: 'Deploy with Cloudflare Pages?',
            default: existingConfig.usePages !== false
          },
          {
            type: 'confirm',
            name: 'buildStep',
            message: 'Does this site require a build step?',
            default: existingConfig.buildStep || false
          }
        );
        break;
    }

    if (prompts.length === 0) return {};
    return inquirer.prompt(prompts);
  }

  async askSaveConfig() {
    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveConfig',
        message: 'Save this configuration for future use?',
        default: true
      }
    ]);
  }

  async askConfigName() {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'configName',
        message: 'Configuration name:',
        validate: (input) => {
          if (!input) return 'Configuration name is required';
          if (!validateProjectName(input)) {
            return 'Invalid name. Use lowercase letters, numbers, and hyphens only.';
          }
          return true;
        }
      }
    ]);
  }

  async confirmAction(message) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: false
      }
    ]);
    return confirmed;
  }

  async selectFromList(message, choices) {
    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message,
        choices
      }
    ]);
    return selection;
  }
}