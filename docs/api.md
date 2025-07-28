# API Documentation

## Overview

The PurAir Cloudflare Setup Tool provides a comprehensive API for automating Cloudflare project setup. This document covers all modules, classes, and functions with detailed examples.

## Core Classes

### CloudflareSetupCLI

Main CLI class that orchestrates the entire setup process.

#### Constructor

```javascript
const cli = new CloudflareSetupCLI();
```

#### Methods

##### `run()`

Initializes and runs the CLI application.

```javascript
await cli.run();
```

##### `handleCommand(options)`

Processes command-line options and executes the setup workflow.

**Parameters:**
- `options` (Object): Command-line options
  - `name` (string): Project name
  - `domain` (string): Domain name
  - `type` (string): Project type ('site', 'api', 'app')
  - `config` (string): Path to configuration file
  - `noInteractive` (boolean): Skip interactive prompts
  - `saveConfig` (boolean): Save configuration for reuse
  - `preview` (boolean): Preview mode only
  - `validateOnly` (boolean): Validation only mode

**Example:**
```javascript
const options = {
  name: 'my-project',
  domain: 'example.com',
  type: 'api',
  saveConfig: true
};

await cli.handleCommand(options);
```

##### `initProject()`

Interactive project initialization workflow.

```javascript
await cli.initProject();
```

## Module APIs

### ConfigManager

Handles configuration storage and retrieval.

#### Constructor

```javascript
import { ConfigManager } from './src/modules/configManager.js';
const configManager = new ConfigManager();
```

#### Methods

##### `save(name, config)`

Saves a configuration with the specified name.

**Parameters:**
- `name` (string): Configuration name
- `config` (Object): Configuration object

**Returns:** Promise\<Object\> - Saved configuration with metadata

**Example:**
```javascript
const config = {
  projectName: 'my-app',
  domain: 'myapp.com',
  projectType: 'api',
  features: ['cloudflare-workers', 'kv-storage']
};

const saved = await configManager.save('my-app-config', config);
```

##### `load(nameOrPath)`

Loads a configuration by name or file path.

**Parameters:**
- `nameOrPath` (string): Configuration name or file path

**Returns:** Promise\<Object\> - Configuration object

**Example:**
```javascript
// Load by name
const config = await configManager.load('my-app-config');

// Load from file
const config = await configManager.load('./project-config.json');
```

##### `list()`

Lists all saved configurations.

**Returns:** Promise\<Array\> - Array of configuration metadata

**Example:**
```javascript
const configs = await configManager.list();
// [
//   {
//     name: 'my-app-config',
//     description: 'api - myapp.com',
//     created: '2024-01-15T10:30:00.000Z',
//     updated: '2024-01-15T10:30:00.000Z'
//   }
// ]
```

##### `delete(name)`

Deletes a saved configuration.

**Parameters:**
- `name` (string): Configuration name

**Returns:** Promise\<boolean\> - Success status

**Example:**
```javascript
const deleted = await configManager.delete('old-config');
```

##### `export(name, outputPath)`

Exports a configuration to a file.

**Parameters:**
- `name` (string): Configuration name
- `outputPath` (string): Output file path

**Returns:** Promise\<string\> - Absolute path to exported file

**Example:**
```javascript
const exportPath = await configManager.export('my-config', './exported-config.json');
```

### TemplateEngine

Processes templates with context-aware security escaping.

#### Constructor

```javascript
import { templateEngine } from './src/modules/templateEngine.js';
// Uses singleton instance
```

#### Methods

##### `processTemplate(templateContent, variables, options)`

Processes a template string with variables.

**Parameters:**
- `templateContent` (string): Template content
- `variables` (Object): Template variables
- `options` (Object): Processing options
  - `context` (string): Security context ('html', 'js', 'shell', 'json')

**Returns:** Promise\<string\> - Processed template

**Example:**
```javascript
const template = `
<!DOCTYPE html>
<html>
<head>
  <title>{{projectName}}</title>
