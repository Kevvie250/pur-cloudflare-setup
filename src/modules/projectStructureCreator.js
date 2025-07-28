import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { fileGenerator } from './fileGenerator.js';
import { templateEngine } from './templateEngine.js';
import { isValidPath } from '../utils/validation.js';

export class ProjectStructureCreator {
  constructor() {
    this.structures = this.defineStructures();
  }

  /**
   * Define project structures for different types
   */
  defineStructures() {
    return {
      vanilla: {
        directories: [
          'src',
          'src/js',
          'src/js/services',
          'src/js/managers',
          'src/js/utils',
          'src/js/config',
          'src/styles',
          'src/assets',
          'src/assets/images',
          'src/assets/fonts',
          'public',
          'docs',
          'tests'
        ],
        files: [
          { template: 'frontend/index.html.template', path: 'index.html' },
          { template: 'frontend/main.js.template', path: 'src/js/main.js' },
          { template: 'frontend/vite.config.js.template', path: 'vite.config.js' },
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'api/services/apiService.js.template', path: 'src/js/services/apiService.js' },
          { template: 'api/services/dataService.js.template', path: 'src/js/services/dataService.js' },
          { template: 'frontend/styles/main.css.template', path: 'src/styles/main.css' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      },
      react: {
        directories: [
          'src',
          'src/components',
          'src/services',
          'src/hooks',
          'src/utils',
          'src/styles',
          'src/assets',
          'public',
          'tests'
        ],
        files: [
          { template: 'frontend/index.html.template', path: 'index.html' },
          { template: 'frontend/main.js.template', path: 'src/main.jsx' },
          { template: 'frontend/react/App.jsx.template', path: 'src/App.jsx' },
          { template: 'frontend/vite.config.js.template', path: 'vite.config.js' },
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      },
      vue: {
        directories: [
          'src',
          'src/components',
          'src/views',
          'src/services',
          'src/composables',
          'src/utils',
          'src/styles',
          'src/assets',
          'public',
          'tests'
        ],
        files: [
          { template: 'frontend/index.html.template', path: 'index.html' },
          { template: 'frontend/main.js.template', path: 'src/main.js' },
          { template: 'frontend/vue/App.vue.template', path: 'src/App.vue' },
          { template: 'frontend/vite.config.js.template', path: 'vite.config.js' },
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      },
      worker: {
        directories: [
          'src',
          'tests',
          'docs'
        ],
        files: [
          { template: 'cloudflare/wrangler.toml.template', path: 'wrangler.toml' },
          { template: 'cloudflare/airtable-proxy.js.template', path: 'src/index.js' },
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      },
      pages: {
        directories: [
          'functions',
          'functions/api',
          'src',
          'src/js',
          'src/styles',
          'src/assets',
          'public',
          'tests'
        ],
        files: [
          { template: 'cloudflare/pages-function.js.template', path: 'functions/api/[[path]].js' },
          { template: 'frontend/index.html.template', path: 'index.html' },
          { template: 'frontend/main.js.template', path: 'src/js/main.js' },
          { template: 'frontend/vite.config.js.template', path: 'vite.config.js' },
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      },
      fullstack: {
        directories: [
          'worker',
          'worker/src',
          'frontend',
          'frontend/src',
          'frontend/src/js',
          'frontend/src/styles',
          'frontend/src/assets',
          'frontend/public',
          'shared',
          'shared/types',
          'shared/utils',
          'tests',
          'docs'
        ],
        files: [
          // Worker files
          { template: 'cloudflare/wrangler.toml.template', path: 'worker/wrangler.toml' },
          { template: 'cloudflare/airtable-proxy.js.template', path: 'worker/src/index.js' },
          { template: 'config/package.json.template', path: 'worker/package.json' },
          // Frontend files
          { template: 'frontend/index.html.template', path: 'frontend/index.html' },
          { template: 'frontend/main.js.template', path: 'frontend/src/js/main.js' },
          { template: 'frontend/vite.config.js.template', path: 'frontend/vite.config.js' },
          { template: 'config/package.json.template', path: 'frontend/package.json' },
          // Root files
          { template: 'config/package.json.template', path: 'package.json' },
          { template: 'config/.env.example.template', path: '.env.example' },
          { template: 'config/.gitignore.template', path: '.gitignore' }
        ]
      }
    };
  }

  /**
   * Create project structure
   */
  async createProjectStructure(projectPath, config) {
    const spinner = ora('Creating project structure...').start();
    
    try {
      // Validate project path
      if (!isValidPath(projectPath)) {
        throw new Error('Invalid project path');
      }
      
      // Check if directory exists
      const exists = await fs.pathExists(projectPath);
      if (exists && !config.overwrite) {
        const files = await fs.readdir(projectPath);
        if (files.length > 0) {
          throw new Error(`Directory ${projectPath} already exists and is not empty`);
        }
      }
      
      // Determine structure type
      const structureType = this.determineStructureType(config);
      const structure = this.structures[structureType];
      
      if (!structure) {
        throw new Error(`Unknown structure type: ${structureType}`);
      }
      
      // Prepare template variables
      const templateVars = this.prepareTemplateVariables(config);
      
      // Create project structure
      const result = await fileGenerator.generateProjectStructure(
        projectPath,
        structure,
        templateVars,
        {
          overwrite: config.overwrite,
          backup: config.backup
        }
      );
      
      // Create additional files based on config
      await this.createAdditionalFiles(projectPath, config, templateVars);
      
      // Run post-creation tasks
      await this.runPostCreationTasks(projectPath, config);
      
      spinner.succeed('Project structure created successfully');
      
      return {
        ...result,
        structureType,
        templateVars
      };
    } catch (error) {
      spinner.fail('Failed to create project structure');
      throw error;
    }
  }

  /**
   * Determine structure type based on config
   */
  determineStructureType(config) {
    if (config.projectType === 'worker-only') {
      return 'worker';
    }
    
    if (config.projectType === 'pages-only') {
      return 'pages';
    }
    
    if (config.projectType === 'fullstack') {
      return 'fullstack';
    }
    
    // Frontend type
    return config.frameworkType || 'vanilla';
  }

  /**
   * Prepare template variables from config
   */
  prepareTemplateVariables(config) {
    const now = new Date();
    
    return {
      // Project info
      projectName: config.projectName,
      projectDescription: config.description || `${config.projectName} - Built with PurAir Cloudflare Setup`,
      author: config.author || 'PurAir Team',
      license: config.license || 'MIT',
      version: config.version || '1.0.0',
      
      // Cloudflare config
      cloudflareAccountId: config.cloudflareAccountId || '',
      workerName: config.workerName || `${config.projectName}-worker`,
      domain: config.domain || '',
      customDomain: !!config.domain,
      zoneName: config.domain || '',
      workerDevUrl: config.workerDevUrl || 'http://localhost:8787',
      
      // API config
      apiType: config.apiType || 'custom',
      apiBaseUrl: config.apiBaseUrl || '/api',
      apiTimeout: config.apiTimeout || 30000,
      
      // Framework config
      frameworkType: config.frameworkType || 'vanilla',
      useTypeScript: config.useTypeScript || false,
      
      // Features
      enableCloudflareWorker: config.projectType !== 'frontend-only',
      enableCloudflarePages: config.projectType === 'pages-only' || config.projectType === 'fullstack',
      enableAuthentication: config.enableAuth || false,
      authProvider: config.authProvider || 'custom',
      enableDatabase: config.enableDatabase || false,
      databaseType: config.databaseType || 'd1',
      enableKVStorage: config.enableKV || false,
      kvBinding: config.kvBinding || 'KV',
      enableR2Storage: config.enableR2 || false,
      r2BucketName: config.r2BucketName || `${config.projectName}-assets`,
      r2Binding: config.r2Binding || 'R2',
      enableDurableObjects: config.enableDurableObjects || false,
      durableObjectName: config.durableObjectName || 'DO',
      durableObjectClass: config.durableObjectClass || 'DurableObject',
      enableWebhooks: config.enableWebhooks || false,
      webhookSecret: config.webhookSecret || '',
      enableAnalytics: config.enableAnalytics || false,
      enableRateLimiting: config.enableRateLimiting || false,
      enableCache: config.enableCache || false,
      
      // UI Features
      enableFilters: config.enableFilters !== false,
      enableStats: config.enableStats !== false,
      enableCharts: config.enableCharts || false,
      enableDataTable: config.enableDataTable !== false,
      enablePagination: config.enablePagination !== false,
      enableSorting: config.enableSorting !== false,
      enableExport: config.enableExport || false,
      enableModals: config.enableModals || false,
      enableToasts: config.enableToasts !== false,
      enablePWA: config.enablePWA || false,
      
      // Development
      devServerPort: config.devServerPort || 5173,
      previewPort: config.previewPort || 4173,
      enableTests: config.enableTests || false,
      enableLinting: config.enableLinting !== false,
      enableFormatting: config.enableFormatting !== false,
      enableHotReload: config.enableHotReload !== false,
      
      // Build config
      enablePostCSS: config.enablePostCSS || false,
      useTailwind: config.useTailwind || false,
      useSass: config.useSass || false,
      useLess: config.useLess || false,
      
      // Data
      defaultTable: config.defaultTable || 'data',
      defaultView: config.defaultView || 'Grid view',
      defaultEndpoint: config.defaultEndpoint || '/data',
      defaultPageSize: config.defaultPageSize || 25,
      defaultSortColumn: config.defaultSortColumn || 'created',
      defaultSortDirection: config.defaultSortDirection || 'desc',
      defaultChartType: config.defaultChartType || 'bar',
      defaultChartLabel: config.defaultChartLabel || 'Data',
      
      // Styling
      themeColor: config.themeColor || '#3B82F6',
      chartBackgroundColor: config.chartBackgroundColor || 'rgba(59, 130, 246, 0.5)',
      chartBorderColor: config.chartBorderColor || 'rgb(59, 130, 246)',
      toastDuration: config.toastDuration || 3000,
      toastPosition: config.toastPosition || 'top-right',
      
      // Meta
      currentYear: now.getFullYear(),
      currentDate: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      compatibilityDate: now.toISOString().split('T')[0],
      
      // Additional config
      keywords: config.keywords || ['cloudflare', 'worker', 'purair'],
      repository: config.repository || '',
      homepage: config.homepage || '',
      bugs: config.bugsUrl || '',
      
      // Environment variables
      envVars: config.envVars || [],
      secrets: config.secrets || [],
      customEnvVars: config.customEnvVars || [],
      
      // Additional pages for multi-page apps
      additionalPages: config.additionalPages || [],
      
      // Custom aliases for Vite
      customAliases: config.customAliases || [],
      
      // Dependencies
      additionalDependencies: config.additionalDependencies || [],
      additionalDevDependencies: config.additionalDevDependencies || [],
      
      // Scripts
      customScripts: config.customScripts || [],
      
      // Features flags
      featureFlags: config.featureFlags || [],
      enableFeatureFlags: (config.featureFlags && config.featureFlags.length > 0) || false,
      
      // Columns for data table
      tableColumns: config.tableColumns || [
        { label: 'ID', key: 'id', class: 'text-left' },
        { label: 'Name', key: 'name', class: 'text-left' },
        { label: 'Status', key: 'status', class: 'text-center' },
        { label: 'Created', key: 'created', class: 'text-right' }
      ],
      
      // Stats cards configuration
      statsCards: config.statsCards || [
        { id: 'total', label: 'Total Records', icon: 'database', dataKey: 'total', format: 'number' },
        { id: 'active', label: 'Active', icon: 'check-circle', dataKey: 'active', format: 'number' },
        { id: 'pending', label: 'Pending', icon: 'clock', dataKey: 'pending', format: 'number' },
        { id: 'completed', label: 'Completed', icon: 'check', dataKey: 'completed', format: 'percent' }
      ],
      
      // Navigation links
      navigationLinks: config.navigationLinks || [],
      
      // Filters configuration
      filters: config.filters || [],
      
      // Optimization
      optimizeDepsInclude: config.optimizeDepsInclude || [],
      optimizeDepsExclude: config.optimizeDepsExclude || [],
      
      // Compatibility flags
      compatibility_flags: config.compatibilityFlags || [],
      
      // Build settings
      buildWatch: config.buildWatch !== false,
      sourceMaps: config.sourceMaps !== false,
      analyzeBundle: config.analyzeBundle || false,
      
      // Security
      allowedOrigins: config.allowedOrigins || 'http://localhost:*',
      allowedOriginsStaging: config.allowedOriginsStaging || '*',
      
      // Logging
      debugMode: config.debugMode || false,
      
      // Tail consumers
      enableTailConsumers: config.enableTailConsumers || false,
      tailService: config.tailService || '',
      
      // Node compatibility
      useNodeCompat: config.useNodeCompat || false,
      
      // Workspaces
      workspaces: config.workspaces || [],
      
      // Husky
      enableHusky: config.enableHusky || false,
      
      // Libraries
      useAxios: config.useAxios || false,
      useChartLibrary: config.enableCharts || false,
      useDataTables: config.useDataTables || false,
      useDateLibrary: config.useDateLibrary || false,
      useFormLibrary: config.useFormLibrary || false,
      useStateManagement: config.useStateManagement || false,
      useReactRouter: config.frameworkType === 'react' && config.useRouter,
      useVueRouter: config.frameworkType === 'vue' && config.useRouter,
      usePinia: config.frameworkType === 'vue' && config.useStateManagement,
      useSvelteKit: config.frameworkType === 'svelte' && config.useSvelteKit,
      usePreactRouter: config.frameworkType === 'preact' && config.useRouter,
      
      // Analytics providers
      useGoogleAnalytics: config.analyticsProvider === 'google',
      usePlausible: config.analyticsProvider === 'plausible',
      usePostHog: config.analyticsProvider === 'posthog',
      gaTrackingId: config.gaTrackingId || '',
      
      // Email providers
      enableEmailService: config.enableEmailService || false,
      emailProvider: config.emailProvider || 'sendgrid',
      
      // Payment providers
      enablePayments: config.enablePayments || false,
      paymentProvider: config.paymentProvider || 'stripe',
      
      // Monitoring
      enableMonitoring: config.enableMonitoring || false,
      monitoringProvider: config.monitoringProvider || 'sentry',
      
      // User menu
      enableUserMenu: config.enableUserMenu || config.enableAuth,
      
      // Websockets
      enableWebsockets: config.enableWebsockets || false,
      
      // Type checking
      enableTypeCheck: config.useTypeScript || false,
      
      // HMR
      enableHMR: config.enableHotReload !== false,
      
      // Google Fonts
      useGoogleFonts: config.useGoogleFonts || false,
      googleFontFamily: config.googleFontFamily || 'Inter',
      googleFontWeights: config.googleFontWeights || '400;500;600;700',
      
      // Custom styles and scripts
      customStyles: config.customStyles || [],
      customScriptsInHtml: config.customScriptsInHtml || [],
      
      // Critical CSS
      criticalCSS: config.criticalCSS || '',
      
      // OG/Twitter images
      ogImage: config.ogImage || '',
      twitterImage: config.twitterImage || ''
    };
  }

  /**
   * Create additional files based on config
   */
  async createAdditionalFiles(projectPath, config, templateVars) {
    const additionalFiles = [];
    
    // Add service files for vanilla JS
    if (config.frameworkType === 'vanilla') {
      additionalFiles.push(
        { template: 'api/services/apiService.js.template', path: 'src/js/services/apiService.js' },
        { template: 'api/services/dataService.js.template', path: 'src/js/services/dataService.js' },
        { template: 'frontend/managers/uiManager.js.template', path: 'src/js/managers/uiManager.js' },
        { template: 'frontend/utils/logger.js.template', path: 'src/js/utils/logger.js' },
        { template: 'frontend/config/index.js.template', path: 'src/js/config/index.js' }
      );
      
      if (config.enableFilters) {
        additionalFiles.push({
          template: 'frontend/managers/filterManager.js.template',
          path: 'src/js/managers/filterManager.js'
        });
      }
      
      if (config.enableCharts) {
        additionalFiles.push({
          template: 'frontend/managers/chartManager.js.template',
          path: 'src/js/managers/chartManager.js'
        });
      }
      
      if (config.enableDataTable !== false) {
        additionalFiles.push({
          template: 'frontend/managers/tableManager.js.template',
          path: 'src/js/managers/tableManager.js'
        });
      }
      
      if (config.enableModals) {
        additionalFiles.push({
          template: 'frontend/services/modalService.js.template',
          path: 'src/js/services/modalService.js'
        });
      }
      
      if (config.enableToasts !== false) {
        additionalFiles.push({
          template: 'frontend/services/toastService.js.template',
          path: 'src/js/services/toastService.js'
        });
      }
    }
    
    // Add TypeScript config if enabled
    if (config.useTypeScript) {
      additionalFiles.push({
        template: 'config/tsconfig.json.template',
        path: 'tsconfig.json'
      });
    }
    
    // Add ESLint config if enabled
    if (config.enableLinting !== false) {
      additionalFiles.push({
        template: 'config/.eslintrc.json.template',
        path: '.eslintrc.json'
      });
    }
    
    // Add Prettier config if enabled
    if (config.enableFormatting !== false) {
      additionalFiles.push({
        template: 'config/.prettierrc.json.template',
        path: '.prettierrc.json'
      });
    }
    
    // Add Tailwind config if enabled
    if (config.useTailwind) {
      additionalFiles.push(
        { template: 'config/tailwind.config.js.template', path: 'tailwind.config.js' },
        { template: 'frontend/styles/tailwind.css.template', path: 'src/styles/tailwind.css' }
      );
    }
    
    // Add README
    additionalFiles.push({
      template: 'docs/README.md.template',
      path: 'README.md'
    });
    
    // Generate additional files
    if (additionalFiles.length > 0) {
      const fileMap = {};
      for (const file of additionalFiles) {
        fileMap[file.template] = path.join(projectPath, file.path);
      }
      
      await fileGenerator.generateFiles(fileMap, templateVars, {
        overwrite: config.overwrite,
        continueOnError: true
      });
    }
  }

  /**
   * Run post-creation tasks
   */
  async runPostCreationTasks(projectPath, config) {
    const tasks = [];
    
    // Make scripts executable
    const scriptsDir = path.join(projectPath, 'scripts');
    if (await fs.pathExists(scriptsDir)) {
      const scripts = await fs.readdir(scriptsDir);
      for (const script of scripts) {
        if (script.endsWith('.sh')) {
          tasks.push({
            type: 'chmod',
            path: `scripts/${script}`,
            mode: 0o755
          });
        }
      }
    }
    
    // Copy .env.example to .env if it doesn't exist
    const envPath = path.join(projectPath, '.env');
    const envExamplePath = path.join(projectPath, '.env.example');
    
    if (await fs.pathExists(envExamplePath) && !await fs.pathExists(envPath)) {
      await fs.copy(envExamplePath, envPath);
      console.log(chalk.green('Created .env file from .env.example'));
    }
    
    // Run tasks
    for (const task of tasks) {
      await fileGenerator.runPostGenerateTask(task, projectPath, {});
    }
  }

  /**
   * Validate project structure
   */
  async validateProjectStructure(projectPath, config) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Check if project directory exists
      if (!await fs.pathExists(projectPath)) {
        validation.valid = false;
        validation.errors.push('Project directory does not exist');
        return validation;
      }
      
      // Check required files
      const requiredFiles = ['package.json'];
      
      if (config.projectType !== 'worker-only') {
        requiredFiles.push('index.html', 'vite.config.js');
      }
      
      if (config.projectType === 'worker-only' || config.projectType === 'fullstack') {
        requiredFiles.push('wrangler.toml');
      }
      
      for (const file of requiredFiles) {
        const filePath = path.join(projectPath, file);
        if (!await fs.pathExists(filePath)) {
          validation.valid = false;
          validation.errors.push(`Required file missing: ${file}`);
        }
      }
      
      // Check directory structure
      const requiredDirs = ['src'];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(projectPath, dir);
        if (!await fs.pathExists(dirPath)) {
          validation.warnings.push(`Expected directory missing: ${dir}`);
        }
      }
      
      // Validate generated files
      const generatedValidation = await fileGenerator.validateGeneratedFiles();
      
      if (generatedValidation.invalid.length > 0) {
        validation.valid = false;
        generatedValidation.invalid.forEach(({ file, reason }) => {
          validation.errors.push(`Invalid file ${file}: ${reason}`);
        });
      }
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
  }
}

// Export singleton instance
export const projectStructureCreator = new ProjectStructureCreator();