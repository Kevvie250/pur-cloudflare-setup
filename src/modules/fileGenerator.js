import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { templateEngine } from './templateEngine.js';
import { isValidPath } from '../utils/validation.js';

export class FileGenerator {
  constructor() {
    this.generatedFiles = [];
    this.skippedFiles = [];
  }

  /**
   * Generate a single file from template
   */
  async generateFile(templatePath, outputPath, variables = {}, options = {}) {
    const { overwrite = false, backup = true } = options;
    
    try {
      // Validate paths
      if (!isValidPath(outputPath)) {
        throw new Error(`Invalid output path: ${outputPath}`);
      }
      
      // Check if file exists
      const fileExists = await fs.pathExists(outputPath);
      
      if (fileExists && !overwrite) {
        this.skippedFiles.push({
          path: outputPath,
          reason: 'File already exists'
        });
        return false;
      }
      
      // Backup existing file if requested
      if (fileExists && backup) {
        const backupPath = `${outputPath}.backup.${Date.now()}`;
        await fs.copy(outputPath, backupPath);
        console.log(chalk.gray(`Backed up existing file to: ${backupPath}`));
      }
      
      // Process template
      const content = await templateEngine.loadAndProcess(templatePath, variables);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(outputPath));
      
      // Write file
      await fs.writeFile(outputPath, content, 'utf-8');
      
      this.generatedFiles.push({
        template: templatePath,
        output: outputPath,
        size: content.length
      });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to generate file ${outputPath}: ${error.message}`);
    }
  }

  /**
   * Generate multiple files from templates
   */
  async generateFiles(fileMap, variables = {}, options = {}) {
    const spinner = ora('Generating files...').start();
    const results = {
      success: [],
      failed: [],
      skipped: []
    };
    
    try {
      for (const [templatePath, outputPath] of Object.entries(fileMap)) {
        try {
          spinner.text = `Generating ${path.basename(outputPath)}...`;
          
          const generated = await this.generateFile(
            templatePath,
            outputPath,
            variables,
            options
          );
          
          if (generated) {
            results.success.push(outputPath);
          } else {
            results.skipped.push(outputPath);
          }
        } catch (error) {
          results.failed.push({
            file: outputPath,
            error: error.message
          });
          
          if (!options.continueOnError) {
            throw error;
          }
        }
      }
      
      spinner.succeed(`Generated ${results.success.length} files`);
      
      // Report results
      if (results.skipped.length > 0) {
        console.log(chalk.yellow(`\nSkipped ${results.skipped.length} existing files`));
      }
      
      if (results.failed.length > 0) {
        console.log(chalk.red(`\nFailed to generate ${results.failed.length} files:`));
        results.failed.forEach(({ file, error }) => {
          console.log(chalk.red(`  - ${file}: ${error}`));
        });
      }
      
      return results;
    } catch (error) {
      spinner.fail('File generation failed');
      throw error;
    }
  }

  /**
   * Generate project structure
   */
  async generateProjectStructure(projectPath, structure, variables = {}, options = {}) {
    const spinner = ora('Creating project structure...').start();
    
    try {
      // Ensure project directory exists
      await fs.ensureDir(projectPath);
      
      // Create directories
      if (structure.directories) {
        for (const dir of structure.directories) {
          const dirPath = path.join(projectPath, dir);
          await fs.ensureDir(dirPath);
          spinner.text = `Created directory: ${dir}`;
        }
      }
      
      // Generate files
      if (structure.files) {
        const fileMap = {};
        
        for (const file of structure.files) {
          const templatePath = file.template;
          const outputPath = path.join(projectPath, file.path);
          fileMap[templatePath] = outputPath;
        }
        
        await this.generateFiles(fileMap, variables, options);
      }
      
      // Copy static files
      if (structure.staticFiles) {
        for (const { source, destination } of structure.staticFiles) {
          const srcPath = path.resolve(source);
          const destPath = path.join(projectPath, destination);
          
          spinner.text = `Copying ${path.basename(destination)}...`;
          
          await fs.ensureDir(path.dirname(destPath));
          await fs.copy(srcPath, destPath);
        }
      }
      
      // Run post-generation scripts
      if (structure.postGenerate) {
        spinner.text = 'Running post-generation tasks...';
        
        for (const task of structure.postGenerate) {
          await this.runPostGenerateTask(task, projectPath, variables);
        }
      }
      
      spinner.succeed('Project structure created successfully');
      
      return {
        projectPath,
        filesGenerated: this.generatedFiles.length,
        filesSkipped: this.skippedFiles.length
      };
    } catch (error) {
      spinner.fail('Failed to create project structure');
      throw error;
    }
  }

  /**
   * Run post-generation task
   */
  async runPostGenerateTask(task, projectPath, variables) {
    switch (task.type) {
      case 'chmod':
        await this.setFilePermissions(
          path.join(projectPath, task.path),
          task.mode
        );
        break;
        
      case 'rename':
        await fs.rename(
          path.join(projectPath, task.from),
          path.join(projectPath, task.to)
        );
        break;
        
      case 'replace':
        await this.replaceInFile(
          path.join(projectPath, task.path),
          task.find,
          task.replace
        );
        break;
        
      case 'custom':
        if (task.handler && typeof task.handler === 'function') {
          await task.handler(projectPath, variables);
        }
        break;
        
      default:
        console.warn(chalk.yellow(`Unknown post-generate task type: ${task.type}`));
    }
  }

  /**
   * Set file permissions
   */
  async setFilePermissions(filePath, mode) {
    try {
      await fs.chmod(filePath, mode);
    } catch (error) {
      console.warn(chalk.yellow(`Failed to set permissions for ${filePath}: ${error.message}`));
    }
  }

  /**
   * Replace content in file
   */
  async replaceInFile(filePath, find, replace) {
    try {
      let content = await fs.readFile(filePath, 'utf-8');
      
      if (find instanceof RegExp) {
        content = content.replace(find, replace);
      } else {
        content = content.split(find).join(replace);
      }
      
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.warn(chalk.yellow(`Failed to replace content in ${filePath}: ${error.message}`));
    }
  }

  /**
   * Validate generated files
   */
  async validateGeneratedFiles() {
    const validation = {
      valid: [],
      invalid: []
    };
    
    for (const file of this.generatedFiles) {
      try {
        // Check if file exists
        if (!await fs.pathExists(file.output)) {
          validation.invalid.push({
            file: file.output,
            reason: 'File not found after generation'
          });
          continue;
        }
        
        // Check file size
        const stats = await fs.stat(file.output);
        if (stats.size === 0) {
          validation.invalid.push({
            file: file.output,
            reason: 'File is empty'
          });
          continue;
        }
        
        // File-specific validation
        const ext = path.extname(file.output).toLowerCase();
        
        switch (ext) {
          case '.json':
            try {
              const content = await fs.readFile(file.output, 'utf-8');
              JSON.parse(content);
            } catch (error) {
              validation.invalid.push({
                file: file.output,
                reason: `Invalid JSON: ${error.message}`
              });
              continue;
            }
            break;
            
          case '.js':
          case '.ts':
            // Basic syntax check for common issues
            const jsContent = await fs.readFile(file.output, 'utf-8');
            if (jsContent.includes('{{') && jsContent.includes('}}')) {
              validation.invalid.push({
                file: file.output,
                reason: 'Contains unprocessed template variables'
              });
              continue;
            }
            break;
        }
        
        validation.valid.push(file.output);
      } catch (error) {
        validation.invalid.push({
          file: file.output,
          reason: error.message
        });
      }
    }
    
    return validation;
  }

  /**
   * Get generation summary
   */
  getSummary() {
    return {
      generated: this.generatedFiles,
      skipped: this.skippedFiles,
      total: this.generatedFiles.length + this.skippedFiles.length
    };
  }

  /**
   * Reset generator state
   */
  reset() {
    this.generatedFiles = [];
    this.skippedFiles = [];
  }
}

// Export singleton instance
export const fileGenerator = new FileGenerator();