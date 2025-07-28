import cliProgress from 'cli-progress';
import chalk from 'chalk';
import ora from 'ora';

export class ProgressIndicator {
  constructor() {
    this.activeSpinners = new Map();
    this.progressBars = new Map();
    this.activeTimers = new Set(); // SECURITY: Track timers for cleanup
  }

  // Create a progress bar with custom styling
  createProgressBar(name, total, options = {}) {
    const bar = new cliProgress.SingleBar({
      format: options.format || `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | {value}/{total} ${options.unit || 'Files'} | ${chalk.gray('{task}')}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      ...options
    }, cliProgress.Presets.shades_classic);

    bar.start(total, 0, {
      task: options.initialTask || 'Starting...'
    });

    this.progressBars.set(name, { bar, total, current: 0 });
    return bar;
  }

  updateProgress(name, increment = 1, task = '') {
    const progress = this.progressBars.get(name);
    if (progress) {
      progress.current += increment;
      progress.bar.update(progress.current, { task });
    }
  }

  completeProgress(name) {
    const progress = this.progressBars.get(name);
    if (progress) {
      progress.bar.stop();
      this.progressBars.delete(name);
    }
  }

  // Multi-bar for parallel operations
  createMultiBar(operations) {
    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: `{name} ${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | ETA: {eta}s | {task}`
    }, cliProgress.Presets.shades_grey);

    const bars = {};
    operations.forEach(op => {
      bars[op.name] = multibar.create(op.total, 0, {
        name: chalk.bold(op.name.padEnd(15)),
        task: op.task || 'Waiting...'
      });
    });

    return { multibar, bars };
  }

  // Spinner with status updates
  createSpinner(name, text, options = {}) {
    const spinner = ora({
      text,
      spinner: options.spinner || 'dots',
      color: options.color || 'cyan',
      ...options
    });

    spinner.start();
    this.activeSpinners.set(name, spinner);
    return spinner;
  }

  updateSpinner(name, text, status = null) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) {
      spinner.text = text;
      if (status) {
        switch (status) {
          case 'success':
            spinner.succeed(text);
            this.activeSpinners.delete(name);
            break;
          case 'fail':
            spinner.fail(text);
            this.activeSpinners.delete(name);
            break;
          case 'warn':
            spinner.warn(text);
            this.activeSpinners.delete(name);
            break;
          case 'info':
            spinner.info(text);
            this.activeSpinners.delete(name);
            break;
        }
      }
    }
  }

  // Task list with checkmarks
  createTaskList(tasks) {
    const taskStates = new Map();
    tasks.forEach(task => {
      taskStates.set(task.id, {
        name: task.name,
        status: 'pending',
        spinner: null
      });
    });
    return taskStates;
  }

  startTask(taskStates, taskId) {
    const task = taskStates.get(taskId);
    if (task) {
      task.status = 'running';
      task.spinner = this.createSpinner(`task-${taskId}`, chalk.gray(`► ${task.name}`));
    }
  }

  completeTask(taskStates, taskId, success = true, message = '') {
    const task = taskStates.get(taskId);
    if (task) {
      task.status = success ? 'completed' : 'failed';
      const status = success ? 'success' : 'fail';
      const text = success 
        ? chalk.green(`✓ ${task.name}`) + (message ? chalk.gray(` - ${message}`) : '')
        : chalk.red(`✗ ${task.name}`) + (message ? chalk.gray(` - ${message}`) : '');
      
      this.updateSpinner(`task-${taskId}`, text, status);
    }
  }

  // Display operation summary with timing
  displayOperationSummary(operation, startTime, details = {}) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const { filesCreated = 0, filesModified = 0, errors = [] } = details;

    console.log('\n' + chalk.bold.underline(`${operation} Summary`));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.green('Duration:')} ${duration}s`);
    
    if (filesCreated > 0) {
      console.log(`${chalk.green('Files Created:')} ${filesCreated}`);
    }
    
    if (filesModified > 0) {
      console.log(`${chalk.yellow('Files Modified:')} ${filesModified}`);
    }
    
    if (errors.length > 0) {
      console.log(`${chalk.red('Errors:')} ${errors.length}`);
      errors.forEach(err => {
        console.log(chalk.red(`  - ${err}`));
      });
    }
    
    console.log(chalk.gray('─'.repeat(40)) + '\n');
  }

  // Animated loading with custom messages (SECURE)
  createLoadingAnimation(messages, interval = 2000) {
    let index = 0;
    const spinner = this.createSpinner('loading', messages[0]);
    
    // SECURITY: Store timer reference for proper cleanup
    const timer = setInterval(() => {
      index = (index + 1) % messages.length;
      if (spinner && !spinner.isSpinning) {
        clearInterval(timer);
        return;
      }
      spinner.text = messages[index];
    }, interval);

    // Store timer for cleanup
    if (!this.activeTimers) {
      this.activeTimers = new Set();
    }
    this.activeTimers.add(timer);

    return {
      stop: (finalMessage, status = 'success') => {
        clearInterval(timer);
        this.activeTimers.delete(timer);
        this.updateSpinner('loading', finalMessage, status);
      }
    };
  }

  // Step indicator for multi-step processes
  createStepIndicator(steps) {
    let currentStep = 0;
    
    const display = () => {
      console.clear();
      console.log(chalk.bold('\nSetup Progress:\n'));
      
      steps.forEach((step, index) => {
        const icon = index < currentStep ? chalk.green('✓') :
                    index === currentStep ? chalk.yellow('▶') :
                    chalk.gray('○');
        
        const text = index <= currentStep ? chalk.white(step) : chalk.gray(step);
        console.log(`  ${icon} ${text}`);
      });
      
      console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
    };

    return {
      display,
      next: () => {
        currentStep = Math.min(currentStep + 1, steps.length - 1);
        display();
      },
      complete: () => {
        currentStep = steps.length;
        display();
      }
    };
  }

  // Clean up all active indicators (SECURE)
  cleanup() {
    // SECURITY: Properly clean up all resources to prevent memory leaks
    this.activeSpinners.forEach(spinner => {
      if (spinner && typeof spinner.stop === 'function') {
        spinner.stop();
      }
    });
    
    this.progressBars.forEach(({ bar }) => {
      if (bar && typeof bar.stop === 'function') {
        bar.stop();
      }
    });
    
    // SECURITY: Clear all active timers
    if (this.activeTimers) {
      this.activeTimers.forEach(timer => {
        clearInterval(timer);
        clearTimeout(timer); // Handle both interval and timeout
      });
      this.activeTimers.clear();
    }
    
    this.activeSpinners.clear();
    this.progressBars.clear();
  }

  // SECURITY: Force cleanup on process termination
  setupCleanupHandlers() {
    const cleanup = () => this.cleanup();
    
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
  }
}

// Singleton instance
export const progressIndicator = new ProgressIndicator();

// SECURITY: Initialize cleanup handlers on module load
progressIndicator.setupCleanupHandlers();

// Utility functions for common progress patterns
export function withProgress(promise, message, options = {}) {
  const spinner = progressIndicator.createSpinner('operation', message, options);
  
  return promise
    .then(result => {
      progressIndicator.updateSpinner('operation', options.successMessage || `${message} completed`, 'success');
      return result;
    })
    .catch(error => {
      progressIndicator.updateSpinner('operation', options.errorMessage || `${message} failed`, 'fail');
      throw error;
    });
}

export function trackFileOperations() {
  let filesCreated = 0;
  let filesModified = 0;
  const errors = [];

  return {
    fileCreated: () => filesCreated++,
    fileModified: () => filesModified++,
    error: (message) => errors.push(message),
    getSummary: () => ({ filesCreated, filesModified, errors })
  };
}