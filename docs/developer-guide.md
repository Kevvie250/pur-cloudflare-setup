# Developer Guide

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Code Structure](#code-structure)
- [Module Development](#module-development)
- [Template System](#template-system)
- [Testing Guidelines](#testing-guidelines)
- [Contributing Guidelines](#contributing-guidelines)
- [Release Process](#release-process)
- [Performance Considerations](#performance-considerations)
- [Debugging](#debugging)

## Architecture Overview

The PurAir Cloudflare Setup Tool follows a modular architecture designed for extensibility, maintainability, and security.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Interface │    │  Configuration  │    │  Template       │
│   (setup.js)    │◄──►│  Manager        │◄──►│  Engine         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prompt        │    │   Validation    │    │  File           │
│   Manager       │    │   Utils         │    │  Generator      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Progress      │    │   Error         │    │  Project        │
│   Indicator     │    │   Handler       │    │  Structure      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Principles

1. **Modularity**: Each component has a single responsibility
2. **Security**: Input validation and output sanitization at every layer
3. **Extensibility**: Plugin-like architecture for easy feature addition
4. **User Experience**: Progressive disclosure and helpful feedback
5. **Performance**: Efficient file operations and progress tracking

### Data Flow

```
User Input → Validation → Configuration → Template Processing → File Generation → Feedback
```

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git 2.30.0 or higher
- VSCode (recommended) with extensions:
  - ESLint
  - Prettier
  - ES6 String HTML

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/purair/pur-cloudflare-setup.git
   cd pur-cloudflare-setup
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up development environment**
   ```bash
   # Copy environment template
   cp .env.example .env.development
   
   # Configure development settings
   nano .env.development
   ```

4. **Run in development mode**
   ```bash
   # Make executable
   chmod +x setup.js
   
   # Test CLI
   ./setup.js --help
   
   # Run with Node.js
   node setup.js init
   ```

### Development Scripts

```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test

# Watch for changes and test
npm run test:watch

# Build documentation
npm run docs:build

# Start development server (if applicable)
npm run dev
```

### IDE Configuration

**VSCode settings.json**
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.template": "handlebars"
  },
  "eslint.workingDirectories": ["./"],
  "prettier.configPath": "./.prettierrc"
}
```

**ESLint configuration (.eslintrc.js)**
```javascript
module.exports = {
  env: {
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

## Code Structure

### Directory Structure

```
pur-cloudflare-setup/
├── src/
│   ├── modules/           # Core business logic modules
│   │   ├── configManager.js
│   │   ├── templateEngine.js
│   │   ├── prompts.js
│   │   ├── fileGenerator.js
│   │   └── ...
│   └── utils/             # Utility functions
│       ├── validation.js
│       ├── errors.js
│       ├── logger.js
│       └── ...
├── templates/             # Template files
│   ├── api/
│   ├── cloudflare/
│   ├── frontend/
│   └── ...
├── config/               # Configuration files
├── docs/                 # Documentation
├── examples/             # Example configurations
├── scripts/              # Development scripts
└── tests/                # Test files
```

### Module Organization

Each module follows a consistent structure:

```javascript
// modules/exampleModule.js

import dependencies from 'external-package';
import { utilityFunction } from '../utils/utilities.js';

/**
 * Module description and purpose
 */
export class ExampleModule {
  constructor(options = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.initialized = false;
  }

  get defaultOptions() {
    return {
      // Default configuration
    };
  }

  async initialize() {
    if (this.initialized) return;
    // Initialization logic
    this.initialized = true;
  }

  // Public methods
  async publicMethod(param) {
    await this.initialize();
    return this._privateMethod(param);
  }

  // Private methods (prefixed with _)
  _privateMethod(param) {
    // Implementation
  }
}

// Export singleton if appropriate
export const exampleModule = new ExampleModule();
```

### Naming Conventions

- **Files**: camelCase for modules (`configManager.js`)
- **Classes**: PascalCase (`ConfigManager`)
- **Functions**: camelCase (`validateInput`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Private methods**: prefix with underscore (`_processTemplate`)

### Import/Export Patterns

```javascript
// Named exports for utilities
export { validateProjectName, sanitizeInput } from './validation.js';

// Default exports for classes
export default class TemplateEngine { }

// Singleton exports
export const templateEngine = new TemplateEngine();

// Destructured imports
import { validateProjectName } from '../utils/validation.js';

// Default imports
import TemplateEngine from './templateEngine.js';
```

## Module Development

### Creating a New Module

1. **Create module file**
   ```bash
   touch src/modules/newModule.js
   ```

2. **Implement module structure**
   ```javascript
   // src/modules/newModule.js
   
   import { validateInput } from '../utils/validation.js';
   import { createError, ErrorCodes } from '../utils/errors.js';
   
   /**
    * NewModule handles specific functionality
    */
   export class NewModule {
     constructor(options = {}) {
       this.options = this._validateOptions(options);
       this.state = new Map();
     }
   
     async initialize() {
       // Setup logic
     }
   
     async processData(input) {
       if (!validateInput(input)) {
         throw createError(ErrorCodes.INVALID_INPUT, {
           details: 'Invalid input provided'
         });
       }
   
       // Processing logic
       return this._processInternal(input);
     }
   
     _validateOptions(options) {
       // Validation logic
       return options;
     }
   
     _processInternal(input) {
       // Private implementation
     }
   }
   
   export const newModule = new NewModule();
   ```

3. **Add tests**
   ```javascript
   // tests/modules/newModule.test.js
   
   import { describe, it, expect } from '@jest/globals';
   import { NewModule } from '../../src/modules/newModule.js';
   
   describe('NewModule', () => {
     let module;
   
     beforeEach(() => {
       module = new NewModule();
     });
   
     it('should initialize correctly', async () => {
       await module.initialize();
       expect(module.state).toBeDefined();
     });
   
     it('should process valid input', async () => {
       const result = await module.processData('valid-input');
       expect(result).toBeDefined();
     });
   
     it('should throw error for invalid input', async () => {
       await expect(module.processData(null))
         .rejects.toThrow('Invalid input provided');
     });
   });
   ```

4. **Update main CLI integration**
   ```javascript
   // setup.js
   
   import { newModule } from './src/modules/newModule.js';
   
   // Use in CLI workflow
   await newModule.initialize();
   const result = await newModule.processData(userInput);
   ```

### Module Communication

Modules communicate through:

1. **Direct method calls** for synchronous operations
2. **Promises/async-await** for asynchronous operations
3. **Event system** for loose coupling (if implemented)
4. **Shared state** through the main CLI class

**Example inter-module communication:**
```javascript
// In CLI class method
async handleCommand(options) {
  // Validate configuration
  const config = await this.configManager.load(options.config);
  
  // Process templates
  const templates = await this.templateEngine.getTemplatesForProject(config);
  
  // Generate files
  for (const template of templates) {
    await this.fileGenerator.generateFile(template.output, template.content);
  }
}
```

### Error Handling

All modules should use the centralized error handling system:

```javascript
import { createError, ErrorCodes, handleError } from '../utils/errors.js';

// In module methods
try {
  await riskyOperation();
} catch (error) {
  const enhancedError = createError(ErrorCodes.OPERATION_FAILED, {
    originalError: error,
    context: { operation: 'riskyOperation', moduleId: this.constructor.name }
  });
  throw enhancedError;
}

// At the top level
try {
  await module.processData(input);
} catch (error) {
  handleError(error, { context: 'main-process' });
}
```

### Logging

Use the centralized logging system:

```javascript
import { logger } from '../utils/logger.js';

export class ExampleModule {
  async processData(input) {
    logger.info('Processing data', { inputType: typeof input });
    
    try {
      const result = await this._process(input);
      logger.debug('Processing completed', { resultSize: result.length });
      return result;
    } catch (error) {
      logger.error('Processing failed', { error: error.message });
      throw error;
    }
  }
}
```

## Template System

### Template Architecture

The template system uses a secure, context-aware processing engine with Handlebars-style syntax.

### Creating Templates

1. **Template file structure**
   ```
   templates/
   ├── api/
   │   ├── index.js.template
   │   └── services/
   │       └── service.js.template
   ├── frontend/
   │   ├── index.html.template
   │   └── components/
   └── config/
       └── package.json.template
   ```

2. **Template syntax**
   ```handlebars
   {{!-- templates/api/service.js.template --}}
   
   /**
    * {{capitalize serviceName}} Service
    * Generated: {{timestamp}}
    */
   export class {{capitalize serviceName}}Service {
     constructor() {
       this.apiUrl = '{{escapeJs apiUrl}}';
       this.timeout = {{default timeout 5000}};
     }
   
     {{#each methods}}
     /**
      * {{this.description}}
      */
     async {{this.name}}({{join this.params ', '}}) {
       {{#if this.validation}}
       // Validation
       {{#each this.validation}}
       if (!{{this.field}}) {
         throw new Error('{{this.message}}');
       }
       {{/each}}
       {{/if}}
   
       // Implementation
       const response = await fetch(`${this.apiUrl}/{{this.endpoint}}`, {
         method: '{{uppercase this.method}}',
         headers: {
           'Content-Type': 'application/json',
           {{#if ../requiresAuth}}
           'Authorization': `Bearer ${this.token}`
           {{/if}}
         }
         {{#if this.body}}
         ,body: JSON.stringify({{this.body}})
         {{/if}}
       });
   
       return response.json();
     }
     {{/each}}
   }
   ```

3. **Security considerations**
   - Always use appropriate escaping functions
   - Validate template variables before processing
   - Use context-aware escaping based on output format

### Template Processing Flow

```javascript
// Template processing workflow
const templateEngine = new TemplateEngine();

// 1. Load template
const template = await templateEngine.loadTemplate('api/service.js.template');

// 2. Prepare variables
const variables = {
  serviceName: 'user',
  apiUrl: 'https://api.example.com',
  methods: [
    {
      name: 'getUser',
      endpoint: 'users/{id}',
      method: 'get',
      params: ['id'],
      description: 'Fetch user by ID'
    }
  ]
};

// 3. Process template
const result = await templateEngine.processTemplate(template, variables, {
  context: 'js' // Enable JavaScript-specific escaping
});

// 4. Generate file
await fileGenerator.generateFile('src/services/userService.js', result);
```

### Custom Helpers

Add custom helper functions:

```javascript
// In templateEngine.js
registerHelpers() {
  return {
    // Existing helpers...
    
    // Custom helper for API documentation
    apiDoc: (method, endpoint) => {
      return `\n * @api {${method.toUpperCase()}} ${endpoint}\n`;
    },
    
    // Helper for generating imports
    generateImports: (dependencies) => {
      return dependencies.map(dep => 
        `import ${dep.name} from '${dep.path}';`
      ).join('\n');
    },
    
    // Helper for camelCase to snake_case
    snakeCase: (str) => {
      return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
  };
}
```

Use custom helpers in templates:
```handlebars
{{apiDoc method endpoint}}
{{generateImports dependencies}}

const {{snakeCase variableName}} = '{{value}}';
```

## Testing Guidelines

### Testing Strategy

1. **Unit Tests**: Test individual functions and modules
2. **Integration Tests**: Test module interactions
3. **End-to-End Tests**: Test complete workflows
4. **Security Tests**: Test input validation and sanitization

### Test Structure

```javascript
// tests/modules/configManager.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager } from '../../src/modules/configManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ConfigManager', () => {
  let configManager;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    configManager = new ConfigManager();
    configManager.configDir = tempDir;
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rmdir(tempDir, { recursive: true });
  });

  describe('save()', () => {
    it('should save valid configuration', async () => {
      const config = {
        projectName: 'test-project',
        domain: 'test.example.com',
        projectType: 'api'
      };

      const saved = await configManager.save('test-config', config);
      
      expect(saved).toMatchObject(config);
      expect(saved._metadata).toBeDefined();
      expect(saved._metadata.created).toBeDefined();
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        projectName: '', // Invalid: empty name
        domain: 'invalid-domain',
        projectType: 'invalid-type'
      };

      await expect(configManager.save('test', invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });
  });

  describe('load()', () => {
    it('should load existing configuration', async () => {
      const config = {
        projectName: 'test-project',
        domain: 'test.example.com',
        projectType: 'api'
      };

      await configManager.save('test-config', config);
      const loaded = await configManager.load('test-config');

      expect(loaded).toMatchObject(config);
      expect(loaded._metadata).toBeUndefined(); // Metadata should be stripped
    });

    it('should throw error for non-existent configuration', async () => {
      await expect(configManager.load('non-existent'))
        .rejects.toThrow("Configuration 'non-existent' not found");
    });
  });
});
```

### Test Utilities

Create reusable test utilities:

```javascript
// tests/utils/testHelpers.js

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export class TestHelper {
  static async createTempDir(prefix = 'test-') {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  static async cleanupTempDir(dirPath) {
    try {
      await fs.rmdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  static createMockConfig(overrides = {}) {
    return {
      projectName: 'test-project',
      domain: 'test.example.com',
      projectType: 'api',
      environment: 'development',
      features: ['workers'],
      ...overrides
    };
  }

  static async writeTestFile(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  static async readTestFile(filePath) {
    return await fs.readFile(filePath, 'utf8');
  }
}
```

### Mocking External Dependencies

```javascript
// Mock file system operations
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeJson: jest.fn().mockResolvedValue(undefined),
  readJson: jest.fn().mockResolvedValue({}),
  pathExists: jest.fn().mockResolvedValue(true)
}));

// Mock CLI dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({
    projectName: 'test-project',
    domain: 'test.example.com',
    projectType: 'api'
  })
}));
```

### Security Testing

Test input validation and sanitization:

```javascript
describe('Security', () => {
  describe('Input validation', () => {
    it('should reject path traversal attempts', () => {
      const maliciousPath = '../../../etc/passwd';
      expect(isValidPath(maliciousPath)).toBe(false);
    });

    it('should sanitize user input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = sanitizeUserInput(maliciousInput);
      expect(sanitized).not.toContain('<script>');
    });

    it('should escape template variables', async () => {
      const template = '<div>{{userInput}}</div>';
      const variables = { userInput: '<script>alert("xss")</script>' };
      
      const result = await templateEngine.processTemplate(template, variables, {
        context: 'html'
      });
      
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
  });
});
```

## Contributing Guidelines

### Code Contribution Process

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/pur-cloudflare-setup.git
   cd pur-cloudflare-setup
   git remote add upstream https://github.com/purair/pur-cloudflare-setup.git
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes following standards**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation
   - Ensure security best practices

4. **Test changes**
   ```bash
   npm test
   npm run lint
   npm run format
   ```

5. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(templates): add TypeScript template support"
git commit -m "fix(validation): handle null domain values"
git commit -m "docs(api): update configuration examples"
```

### Code Review Process

1. **Automated checks** must pass:
   - All tests pass
   - Linting passes
   - Security scans pass
   - Code coverage maintained

2. **Manual review** focuses on:
   - Code quality and maintainability
   - Security implications
   - Documentation accuracy
   - User experience impact

3. **Review criteria:**
   - Functionality works as intended
   - Code follows project standards
   - Tests provide adequate coverage
   - Documentation is updated
   - No security vulnerabilities

### Documentation Standards

1. **Code documentation**
   ```javascript
   /**
    * Processes a template with the provided variables
    * @param {string} templateContent - The template content to process
    * @param {Object} variables - Variables to substitute in template
    * @param {Object} options - Processing options
    * @param {string} options.context - Security context ('html', 'js', 'shell')
    * @returns {Promise<string>} Processed template content
    * @throws {Error} When template processing fails
    * @example
    * const result = await processTemplate(
    *   'Hello {{name}}!',
    *   { name: 'World' },
    *   { context: 'html' }
    * );
    */
   async processTemplate(templateContent, variables = {}, options = {}) {
     // Implementation
   }
   ```

2. **README updates**
   - Update installation instructions if needed
   - Add new features to feature list
   - Update usage examples

3. **API documentation**
   - Document new public methods
   - Update parameter descriptions
   - Add usage examples

### Issue Reporting

When reporting issues:

1. **Use issue templates** provided in the repository
2. **Provide detailed reproduction steps**
3. **Include environment information**:
   - Node.js version
   - npm version
   - Operating system
   - Tool version
4. **Attach relevant logs or error messages**
5. **Describe expected vs actual behavior**

**Good issue example:**
```markdown
## Bug Report

### Description
Configuration validation fails for valid domain names containing hyphens.

### Steps to Reproduce
1. Run `pur-cloudflare-setup init`
2. Enter project name: `test-project`
3. Enter domain: `my-site.example.com`
4. Error appears: "Invalid domain name"

### Expected Behavior
Domain should be accepted as valid.

### Environment
- Node.js: v18.15.0
- npm: 8.5.5
- OS: macOS 13.2.1
- Tool version: 1.0.0

### Additional Context
The domain validates correctly in browser and DNS tools.
```

## Release Process

### Version Management

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Workflow

1. **Prepare release**
   ```bash
   # Update version in package.json
   npm version minor # or major/patch
   
   # Update CHANGELOG.md
   # Update documentation if needed
   ```

2. **Test release candidate**
   ```bash
   # Run full test suite
   npm test
   
   # Test CLI functionality
   ./setup.js --help
   ./setup.js init --preview
   
   # Test installation
   npm pack
   npm install -g ./pur-cloudflare-setup-*.tgz
   ```

3. **Create release**
   ```bash
   git add .
   git commit -m "chore: prepare release v1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```

4. **Publish to npm**
   ```bash
   npm publish
   ```

5. **Create GitHub release**
   - Use GitHub's release interface
   - Include changelog information
   - Attach relevant assets

### Changelog Format

```markdown
# Changelog

## [1.1.0] - 2024-01-15

### Added
- TypeScript template support
- Custom domain configuration
- Progress indicators for file operations

### Changed
- Updated template engine for better performance
- Improved error messages

### Fixed
- Domain validation for internationalized domains
- Template processing edge cases

### Security
- Enhanced input sanitization
- Updated dependencies with security patches

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Basic project generation
- Configuration management
- Template processing
```

## Performance Considerations

### File Operations

Optimize file operations for better performance:

```javascript
// Good: Batch file operations
const operations = templates.map(template => 
  fileGenerator.generateFile(template.output, template.content)
);
await Promise.all(operations);

// Avoid: Sequential file operations
for (const template of templates) {
  await fileGenerator.generateFile(template.output, template.content);
}
```

### Memory Management

```javascript
// Good: Stream large files
const stream = fs.createReadStream(largeTempate);
const chunks = [];
stream.on('data', chunk => chunks.push(chunk));
stream.on('end', () => processTemplate(Buffer.concat(chunks)));

// Avoid: Loading large files entirely
const largeTemplate = await fs.readFile(largeTemplate, 'utf8');
```

### Template Processing

```javascript
// Good: Cache compiled templates
class TemplateEngine {
  constructor() {
    this.compiledTemplates = new Map();
  }
  
  async processTemplate(path, variables) {
    if (!this.compiledTemplates.has(path)) {
      const template = await this.loadTemplate(path);
      this.compiledTemplates.set(path, this.compileTemplate(template));
    }
    
    return this.compiledTemplates.get(path)(variables);
  }
}
```

### Progress Reporting

Provide meaningful progress updates:

```javascript
// Good: Granular progress reporting
const progressBar = progressIndicator.createProgressBar('generation', templates.length);

for (const [index, template] of templates.entries()) {
  progressIndicator.updateProgress(
    'generation',
    1,
    `Generating ${path.basename(template.output)}`
  );
  
  await fileGenerator.generateFile(template.output, template.content);
}
```

## Debugging

### Debug Configuration

Enable debug mode for development:

```bash
# Environment variable
DEBUG=pur-cloudflare-setup* node setup.js init

# Command line flag
node setup.js --debug init
```

### Logging Levels

Configure appropriate logging levels:

```javascript
// src/utils/logger.js
import debug from 'debug';

const log = debug('pur-cloudflare-setup');
const error = debug('pur-cloudflare-setup:error');
const warn = debug('pur-cloudflare-setup:warn');
const info = debug('pur-cloudflare-setup:info');

export const logger = {
  error: (message, data) => error(message, data),
  warn: (message, data) => warn(message, data),
  info: (message, data) => info(message, data),
  debug: (message, data) => log(message, data)
};
```

### Common Debug Scenarios

**Template processing issues:**
```javascript
// Add debug logging to template engine
async processTemplate(template, variables, options = {}) {
  logger.debug('Processing template', {
    templateLength: template.length,
    variableCount: Object.keys(variables).length,
    context: options.context
  });
  
  try {
    const result = await this._processInternal(template, variables, options);
    logger.debug('Template processed successfully', {
      resultLength: result.length
    });
    return result;
  } catch (error) {
    logger.error('Template processing failed', {
      error: error.message,
      template: template.substring(0, 100) + '...',
      variables: Object.keys(variables)
    });
    throw error;
  }
}
```

**Configuration issues:**
```javascript
// Debug configuration loading
async load(nameOrPath) {
  logger.debug('Loading configuration', { nameOrPath });
  
  try {
    const config = await this._loadInternal(nameOrPath);
    logger.debug('Configuration loaded', {
      configSize: JSON.stringify(config).length,
      keys: Object.keys(config)
    });
    return config;
  } catch (error) {
    logger.error('Configuration loading failed', {
      nameOrPath,
      error: error.message
    });
    throw error;
  }
}
```

### VSCode Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/setup.js",
      "args": ["init", "--debug"],
      "env": {
        "DEBUG": "pur-cloudflare-setup*"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "disableOptimisticBPs": true,
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

### Performance Profiling

Profile performance bottlenecks:

```javascript
// Add performance monitoring
import { performance, PerformanceObserver } from 'perf_hooks';

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    logger.debug('Performance', {
      name: entry.name,
      duration: entry.duration
    });
  });
});
obs.observe({ entryTypes: ['measure'] });

// Measure operations
performance.mark('template-start');
await templateEngine.processTemplate(template, variables);
performance.mark('template-end');
performance.measure('template-processing', 'template-start', 'template-end');
```

This developer guide provides comprehensive information for contributing to and extending the PurAir Cloudflare Setup Tool. Follow these guidelines to maintain code quality, security, and consistency across the project.