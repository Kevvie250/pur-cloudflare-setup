# User Guide

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Types](#project-types)
- [Configuration Options](#configuration-options)
- [Step-by-Step Tutorials](#step-by-step-tutorials)
- [Configuration Management](#configuration-management)
- [Template System](#template-system)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [FAQ](#faq)

## Introduction

The PurAir Cloudflare Setup Tool is a command-line utility designed to streamline the creation and configuration of Cloudflare projects. Whether you're building static sites, APIs, or full-stack applications, this tool provides automated setup, template generation, and configuration management.

### Key Features

- **Interactive Setup**: Guided project creation with intelligent prompts
- **Multiple Project Types**: Support for static sites, APIs, and applications
- **Template Engine**: Secure, context-aware template processing
- **Configuration Management**: Save and reuse project configurations
- **Cloudflare Integration**: Optimized for Cloudflare Workers, Pages, and KV
- **Security First**: Built-in input sanitization and validation
- **Progress Tracking**: Visual feedback during project generation

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Cloudflare account (for deployment)

### Global Installation

```bash
# Install globally via npm
npm install -g pur-cloudflare-setup

# Verify installation
pur-cloudflare-setup --version
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/purair/pur-cloudflare-setup.git
cd pur-cloudflare-setup

# Install dependencies
npm install

# Make executable
chmod +x setup.js

# Use with Node.js
node setup.js --help
```

## Quick Start

### 1. Interactive Setup

The easiest way to get started is with the interactive setup wizard:

```bash
pur-cloudflare-setup init
```

This will guide you through:
- Project name selection
- Domain configuration
- Project type selection
- Feature selection
- Environment setup

### 2. Quick Command

For experienced users, create a project with a single command:

```bash
pur-cloudflare-setup --name my-project --domain example.com --type api
```

### 3. Preview Mode

Preview what will be created without making changes:

```bash
pur-cloudflare-setup --preview --name test-project --type site
```

## Project Types

### Static Site

Perfect for marketing sites, documentation, or simple web applications.

**Features:**
- HTML, CSS, and JavaScript templates
- Cloudflare Pages integration
- Build step configuration
- Frontend framework support

**Example:**
```bash
pur-cloudflare-setup --type site --framework react --domain mysite.com
```

**Generated Structure:**
```
my-site/
├── src/
│   ├── index.html
│   ├── main.js
│   └── styles/
│       └── main.css
├── public/
├── package.json
├── vite.config.js
└── wrangler.toml
```

### API

Backend services and microservices with Cloudflare Workers.

**Features:**
- Worker script templates
- API routing
- KV storage integration
- Durable Objects support

**Example:**
```bash
pur-cloudflare-setup --type api --features workers,kv --domain api.example.com
```

**Generated Structure:**
```
my-api/
├── src/
│   ├── index.js
│   └── services/
│       ├── apiService.js
│       └── dataService.js
├── wrangler.toml
├── package.json
└── README.md
```

### Full Application

Complete full-stack applications with frontend and backend.

**Features:**
- Frontend and backend templates
- Database integration
- Authentication setup
- Deployment scripts

**Example:**
```bash
pur-cloudflare-setup --type app --framework nextjs --features auth,db
```

## Configuration Options

### Command Line Options

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--name` | `-n` | Project name | `--name my-project` |
| `--domain` | `-d` | Domain name | `--domain example.com` |
| `--type` | `-t` | Project type | `--type api` |
| `--config` | `-c` | Config file path | `--config ./config.json` |
| `--no-interactive` | | Skip interactive prompts | `--no-interactive` |
| `--save-config` | | Save configuration | `--save-config` |
| `--preview` | | Preview mode only | `--preview` |
| `--validate-only` | | Validate configuration | `--validate-only` |

### Project Configuration

#### Basic Settings

```json
{
  "projectName": "my-project",
  "domain": "example.com",
  "projectType": "api",
  "environment": "production"
}
```

#### Advanced Settings

```json
{
  "projectName": "advanced-project",
  "domain": "advanced.example.com",
  "projectType": "app",
  "environment": "production",
  "features": ["workers", "kv", "durable-objects"],
  "framework": "react",
  "useWrangler": true,
  "buildStep": true,
  "customDomains": ["www.example.com", "app.example.com"]
}
```

#### Feature Options

- **workers**: Cloudflare Workers support
- **kv**: KV storage integration
- **durable-objects**: Durable Objects support
- **pages**: Cloudflare Pages integration
- **auth**: Authentication setup
- **database**: Database integration
- **analytics**: Analytics tracking
- **caching**: Advanced caching rules

## Step-by-Step Tutorials

### Tutorial 1: Creating a Static Portfolio Site

1. **Initialize the project**
   ```bash
   pur-cloudflare-setup init
   ```

2. **Choose project details**
   - Name: `my-portfolio`
   - Domain: `portfolio.example.com`
   - Type: `site`
   - Framework: `vanilla`

3. **Select features**
   - ✅ Cloudflare Pages
   - ✅ Build optimization
   - ❌ Database integration

4. **Review and confirm**
   The tool will show a preview of files to be created.

5. **Navigate to project**
   ```bash
   cd my-portfolio
   npm install
   ```

6. **Start development**
   ```bash
   npm run dev
   ```

7. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

### Tutorial 2: Building an API Service

1. **Create API project**
   ```bash
   pur-cloudflare-setup --name user-api --type api --domain api.myapp.com
   ```

2. **Select API features**
   - Workers: Yes
   - KV Storage: Yes
   - Authentication: Yes

3. **Configure environment**
   ```bash
   cd user-api
   cp .env.example .env
   ```

4. **Edit environment variables**
   ```bash
   nano .env
   ```
   Add your Cloudflare credentials:
   ```env
   CLOUDFLARE_API_TOKEN=your_token_here
   CLOUDFLARE_ACCOUNT_ID=your_account_id
   KV_NAMESPACE_ID=your_kv_namespace
   ```

5. **Test locally**
   ```bash
   npm run dev
   # Test endpoint: http://localhost:8787/api/users
   ```

6. **Deploy to production**
   ```bash
   wrangler login
   npm run deploy:production
   ```

### Tutorial 3: Full-Stack Application

1. **Initialize full-stack app**
   ```bash
   pur-cloudflare-setup --type app --framework nextjs --name my-app
   ```

2. **Configure features**
   - Frontend: Next.js
   - Backend: Cloudflare Workers
   - Database: D1 SQL
   - Authentication: OAuth

3. **Set up development environment**
   ```bash
   cd my-app
   npm install
   
   # Set up database
   npm run db:setup
   
   # Start development servers
   npm run dev
   ```

4. **Configure authentication**
   Edit `src/config/auth.js`:
   ```javascript
   export const authConfig = {
     providers: ['google', 'github'],
     redirectUri: process.env.AUTH_REDIRECT_URI,
     clientId: process.env.OAUTH_CLIENT_ID
   };
   ```

5. **Deploy application**
   ```bash
   # Deploy backend first
   npm run deploy:api
   
   # Deploy frontend
   npm run deploy:frontend
   ```

## Configuration Management

### Saving Configurations

Save frequently used configurations for reuse:

```bash
# Interactive save during setup
pur-cloudflare-setup init --save-config

# Save existing configuration
pur-cloudflare-setup config --save my-config
```

### Using Saved Configurations

```bash
# List saved configurations
pur-cloudflare-setup config --list

# Use saved configuration
pur-cloudflare-setup --config my-saved-config

# Show configuration details
pur-cloudflare-setup config --show my-config
```

### Configuration Files

Create reusable configuration files:

**project-config.json**
```json
{
  "projectName": "template-project",
  "domain": "template.example.com",
  "projectType": "api",
  "environment": "production",
  "features": ["workers", "kv"],
  "customSettings": {
    "timeout": 30000,
    "memory": 128,
    "routes": ["api.example.com/*"]
  }
}
```

Use the configuration file:
```bash
pur-cloudflare-setup --config ./project-config.json
```

### Exporting and Importing

```bash
# Export configuration to file
pur-cloudflare-setup config --export my-config ./exported-config.json

# Import configuration from file
pur-cloudflare-setup config --import ./imported-config.json new-config-name
```

## Template System

### Understanding Templates

Templates use Handlebars-style syntax with security enhancements:

```handlebars
{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "scripts": {
    {{#if eq projectType 'api'}}
    "start": "wrangler dev",
    "deploy": "wrangler publish"
    {{else}}
    "dev": "vite dev",
    "build": "vite build"
    {{/if}}
  },
  "dependencies": {
    {{#each dependencies}}
    "{{@key}}": "{{this}}"{{#unless @last}},{{/unless}}
    {{/each}}
  }
}
```

### Custom Templates

Create custom templates in your project:

1. **Create template directory**
   ```bash
   mkdir -p custom-templates/api
   ```

2. **Create template file**
   ```handlebars
   // custom-templates/api/service.js.template
   export class {{capitalize serviceName}}Service {
     constructor() {
       this.baseUrl = '{{apiUrl}}';
     }
     
     {{#each methods}}
     async {{this.name}}({{join this.params ', '}}) {
       // Implementation for {{this.name}}
     }
     {{/each}}
   }
   ```

3. **Use custom template**
   ```bash
   pur-cloudflare-setup --template-dir ./custom-templates
   ```

### Template Variables

Available variables in templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `projectName` | Project name | `my-project` |
| `domain` | Domain name | `example.com` |
| `projectType` | Project type | `api` |
| `features` | Selected features | `['workers', 'kv']` |
| `framework` | Frontend framework | `react` |
| `currentYear` | Current year | `2024` |
| `currentDate` | Current date | `2024-01-15` |
| `timestamp` | ISO timestamp | `2024-01-15T10:30:00.000Z` |

## Troubleshooting

### Common Issues

#### Installation Problems

**Issue: Permission denied**
```bash
# Solution: Use sudo or install locally
sudo npm install -g pur-cloudflare-setup
# Or install locally
npm install pur-cloudflare-setup
```

**Issue: Node.js version incompatible**
```bash
# Check Node.js version
node --version

# Update Node.js to version 18+
nvm install 18
nvm use 18
```

#### Configuration Errors

**Issue: Invalid project name**
```
Error: Project name must be lowercase letters, numbers, and hyphens only
```

**Solution:**
- Use lowercase letters only
- Replace spaces with hyphens
- No special characters except hyphens
- Length: 3-50 characters

**Valid examples:**
- `my-project`
- `api-service-v2`
- `user-dashboard`

**Issue: Domain validation failed**
```
Error: Invalid domain name
```

**Solution:**
- Use valid domain format: `example.com`
- Include subdomain if needed: `api.example.com`
- No protocol prefix (`http://`, `https://`)

#### Template Processing Errors

**Issue: Template variable not found**
```
Warning: Failed to resolve variable: missingVar
```

**Solution:**
1. Check variable name spelling
2. Ensure variable is provided in configuration
3. Use default helper: `{{default missingVar 'fallback'}}`

**Issue: Template syntax error**
```
Error: Template processing failed: Unexpected token
```

**Solution:**
1. Check template syntax
2. Ensure proper opening/closing tags
3. Validate JSON syntax in configuration

#### File Generation Errors

**Issue: Permission denied when creating files**
```
Error: EACCES: permission denied, mkdir
```

**Solution:**
```bash
# Check permissions
ls -la

# Create with proper permissions
mkdir -p project-name
chmod 755 project-name
```

**Issue: Directory already exists**
```
Error: Directory already exists
```

**Solution:**
- Choose a different project name
- Remove existing directory
- Use `--force` flag (if available)

#### Deployment Issues

**Issue: Wrangler authentication failed**
```
Error: Authentication failed
```

**Solution:**
```bash
# Login to Cloudflare
wrangler login

# Or set API token manually
export CLOUDFLARE_API_TOKEN=your_token_here
```

**Issue: Build fails**
```
Error: Build process failed
```

**Solution:**
1. Check Node.js version compatibility
2. Install dependencies: `npm install`
3. Clear cache: `npm cache clean --force`
4. Check build script in `package.json`

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Set debug environment variable
DEBUG=pur-cloudflare-setup* pur-cloudflare-setup init

# Or use verbose flag
pur-cloudflare-setup --verbose init
```

### Log Files

Check log files for detailed error information:

```bash
# View logs
tail -f ~/.pur-cloudflare-setup/logs/setup.log

# Check configuration issues
cat ~/.pur-cloudflare-setup/logs/config-errors.log
```

### Getting Help

If you encounter issues not covered here:

1. **Check the FAQ section below**
2. **Review API documentation**: `docs/api.md`
3. **Check GitHub issues**: Look for similar problems
4. **Create new issue**: Provide detailed error information
5. **Community Discord**: Join the PurAir Discord for support

## Best Practices

### Project Organization

1. **Use descriptive names**
   ```bash
   # Good
   pur-cloudflare-setup --name user-authentication-api
   
   # Avoid
   pur-cloudflare-setup --name myapi
   ```

2. **Consistent naming conventions**
   - Projects: `kebab-case`
   - Domains: `subdomain.domain.com`
   - Environment: Clear naming (`staging`, `production`)

3. **Configuration management**
   - Save configurations for similar projects
   - Use environment-specific configs
   - Document custom configurations

### Security

1. **Environment variables**
   ```bash
   # Always use .env files for secrets
   cp .env.example .env
   
   # Never commit .env files
   echo ".env" >> .gitignore
   ```

2. **Input validation**
   - The tool automatically validates inputs
   - Review generated configurations
   - Use `--validate-only` for testing

3. **Template security**
   - Templates are context-aware escaped
   - Review custom templates for XSS
   - Use safe helpers for user content

### Development Workflow

1. **Start with preview mode**
   ```bash
   pur-cloudflare-setup --preview --config my-config
   ```

2. **Test locally first**
   ```bash
   cd my-project
   npm run dev
   ```

3. **Deploy incrementally**
   ```bash
   # Deploy to staging first
   npm run deploy:staging
   
   # Test staging environment
   # Then deploy to production
   npm run deploy:production
   ```

### Performance

1. **Use saved configurations**
   - Avoid re-entering the same information
   - Create templates for common setups

2. **Batch operations**
   - Generate multiple similar projects
   - Use configuration files for automation

3. **Cache management**
   - Clear npm cache if builds fail
   - Use local development for testing

## FAQ

### General Questions

**Q: What is the PurAir Cloudflare Setup Tool?**
A: It's a command-line tool that automates the creation and configuration of Cloudflare projects, including Workers, Pages, and KV storage setups.

**Q: Do I need a Cloudflare account to use this tool?**
A: You need a Cloudflare account for deployment, but you can use the tool to generate project structures without an account.

**Q: Is this tool official from Cloudflare?**
A: No, this is a third-party tool developed by PurAir to streamline Cloudflare project setup.

### Technical Questions

**Q: What Node.js version is required?**
A: Node.js 18.0.0 or higher is required for full compatibility.

**Q: Can I use this tool with TypeScript?**
A: Yes, templates support TypeScript. Use the `--framework typescript` option or configure it manually.

**Q: How do I customize the generated templates?**
A: You can create custom templates or modify existing ones. See the Template System section for details.

**Q: Can I use this tool in CI/CD pipelines?**
A: Yes, use the `--no-interactive` flag with configuration files for automated deployment.

### Configuration Questions

**Q: Where are configurations stored?**
A: Configurations are stored in `~/.pur-cloudflare-setup/configs.json` in your home directory.

**Q: Can I share configurations with my team?**
A: Yes, export configurations to files and share them with your team members.

**Q: How do I update an existing configuration?**
A: Use the config management commands to update saved configurations.

### Deployment Questions

**Q: How do I deploy to multiple environments?**
A: Create separate configurations for each environment and use environment-specific deployment scripts.

**Q: Can I deploy to regions other than the US?**
A: Yes, Cloudflare automatically handles global distribution. Configure regions in your Wrangler configuration.

**Q: How do I set up custom domains?**
A: Configure custom domains in your Cloudflare dashboard and update the domain settings in your project configuration.

### Troubleshooting Questions

**Q: What should I do if installation fails?**
A: Check Node.js version, try installing locally instead of globally, or use sudo for global installation.

**Q: Why am I getting template processing errors?**
A: Check template syntax, ensure all required variables are provided, and validate your configuration.

**Q: How do I report bugs or request features?**
A: Create an issue on the GitHub repository with detailed information about the problem or feature request.

### Migration Questions

**Q: Can I migrate existing projects to use this tool?**
A: While the tool is designed for new projects, you can adapt existing projects by integrating the generated configuration files.

**Q: How do I upgrade to newer versions?**
A: Update the tool using `npm update -g pur-cloudflare-setup` and check the changelog for breaking changes.

**Q: Are there any breaking changes between versions?**
A: Check the changelog and migration guide for version-specific changes and upgrade instructions.

---

For additional support, join our Discord community or check the developer documentation for advanced usage patterns.