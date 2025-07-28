import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../utils/logger.js';

export class SharedWorkerManager {
  constructor() {
    this.workerConfig = {
      url: 'api.modernpurairint.com',
      name: 'purair-api-proxy',
      environment: 'production'
    };
  }

  /**
   * Generate instructions for registering a new project with the shared worker
   */
  generateRegistrationInstructions(projectConfig) {
    const { projectKey, projectName, domain, airtableBaseId } = projectConfig;
    
    const instructions = {
      title: 'Shared Worker Registration Steps',
      steps: [
        {
          title: 'Add Environment Variables',
          description: 'Add these secrets to the shared worker',
          commands: [
            `wrangler secret put AIRTABLE_TOKEN_${projectKey} --env production`,
            `wrangler secret put AIRTABLE_BASE_ID_${projectKey} --env production`
          ],
          values: {
            baseId: airtableBaseId || '[Your Airtable Base ID]',
            token: '[Your Airtable Personal Access Token]'
          }
        },
        {
          title: 'Update Allowed Origins',
          description: 'Add your domain to the allowed origins list',
          file: 'wrangler.toml',
          update: {
            field: 'ALLOWED_ORIGINS',
            add: domain
          }
        },
        {
          title: 'Update Frontend Configuration',
          description: 'Configure your frontend to use the shared worker',
          config: {
            apiBaseUrl: `https://${this.workerConfig.url}/api/airtable`,
            projectHeader: `X-PurAir-Project: ${projectKey.toLowerCase().replace(/_/g, '-')}`
          }
        },
        {
          title: 'Test the Connection',
          description: 'Verify the worker can handle requests for your project',
          testUrl: `https://${this.workerConfig.url}/api/debug`,
          expectedResponse: {
            configuredProjects: `Should include ${projectKey}`
          }
        }
      ]
    };

    return instructions;
  }

  /**
   * Generate a registration script for automated setup
   */
  generateRegistrationScript(projectConfig) {
    const { projectKey, projectName, domain } = projectConfig;
    
    return `#!/bin/bash
# Registration script for ${projectName} with shared PurAir API worker

echo "🚀 Registering ${projectName} with shared worker..."

# Set project variables
PROJECT_KEY="${projectKey}"
PROJECT_NAME="${projectName}"
DOMAIN="${domain}"

# Step 1: Add secrets (requires manual input)
echo "📝 Step 1: Adding secrets to shared worker"
echo "You'll be prompted to enter your Airtable credentials"

read -p "Enter your Airtable Base ID: " AIRTABLE_BASE_ID
wrangler secret put AIRTABLE_BASE_ID_\${PROJECT_KEY} --env production <<< "\$AIRTABLE_BASE_ID"

read -s -p "Enter your Airtable Personal Access Token: " AIRTABLE_TOKEN
echo
wrangler secret put AIRTABLE_TOKEN_\${PROJECT_KEY} --env production <<< "\$AIRTABLE_TOKEN"

# Step 2: Update wrangler.toml (manual step)
echo ""
echo "📝 Step 2: Update wrangler.toml"
echo "Add '\${DOMAIN}' to the ALLOWED_ORIGINS in wrangler.toml"
echo "Current line should look like:"
echo 'ALLOWED_ORIGINS = "*.modernpurairint.com,*.purair.com,...,'"\${DOMAIN}"'"'
read -p "Press enter when you've updated wrangler.toml..."

# Step 3: Deploy the updated worker
echo ""
echo "🚀 Step 3: Deploying updated worker"
wrangler deploy --env production

# Step 4: Test the configuration
echo ""
echo "🧪 Step 4: Testing configuration"
curl -s https://${this.workerConfig.url}/api/debug | jq .

echo ""
echo "✅ Registration complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your frontend to use: https://${this.workerConfig.url}/api/airtable"
echo "2. Add header 'X-PurAir-Project: ${projectKey.toLowerCase().replace(/_/g, '-')}' to API requests"
echo "3. Test your application with the shared worker"
`;
  }