</head>
<body>
  <h1>Welcome to {{projectName}}</h1>
  {{#if features}}
  <ul>
    {{#each features}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
  {{/if}}
</body>
</html>
`;

const variables = {
  projectName: 'My App',
  features: ['Authentication', 'Database', 'API']
};

const result = await templateEngine.processTemplate(template, variables, {
  context: 'html'
});
```

##### `loadAndProcess(templatePath, variables, options)`

Loads and processes a template file.

**Parameters:**
- `templatePath` (string): Path to template file
- `variables` (Object): Template variables
- `options` (Object): Processing options

**Returns:** Promise\<string\> - Processed template

**Example:**
```javascript
const result = await templateEngine.loadAndProcess(
  'templates/api/package.json.template',
  {
    projectName: 'my-api',
    dependencies: ['express', 'cors']
  }
);
```

##### `getTemplatesForProject(config)`

Gets all templates needed for a project configuration.

**Parameters:**
- `config` (Object): Project configuration

**Returns:** Promise\<Array\> - Array of template objects

**Example:**
```javascript
const config = {
  projectType: 'api',
  useWrangler: true,
  features: ['kv-storage']
};

const templates = await templateEngine.getTemplatesForProject(config);
// [
//   {
//     template: 'api/index.js.template',
//     output: 'src/index.js',
//     content: '...'
//   },
//   ...
// ]
```

##### Template Helper Functions

The template engine provides various helper functions:

**Conditionals:**
- `eq(a, b)` - Equality check
- `ne(a, b)` - Not equal
- `lt(a, b)` - Less than
- `gt(a, b)` - Greater than
- `and(...args)` - Logical AND
- `or(...args)` - Logical OR
- `not(value)` - Logical NOT

**String manipulation:**
- `capitalize(str)` - Capitalize first letter
- `lowercase(str)` - Convert to lowercase
- `uppercase(str)` - Convert to uppercase
- `default(value, defaultValue)` - Default value

**Security escaping:**
- `escapeHtml(str)` - HTML escaping
- `escapeJs(str)` - JavaScript escaping
- `escapeShell(str)` - Shell escaping
- `safeString(str, context)` - Context-aware escaping

**Example template usage:**
```handlebars
{{#if eq projectType 'api'}}
  // API-specific code
  const port = {{default port 3000}};
{{/if}}

<script>
  const projectName = "{{escapeJs projectName}}";
</script>

<div class="description">
  {{escapeHtml description}}
</div>
```

### Validation Utilities

Comprehensive validation functions using Joi schemas.

#### Functions

##### `validateProjectName(name)`

Validates project name format.

**Parameters:**
- `name` (string): Project name to validate

**Returns:** boolean - Validation result

**Rules:**
- Must be 3-50 characters
- Lowercase letters, numbers, and hyphens only
- Cannot start or end with hyphen

**Example:**
```javascript
import { validateProjectName } from './src/utils/validation.js';

console.log(validateProjectName('my-project')); // true
console.log(validateProjectName('My Project')); // false
console.log(validateProjectName('a')); // false
```

##### `validateDomain(domain)`

Validates domain name format.

**Parameters:**
- `domain` (string): Domain to validate

**Returns:** boolean - Validation result

**Example:**
```javascript
import { validateDomain } from './src/utils/validation.js';

console.log(validateDomain('example.com')); // true
console.log(validateDomain('sub.example.com')); // true
console.log(validateDomain('invalid-domain')); // false
```

##### `validateProjectConfig(config)`

Validates complete project configuration.

**Parameters:**
- `config` (Object): Configuration object

**Returns:** Object - Validated configuration (throws on error)

**Example:**
```javascript
import { validateProjectConfig } from './src/utils/validation.js';

const config = {
  projectName: 'my-app',
  domain: 'myapp.com',
  projectType: 'api',
  environment: 'production',
  features: ['workers', 'kv'],
  useWrangler: true
};

try {
  const validated = validateProjectConfig(config);
  console.log('Configuration is valid');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

##### Security Functions

**`sanitizeUserInput(input, options)`**

Sanitizes user input for security.

```javascript
import { sanitizeUserInput } from './src/utils/validation.js';

const cleaned = sanitizeUserInput('<script>alert("xss")</script>', {
  maxLength: 100,
  allowHTML: false,
  stripControlChars: true
});
```

**`validateApiToken(token, type)`**

Validates API tokens.

```javascript
import { validateApiToken } from './src/utils/validation.js';

const isValid = validateApiToken(cfToken, 'cloudflare');
```

**`RateLimiter`** class for API rate limiting:

```javascript
import { RateLimiter } from './src/utils/validation.js';

const limiter = new RateLimiter(10, 60000); // 10 requests per minute

if (!limiter.isRateLimited('user-id')) {
  // Process request
} else {
  console.log('Rate limit exceeded');
}
```

### Project Structure Creator

Creates project directory structures.

#### Functions

##### `createDirectories(projectPath, config)`

Creates the directory structure for a project.

**Parameters:**
- `projectPath` (string): Root project path
- `config` (Object): Project configuration

**Returns:** Promise\<void\>

**Example:**
```javascript
import { projectStructureCreator } from './src/modules/projectStructureCreator.js';

await projectStructureCreator.createDirectories('./my-project', {
  projectType: 'api',
  useWrangler: true,
  features: ['kv-storage']
});
```

### File Generator

Generates project files from templates.

#### Functions

##### `generateFile(outputPath, content)`

Generates a file with the specified content.

**Parameters:**
- `outputPath` (string): Output file path
- `content` (string): File content

**Returns:** Promise\<void\>

**Example:**
```javascript
import { fileGenerator } from './src/modules/fileGenerator.js';

await fileGenerator.generateFile('./package.json', jsonContent);
```

### Progress Indicator

Provides progress feedback utilities.

#### Functions

##### `createProgressBar(id, total, options)`

Creates a progress bar.

**Parameters:**
- `id` (string): Progress bar identifier
- `total` (number): Total items
- `options` (Object): Options
  - `unit` (string): Unit name (e.g., 'Files')

**Example:**
```javascript
import { progressIndicator } from './src/utils/progressIndicator.js';

const bar = progressIndicator.createProgressBar('files', 10, { unit: 'Files' });
progressIndicator.updateProgress('files', 1, 'Creating package.json');
```

##### `withProgress(promise, message, options)`

Wraps a promise with progress indication.

**Parameters:**
- `promise` (Promise): Promise to track
- `message` (string): Progress message
- `options` (Object): Options

**Example:**
```javascript
await withProgress(
  longRunningOperation(),
  'Processing templates',
  {
    successMessage: 'Templates processed successfully',
    errorMessage: 'Template processing failed'
  }
);
```

## Error Handling

### ErrorCodes

Standard error codes used throughout the application:

```javascript
import { ErrorCodes } from './src/utils/errors.js';

// Available error codes:
ErrorCodes.INVALID_CONFIG
ErrorCodes.FILE_NOT_FOUND
ErrorCodes.TEMPLATE_ERROR
ErrorCodes.VALIDATION_ERROR
ErrorCodes.NETWORK_ERROR
```

### Error Handler

```javascript
import { handleError, errorHandler } from './src/utils/errors.js';

try {
  // Operation that might fail
} catch (error) {
  handleError(error, { context: 'operation-name' });
}

// Create custom errors
const customError = errorHandler.createError(ErrorCodes.INVALID_CONFIG, {
  details: 'Missing required field'
});
```

## Configuration Schema

### Project Configuration Object

```javascript
{
  // Required fields
  projectName: "my-project",        // string, 3-50 chars, lowercase with hyphens
  domain: "example.com",            // string, valid domain
  projectType: "api",               // "site" | "api" | "app"
  environment: "production",        // "development" | "staging" | "production"
  
  // Optional fields
  features: ["workers", "kv"],      // array of feature strings
  useWrangler: true,                // boolean
  useWorkers: true,                 // boolean
  useKV: false,                     // boolean
  useDurableObjects: false,         // boolean
  usePages: false,                  // boolean
  buildStep: true,                  // boolean
  framework: "react",               // "react" | "vue" | "nextjs" | "nuxt" | "sveltekit" | "vanilla"
  
  // Metadata (added automatically)
  _metadata: {
    created: "2024-01-15T10:30:00.000Z",
    updated: "2024-01-15T10:30:00.000Z",
    version: "1.0.0"
  }
}
```

## Template Syntax

### Variable Substitution

```handlebars
{{variableName}}              <!-- HTML-escaped -->
{{{variableName}}}            <!-- Raw, unescaped -->
{{!variableName}}             <!-- Raw with ! prefix -->
```

### Conditionals

```handlebars
{{#if condition}}
  Content when true
{{else}}
  Content when false
{{/if}}

{{#if eq projectType 'api'}}
  API-specific content
{{/if}}
```

### Loops

```handlebars
{{#each features}}
  <li>{{this}}</li>
  <span>Index: {{@index}}</span>
  {{#if @first}}First item{{/if}}
  {{#if @last}}Last item{{/if}}
{{/each}}
```

### Helper Functions

```handlebars
{{capitalize projectName}}
{{default description "No description provided"}}
{{join features ", "}}
{{escapeJs userInput}}
```

## CLI Usage Examples

### Basic Usage

```bash
# Interactive setup
pur-cloudflare-setup init

# Non-interactive with options
pur-cloudflare-setup --name my-project --domain example.com --type api

# Using saved configuration
pur-cloudflare-setup --config my-saved-config

# Preview mode
pur-cloudflare-setup --preview --name test-project --type site

# Validation only
pur-cloudflare-setup --validate-only --config ./project.json
```

### Configuration Management

```bash
# List saved configurations
pur-cloudflare-setup config --list

# Show configuration details
pur-cloudflare-setup config --show my-config

# Delete configuration
pur-cloudflare-setup config --delete old-config
```

### Template Management

```bash
# List available templates
pur-cloudflare-setup templates
```

## Integration Examples

### Programmatic Usage

```javascript
import { CloudflareSetupCLI } from './setup.js';
import { ConfigManager } from './src/modules/configManager.js';

// Create and configure
const cli = new CloudflareSetupCLI();
const configManager = new ConfigManager();

// Save a configuration
const config = {
  projectName: 'automated-project',
  domain: 'auto.example.com',
  projectType: 'api',
  features: ['workers', 'kv']
};

await configManager.save('auto-config', config);

// Generate project programmatically
await cli.handleCommand({
  config: 'auto-config',
  noInteractive: true,
  saveConfig: false
});
```

### Custom Template Processing

```javascript
import { templateEngine } from './src/modules/templateEngine.js';

// Process custom template
const customTemplate = `
export const config = {
  name: "{{projectName}}",
  domain: "{{domain}}",
  features: [{{#each features}}"{{this}}"{{#unless @last}},{{/unless}}{{/each}}]
};
`;

const result = await templateEngine.processTemplate(customTemplate, {
  projectName: 'my-app',
  domain: 'myapp.com',
  features: ['auth', 'db', 'api']
}, { context: 'js' });
```

## Best Practices

### Configuration Management

1. **Validate Early**: Always validate configurations before processing
2. **Use Type-Safe**: Leverage the validation functions for type safety
3. **Sanitize Input**: Use sanitization functions for user-provided data
4. **Handle Errors**: Implement proper error handling with context

### Template Security

1. **Context-Aware Escaping**: Always specify the appropriate context
2. **Validate Variables**: Use `validateVariables()` before processing
3. **Sanitize Input**: Clean user input before template processing
4. **Avoid Raw Output**: Use raw output (`{{{var}}}`) sparingly

### Performance

1. **Batch Operations**: Use progress indicators for long operations
2. **Rate Limiting**: Implement rate limiting for API calls
3. **Caching**: Cache template processing results when possible
4. **Async Operations**: Use async/await for non-blocking operations

## Troubleshooting

### Common Issues

**Configuration Validation Errors**
```javascript
// Check specific validation
try {
  validateProjectName(name);
} catch (error) {
  console.error('Invalid project name:', error.message);
}
```

**Template Processing Errors**
```javascript
// Validate template variables first
const validation = templateEngine.validateVariables(template, variables);
if (!validation.isValid) {
  console.error('Missing variables:', validation.missing);
}
```

**File Generation Errors**
```javascript
// Ensure directories exist before file generation
await projectStructureCreator.createDirectories(projectPath, config);
await fileGenerator.generateFile(filePath, content);
```

## Version Compatibility

This API documentation is for version 1.0.0 of the PurAir Cloudflare Setup Tool. For version-specific changes, refer to the changelog and migration guides.