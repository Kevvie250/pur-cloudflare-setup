# Security Guide

## Table of Contents

- [Security Overview](#security-overview)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [Template Security](#template-security)
- [File System Security](#file-system-security)
- [Configuration Security](#configuration-security)
- [API Token Management](#api-token-management)
- [Runtime Security](#runtime-security)
- [Compliance & Standards](#compliance--standards)
- [Security Best Practices](#security-best-practices)
- [Security Testing](#security-testing)
- [Incident Response](#incident-response)
- [Security Auditing](#security-auditing)

## Security Overview

The PurAir Cloudflare Setup Tool is designed with security as a primary concern. This guide outlines the security features, best practices, and compliance measures implemented throughout the application.

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions and access rights
3. **Input Validation**: Comprehensive validation at all input points
4. **Output Encoding**: Context-aware output sanitization
5. **Secure by Default**: Safe default configurations
6. **Fail Securely**: Graceful failure without information disclosure

### Threat Model

**Primary Threats Addressed:**
- **Code Injection**: XSS, command injection, template injection
- **Path Traversal**: Directory traversal attacks
- **Information Disclosure**: Credential leakage, error information
- **Denial of Service**: Resource exhaustion, infinite loops
- **Supply Chain**: Dependency vulnerabilities
- **Configuration Tampering**: Malicious configuration changes

## Input Validation & Sanitization

### Validation Architecture

All user inputs undergo multi-layer validation:

```javascript
// Input validation flow
User Input → Basic Type Check → Format Validation → Security Validation → Business Logic Validation
```

### Project Name Validation

```javascript
// src/utils/validation.js
export function validateProjectName(name) {
  // Type validation
  if (typeof name !== 'string') return false;
  
  // Length validation (prevents DoS)
  if (name.length < 3 || name.length > 50) return false;
  
  // Format validation (prevents injection)
  if (!/^[a-z0-9-]+$/.test(name)) return false;
  
  // Security validation (prevents abuse)
  if (name.startsWith('-') || name.endsWith('-')) return false;
  if (name.includes('--')) return false;
  
  return true;
}
```

### Domain Validation

```javascript
export function validateDomain(domain) {
  const { error } = Joi.string()
    .domain({ tlds: { allow: true } })
    .max(253) // RFC limit
    .validate(domain);
  
  return !error;
}
```

### Input Sanitization

```javascript
export function sanitizeUserInput(input, options = {}) {
  const {
    maxLength = 1000,        // Prevent DoS
    allowHTML = false,       // XSS prevention
    allowNewlines = true,    // Context-dependent
    stripControlChars = true // Prevent injection
  } = options;
  
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Length limitation (DoS prevention)
  sanitized = sanitized.substring(0, maxLength);
  
  // Remove dangerous control characters
  if (stripControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  // Handle newlines based on context
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\n\r]/g, ' ');
  }
  
  // XSS prevention
  if (!allowHTML) {
    sanitized = sanitized.replace(/[<>]/g, '');
  }
  
  return sanitized.trim();
}
```

### Path Validation

Critical for preventing directory traversal attacks:

```javascript
export function isValidPath(inputPath) {
  // Type validation
  if (typeof inputPath !== 'string') return false;
  
  // Null byte injection prevention
  if (inputPath.includes('\0')) return false;
  
  // Path normalization
  const normalizedPath = path.normalize(inputPath);
  
  // Traversal pattern detection
  const traversalPatterns = [
    /\.\.(\/|\\)/,              // ../
    /^\.\./,                    // starts with ..
    /\/\.\.$|\\\.\.$/,         // ends with /.. or \..
    /\.\.$/,                    // ends with ..
    /^\//,                      // absolute paths
    /^[A-Za-z]:[\\\/]/,        // Windows absolute paths
    /^\\\\|^\/\//              // UNC paths
  ];
  
  for (const pattern of traversalPatterns) {
    if (pattern.test(normalizedPath)) {
      return false;
    }
  }
  
  // Dangerous character detection
  const dangerousChars = ['<', '>', '|', '&', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (normalizedPath.includes(char)) {
      return false;
    }
  }
  
  // Boundary validation
  try {
    const resolvedPath = path.resolve(normalizedPath);
    const cwd = process.cwd();
    
    if (!resolvedPath.startsWith(cwd)) {
      return false;
    }
  } catch (error) {
    return false;
  }
  
  return true;
}
```

### Safe Path Resolution

```javascript
export function resolveSafePath(inputPath, basePath = process.cwd()) {
  if (!isValidPath(inputPath)) {
    throw new Error('Invalid path provided');
  }
  
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(resolvedBase, inputPath);
  
  // Double-check boundary enforcement
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolvedPath;
}
```

## Template Security

### Context-Aware Output Encoding

The template engine provides context-specific encoding to prevent injection attacks:

```javascript
// Template security by context
export class TemplateEngine {
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
        return stringValue; // Use with extreme caution
      default:
        return this.escapeHtml(stringValue); // Safe default
    }
  }
}
```

### HTML Escaping

```javascript
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
```

### JavaScript Escaping

```javascript
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
    '\u2028': '\\u2028', // Line separator
    '\u2029': '\\u2029'  // Paragraph separator
  };
  
  return str.replace(/[\\"'\n\r\t\b\f\v\0\u2028\u2029]/g, char => jsEscapes[char] || char);
}
```

### Shell Escaping

```javascript
escapeShell(str) {
  if (!str) return "''";
  
  // Single quote escaping is the safest approach for shell
  const escaped = str.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}
```

### Template Variable Validation

```javascript
validateVariables(templateContent, providedVariables = {}) {
  const requiredVars = new Set();
  const varRegex = /\{\{([^#\/].*?)\}\}/g;
  let match;
  
  while ((match = varRegex.exec(templateContent)) !== null) {
    const expression = match[1].trim();
    if (!expression.includes(' ')) {
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
```

### Safe Template Processing

```javascript
async processTemplate(templateContent, variables = {}, options = {}) {
  try {
    // Validate template variables first
    const validation = this.validateVariables(templateContent, variables);
    if (!validation.isValid) {
      throw new Error(`Missing template variables: ${validation.missing.join(', ')}`);
    }
    
    // Detect and validate context
    const context = options.context || this.detectContext(options.templatePath);
    
    // Sanitize variables based on context
    const sanitizedVariables = this.sanitizeTemplateVariables(variables, context);
    
    // Process with security context
    const templateContext = {
      ...sanitizedVariables,
      ...this.helperFunctions,
      _securityContext: context
    };
    
    return this.processInternal(templateContent, templateContext);
  } catch (error) {
    // Sanitize error messages to prevent information disclosure
    throw new Error(`Template processing failed: ${sanitizeErrorMessage(error.message)}`);
  }
}
```

## File System Security

### Secure File Operations

All file operations are performed with security controls:

```javascript
// src/modules/fileGenerator.js
export class FileGenerator {
  async generateFile(outputPath, content) {
    // Validate output path
    if (!isValidPath(outputPath)) {
      throw new Error('Invalid output path');
    }
    
    // Resolve path safely
    const safePath = resolveSafePath(outputPath);
    
    // Ensure parent directory exists
    const parentDir = path.dirname(safePath);
    await fs.ensureDir(parentDir);
    
    // Write with secure permissions
    await fs.writeFile(safePath, content, {
      encoding: 'utf8',
      mode: 0o644 // rw-r--r--
    });
    
    // Log file creation (without sensitive content)
    logger.info('File generated', {
      path: path.basename(safePath),
      size: content.length
    });
  }
}
```

### Directory Creation Security

```javascript
async createDirectories(projectPath, config) {
  // Validate project path
  const safePath = resolveSafePath(projectPath);
  
  // Create with secure permissions
  await fs.ensureDir(safePath, { mode: 0o755 }); // rwxr-xr-x
  
  // Create subdirectories
  const subdirs = this.getRequiredDirectories(config);
  for (const subdir of subdirs) {
    const subdirPath = resolveSafePath(subdir, safePath);
    await fs.ensureDir(subdirPath, { mode: 0o755 });
  }
}
```

### File Permission Management

```javascript
// Set appropriate file permissions
const setSecurePermissions = async (filePath, isExecutable = false) => {
  const mode = isExecutable ? 0o755 : 0o644;
  await fs.chmod(filePath, mode);
};

// Example usage in file generation
await generateFile(scriptPath, scriptContent);
await setSecurePermissions(scriptPath, true); // Executable script
```

## Configuration Security

### Configuration Storage

Configurations are stored securely in the user's home directory:

```javascript
// src/modules/configManager.js
export class ConfigManager {
  constructor() {
    // Use user home directory (secure by default)
    this.configDir = path.join(os.homedir(), '.pur-cloudflare-setup');
    
    // Ensure secure directory permissions
    this.ensureSecureConfigDir();
  }
  
  async ensureSecureConfigDir() {
    try {
      await fs.ensureDir(this.configDir, { mode: 0o700 }); // rwx------
    } catch (error) {
      throw new Error(`Failed to create secure config directory: ${error.message}`);
    }
  }
}
```

### Configuration Validation

```javascript
async save(name, config) {
  // Validate configuration name
  if (!name || !isValidPath(name)) {
    throw new Error('Invalid configuration name');
  }
  
  // Validate configuration structure
  const validatedConfig = validateProjectConfig(config);
  
  // Sanitize sensitive data before saving
  const sanitizedConfig = this.sanitizeConfig(validatedConfig);
  
  // Save with metadata
  const configData = {
    ...sanitizedConfig,
    _metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0'
    }
  };
  
  const configs = await this.loadAllConfigs();
  configs[name] = configData;
  
  await this.saveAllConfigs(configs);
  return configData;
}
```

### Sensitive Data Handling

```javascript
sanitizeConfig(config) {
  const sanitized = { ...config };
  
  // Remove or mask sensitive fields
  if (sanitized.apiKey) {
    sanitized.apiKey = '[REDACTED]';
  }
  
  if (sanitized.secrets) {
    delete sanitized.secrets;
  }
  
  // Sanitize user-provided strings
  if (sanitized.description) {
    sanitized.description = sanitizeUserInput(sanitized.description, {
      maxLength: 200,
      allowHTML: false
    });
  }
  
  return sanitized;
}
```

## API Token Management

### Token Validation

```javascript
export function validateApiToken(token, type = 'generic') {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Length validation (prevents trivial tokens)
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
      return token.length >= 30 && /^[A-Za-z0-9_-]+$/.test(token);
    case 'airtable':
      return (token.startsWith('key') || token.startsWith('pat')) && token.length >= 17;
    default:
      return /^[A-Za-z0-9_-]+$/.test(token);
  }
}
```

### Token Storage Security

```javascript
// Environment variable recommendation
const loadApiCredentials = () => {
  const config = {
    cloudflareToken: process.env.CLOUDFLARE_API_TOKEN,
    airtableKey: process.env.AIRTABLE_API_KEY
  };
  
  // Validate tokens
  if (config.cloudflareToken && !validateApiToken(config.cloudflareToken, 'cloudflare')) {
    throw new Error('Invalid Cloudflare API token format');
  }
  
  if (config.airtableKey && !validateApiToken(config.airtableKey, 'airtable')) {
    throw new Error('Invalid Airtable API key format');
  }
  
  return config;
};
```

### Token Masking in Logs

```javascript
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
    /[A-Za-z0-9]{32,}/g  // Long hex strings
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized.substring(0, 100); // Limit message length
}
```

## Runtime Security

### Rate Limiting

```javascript
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  isRateLimited(identifier) {
    const now = Date.now();
    const requestLog = this.requests.get(identifier) || [];
    
    // Clean old requests
    const recentRequests = requestLog.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return true;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return false;
  }
}
```

### Memory Management

```javascript
// Prevent memory exhaustion
const processLargeFile = async (filePath) => {
  const stats = await fs.stat(filePath);
  
  // Limit file size (prevent DoS)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error('File too large to process');
  }
  
  // Stream processing for large files
  if (stats.size > 1024 * 1024) { // 1MB
    return processFileStream(filePath);
  } else {
    return fs.readFile(filePath, 'utf8');
  }
};
```

### Process Security

```javascript
// Secure process execution (if needed)
const executeSecurely = async (command, args = []) => {
  // Validate command
  const allowedCommands = ['npm', 'git', 'wrangler'];
  if (!allowedCommands.includes(command)) {
    throw new Error('Command not allowed');
  }
  
  // Sanitize arguments
  const sanitizedArgs = args.map(arg => {
    if (typeof arg !== 'string') {
      throw new Error('Invalid argument type');
    }
    
    // Remove dangerous characters
    return arg.replace(/[;&|`$(){}[\]<>]/g, '');
  });
  
  // Execute with timeout and resource limits
  const result = await execWithTimeout(command, sanitizedArgs, {
    timeout: 30000, // 30 second timeout
    maxBuffer: 1024 * 1024 // 1MB buffer limit
  });
  
  return result;
};
```

## Compliance & Standards

### Security Standards Compliance

The tool follows industry security standards:

1. **OWASP Top 10**: Address common web application security risks
2. **CIS Controls**: Implement basic cybersecurity controls
3. **ISO 27001**: Follow information security management practices
4. **NIST Cybersecurity Framework**: Implement cybersecurity risk management

### Data Protection

```javascript
// GDPR/Privacy compliance
const handlePersonalData = (userData) => {
  // Minimize data collection
  const minimalData = {
    projectName: userData.projectName,
    domain: userData.domain,
    projectType: userData.projectType
    // Exclude: email, names, personal identifiers
  };
  
  // Implement data retention
  const retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
  minimalData._expires = Date.now() + retentionPeriod;
  
  return minimalData;
};
```

### Audit Logging

```javascript
// Security event logging
const auditLogger = {
  logSecurityEvent(event, details = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      severity: this.getSeverity(event),
      details: sanitizeLogDetails(details),
      sessionId: this.getSessionId()
    };
    
    // Log to secure audit file
    fs.appendFileSync(
      path.join(os.homedir(), '.pur-cloudflare-setup', 'audit.log'),
      JSON.stringify(auditEntry) + '\n',
      { mode: 0o600 }
    );
  },
  
  getSeverity(event) {
    const highSeverityEvents = [
      'path_traversal_attempt',
      'invalid_token_detected',
      'unauthorized_access'
    ];
    
    return highSeverityEvents.includes(event) ? 'HIGH' : 'INFO';
  }
};
```

## Security Best Practices

### For Users

1. **Environment Variables**
   ```bash
   # Use .env files for sensitive data
   echo "CLOUDFLARE_API_TOKEN=your_token_here" >> .env
   echo ".env" >> .gitignore
   ```

2. **Token Management**
   ```bash
   # Use token scopes appropriately
   # Cloudflare: Zone:Edit, Account:Read
   # Rotate tokens regularly
   ```

3. **File Permissions**
   ```bash
   # Ensure secure permissions on config files
   chmod 600 ~/.pur-cloudflare-setup/configs.json
   ```

4. **Regular Updates**
   ```bash
   # Keep the tool updated
   npm update -g pur-cloudflare-setup
   ```

### For Developers

1. **Input Validation**
   ```javascript
   // Always validate user inputs
   const validateAndSanitize = (input, options) => {
     if (!validateInput(input)) {
       throw new Error('Invalid input');
     }
     return sanitizeUserInput(input, options);
   };
   ```

2. **Output Encoding**
   ```javascript
   // Use context-appropriate encoding
   const safeOutput = templateEngine.escapeForContext(userInput, 'html');
   ```

3. **Error Handling**
   ```javascript
   // Don't expose sensitive information in errors
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', { operation: 'riskyOperation' });
     throw new Error('Operation failed'); // Generic message
   }
   ```

4. **Dependency Management**
   ```bash
   # Regular security audits
   npm audit
   npm audit fix
   
   # Use lock files
   npm ci # Use package-lock.json
   ```

## Security Testing

### Automated Security Testing

```javascript
// Security test examples
describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32'
      ];
      
      maliciousPaths.forEach(path => {
        expect(isValidPath(path)).toBe(false);
      });
    });
    
    it('should sanitize XSS attempts', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>'
      ];
      
      xssPayloads.forEach(payload => {
        const sanitized = sanitizeUserInput(payload, { allowHTML: false });
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
      });
    });
    
    it('should validate API tokens correctly', () => {
      const invalidTokens = [
        'test',
        '123456',
        'example',
        'placeholder',
        '',
        null,
        undefined
      ];
      
      invalidTokens.forEach(token => {
        expect(validateApiToken(token)).toBe(false);
      });
    });
  });
  
  describe('Template Security', () => {
    it('should escape template variables by default', async () => {
      const template = '<div>{{userInput}}</div>';
      const variables = { userInput: '<script>alert("xss")</script>' };
      
      const result = await templateEngine.processTemplate(template, variables, {
        context: 'html'
      });
      
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
    
    it('should handle shell escaping correctly', () => {
      const dangerousShellInput = "; rm -rf /";
      const escaped = templateEngine.escapeShell(dangerousShellInput);
      
      expect(escaped).toBe("'; rm -rf /'");
    });
  });
});
```

### Manual Security Testing

1. **Path Traversal Testing**
   ```bash
   # Test with malicious paths
   node setup.js --name "../../../malicious" --type api
   node setup.js --config "../../../etc/passwd"
   ```

2. **Input Injection Testing**
   ```bash
   # Test with injection payloads
   node setup.js --name "test<script>alert(1)</script>" --type api
   node setup.js --domain "evil.com'; DROP TABLE users;--"
   ```

3. **Template Injection Testing**
   ```bash
   # Test template processing with malicious input
   echo '{{constructor.constructor("alert(1)")()}}' > test.template
   ```

### Security Scan Integration

```javascript
// package.json scripts
{
  "scripts": {
    "security:audit": "npm audit",
    "security:scan": "npx snyk test",
    "security:test": "jest --testPathPattern=security",
    "security:full": "npm run security:audit && npm run security:scan && npm run security:test"
  }
}
```

## Incident Response

### Security Incident Classification

1. **Critical**: Active exploitation, data breach
2. **High**: Vulnerability with high impact potential
3. **Medium**: Vulnerability with limited impact
4. **Low**: Theoretical or low-impact vulnerability

### Response Procedures

1. **Immediate Response**
   - Isolate affected systems
   - Document the incident
   - Notify stakeholders

2. **Investigation**
   - Analyze logs and audit trails
   - Determine scope and impact
   - Identify root cause

3. **Containment**
   - Implement temporary fixes
   - Update security controls
   - Monitor for further activity

4. **Recovery**
   - Deploy permanent fixes
   - Update documentation
   - Conduct post-incident review

### Incident Reporting

```javascript
// Security incident reporting
const reportSecurityIncident = (incident) => {
  const report = {
    id: generateIncidentId(),
    timestamp: new Date().toISOString(),
    severity: incident.severity,
    type: incident.type,
    description: sanitizeIncidentDescription(incident.description),
    affectedSystems: incident.systems,
    reportedBy: incident.reporter,
    status: 'REPORTED'
  };
  
  // Log to secure incident file
  auditLogger.logSecurityEvent('security_incident_reported', report);
  
  // Notify security team (if configured)
  if (process.env.SECURITY_WEBHOOK_URL) {
    notifySecurityTeam(report);
  }
};
```

## Security Auditing

### Regular Security Reviews

1. **Code Reviews**
   - Security-focused code reviews
   - Automated security scanning
   - Dependency vulnerability checks

2. **Configuration Audits**
   - File permission reviews
   - Configuration security checks
   - Access control verification

3. **Penetration Testing**
   - Regular security testing
   - Third-party security assessments
   - Vulnerability remediation

### Security Metrics

```javascript
// Security metrics collection
const securityMetrics = {
  trackValidationFailures(type) {
    this.incrementMetric(`validation_failures.${type}`);
  },
  
  trackSecurityEvents(event) {
    this.incrementMetric(`security_events.${event}`);
  },
  
  generateSecurityReport() {
    return {
      validationFailures: this.getMetrics('validation_failures'),
      securityEvents: this.getMetrics('security_events'),
      auditLogEntries: this.countAuditEntries(),
      lastSecurityScan: this.getLastScanDate()
    };
  }
};
```

### Continuous Security Improvement

1. **Security Training**
   - Regular security awareness training
   - Secure coding practices
   - Threat modeling workshops

2. **Process Improvement**
   - Security design reviews
   - Automated security testing
   - Security metrics tracking

3. **Technology Updates**
   - Regular dependency updates
   - Security patch management
   - Security tool upgrades

---

This security guide provides comprehensive coverage of security features and best practices for the PurAir Cloudflare Setup Tool. Follow these guidelines to maintain a secure development and deployment environment.