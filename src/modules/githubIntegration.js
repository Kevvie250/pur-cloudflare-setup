import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { templateEngine } from './templateEngine.js';
import { logger } from '../utils/logger.js';
import { progressIndicator } from '../utils/progressIndicator.js';
import { errorHandler, ErrorCodes } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class GitHubIntegration {
  constructor() {
    this.workflowTemplates = {
      standard: 'deploy-workflow.yml.hbs',
      minimal: 'minimal-workflow.yml.hbs',
      pages: 'pages-workflow.yml.hbs'
    };
    
    this.secretsConfiguration = {
      development: ['CLOUDFLARE_API_TOKEN_DEV'],
      staging: ['CLOUDFLARE_API_TOKEN_STAGING'],
      production: ['CLOUDFLARE_API_TOKEN_PROD']
    };
  }

  /**
   * Generate GitHub Actions workflow for a project
   */
  async generateWorkflow(projectConfig, options = {}) {
    try {
      console.log(chalk.blue.bold('🔧 Generating GitHub Actions Workflow'));
      console.log(chalk.gray(`Project: ${projectConfig.projectName}`));
      console.log('');

      const spinner = progressIndicator.createSpinner('workflow', 'Generating workflow configuration...');

      // Determine workflow template based on project type
      const workflowTemplate = this.selectWorkflowTemplate(projectConfig);
      
      // Prepare template context
      const templateContext = await this.prepareTemplateContext(projectConfig, options);
      
      // Generate workflow content
      const workflowContent = await this.renderWorkflowTemplate(workflowTemplate, templateContext);
      
      // Create workflow directory and file
      const workflowPath = await this.createWorkflowFile(projectConfig.outputPath, workflowContent);
      
      // Generate additional GitHub configuration files
      const additionalFiles = await this.generateAdditionalFiles(projectConfig, templateContext);
      
      progressIndicator.updateSpinner('workflow', 'GitHub Actions workflow generated successfully', 'success');

      return {
        success: true,
        workflowPath,
        additionalFiles,
        templateContext,
        setupInstructions: this.generateSetupInstructions(templateContext)
      };
      
    } catch (error) {
      logger.error('Failed to generate GitHub workflow:', error.message);
      throw errorHandler.createError(ErrorCodes.GENERATION_FAILED, {
        operation: 'GitHub workflow generation',
        details: error.message
      });
    }
  }

  /**
   * Select appropriate workflow template based on project configuration
   */
  selectWorkflowTemplate(projectConfig) {
    if (projectConfig.projectType === 'site' && !projectConfig.useWorkers) {
      return 'pages';
    } else if (projectConfig.projectType === 'api' && projectConfig.useSharedWorker) {
      return 'minimal';
    } else {
      return 'standard';
    }
  }

  /**
   * Prepare template context with all necessary configuration
   */
  async prepareTemplateContext(projectConfig, options) {
    const context = {
      // Basic project information
      projectName: projectConfig.projectName,
      projectType: projectConfig.projectType,
      kebabCase: (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
      
      // Version configuration
      nodeVersion: options.nodeVersion || '20',
      wranglerVersion: options.wranglerVersion || '3',
      
      // Branch configuration
      prodBranch: options.prodBranch || 'main',
      devBranch: options.devBranch || 'develop',
      
      // Environment configuration
      environments: this.determineEnvironments(projectConfig, options),
      defaultEnvironment: options.defaultEnvironment || 'development',
      
      // Feature flags
      hasWrangler: projectConfig.useWorkers || projectConfig.projectType === 'api',
      hasPublicDir: projectConfig.projectType === 'site' || projectConfig.projectType === 'app',
      hasStylesDir: projectConfig.projectType === 'site' || projectConfig.projectType === 'app',
      hasStaging: options.includeStaging !== false,
      useSharedWorker: projectConfig.useSharedWorker === true,
      
      // Build configuration
      buildCommand: this.determineBuildCommand(projectConfig),
      buildOutput: this.determineBuildOutput(projectConfig),
      
      // Shared worker configuration
      sharedWorkerUrl: projectConfig.sharedWorkerUrl || 'https://api.modernpurairint.com',
      projectKey: projectConfig.projectKey || projectConfig.projectName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      
      // API configuration
      apiEndpoints: this.determineApiEndpoints(projectConfig),
      
      // Notification configuration
      notificationWebhook: options.notificationWebhook,
      
      // Helper functions for template
      eq: (a, b) => a === b,
      uppercase: (str) => str.toUpperCase()
    };

    return context;
  }

  /**
   * Determine environments based on project configuration
   */
  determineEnvironments(projectConfig, options) {
    const environments = ['development'];
    
    if (options.includeStaging !== false) {
      environments.push('staging');
    }
    
    environments.push('production');
    
    return environments;
  }

  /**
   * Determine build command based on project type
   */
  determineBuildCommand(projectConfig) {
    switch (projectConfig.projectType) {
      case 'site':
      case 'app':
        return 'npm run build';
      case 'api':
        return projectConfig.useWorkers ? 'npm run build --if-present' : null;
      default:
        return null;
    }
  }

  /**
   * Determine build output directory
   */
  determineBuildOutput(projectConfig) {
    switch (projectConfig.projectType) {
      case 'site':
      case 'app':
        return 'dist';
      case 'api':
        return null; // APIs typically don't have a build output
      default:
        return null;
    }
  }

  /**
   * Determine API endpoints to test
   */
  determineApiEndpoints(projectConfig) {
    if (projectConfig.projectType !== 'api') {
      return null;
    }

    const endpoints = ['/api'];
    
    if (projectConfig.apiType === 'airtable') {
      endpoints.push('/api/records', '/api/health');
    }
    
    return endpoints;
  }

  /**
   * Render workflow template with context
   */
  async renderWorkflowTemplate(templateName, context) {
    try {
      const templatePath = path.join(__dirname, '../../templates/github', this.workflowTemplates[templateName]);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      return templateEngine.render(templateContent, context);
      
    } catch (error) {
      throw new Error(`Failed to render workflow template: ${error.message}`);
    }
  }

  /**
   * Create workflow file in project directory
   */
  async createWorkflowFile(outputPath, workflowContent) {
    try {
      const workflowDir = path.join(outputPath, '.github', 'workflows');
      await fs.mkdir(workflowDir, { recursive: true });
      
      const workflowPath = path.join(workflowDir, 'deploy.yml');
      await fs.writeFile(workflowPath, workflowContent, 'utf8');
      
      logger.info(`GitHub workflow created: ${workflowPath}`);
      return workflowPath;
      
    } catch (error) {
      throw new Error(`Failed to create workflow file: ${error.message}`);
    }
  }

  /**
   * Generate additional GitHub configuration files
   */
  async generateAdditionalFiles(projectConfig, templateContext) {
    const additionalFiles = [];

    try {
      // Generate PR template
      const prTemplate = await this.generatePullRequestTemplate(templateContext);
      if (prTemplate) {
        additionalFiles.push(prTemplate);
      }

      // Generate issue templates
      const issueTemplates = await this.generateIssueTemplates(templateContext);
      additionalFiles.push(...issueTemplates);

      // Generate dependabot configuration
      const dependabotConfig = await this.generateDependabotConfig(templateContext);
      if (dependabotConfig) {
        additionalFiles.push(dependabotConfig);
      }

      // Generate security policy
      const securityPolicy = await this.generateSecurityPolicy(templateContext);
      if (securityPolicy) {
        additionalFiles.push(securityPolicy);
      }

      return additionalFiles;
      
    } catch (error) {
      logger.warn('Some additional GitHub files could not be generated:', error.message);
      return additionalFiles;
    }
  }

  /**
   * Generate pull request template
   */
  async generatePullRequestTemplate(templateContext) {
    try {
      const templateDir = path.join(templateContext.outputPath || '.', '.github');
      await fs.mkdir(templateDir, { recursive: true });
      
      const prTemplateContent = `## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Configuration change

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Deployment
- [ ] Ready for ${templateContext.environments[0]} deployment
${templateContext.environments.length > 1 ? `- [ ] Ready for ${templateContext.environments[templateContext.environments.length - 1]} deployment` : ''}

${templateContext.useSharedWorker ? `## Shared Worker
- [ ] No shared worker configuration changes required
- [ ] Shared worker registration updated (if needed)` : ''}

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No sensitive data exposed
`;

      const prTemplatePath = path.join(templateDir, 'pull_request_template.md');
      await fs.writeFile(prTemplatePath, prTemplateContent, 'utf8');
      
      return {
        type: 'pr_template',
        path: prTemplatePath,
        name: 'Pull Request Template'
      };
      
    } catch (error) {
      logger.warn('Failed to generate PR template:', error.message);
      return null;
    }
  }

  /**
   * Generate issue templates
   */
  async generateIssueTemplates(templateContext) {
    const templates = [];
    
    try {
      const templateDir = path.join(templateContext.outputPath || '.', '.github', 'ISSUE_TEMPLATE');
      await fs.mkdir(templateDir, { recursive: true });
      
      // Bug report template
      const bugReportContent = `---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment**
- Environment: [e.g., production, staging, development]
- Browser: [e.g., chrome, safari]
- Version: [e.g., 22]

**Additional context**
Add any other context about the problem here.
`;

      const bugReportPath = path.join(templateDir, 'bug_report.md');
      await fs.writeFile(bugReportPath, bugReportContent, 'utf8');
      templates.push({
        type: 'issue_template',
        path: bugReportPath,
        name: 'Bug Report Template'
      });

      // Feature request template
      const featureRequestContent = `---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
`;

      const featureRequestPath = path.join(templateDir, 'feature_request.md');
      await fs.writeFile(featureRequestPath, featureRequestContent, 'utf8');
      templates.push({
        type: 'issue_template',
        path: featureRequestPath,
        name: 'Feature Request Template'
      });

      return templates;
      
    } catch (error) {
      logger.warn('Failed to generate issue templates:', error.message);
      return [];
    }
  }

  /**
   * Generate Dependabot configuration
   */
  async generateDependabotConfig(templateContext) {
    try {
      const dependabotDir = path.join(templateContext.outputPath || '.', '.github');
      await fs.mkdir(dependabotDir, { recursive: true });
      
      const dependabotContent = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    reviewers:
      - "${templateContext.projectName}-team"
    assignees:
      - "${templateContext.projectName}-team"
    commit-message:
      prefix: "deps"
      include: "scope"
`;

      const dependabotPath = path.join(dependabotDir, 'dependabot.yml');
      await fs.writeFile(dependabotPath, dependabotContent, 'utf8');
      
      return {
        type: 'dependabot_config',
        path: dependabotPath,
        name: 'Dependabot Configuration'
      };
      
    } catch (error) {
      logger.warn('Failed to generate Dependabot config:', error.message);
      return null;
    }
  }

  /**
   * Generate security policy
   */
  async generateSecurityPolicy(templateContext) {
    try {
      const securityContent = `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ${templateContext.projectName}, please report it by:

1. **DO NOT** create a public GitHub issue
2. Send an email to the project maintainers
3. Include as much information as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

This project implements several security measures:

- Regular dependency updates via Dependabot
- Automated security scanning in CI/CD
- Input validation and sanitization
- Secure secrets management
${templateContext.useSharedWorker ? '- Shared worker with CORS protection' : ''}

## Response Time

We aim to respond to security reports within 48 hours and provide a fix within 7 days for critical vulnerabilities.
`;

      const securityPath = path.join(templateContext.outputPath || '.', 'SECURITY.md');
      await fs.writeFile(securityPath, securityContent, 'utf8');
      
      return {
        type: 'security_policy',
        path: securityPath,
        name: 'Security Policy'
      };
      
    } catch (error) {
      logger.warn('Failed to generate security policy:', error.message);
      return null;
    }
  }

  /**
   * Generate setup instructions for GitHub Actions
   */
  generateSetupInstructions(templateContext) {
    const instructions = {
      title: 'GitHub Actions Setup Instructions',
      steps: []
    };

    // Repository secrets setup
    instructions.steps.push({
      title: 'Configure Repository Secrets',
      description: 'Add the following secrets to your GitHub repository',
      items: [
        {
          name: 'CLOUDFLARE_API_TOKEN_DEV',
          description: 'Cloudflare API token for development environment',
          required: templateContext.environments.includes('development')
        },
        {
          name: 'CLOUDFLARE_API_TOKEN_STAGING',
          description: 'Cloudflare API token for staging environment',
          required: templateContext.environments.includes('staging')
        },
        {
          name: 'CLOUDFLARE_API_TOKEN_PROD',
          description: 'Cloudflare API token for production environment',
          required: templateContext.environments.includes('production')
        }
      ].filter(item => item.required)
    });

    // Environment setup
    instructions.steps.push({
      title: 'Configure GitHub Environments',
      description: 'Create environments in your repository settings',
      items: templateContext.environments.map(env => ({
        name: env,
        description: `${env.charAt(0).toUpperCase() + env.slice(1)} environment`,
        protectionRules: env === 'production' ? [
          'Required reviewers: 1',
          'Wait timer: 5 minutes',
          'Restrict to protected branches'
        ] : []
      }))
    });

    // Branch protection rules
    if (templateContext.prodBranch || templateContext.devBranch) {
      instructions.steps.push({
        title: 'Set Up Branch Protection',
        description: 'Configure branch protection rules',
        items: [
          {
            branch: templateContext.prodBranch || 'main',
            rules: [
              'Require pull request reviews',
              'Require status checks to pass',
              'Require up-to-date branches',
              'Include administrators'
            ]
          }
        ]
      });
    }

    // Shared worker setup (if applicable)
    if (templateContext.useSharedWorker) {
      instructions.steps.push({
        title: 'Shared Worker Configuration',
        description: 'Register project with shared worker',
        items: [
          {
            name: 'Register Project',
            description: `Add project key '${templateContext.projectKey}' to shared worker configuration`
          },
          {
            name: 'Update CORS Origins',
            description: 'Add your domain to the shared worker CORS origins'
          },
          {
            name: 'Configure Secrets',
            description: 'Add Airtable credentials to shared worker secrets'
          }
        ]
      });
    }

    return instructions;
  }

  /**
   * Display setup instructions in terminal
   */
  displaySetupInstructions(instructions) {
    console.log('\n' + chalk.blue.bold(instructions.title));
    console.log(chalk.gray('Follow these steps to complete your GitHub Actions setup:'));
    console.log('');

    instructions.steps.forEach((step, stepIndex) => {
      console.log(chalk.green.bold(`${stepIndex + 1}. ${step.title}`));
      console.log(chalk.gray(`   ${step.description}`));
      
      if (step.items) {
        step.items.forEach((item, itemIndex) => {
          if (typeof item === 'string') {
            console.log(`   ${chalk.cyan('•')} ${item}`);
          } else if (item.name) {
            console.log(`   ${chalk.cyan('•')} ${chalk.bold(item.name)}: ${item.description}`);
            if (item.rules) {
              item.rules.forEach(rule => {
                console.log(`     ${chalk.gray('◦')} ${rule}`);
              });
            }
            if (item.protectionRules && item.protectionRules.length > 0) {
              console.log(`     ${chalk.yellow('Protection rules:')}`);
              item.protectionRules.forEach(rule => {
                console.log(`     ${chalk.gray('◦')} ${rule}`);
              });
            }
          } else if (item.branch) {
            console.log(`   ${chalk.cyan('•')} ${chalk.bold(item.branch)} branch:`);
            item.rules.forEach(rule => {
              console.log(`     ${chalk.gray('◦')} ${rule}`);
            });
          }
        });
      }
      
      console.log('');
    });

    // Additional notes
    console.log(chalk.yellow.bold('📝 Important Notes:'));
    console.log(chalk.yellow('   • API tokens should have appropriate permissions for your Cloudflare account'));
    console.log(chalk.yellow('   • Test the workflow with a small change before deploying to production'));
    console.log(chalk.yellow('   • Monitor the Actions tab for deployment status and logs'));
    if (instructions.steps.some(step => step.title.includes('Shared Worker'))) {
      console.log(chalk.yellow('   • Shared worker setup requires coordination with the platform team'));
    }
    console.log('');
  }

  /**
   * Validate GitHub repository configuration
   */
  async validateRepositorySetup(repositoryConfig) {
    const validationResults = [];

    try {
      // Validate repository structure
      const requiredPaths = [
        '.github/workflows',
        'package.json'
      ];

      for (const requiredPath of requiredPaths) {
        try {
          await fs.access(path.join(repositoryConfig.path, requiredPath));
          validationResults.push({
            item: requiredPath,
            status: 'success',
            message: 'Present'
          });
        } catch {
          validationResults.push({
            item: requiredPath,
            status: 'error',
            message: 'Missing'
          });
        }
      }

      // Validate workflow file
      const workflowPath = path.join(repositoryConfig.path, '.github/workflows/deploy.yml');
      try {
        const workflowContent = await fs.readFile(workflowPath, 'utf8');
        if (workflowContent.includes('name:') && workflowContent.includes('on:')) {
          validationResults.push({
            item: 'Workflow Configuration',
            status: 'success',
            message: 'Valid YAML structure'
          });
        } else {
          validationResults.push({
            item: 'Workflow Configuration',
            status: 'error',
            message: 'Invalid workflow structure'
          });
        }
      } catch {
        validationResults.push({
          item: 'Workflow Configuration',
          status: 'error',
          message: 'Workflow file not found'
        });
      }

      return {
        valid: !validationResults.some(r => r.status === 'error'),
        results: validationResults
      };

    } catch (error) {
      logger.error('Repository validation failed:', error.message);
      return {
        valid: false,
        results: [{
          item: 'Repository Access',
          status: 'error',
          message: error.message
        }]
      };
    }
  }

  /**
   * Generate deployment status badge markdown
   */
  generateStatusBadge(repositoryConfig, environment = 'production') {
    const { owner, repo } = repositoryConfig;
    const workflowName = 'deploy.yml';
    
    return `[![Deploy ${environment}](https://github.com/${owner}/${repo}/workflows/${encodeURIComponent(workflowName)}/badge.svg?branch=main)](https://github.com/${owner}/${repo}/actions)`;
  }

  /**
   * Create GitHub repository automation script
   */
  async generateRepositoryScript(projectConfig, templateContext) {
    const scriptContent = `#!/bin/bash
# GitHub repository setup script for ${projectConfig.projectName}

set -e

echo "🚀 Setting up GitHub repository for ${projectConfig.projectName}..."

# Verify git repository
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Initialize with: git init"
    exit 1
fi

# Add all files
echo "📝 Adding project files..."
git add .

# Create initial commit
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "📝 Creating initial commit..."
    git commit -m "Initial commit: ${projectConfig.projectName} setup

Generated with PurAir Cloudflare Setup Tool
- Project type: ${projectConfig.projectType}
- GitHub Actions workflow configured
${templateContext.useSharedWorker ? '- Shared worker integration enabled' : ''}
- Multi-environment deployment ready"
fi

# Create and push branches
echo "🌳 Setting up branches..."
if [ "\$(git branch --show-current)" != "${templateContext.prodBranch}" ]; then
    git checkout -b ${templateContext.prodBranch} 2>/dev/null || git checkout ${templateContext.prodBranch}
fi

${templateContext.devBranch !== templateContext.prodBranch ? `
if ! git show-ref --verify --quiet refs/heads/${templateContext.devBranch}; then
    echo "Creating ${templateContext.devBranch} branch..."
    git checkout -b ${templateContext.devBranch}
    git checkout ${templateContext.prodBranch}
fi
` : ''}

# Push to remote (if configured)
if git remote get-url origin >/dev/null 2>&1; then
    echo "📤 Pushing to remote repository..."
    git push -u origin ${templateContext.prodBranch}
    ${templateContext.devBranch !== templateContext.prodBranch ? `git push -u origin ${templateContext.devBranch}` : ''}
else
    echo "⚠️  No remote origin configured. Add with:"
    echo "   git remote add origin https://github.com/your-username/your-repo.git"
    echo "   git push -u origin ${templateContext.prodBranch}"
fi

echo ""
echo "✅ Repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure repository secrets in GitHub:"
${templateContext.environments.map(env => 
  `echo "   - CLOUDFLARE_API_TOKEN_${env.toUpperCase()}"`
).join('\n')}
echo "2. Set up GitHub environments: ${templateContext.environments.join(', ')}"
echo "3. Configure branch protection for ${templateContext.prodBranch}"
${templateContext.useSharedWorker ? 'echo "4. Register project with shared worker"' : ''}
echo ""
echo "🔗 Repository URL: \$(git remote get-url origin 2>/dev/null || echo 'Not configured')"
`;

    const scriptPath = path.join(projectConfig.outputPath, 'setup-github.sh');
    await fs.writeFile(scriptPath, scriptContent, 'utf8');
    await fs.chmod(scriptPath, '755'); // Make executable

    return {
      path: scriptPath,
      name: 'GitHub Repository Setup Script'
    };
  }
}

// Export singleton instance
export const githubIntegration = new GitHubIntegration();

// Convenience functions
export async function generateGitHubWorkflow(projectConfig, options = {}) {
  return await githubIntegration.generateWorkflow(projectConfig, options);
}

export function displayGitHubSetupInstructions(instructions) {
  githubIntegration.displaySetupInstructions(instructions);
}