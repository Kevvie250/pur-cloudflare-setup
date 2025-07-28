/**
 * PurAir Cloudflare Deployment Automation Suite
 * 
 * This module provides comprehensive deployment automation for Cloudflare Workers and Pages,
 * including CI/CD integration and deployment verification.
 */

export { 
  DeploymentAutomation, 
  deploymentAutomation, 
  deployProject 
} from './deploy.js';

export { 
  CIDeploymentManager, 
  ciDeploymentManager, 
  runCIDeployment 
} from './ci-deploy.js';

export { 
  DeploymentVerifier, 
  deploymentVerifier, 
  verifyDeployment, 
  quickHealthCheck 
} from './verify-deployment.js';

/**
 * Unified deployment workflow
 * Combines all deployment steps into a single, streamlined process
 */
export class UnifiedDeploymentWorkflow {
  constructor() {
    this.deploymentAutomation = deploymentAutomation;
    this.ciDeploymentManager = ciDeploymentManager;
    this.deploymentVerifier = deploymentVerifier;
  }

  /**
   * Complete deployment workflow with verification
   */
  async deployWithVerification(projectPath, options = {}) {
    try {
      // Step 1: Deploy the project
      const deploymentResult = await this.deploymentAutomation.deployProject(projectPath, options);

      // Step 2: Verify the deployment if URL is available
      if (deploymentResult.result && deploymentResult.result.url && !options.dryRun) {
        const verificationOptions = {
          responseTimeThreshold: options.responseTimeThreshold || 2000,
          ttfbThreshold: options.ttfbThreshold || 800,
          stopOnFailure: options.stopOnVerificationFailure || false,
          apiTests: options.apiTests || []
        };

        const verificationResult = await this.deploymentVerifier.verifyDeployment(
          deploymentResult.result.url,
          verificationOptions
        );

        return {
          ...deploymentResult,
          verification: verificationResult
        };
      }

      return deploymentResult;

    } catch (error) {
      throw new Error(`Unified deployment failed: ${error.message}`);
    }
  }

  /**
   * CI deployment with verification
   */
  async runCIDeploymentWithVerification(options = {}) {
    try {
      // Step 1: Run CI deployment
      const ciResult = await this.ciDeploymentManager.runCIDeployment(options);

      // Step 2: Verify the deployment
      if (ciResult.result && ciResult.result.url && !options.dryRun) {
        const verificationResult = await this.deploymentVerifier.verifyDeployment(
          ciResult.result.url,
          {
            responseTimeThreshold: 3000, // More lenient for CI
            stopOnFailure: false // Don't fail CI on verification issues
          }
        );

        return {
          ...ciResult,
          verification: verificationResult
        };
      }

      return ciResult;

    } catch (error) {
      throw new Error(`CI deployment with verification failed: ${error.message}`);
    }
  }

  /**
   * Generate deployment scripts for different scenarios
   */
  generateDeploymentScripts(projectConfig) {
    const scripts = {};

    // Basic deployment script
    scripts.deploy = `#!/bin/bash
# Basic deployment script
set -e

echo "🚀 Starting deployment..."
node src/deployment/deploy.js

echo "✅ Deployment completed!"
`;

    // CI deployment script
    scripts.ciDeploy = `#!/bin/bash
# CI deployment script
set -e

echo "🤖 Starting CI deployment..."
node src/deployment/ci-deploy.js

echo "✅ CI deployment completed!"
`;

    // Deployment with verification
    scripts.deployAndVerify = `#!/bin/bash
# Deployment with verification script
set -e

echo "🚀 Starting deployment with verification..."

# Deploy
node src/deployment/deploy.js

# Get the deployment URL (you'll need to extract this from deploy output)
DEPLOYMENT_URL=$(grep -o 'https://[^[:space:]]*' .deployment-reports/deploy_*.json | tail -1)

if [ ! -z "$DEPLOYMENT_URL" ]; then
  echo "🔍 Verifying deployment at $DEPLOYMENT_URL"
  node src/deployment/verify-deployment.js "$DEPLOYMENT_URL"
else
  echo "⚠️  Could not determine deployment URL for verification"
fi

echo "✅ Deployment and verification completed!"
`;

    // Package.json scripts
    scripts.packageJsonScripts = {
      "deploy": "node src/deployment/deploy.js",
      "deploy:ci": "node src/deployment/ci-deploy.js", 
      "deploy:verify": "npm run deploy && npm run verify:last",
      "verify": "node src/deployment/verify-deployment.js",
      "verify:last": "node -e 'const fs=require(\"fs\");const files=fs.readdirSync(\".deployment-reports\");const latest=files.sort().pop();const report=JSON.parse(fs.readFileSync(\".deployment-reports/\"+latest));if(report.url){require(\"child_process\").exec(\"node src/deployment/verify-deployment.js \"+report.url);}else{console.log(\"No URL found in latest deployment report\");}'",
      "deploy:staging": "ENVIRONMENT=staging npm run deploy",
      "deploy:production": "ENVIRONMENT=production npm run deploy"
    };

    return scripts;
  }

