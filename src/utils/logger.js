import chalk from 'chalk';
import ora from 'ora';

export class Logger {
  constructor() {
    this.spinner = null;
  }

  // Standard logging methods
  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message) {
    console.log(chalk.green('✓'), message);
  }

  warning(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message) {
    console.error(chalk.red('✗'), message);
  }

  debug(message) {
    if (process.env.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  }

  // Formatted output methods
  header(message) {
    console.log('\n' + chalk.bold.underline(message));
  }

  subheader(message) {
    console.log('\n' + chalk.bold(message));
  }

  list(items, bullet = '•') {
    items.forEach(item => {
      console.log(`  ${chalk.gray(bullet)} ${item}`);
    });
  }

  table(data) {
    console.table(data);
  }

  // Spinner methods
  startSpinner(message) {
    this.spinner = ora(message).start();
    return this.spinner;
  }

  updateSpinner(message) {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  succeedSpinner(message) {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  failSpinner(message) {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Box output
  box(content, title = '') {
    const lines = content.split('\n');
    const maxLength = Math.max(
      title.length,
      ...lines.map(line => line.length)
    );
    
    const top = '╔' + '═'.repeat(maxLength + 2) + '╗';
    const bottom = '╚' + '═'.repeat(maxLength + 2) + '╝';
    
    console.log(chalk.cyan(top));
    
    if (title) {
      console.log(chalk.cyan('║') + ' ' + chalk.bold(title.padEnd(maxLength)) + ' ' + chalk.cyan('║'));
      console.log(chalk.cyan('╟' + '─'.repeat(maxLength + 2) + '╢'));
    }
    
    lines.forEach(line => {
      console.log(chalk.cyan('║') + ' ' + line.padEnd(maxLength) + ' ' + chalk.cyan('║'));
    });
    
    console.log(chalk.cyan(bottom));
  }

  // Progress bar (simple implementation)
  progress(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 20);
    const empty = 20 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    process.stdout.write(
      `\r${label} ${chalk.cyan(bar)} ${percentage}% (${current}/${total})`
    );
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  // Clear line
  clearLine() {
    process.stdout.write('\r\x1b[K');
  }
}

// Export singleton instance
export const logger = new Logger();