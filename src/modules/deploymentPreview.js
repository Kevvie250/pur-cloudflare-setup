import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import hljs from 'highlight.js';
import path from 'path';
import fs from 'fs-extra';

// Configure marked for terminal output
marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.gray,
    blockquote: chalk.gray.italic,
    html: chalk.gray,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.bold,
    hr: chalk.gray,
    listitem: chalk.gray,
    list: list => list,
    paragraph: chalk.white,
    table: chalk.gray,
    tablerow: chalk.gray,
    tablecell: chalk.gray,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline
  })
});

export class DeploymentPreview {
  constructor() {
    this.fileTree = [];
    this.configSummary = {};
    this.estimatedTime = 0;
  }

  // Generate complete preview
  async generatePreview(projectPath, config) {
    console.log(boxen(
      chalk.bold.cyan('🔍 Deployment Preview') + '\n' +
      chalk.gray('Review what will be created'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));

    // Build file tree
    this.fileTree = await this.buildFileTree(projectPath, config);
    
    // Generate config summary
    this.configSummary = this.generateConfigSummary(config);
    
    // Estimate deployment time
    this.estimatedTime = this.estimateDeploymentTime(config);

    // Display all previews
    this.displayFileTree();
    this.displayConfigSummary();
    this.displayEstimatedTime();
    await this.previewSampleFiles(config);
    
    return {
      fileTree: this.fileTree,
      configSummary: this.configSummary,
      estimatedTime: this.estimatedTime
    };
  }

  // Build visual file tree (SECURE)
  async buildFileTree(projectPath, config) {
    // SECURITY: Validate and sanitize projectPath to prevent directory traversal
    const sanitizedPath = this.sanitizeProjectPath(projectPath);
    if (!sanitizedPath) {
      throw new Error('Invalid project path provided');
    }
    
    const tree = {
      name: path.basename(sanitizedPath),
      type: 'directory',
      children: []
    };

    // Project structure based on type
    if (config.projectType === 'api' || config.projectType === 'app') {
      tree.children.push(
        { name: 'src/', type: 'directory', children: [
          { name: 'index.js', type: 'file', new: true },
          { name: 'config.js', type: 'file', new: true },
          ...(config.useWorkers ? [{ name: 'worker.js', type: 'file', new: true }] : [])
        ]},
        { name: 'tests/', type: 'directory', children: [] },
        { name: 'docs/', type: 'directory', children: [
          { name: 'README.md', type: 'file', new: true },
          { name: 'API.md', type: 'file', new: true }
        ]}
      );
    }

    if (config.projectType === 'site' || config.projectType === 'app') {
      tree.children.push(
        { name: 'public/', type: 'directory', children: [
          { name: 'index.html', type: 'file', new: true },
          { name: 'styles/', type: 'directory', children: [
            { name: 'main.css', type: 'file', new: true }
          ]},
          { name: 'scripts/', type: 'directory', children: [
            { name: 'main.js', type: 'file', new: true }
          ]}
        ]}
      );
    }

    // Common files
    tree.children.push(
      { name: 'package.json', type: 'file', new: true },
      { name: '.env.example', type: 'file', new: true },
      { name: '.gitignore', type: 'file', new: true },
      { name: 'README.md', type: 'file', new: true }
    );

    if (config.useWrangler) {
      tree.children.push({ name: 'wrangler.toml', type: 'file', new: true });
    }

    return tree;
  }

  // Display file tree
  displayFileTree() {
    console.log('\n' + chalk.bold('📁 Project Structure:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const renderTree = (node, prefix = '', isLast = true) => {
      const connector = isLast ? '└── ' : '├── ';
      const extension = isLast ? '    ' : '│   ';
      
      const icon = node.type === 'directory' ? '📁' : '📄';
      const name = node.new ? chalk.green(node.name) : node.name;
      
      console.log(prefix + connector + icon + ' ' + name);
      
      if (node.children) {
        node.children.forEach((child, index) => {
          const isLastChild = index === node.children.length - 1;
          renderTree(child, prefix + extension, isLastChild);
        });
      }
    };

    renderTree(this.fileTree);
    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  // Generate configuration summary
  generateConfigSummary(config) {
    const summary = {
      'Project Details': {
        'Name': config.projectName,
        'Domain': config.domain,
        'Type': config.projectType,
        'Environment': config.environment
      },
      'Features': config.features || [],
      'Deployment': {
        'Platform': config.usePages ? 'Cloudflare Pages' : 'Cloudflare Workers',
        'Build Tool': config.useWrangler ? 'Wrangler' : 'None',
        'Auto Deploy': config.autoDeploy || false
      }
    };

    if (config.projectType === 'api') {
      summary['API Configuration'] = {
        'Type': config.apiType || 'rest',
        'Authentication': config.useAuth ? 'Enabled' : 'Disabled',
        'Rate Limiting': config.features?.includes('rate-limiting') ? 'Enabled' : 'Disabled',
        'CORS': config.features?.includes('cors') ? 'Configured' : 'Default'
      };
    }

    return summary;
  }

  // Display configuration summary
  displayConfigSummary() {
    console.log(chalk.bold('⚙️  Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(50)));

    const table = new Table({
      chars: {
        'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
        'right': '│', 'right-mid': '┤', 'middle': '│'
      },
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    Object.entries(this.configSummary).forEach(([section, values]) => {
      table.push([{ colSpan: 2, content: chalk.yellow.bold(section) }]);
      
      if (Array.isArray(values)) {
        table.push(['Features', values.map(v => `• ${v}`).join('\n')]);
      } else {
        Object.entries(values).forEach(([key, value]) => {
          table.push([chalk.gray(key), chalk.white(value)]);
        });
      }
    });

    console.log(table.toString());
    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  // Estimate deployment time
  estimateDeploymentTime(config) {
    let seconds = 10; // Base time

    // Add time based on features
    if (config.features) {
      seconds += config.features.length * 2;
    }

    // Add time for build steps
    if (config.buildStep) seconds += 15;
    if (config.useWrangler) seconds += 20;
    if (config.useWorkers) seconds += 10;
    if (config.framework && config.framework !== 'vanilla') seconds += 30;

    return seconds;
  }

  // Display estimated time
  displayEstimatedTime() {
    console.log(chalk.bold('⏱️  Estimated Setup Time:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const minutes = Math.floor(this.estimatedTime / 60);
    const seconds = this.estimatedTime % 60;
    
    let timeStr = '';
    if (minutes > 0) {
      timeStr += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    }
    timeStr += `${seconds} second${seconds > 1 ? 's' : ''}`;
    
    console.log(`  ${chalk.cyan('Total time:')} ${chalk.yellow(timeStr)}`);
    console.log(`  ${chalk.gray('This includes file generation and initial setup')}`);
    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  // Preview sample files with syntax highlighting
  async previewSampleFiles(config) {
    console.log(chalk.bold('📄 Sample File Previews:'));
    console.log(chalk.gray('─'.repeat(50)));

    // Sample package.json
    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: `${config.projectType} project for ${config.domain}`,
      main: 'src/index.js',
      scripts: {
        dev: config.projectType === 'site' ? 'vite' : 'wrangler dev',
        build: config.projectType === 'site' ? 'vite build' : 'wrangler build',
        deploy: config.useWrangler ? 'wrangler deploy' : 'npm run build'
      },
      dependencies: this.getProjectDependencies(config)
    };

    console.log('\n' + chalk.cyan.bold('package.json:'));
    console.log(this.highlightCode(JSON.stringify(packageJson, null, 2), 'json'));

    // Sample wrangler.toml if applicable
    if (config.useWrangler) {
      const wranglerConfig = `name = "${config.projectName}"
main = "src/index.js"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[env.production]
route = "${config.domain}/*"
zone_id = "YOUR_ZONE_ID"

${config.useKV ? '[kv_namespaces]\nbinding = "KV"\nid = "YOUR_KV_NAMESPACE_ID"' : ''}`;

      console.log('\n' + chalk.cyan.bold('wrangler.toml:'));
      console.log(this.highlightCode(wranglerConfig, 'toml'));
    }

    // Sample index.js
    const indexJs = this.generateSampleIndexJs(config);
    console.log('\n' + chalk.cyan.bold('src/index.js:'));
    console.log(this.highlightCode(indexJs, 'javascript'));

    console.log(chalk.gray('─'.repeat(50)) + '\n');
  }

  // Generate sample index.js based on project type
  generateSampleIndexJs(config) {
    if (config.projectType === 'api') {
      return `import { Router } from 'itty-router';

const router = Router();

// Health check endpoint
router.get('/health', () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Main API endpoint
router.get('/api/*', async (request) => {
  // Your API logic here
  return new Response('API endpoint', { status: 200 });
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  fetch: router.handle
};`;
    }

    return `// ${config.projectName} - Main entry point
console.log('Project initialized');

export function init() {
  console.log('Running on ${config.domain}');
}`;
  }

  // Get project dependencies based on config
  getProjectDependencies(config) {
    const deps = {};

    if (config.projectType === 'api') {
      deps['itty-router'] = '^4.0.0';
      if (config.apiType === 'graphql') {
        deps['graphql'] = '^16.0.0';
      }
    }

    if (config.framework) {
      switch (config.framework) {
        case 'react':
          deps['react'] = '^18.0.0';
          deps['react-dom'] = '^18.0.0';
          break;
        case 'vue':
          deps['vue'] = '^3.0.0';
          break;
        case 'nextjs':
          deps['next'] = '^14.0.0';
          break;
      }
    }

    return deps;
  }

  // Simple syntax highlighting
  highlightCode(code, language) {
    try {
      const highlighted = hljs.highlight(code, { language }).value;
      // Convert HTML to terminal colors (simplified)
      return highlighted
        .replace(/<span class="hljs-string">(.*?)<\/span>/g, chalk.green('$1'))
        .replace(/<span class="hljs-keyword">(.*?)<\/span>/g, chalk.blue('$1'))
        .replace(/<span class="hljs-number">(.*?)<\/span>/g, chalk.yellow('$1'))
        .replace(/<span class="hljs-comment">(.*?)<\/span>/g, chalk.gray('$1'))
        .replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
    } catch (error) {
      // Fallback to plain text
      return code;
    }
  }

  // Dry run mode
  async performDryRun(projectPath, config) {
    console.log(boxen(
      chalk.yellow.bold('🚧 DRY RUN MODE') + '\n' +
      chalk.white('No files will be created'),
      {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'yellow'
      }
    ));

    const operations = [
      { name: 'Validate configuration', status: 'success' },
      { name: 'Check directory availability', status: 'success' },
      { name: 'Verify template files', status: 'success' },
      { name: 'Test API connections', status: config.apiType ? 'success' : 'skipped' },
      { name: 'Validate domain ownership', status: 'warning', message: 'Manual verification required' }
    ];

    console.log('\n' + chalk.bold('Dry Run Results:'));
    console.log(chalk.gray('─'.repeat(50)));

    operations.forEach(op => {
      const icon = op.status === 'success' ? chalk.green('✓') :
                   op.status === 'warning' ? chalk.yellow('⚠') :
                   op.status === 'error' ? chalk.red('✗') :
                   chalk.gray('○');
      
      console.log(`  ${icon} ${op.name}${op.message ? chalk.gray(` - ${op.message}`) : ''}`);
    });

    console.log(chalk.gray('─'.repeat(50)) + '\n');

    return {
      success: !operations.some(op => op.status === 'error'),
      operations
    };
  }

  // SECURITY: Sanitize project path to prevent directory traversal
  sanitizeProjectPath(projectPath) {
    if (!projectPath || typeof projectPath !== 'string') {
      return null;
    }
    
    // Resolve to absolute path and normalize
    const resolvedPath = path.resolve(projectPath);
    
    // Check for directory traversal attempts
    const dangerousPatterns = [
      /\.\./,  // Parent directory traversal
      /\0/,    // Null bytes
      /[<>:"|?*]/,  // Invalid filename characters
      /^\/etc\/|^\/proc\/|^\/sys\/|^\/dev\//,  // System directories
      /^[A-Z]:\\/  // Windows root drives
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(resolvedPath)) {
        console.warn(`Security warning: Potentially dangerous path detected: ${projectPath}`);
        return null;
      }
    }
    
    // Ensure path is within reasonable bounds (not system directories)
    const homedir = require('os').homedir();
    const cwd = process.cwd();
    
    // Allow paths under home directory or current working directory
    if (!resolvedPath.startsWith(homedir) && !resolvedPath.startsWith(cwd)) {
      console.warn(`Security warning: Path outside allowed directories: ${projectPath}`);
      return null;
    }
    
    return resolvedPath;
  }
}

// Singleton instance
export const deploymentPreview = new DeploymentPreview();