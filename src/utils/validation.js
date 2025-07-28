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

// SECURITY: Additional API token validation functions
export function validateApiToken(token, type = 'generic') {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Length validation (tokens should be reasonably long)
  if (token.length < 8 || token.length > 256) {
    return false;
  }
  
  // Check for obvious test tokens
  const testTokens = ['test', 'example', 'demo', 'placeholder', '123456'];
  if (testTokens.some(test => token.toLowerCase().includes(test))) {
    return false;
  }
  
  // Type-specific validation
  switch (type) {
    case 'cloudflare':
      // Cloudflare tokens are typically 40 characters
      return token.length >= 30 && /^[A-Za-z0-9_-]+$/.test(token);
    case 'airtable':
      // Airtable keys start with 'key' or 'pat'
      return (token.startsWith('key') || token.startsWith('pat')) && token.length >= 17;
    default:
      // Generic token validation
      return /^[A-Za-z0-9_-]+$/.test(token);
  }
}

// SECURITY: Sanitize error messages to prevent information disclosure
export function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'An error occurred';
  }
  
  // Remove potential sensitive data patterns
  const sensitivePatterns = [
    /Bearer\s+[A-Za-z0-9\-_]+/gi,  // Bearer tokens
    /api[_-]?key[s]?[:\s=]+[A-Za-z0-9\-_]+/gi,  // API keys
    /token[s]?[:\s=]+[A-Za-z0-9\-_]+/gi,  // Generic tokens
    /password[s]?[:\s=]+\S+/gi,  // Passwords
    /secret[s]?[:\s=]+\S+/gi,  // Secrets
    /[A-Za-z0-9]{32,}/g  // Long hex strings (potential keys)
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  // Generic network errors
  if (sanitized.includes('ENOTFOUND') || sanitized.includes('ECONNREFUSED')) {
    return 'Network connection error';
  }
  
  if (sanitized.includes('timeout') || sanitized.includes('ETIMEDOUT')) {
    return 'Request timeout';
  }
  
  if (sanitized.includes('401') || sanitized.includes('403')) {
    return 'Authentication failed';
  }
  
  return sanitized.substring(0, 100); // Limit message length
}

// SECURITY: Rate limiting helper for API calls
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  isRateLimited(identifier) {
    const now = Date.now();
    const requestLog = this.requests.get(identifier) || [];
    
    // Clean old requests outside the window
    const recentRequests = requestLog.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return true;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return false;
  }
  
  getRemainingRequests(identifier) {
    const now = Date.now();
    const requestLog = this.requests.get(identifier) || [];
    const recentRequests = requestLog.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// SECURITY: Input sanitization with comprehensive checks
export function sanitizeUserInput(input, options = {}) {
  const {
    maxLength = 1000,
    allowHTML = false,
    allowNewlines = true,
    stripControlChars = true
  } = options;
  
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Limit length to prevent DoS
  sanitized = sanitized.substring(0, maxLength);
  
  // Remove null bytes and other control characters
  if (stripControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  // Remove newlines if not allowed
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\n\r]/g, ' ');
  }
  
  // Basic XSS prevention if not allowing HTML
  if (!allowHTML) {
    sanitized = sanitized.replace(/[<>]/g, '');
  }
  
  return sanitized.trim();
}