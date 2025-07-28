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
            name: 'useSharedWorker',
            message: 'Use shared PurAir API proxy worker?',
            default: existingConfig.useSharedWorker !== false,
            when: () => {
              console.log(boxen(
                chalk.yellow('💡 Recommendation') + '\n' +
                chalk.white('Use the shared worker for all PurAir projects\n') +
                chalk.gray('This provides centralized API management'),
                {
                  padding: 1,
                  borderStyle: 'round',
                  borderColor: 'yellow'
                }
              ));
              return true;
            }
          },
          {
            type: 'confirm',
            name: 'useWorkers',
            message: 'Use Cloudflare Workers?',
            default: existingConfig.useWorkers !== false,
            when: (answers) => !answers.useSharedWorker && advancedMode
          },
          {
            type: 'list',
            name: 'apiType',
            message: 'Which API backend?',
            choices: [
              { name: 'Airtable', value: 'airtable' },
              { name: 'Custom API', value: 'custom' },
              { name: 'GraphQL', value: 'graphql' },
              { name: 'REST API', value: 'rest' }
            ],
            default: existingConfig.apiType || 'airtable'
          },
          {
            type: 'confirm',
            name: 'useKV',
            message: 'Include KV storage?',
            default: existingConfig.useKV || false,
            when: (answers) => !answers.useSharedWorker && advancedMode
          },
          {
            type: 'confirm',
            name: 'useDurableObjects',
            message: 'Include Durable Objects?',
            default: existingConfig.useDurableObjects || false,
            when: (answers) => !answers.useSharedWorker && advancedMode
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

  async collectSharedWorkerConfig() {
    console.log(chalk.blue('\nShared Worker Configuration:\n'));
    
    return inquirer.prompt([
      {
        type: 'input',
        name: 'sharedWorkerUrl',
        message: 'Shared worker URL (e.g., api.modernpurairint.com):',
        default: 'api.modernpurairint.com',
        validate: (input) => {
          if (!input) return 'Worker URL is required';
          return true;
        }
      },
      {
        type: 'input',
        name: 'projectKey',
        message: 'Project key (e.g., ADSPEND, SPRINTER):',
        validate: (input) => {
          if (!input) return 'Project key is required';
          if (!/^[A-Z0-9_]+$/.test(input)) {
            return 'Project key must be uppercase letters, numbers, and underscores only';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'needsWorkerSetup',
        message: 'Do you need to add this project to the shared worker?',
        default: true
      }
    ]);
  }

  async selectFromList(message, choices, allowMultiple = false) {
    const { selection } = await inquirer.prompt([
      {
        type: allowMultiple ? 'checkbox' : 'list',
        name: 'selection',
        message,
        choices,
        pageSize: 15
      }
    ]);
    return selection;
  }

  async confirmWithDetails(message, details) {
    console.log(boxen(
      details,
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    ));
    
    const confirmed = await this.confirmAction(message);
    return { proceed: confirmed };
  }

  displayFeatureInfo(feature) {
    const featureDescriptions = {
      'error-pages': 'Custom 404, 500, and other error pages',
      'redirects': 'URL redirects and path rewrites',
      'headers': 'Custom HTTP headers for responses',
      'env-vars': 'Environment variable management',
      'rate-limiting': 'API rate limiting per client',
      'cors': 'Cross-Origin Resource Sharing settings',
      'analytics': 'Cloudflare Analytics integration',
      'ssl': 'SSL/TLS certificate configuration',
      'cache': 'Cache control and purging rules',
      'security-headers': 'Security headers (CSP, HSTS, etc.)'
    };
    
    if (featureDescriptions[feature]) {
      console.log(chalk.gray(`  ℹ️  ${featureDescriptions[feature]}\n`));
    }
  }
}