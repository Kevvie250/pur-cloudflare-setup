// Application constants
export const APP_NAME = 'PurAir Cloudflare Setup';
export const CONFIG_VERSION = '1.0.0';

// Project types
export const PROJECT_TYPES = {
  SITE: 'site',
  API: 'api',
  APP: 'app'
};

// Environment types
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Feature flags
export const FEATURES = {
  ERROR_PAGES: 'error-pages',
  REDIRECTS: 'redirects',
  HEADERS: 'headers',
  ENV_VARS: 'env-vars',
  RATE_LIMITING: 'rate-limiting',
  CORS: 'cors'
};

// Framework options
export const FRAMEWORKS = {
  REACT: 'react',
  VUE: 'vue',
  NEXTJS: 'nextjs',
  NUXT: 'nuxt',
  SVELTEKIT: 'sveltekit',
  VANILLA: 'vanilla'
};

// File paths
export const PATHS = {
  TEMPLATES: 'templates',
  CONFIG: 'config',
  DOCS: 'docs',
  SCRIPTS: 'scripts',
  EXAMPLES: 'examples'
};

// Cloudflare specific
export const CLOUDFLARE = {
  WORKERS_RUNTIME: 'workers',
  PAGES_RUNTIME: 'pages',
  DEFAULT_COMPATIBILITY_DATE: '2024-01-01',
  DEFAULT_NODE_COMPAT: true
};

// Template variables prefix
export const TEMPLATE_VAR_PREFIX = '{{';
export const TEMPLATE_VAR_SUFFIX = '}}';

// Error messages
export const ERRORS = {
  INVALID_PROJECT_NAME: 'Invalid project name. Use lowercase letters, numbers, and hyphens only.',
  INVALID_DOMAIN: 'Invalid domain name format.',
  INVALID_PROJECT_TYPE: 'Invalid project type. Must be: site, api, or app.',
  CONFIG_NOT_FOUND: 'Configuration not found.',
  TEMPLATE_NOT_FOUND: 'Template not found.',
  FILE_NOT_FOUND: 'File not found.',
  VALIDATION_FAILED: 'Validation failed.'
};

// Success messages
export const SUCCESS = {
  CONFIG_SAVED: 'Configuration saved successfully.',
  CONFIG_DELETED: 'Configuration deleted successfully.',
  PROJECT_CREATED: 'Project created successfully.',
  FILES_GENERATED: 'Files generated successfully.'
};

// CLI text
export const CLI_TEXT = {
  WELCOME: 'Welcome to PurAir Cloudflare Setup Tool',
  SELECT_ACTION: 'What would you like to do?',
  PROJECT_INFO: 'Please provide project information:',
  CONFIG_SUMMARY: 'Project Configuration Summary:',
  NEXT_STEPS: 'Next Steps:'
};