  /**
   * Generate GitHub Actions workflow
   */
  generateGitHubActionsWorkflow(projectConfig = {}) {
    return this.ciDeploymentManager.generateGitHubWorkflow(projectConfig);
  }

  /**
   * Generate GitLab CI configuration  
   */
  generateGitLabCIConfig(projectConfig = {}) {
    return this.ciDeploymentManager.generateGitLabCI(projectConfig);
  }
}

// Export singleton instance
export const unifiedDeploymentWorkflow = new UnifiedDeploymentWorkflow();

/**
 * Convenience functions for common deployment scenarios
 */

/**
 * Deploy and verify a project in one step
 */
export async function deployAndVerify(projectPath, options = {}) {
  return await unifiedDeploymentWorkflow.deployWithVerification(projectPath, options);
}

/**
 * Run CI deployment with verification
 */
export async function runFullCIDeployment(options = {}) {
  return await unifiedDeploymentWorkflow.runCIDeploymentWithVerification(options);
}

/**
 * Quick deployment health check
 */
export async function healthCheck(deploymentUrl) {
  return await quickHealthCheck(deploymentUrl);
}

/**
 * Generate all deployment automation files for a project
 */
export async function generateDeploymentFiles(projectPath, projectConfig = {}) {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const scriptsDir = path.join(projectPath, 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });

  const workflowsDir = path.join(projectPath, '.github/workflows');
  await fs.mkdir(workflowsDir, { recursive: true });

  const scripts = unifiedDeploymentWorkflow.generateDeploymentScripts(projectConfig);

  // Write shell scripts
  await fs.writeFile(path.join(scriptsDir, 'deploy.sh'), scripts.deploy, { mode: 0o755 });
  await fs.writeFile(path.join(scriptsDir, 'ci-deploy.sh'), scripts.ciDeploy, { mode: 0o755 });
  await fs.writeFile(path.join(scriptsDir, 'deploy-and-verify.sh'), scripts.deployAndVerify, { mode: 0o755 });

  // Write GitHub Actions workflow
  const workflow = unifiedDeploymentWorkflow.generateGitHubActionsWorkflow(projectConfig);
  await fs.writeFile(path.join(workflowsDir, 'deploy.yml'), workflow);

  // Update package.json with scripts
  const packageJsonPath = path.join(projectPath, 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    packageJson.scripts = {
      ...packageJson.scripts,
      ...scripts.packageJsonScripts
    };
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.warn('Could not update package.json scripts:', error.message);
  }

  return {
    scriptsGenerated: [
      'scripts/deploy.sh',
      'scripts/ci-deploy.sh', 
      'scripts/deploy-and-verify.sh',
      '.github/workflows/deploy.yml'
    ],
    packageJsonUpdated: true
  };
}

// Default export for convenience
export default {
  DeploymentAutomation,
  CIDeploymentManager,
  DeploymentVerifier,
  UnifiedDeploymentWorkflow,
  deployProject,
  runCIDeployment,
  verifyDeployment,
  deployAndVerify,
  runFullCIDeployment,
  healthCheck,
  generateDeploymentFiles
};