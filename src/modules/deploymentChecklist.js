import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import ora from 'ora';
import { progressIndicator } from '../utils/progressIndicator.js';

export class DeploymentChecklist {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
    this.startTime = null;
    this.stepTimings = [];
  }

  // Initialize checklist for project type
  initializeChecklist(config) {
    this.steps = this.getStepsForProjectType(config);
    this.startTime = Date.now();
    return this.steps;
  }

  // Get steps based on project configuration
  getStepsForProjectType(config) {
    const commonSteps = [
      {
        id: 'validate-config',
        name: 'Validate configuration',
        description: 'Check all settings and connections',
        required: true,
        estimatedTime: 5,
        action: 'validateConfiguration'
      },
      {
        id: 'create-directories',
        name: 'Create project directories',
        description: 'Set up folder structure',
        required: true,
        estimatedTime: 2,
        action: 'createDirectories'
      },
      {
        id: 'generate-files',
        name: 'Generate project files',
        description: 'Create configuration and source files',
        required: true,
        estimatedTime: 10,
        action: 'generateFiles'
      },
      {
        id: 'install-dependencies',
        name: 'Install dependencies',
        description: 'Download and install npm packages',
        required: true,
        estimatedTime: 30,
        action: 'installDependencies'
      }
    ];

    const apiSteps = [
      {
        id: 'setup-worker',
        name: 'Configure Cloudflare Worker',
        description: 'Set up worker script and bindings',
        required: config.useWorkers,
        estimatedTime: 10,
        action: 'setupWorker'
      },
      {
        id: 'configure-api',
        name: 'Configure API endpoints',
        description: 'Set up routing and middleware',
        required: true,
        estimatedTime: 5,
        action: 'configureAPI'
      }
    ];

    const siteSteps = [
      {
        id: 'setup-pages',
        name: 'Configure Cloudflare Pages',
        description: 'Set up Pages deployment',
        required: config.usePages,
        estimatedTime: 10,
        action: 'setupPages'
      },
      {
        id: 'build-assets',
        name: 'Build static assets',
        description: 'Compile CSS and JavaScript',
        required: config.buildStep,
        estimatedTime: 15,
        action: 'buildAssets'
      }
    ];

    const deploymentSteps = [
      {
        id: 'test-local',
        name: 'Test local development',
        description: 'Verify project runs locally',
        required: false,
        estimatedTime: 5,
        action: 'testLocal'
      },
      {
        id: 'deploy-preview',
        name: 'Deploy to preview',
        description: 'Create preview deployment',
        required: false,
        estimatedTime: 20,
        action: 'deployPreview'
      },
      {
        id: 'final-checks',
        name: 'Final verification',
        description: 'Confirm everything is working',
        required: true,
        estimatedTime: 5,
        action: 'finalChecks'
      }
    ];

    // Build step list based on project type
    let steps = [...commonSteps];

    if (config.projectType === 'api' || config.projectType === 'app') {
      steps = [...steps, ...apiSteps];
    }

    if (config.projectType === 'site' || config.projectType === 'app') {
      steps = [...steps, ...siteSteps];
    }

    steps = [...steps, ...deploymentSteps];

    // Filter out steps that aren't required
    return steps.filter(step => step.required !== false);
  }

  // Display interactive checklist (SECURE)
  async displayChecklist() {
    // SECURITY: Only clear screen in interactive environments, not CI/CD
    this.safeClearScreen();
    console.log(boxen(
      chalk.bold.cyan('📋 Deployment Checklist') + '\n' +
      chalk.gray('Track your deployment progress'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));

    const totalSteps = this.steps.length;
    const completedSteps = this.steps.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    // Progress bar
    const progressBar = this.createProgressBar(progress);
    console.log(`\n${chalk.bold('Overall Progress:')} ${progressBar} ${chalk.yellow(`${progress}%`)}\n`);

    // Display steps
    this.steps.forEach((step, index) => {
      const icon = this.getStepIcon(step);
      const name = this.getStepName(step, index);
      const timing = step.timing ? chalk.gray(` (${step.timing}s)`) : '';
      
      console.log(`${icon} ${name}${timing}`);
      
      if (step.status === 'in-progress' && step.substeps) {
        step.substeps.forEach(substep => {
          console.log(chalk.gray(`   ${substep}`));
        });
      }
      
      if (step.error) {
        console.log(chalk.red(`   ❌ ${step.error}`));
      }
    });

    // Time estimate
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const remaining = this.estimateRemainingTime();
    
    console.log('\n' + chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`Elapsed: ${this.formatTime(elapsed)} | Remaining: ${this.formatTime(remaining)}`));
  }

  // Create visual progress bar
  createProgressBar(percentage) {
    const width = 30;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  // Get icon for step status
  getStepIcon(step) {
    switch (step.status) {
      case 'completed':
        return chalk.green('✓');
      case 'in-progress':
        return chalk.yellow('▶');
      case 'failed':
        return chalk.red('✗');
      case 'skipped':
        return chalk.gray('○');
      default:
        return chalk.gray('○');
    }
  }

  // Get formatted step name
  getStepName(step, index) {
    const number = chalk.gray(`${(index + 1).toString().padStart(2, '0')}.`);
    const name = step.status === 'completed' ? chalk.green(step.name) :
                 step.status === 'in-progress' ? chalk.yellow(step.name) :
                 step.status === 'failed' ? chalk.red(step.name) :
                 chalk.gray(step.name);
    
    return `${number} ${name}`;
  }

  // Start a step
  async startStep(stepId, substeps = []) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'in-progress';
    step.startTime = Date.now();
    step.substeps = substeps;
    
    await this.displayChecklist();
  }

  // Complete a step
  async completeStep(stepId, success = true, error = null) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = success ? 'completed' : 'failed';
    step.error = error;
    step.timing = Math.round((Date.now() - step.startTime) / 1000);
    
    this.stepTimings.push({
      step: step.name,
      timing: step.timing,
      success
    });

    await this.displayChecklist();
  }

  // Skip a step
  async skipStep(stepId, reason) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'skipped';
    step.skipReason = reason;
    
    await this.displayChecklist();
  }

  // Interactive step execution
  async executeStep(stepId, executor) {
    await this.startStep(stepId);
    
    try {
      const result = await executor();
      await this.completeStep(stepId, true);
      return result;
    } catch (error) {
      await this.completeStep(stepId, false, error.message);
      throw error;
    }
  }

  // Manual step override
  async promptManualOverride(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step || step.status === 'completed') return;

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `Override step "${step.name}"?`,
        choices: [
          { name: 'Mark as completed', value: 'complete' },
          { name: 'Skip this step', value: 'skip' },
          { name: 'Retry', value: 'retry' },
          { name: 'Continue', value: 'continue' }
        ]
      }
    ]);

    switch (action) {
      case 'complete':
        await this.completeStep(stepId, true);
        break;
      case 'skip':
        await this.skipStep(stepId, 'Manually skipped');
        break;
      case 'retry':
        step.status = 'pending';
        await this.displayChecklist();
        break;
    }

    return action;
  }

  // Estimate remaining time
  estimateRemainingTime() {
    const remainingSteps = this.steps.filter(s => 
      s.status !== 'completed' && s.status !== 'skipped'
    );
    
    return remainingSteps.reduce((total, step) => total + step.estimatedTime, 0);
  }

  // Format time display
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  }

  // Generate final report
  generateReport() {
    const completedSteps = this.steps.filter(s => s.status === 'completed').length;
    const failedSteps = this.steps.filter(s => s.status === 'failed').length;
    const skippedSteps = this.steps.filter(s => s.status === 'skipped').length;
    const totalTime = Math.round((Date.now() - this.startTime) / 1000);

    const report = {
      summary: {
        total: this.steps.length,
        completed: completedSteps,
        failed: failedSteps,
        skipped: skippedSteps,
        success: failedSteps === 0
      },
      timing: {
        total: totalTime,
        average: Math.round(totalTime / completedSteps),
        details: this.stepTimings
      },
      failures: this.steps
        .filter(s => s.status === 'failed')
        .map(s => ({ step: s.name, error: s.error }))
    };

    // Display report
    console.log(boxen(
      chalk.bold('Deployment Summary') + '\n\n' +
      `${chalk.green('✓ Completed:')} ${completedSteps}\n` +
      `${chalk.red('✗ Failed:')} ${failedSteps}\n` +
      `${chalk.gray('○ Skipped:')} ${skippedSteps}\n\n` +
      `${chalk.blue('Total time:')} ${this.formatTime(totalTime)}`,
      {
        padding: 1,
        borderStyle: 'double',
        borderColor: report.summary.success ? 'green' : 'yellow'
      }
    ));

    return report;
  }

  // Save checklist state
  saveState() {
    return {
      steps: this.steps,
      currentStep: this.currentStep,
      startTime: this.startTime,
      stepTimings: this.stepTimings
    };
  }

  // Restore checklist state
  restoreState(state) {
    this.steps = state.steps;
    this.currentStep = state.currentStep;
    this.startTime = state.startTime;
    this.stepTimings = state.stepTimings;
  }

  // SECURITY: Safe screen clearing for production environments
  safeClearScreen() {
    // Check for CI/CD environment variables
    const isCI = process.env.CI || 
                 process.env.CONTINUOUS_INTEGRATION || 
                 process.env.GITHUB_ACTIONS ||
                 process.env.GITLAB_CI ||
                 process.env.JENKINS_URL ||
                 process.env.BUILDKITE ||
                 process.env.TRAVIS;
    
    // Check if running in a non-interactive environment
    const isNonInteractive = !process.stdout.isTTY || 
                             process.env.NODE_ENV === 'production';
    
    if (isCI || isNonInteractive) {
      // In CI/CD or non-interactive environments, just add separators
      console.log('\n' + '═'.repeat(80));
      console.log('DEPLOYMENT CHECKLIST UPDATE');
      console.log('═'.repeat(80) + '\n');
    } else {
      // Safe to clear screen in interactive environments
      try {
        console.clear();
      } catch (error) {
        // Fallback if console.clear() fails
        console.log('\n'.repeat(50));
      }
    }
  }
}

// Singleton instance
export const deploymentChecklist = new DeploymentChecklist();

// Helper function for step execution with checklist
export async function withChecklist(stepId, executor) {
  return deploymentChecklist.executeStep(stepId, executor);
}