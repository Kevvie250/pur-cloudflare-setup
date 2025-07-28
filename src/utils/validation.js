import Joi from 'joi';
import path from 'path';

// Validation schemas
const schemas = {
  projectName: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .min(3)
    .max(50)
    .required(),
  
  domain: Joi.string()
    .domain({ tlds: { allow: true } })
    .required(),
  
  email: Joi.string()
    .email()
    .required(),
  
  projectType: Joi.string()
    .valid('site', 'api', 'app')
    .required(),
  
  environment: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  
  port: Joi.number()
    .port()
    .required(),
  
  url: Joi.string()
    .uri()
    .required()
};

// Individual validation functions
export function validateProjectName(name) {
  const { error } = schemas.projectName.validate(name);
  return !error;
}

export function validateDomain(domain) {
  const { error } = schemas.domain.validate(domain);
  return !error;
}

export function validateEmail(email) {
  const { error } = schemas.email.validate(email);
  return !error;
}

export function validateProjectType(type) {
  const { error } = schemas.projectType.validate(type);
  return !error;
}

export function validateEnvironment(env) {
  const { error } = schemas.environment.validate(env);
  return !error;
}

export function validatePort(port) {
  const { error } = schemas.port.validate(port);
  return !error;
}

export function validateUrl(url) {
  const { error } = schemas.url.validate(url);
  return !error;
}

// Complete configuration validation
export function validateProjectConfig(config) {
  const configSchema = Joi.object({
    projectName: schemas.projectName,
    domain: schemas.domain,
    projectType: schemas.projectType,
    environment: schemas.environment,
    features: Joi.array().items(Joi.string()),
    useWrangler: Joi.boolean(),
    useWorkers: Joi.boolean(),
    useKV: Joi.boolean(),
    useDurableObjects: Joi.boolean(),
    usePages: Joi.boolean(),
    buildStep: Joi.boolean(),
    framework: Joi.string().valid('react', 'vue', 'nextjs', 'nuxt', 'sveltekit', 'vanilla')
  });

  const { error, value } = configSchema.validate(config);
  
  if (error) {
    throw new Error(`Configuration validation failed: ${error.details[0].message}`);
  }
  
  return value;
}

// Sanitization functions
export function sanitizeProjectName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeDomain(domain) {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

// Path validation with security hardening
export function isValidPath(inputPath) {
  // Basic type and null byte validation
  if (typeof inputPath !== 'string') return false;
  if (inputPath.includes('\0')) return false;
  
  // Normalize the path to prevent traversal attacks
  const normalizedPath = path.normalize(inputPath);
  
  // Check for path traversal patterns
  const traversalPatterns = [
    /\.\.(\/|\\)/,              // ../
    /^\.\./,                    // starts with ..
    /\/\.\.$|\\\.\.$/,         // ends with /.. or \..
    /\.\.$/,                    // ends with ..
    /^\//,                      // absolute paths starting with /
    /^[A-Za-z]:[\\\/]/,        // Windows absolute paths
    /^\\\\|^\/\//              // UNC paths or protocol-like paths
  ];
  
  for (const pattern of traversalPatterns) {
    if (pattern.test(normalizedPath)) {
      return false;
    }
  }
  
  // Additional security checks
  const dangerousChars = ['<', '>', '|', '&', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (normalizedPath.includes(char)) {
      return false;
    }
  }
  
  // Ensure the path doesn't escape the current working directory
  try {
    const resolvedPath = path.resolve(normalizedPath);
    const cwd = process.cwd();
    
    // Path must be within the current working directory
    if (!resolvedPath.startsWith(cwd)) {
      return false;
    }
  } catch (error) {
    // If path resolution fails, it's invalid
    return false;
  }
  
  return true;
}

// Safe path resolution with boundary checking
export function resolveSafePath(inputPath, basePath = process.cwd()) {
  if (!isValidPath(inputPath)) {
    throw new Error('Invalid path provided');
  }
  
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(resolvedBase, inputPath);
  
  // Ensure resolved path is within the base path
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolvedPath;
}

// Template variable validation
export function validateTemplateVariables(variables) {
  const variableSchema = Joi.object().pattern(
    Joi.string().pattern(/^[A-Z_][A-Z0-9_]*$/),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array(),
      Joi.object()
    )
  );

  const { error } = variableSchema.validate(variables);
  return !error;
}