  /**
   * Display registration instructions in the terminal
   */
  displayRegistrationInstructions(instructions) {
    console.log('\n' + chalk.blue.bold(instructions.title) + '\n');
    
    instructions.steps.forEach((step, index) => {
      console.log(chalk.green(`${index + 1}. ${step.title}`));
      console.log(chalk.gray(`   ${step.description}`));
      
      if (step.commands) {
        console.log(chalk.yellow('   Commands:'));
        step.commands.forEach(cmd => {
          console.log(`   ${chalk.cyan('$')} ${cmd}`);
        });
      }
      
      if (step.values) {
        console.log(chalk.yellow('   Values:'));
        Object.entries(step.values).forEach(([key, value]) => {
          console.log(`   ${key}: ${chalk.cyan(value)}`);
        });
      }
      
      if (step.config) {
        console.log(chalk.yellow('   Configuration:'));
        Object.entries(step.config).forEach(([key, value]) => {
          console.log(`   ${key}: ${chalk.cyan(value)}`);
        });
      }
      
      console.log('');
    });
  }

  /**
   * Generate checklist markdown for manual steps
   */
  generateChecklist(projectConfig) {
    const { projectKey, projectName, domain } = projectConfig;
    
    return `# Shared Worker Registration Checklist - ${projectName}

## Prerequisites
- [ ] Wrangler CLI installed and authenticated
- [ ] Access to the shared worker repository
- [ ] Airtable API token and Base ID ready

## Registration Steps

### 1. Add Project Secrets
- [ ] Run: \`wrangler secret put AIRTABLE_TOKEN_${projectKey} --env production\`
- [ ] Run: \`wrangler secret put AIRTABLE_BASE_ID_${projectKey} --env production\`

### 2. Update Worker Configuration
- [ ] Open \`wrangler.toml\` in the shared worker repository
- [ ] Add \`${domain}\` to the ALLOWED_ORIGINS list
- [ ] Save the file

### 3. Deploy Updated Worker
- [ ] Run: \`wrangler deploy --env production\`
- [ ] Verify deployment succeeded

### 4. Configure Frontend
- [ ] Update API base URL to: \`https://${this.workerConfig.url}/api/airtable\`
- [ ] Add header to all API requests: \`X-PurAir-Project: ${projectKey.toLowerCase().replace(/_/g, '-')}\`

### 5. Test Configuration
- [ ] Visit: https://${this.workerConfig.url}/api/debug
- [ ] Verify ${projectKey} appears in configuredProjects
- [ ] Test an API call from your application

## Troubleshooting

### API calls failing?
- Check browser console for CORS errors
- Verify domain is in ALLOWED_ORIGINS
- Check project header is being sent

### Project not detected?
- Verify secrets are set correctly
- Check PROJECT_KEY matches in all places
- Review worker logs: \`wrangler tail --env production\`

## Support
For issues, check the shared worker logs or contact the platform team.
`;
  }

  /**
   * Check if a project can use the shared worker
   */
  canUseSharedWorker(projectConfig) {
    // Check if it's an API project using Airtable
    return projectConfig.projectType === 'api' && 
           projectConfig.apiType === 'airtable' &&
           projectConfig.useSharedWorker === true;
  }

  /**
   * Get configuration for frontend to use shared worker
   */
  getFrontendConfig(projectConfig) {
    const { projectKey } = projectConfig;
    
    return {
      apiBaseUrl: `https://${this.workerConfig.url}/api/airtable`,
      headers: {
        'X-PurAir-Project': projectKey.toLowerCase().replace(/_/g, '-')
      },
      // Environment variable configuration
      envVars: {
        VITE_API_BASE_URL: `https://${this.workerConfig.url}/api/airtable`,
        VITE_PROJECT_KEY: projectKey.toLowerCase().replace(/_/g, '-')
      }
    };
  }
}

// Export singleton instance
export const sharedWorkerManager = new SharedWorkerManager();