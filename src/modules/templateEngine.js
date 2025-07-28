import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateEngine {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
    this.helperFunctions = this.registerHelpers();
    this.contextType = 'text'; // default context
  }

  /**
   * Context-aware escaping functions
   */
  escapeForContext(value, context) {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    switch (context) {
      case 'html':
        return this.escapeHtml(stringValue);
      case 'js':
      case 'javascript':
        return this.escapeJavaScript(stringValue);
      case 'shell':
      case 'bash':
        return this.escapeShell(stringValue);
      case 'json':
        return this.escapeJson(stringValue);
      case 'url':
        return encodeURIComponent(stringValue);
      case 'none':
      case 'raw':
        return stringValue;
      default:
        // Default to HTML escaping for safety
        return this.escapeHtml(stringValue);
    }
  }

  escapeHtml(str) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    
    return str.replace(/[&<>"'`=\/]/g, char => htmlEscapes[char]);
  }

  escapeJavaScript(str) {
    const jsEscapes = {
      '\\': '\\\\',
      '"': '\\"',
      "'": "\\'",
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t',
      '\b': '\\b',
      '\f': '\\f',
      '\v': '\\v',
      '\0': '\\0',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029'
    };
    
    return str.replace(/[\\"'\n\r\t\b\f\v\0\u2028\u2029]/g, char => jsEscapes[char] || char);
  }

  escapeShell(str) {
    // For shell commands, use single quotes and escape any single quotes
    // This is the safest approach for shell escaping
    if (!str) return "''";
    
    // Replace single quotes with '\'' (end quote, escaped quote, start quote)
    const escaped = str.replace(/'/g, "'\\''");
    
    // Wrap in single quotes
    return `'${escaped}'`;
  }

  escapeJson(str) {
    // Use native JSON.stringify for proper JSON escaping
    return JSON.stringify(str).slice(1, -1);
  }

  /**
   * Register Handlebars-style helper functions
   */
  registerHelpers() {
    return {
      eq: (a, b) => a === b,
      ne: (a, b) => a !== b,
      lt: (a, b) => a < b,
      gt: (a, b) => a > b,
      lte: (a, b) => a <= b,
      gte: (a, b) => a >= b,
      and: (...args) => args.slice(0, -1).every(Boolean),
      or: (...args) => args.slice(0, -1).some(Boolean),
      not: (value) => !value,
      includes: (array, value) => array && array.includes(value),
      join: (array, separator = ', ') => array && array.join(separator),
      capitalize: (str) => str && str.charAt(0).toUpperCase() + str.slice(1),
      lowercase: (str) => str && str.toLowerCase(),
      uppercase: (str) => str && str.toUpperCase(),
      default: (value, defaultValue) => value || defaultValue,
      // Security-focused helpers
      escapeHtml: (str) => this.escapeHtml(str),
      escapeJs: (str) => this.escapeJavaScript(str),
      escapeShell: (str) => this.escapeShell(str),
      escapeJson: (str) => this.escapeJson(str),
      safeString: (str, context = 'html') => this.escapeForContext(str, context)
    };
  }

  /**
   * Process a template string with variables
   */
  async processTemplate(templateContent, variables = {}, options = {}) {
    try {
      // Determine context from template file extension or options
      const context = options.context || this.detectContext(options.templatePath);
      
      // Create context with variables and helpers
      const templateContext = {
        ...variables,
        ...this.helperFunctions,
        // Add current date/time helpers
        currentYear: new Date().getFullYear(),
        currentDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        // Security context
        _securityContext: context
      };

      // Process the template
      let processed = templateContent;

      // Handle conditionals: {{#if condition}}...{{/if}}
      processed = this.processConditionals(processed, templateContext);

      // Handle loops: {{#each array}}...{{/each}}
      processed = this.processLoops(processed, templateContext);

      // Handle simple variable substitution: {{variable}}
      processed = this.processVariables(processed, templateContext);

      // Handle helper functions: {{helper arg1 arg2}}
      processed = this.processHelpers(processed, templateContext);

      return processed;
    } catch (error) {
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Detect context type from file extension
   */
  detectContext(templatePath) {
    if (!templatePath) return 'html';
    
    const ext = path.extname(templatePath).toLowerCase();
    const filename = path.basename(templatePath).toLowerCase();
    
    // Check for shell scripts
    if (ext === '.sh' || ext === '.bash' || filename.includes('script')) {
      return 'shell';
    }
    
    // Check for JavaScript
    if (ext === '.js' || ext === '.mjs' || ext === '.ts') {
      return 'js';
    }
    
    // Check for JSON
    if (ext === '.json') {
      return 'json';
    }
    
    // Check for HTML
    if (ext === '.html' || ext === '.htm') {
      return 'html';
    }
    
    // Check for config files that might contain shell commands
    if (filename.includes('wrangler') || filename.includes('.toml')) {
      return 'shell';
    }
    
    // Default to HTML for safety
    return 'html';
  }

  /**
   * Process conditional blocks
   */
  processConditionals(template, context) {
    const ifRegex = /\{\{#if\s+(.+?)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    
    return template.replace(ifRegex, (match, condition, ifContent, elseContent = '') => {
      try {
        const result = this.evaluateCondition(condition, context);
        return result ? this.processTemplate(ifContent, context) : this.processTemplate(elseContent, context);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to evaluate condition: ${condition}`));
        return match;
      }
    });
  }

  /**
   * Process loop blocks
   */
  processLoops(template, context) {
    const eachRegex = /\{\{#each\s+(.+?)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (match, arrayName, loopContent) => {
      try {
        const array = this.resolveValue(arrayName, context);
        if (!Array.isArray(array)) return '';
        
        return array.map((item, index) => {
          const loopContext = {
            ...context,
            this: item,
            '@index': index,
            '@first': index === 0,
            '@last': index === array.length - 1
          };
          return this.processTemplate(loopContent, loopContext);
        }).join('');
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to process loop: ${arrayName}`));
        return match;
      }
    });
  }

  /**
   * Process simple variable substitutions
   */
  processVariables(template, context) {
    const varRegex = /\{\{([^#\/].*?)\}\}/g;
    
    return template.replace(varRegex, (match, expression) => {
      try {
        const trimmed = expression.trim();
        
        // Skip if it's a helper function call
        if (trimmed.includes(' ')) {
          return match;
        }
        
        // Check for raw/unescaped marker {{{variable}}}
        const isRaw = match.startsWith('{{{') && match.endsWith('}}}');
        
        const value = this.resolveValue(trimmed, context);
        if (value === undefined || value === null) return '';
        
        // Apply context-aware escaping unless marked as raw
        if (isRaw || trimmed.startsWith('!')) {
          // Remove the ! prefix if present
          const cleanValue = trimmed.startsWith('!') 
            ? this.resolveValue(trimmed.substring(1), context) 
            : value;
          return String(cleanValue);
        }
        
        // Apply security escaping based on context
        const securityContext = context._securityContext || 'html';
        return this.escapeForContext(value, securityContext);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to resolve variable: ${expression}`));
        return match;
      }
    });
  }

  /**
   * Process helper function calls
   */
  processHelpers(template, context) {
    const helperRegex = /\{\{([^#\/].*?\s+.*?)\}\}/g;
    
    return template.replace(helperRegex, (match, expression) => {
      try {
        const parts = expression.trim().split(/\s+/);
        const helperName = parts[0];
        const args = parts.slice(1).map(arg => this.resolveValue(arg, context));
        
        if (helperName in this.helperFunctions) {
          const result = this.helperFunctions[helperName](...args);
          return result !== undefined && result !== null ? String(result) : '';
        }
        
        return match;
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to process helper: ${expression}`));
        return match;
      }
    });
  }

  /**
   * Evaluate a condition expression
   */
  evaluateCondition(condition, context) {
    const trimmed = condition.trim();
    
    // Handle negation
    if (trimmed.startsWith('!')) {
      return !this.evaluateCondition(trimmed.substring(1), context);
    }
    
    // Handle helper functions in conditions
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(/\s+/);
      const helperName = parts[0];
      
      if (helperName in this.helperFunctions) {
        const args = parts.slice(1).map(arg => this.resolveValue(arg, context));
        return this.helperFunctions[helperName](...args);
      }
    }
    
    // Simple variable evaluation
    const value = this.resolveValue(trimmed, context);
    return !!value;
  }

  /**
   * Resolve a value from the context (supports dot notation)
   */
  resolveValue(path, context) {
    if (!path) return undefined;
    
    // Handle literals
    if (path.startsWith('"') && path.endsWith('"')) {
      return path.slice(1, -1);
    }
    if (path.startsWith("'") && path.endsWith("'")) {
      return path.slice(1, -1);
    }
    if (!isNaN(path)) {
      return Number(path);
    }
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    
    // Handle dot notation
    const parts = path.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    
    return value;
  }

  /**
   * Load and process a template file
   */
  async loadAndProcess(templatePath, variables = {}, options = {}) {
    try {
      const fullPath = path.isAbsolute(templatePath) 
        ? templatePath 
        : path.join(this.templatesDir, templatePath);
        
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }
      
      const templateContent = await fs.readFile(fullPath, 'utf-8');
      
      // Pass the template path for context detection
      const processOptions = {
        ...options,
        templatePath: fullPath
      };
      
      return this.processTemplate(templateContent, variables, processOptions);
    } catch (error) {
      throw new Error(`Failed to load template: ${error.message}`);
    }
  }

  /**
   * Process multiple templates
   */
  async processTemplates(templates, variables = {}) {
    const results = {};
    
    for (const [name, templatePath] of Object.entries(templates)) {
      try {
        results[name] = await this.loadAndProcess(templatePath, variables);
      } catch (error) {
        console.error(chalk.red(`Failed to process template ${name}:`), error.message);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Validate template variables
   */
  validateVariables(templateContent, providedVariables = {}) {
    const requiredVars = new Set();
    const varRegex = /\{\{([^#\/].*?)\}\}/g;
    let match;
    
    while ((match = varRegex.exec(templateContent)) !== null) {
      const expression = match[1].trim();
      if (!expression.includes(' ')) {
        // Simple variable
        const varName = expression.split('.')[0];
        if (!varName.startsWith('@')) {
          requiredVars.add(varName);
        }
      }
    }
    
    const missing = [];
    for (const varName of requiredVars) {
      if (!(varName in providedVariables) && !(varName in this.helperFunctions)) {
        missing.push(varName);
      }
    }
    
    return {
      isValid: missing.length === 0,
      missing,
      required: Array.from(requiredVars)
    };
  }

  /**
   * Get list of available templates
   */
  async getAvailableTemplates() {
    const templates = {};
    
    const scanDir = async (dir, prefix = '') => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await scanDir(fullPath, prefix ? `${prefix}/${item.name}` : item.name);
        } else if (item.name.endsWith('.template')) {
          const key = prefix ? `${prefix}/${item.name}` : item.name;
          templates[key] = fullPath;
        }
      }
    };
    
    await scanDir(this.templatesDir);
    return templates;
  }
}

// Export singleton instance
export const templateEngine = new TemplateEngine();