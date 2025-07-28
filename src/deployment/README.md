# PurAir Cloudflare Deployment Automation Suite

A comprehensive deployment automation system for Cloudflare Workers and Pages, designed specifically for PurAir projects with built-in security, performance monitoring, and CI/CD integration.

## Features

- **🚀 Automated Deployment** - Complete deployment pipeline with pre/post validation
- **🤖 CI/CD Integration** - GitHub Actions, GitLab CI, and other CI platforms
- **🔍 Deployment Verification** - Health checks, performance monitoring, and security validation
- **🔄 Rollback Support** - Automatic rollback on failure with deployment history
- **📊 Performance Monitoring** - Response time, TTFB, and concurrent request testing
- **🔒 Security Validation** - Security headers, SSL certificates, and CORS verification
- **📈 Progress Tracking** - Visual progress indicators and detailed reporting
- **🔧 Configuration Management** - Environment-specific deployments and secret handling

## Quick Start

### 1. Basic Deployment

```javascript
import { deployProject } from './src/deployment/index.js';

const result = await deployProject('/path/to/project', {
  environment: 'production',
  runTests: true,
  enableRollback: true
});

console.log('Deployed to:', result.result.url);
```

### 2. CI/CD Deployment

```javascript
import { runCIDeployment } from './src/deployment/index.js';

// Automatically detects CI environment and configures deployment
const result = await runCIDeployment({
  projectPath: process.cwd()
});
```

### 3. Deployment Verification

```javascript
import { verifyDeployment } from './src/deployment/index.js';

const report = await verifyDeployment('https://your-app.pages.dev', {
  responseTimeThreshold: 2000,
  runSecurityChecks: true
});

console.log('Verification passed:', report.summary.passed);
```

### 4. Combined Deploy and Verify

```javascript
import { deployAndVerify } from './src/deployment/index.js';

const result = await deployAndVerify('/path/to/project', {
  environment: 'production',
  responseTimeThreshold: 1500
});
```

## Installation

The deployment automation suite is part of the PurAir Cloudflare Setup Tool. No additional installation required.

### Prerequisites

- Node.js 18+ 
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with API token
- Git (for CI/CD features)

## Configuration

### Environment Variables

```bash
# Required
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Optional
NODE_ENV=production
ENVIRONMENT=production  
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DEPLOYMENT_WEBHOOK_URL=https://your-webhook.com/deploy

# Project-specific
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=your_base_id
```

### Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "deploy": "node src/deployment/deploy.js",
    "deploy:ci": "node src/deployment/ci-deploy.js",
    "deploy:staging": "ENVIRONMENT=staging npm run deploy",
    "deploy:production": "ENVIRONMENT=production npm run deploy",
    "verify": "node src/deployment/verify-deployment.js",
    "deploy:verify": "npm run deploy && npm run verify:last"
  }
}
```

## Deployment Options

### Standard Deployment Options

```javascript
{
  environment: 'production',        // Target environment
  installDependencies: true,        // Run npm ci
  runTests: true,                   // Execute test suite
  build: true,                      // Run build process
  enableRollback: true,             // Enable automatic rollback
  dryRun: false,                    // Preview deployment without executing
  runPostDeployTests: true,         // Run post-deployment verification
  enableHealthChecks: true,         // Perform health checks
  environmentVariables: {},         // Environment-specific variables
  secrets: {}                       // Deployment secrets
}
```

### Verification Options

```javascript
{
  responseTimeThreshold: 2000,      // Maximum acceptable response time (ms)
  ttfbThreshold: 800,               // Time to First Byte threshold (ms)
  concurrencyThreshold: 10,         // Concurrent request test limit
  stopOnFailure: false,             // Stop verification on first failure
  runSecurityChecks: true,          // Validate security headers
  apiTests: []                      // Custom API endpoint tests
}
```

## CI/CD Integration

### GitHub Actions

Generate workflow file:

```javascript
import { generateGitHubActionsWorkflow } from './src/deployment/index.js';

const workflow = generateGitHubActionsWorkflow({
  projectName: 'my-purair-app'
});
```

Example workflow:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm test
    - run: node src/deployment/ci-deploy.js
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### GitLab CI

```yaml
stages:
  - test
  - deploy

deploy:
  stage: deploy
  script:
    - npm ci
    - node src/deployment/ci-deploy.js
  only:
    - main
    - staging
```

## API Reference

### DeploymentAutomation

Main deployment orchestration class.

#### Methods

- `deployProject(projectPath, options)` - Deploy a project
- `preDeploymentValidation(projectPath, options)` - Validate before deployment
- `performRollback(projectPath)` - Rollback to previous deployment

### CIDeploymentManager  

CI/CD specific deployment management.

#### Methods

- `runCIDeployment(options)` - Execute CI deployment pipeline
- `detectEnvironment()` - Auto-detect deployment environment
- `validateCISecrets()` - Validate CI secrets and credentials

### DeploymentVerifier

Comprehensive deployment verification and monitoring.

#### Methods

- `verifyDeployment(url, options)` - Full verification suite
- `quickHealthCheck(url)` - Quick connectivity test
- `verifyHealthChecks(url)` - Health endpoint validation
- `verifyAPIEndpoints(url)` - API functionality testing
- `verifyPerformance(url)` - Performance metrics collection
- `verifySecurityHeaders(url)` - Security configuration validation

## Verification Suites

### Health Checks
- Basic connectivity
- Root endpoint availability  
- Health endpoint response
- API status validation

### API Testing
- Endpoint availability
- CORS configuration
- Response validation
- Custom API tests

### Configuration Validation
- SSL certificate verification
- DNS resolution testing
- Cloudflare integration
- Cache header validation

### Performance Monitoring
- Response time measurement
- Time to First Byte (TTFB)
- Concurrent request handling
- Performance threshold validation

### Security Verification  
- Security header presence
- SSL/TLS configuration
- CORS policy validation
- Content Security Policy

## Error Handling

The deployment system includes comprehensive error handling:

```javascript
try {
  const result = await deployProject(projectPath, options);
} catch (error) {
  // Automatic rollback if enabled
  if (error.rollbackAvailable) {
    console.log('Rollback initiated...');
  }
  
  // Detailed error information
  console.error('Deployment failed:', error.message);
  console.error('Error code:', error.code);
  console.error('Solution:', error.solution);
}
```

### Common Error Codes

- `INVALID_CONFIG` - Configuration validation failed
- `API_KEY_INVALID` - Invalid Cloudflare API token
- `DEPLOYMENT_FAILED` - Deployment process failed
- `WRANGLER_NOT_FOUND` - Wrangler CLI not installed
- `BUILD_FAILED` - Build process failed
- `NETWORK_TIMEOUT` - Network request timeout

## Performance Optimization

### Deployment Speed
- Use `npm ci` instead of `npm install`
- Enable dependency caching in CI
- Parallel test execution
- Optimized Wrangler configuration

### Verification Efficiency  
- Reasonable timeout values
- Selective verification suites
- Concurrent request limits
- Smart retry logic

## Security Features

### Credential Protection
- Secure secret handling
- Token sanitization in logs
- Environment variable validation
- CI-specific security checks

### Deployment Security
- Pre-deployment validation
- Security header verification
- SSL certificate validation
- CORS policy testing

## Monitoring and Reporting

### Deployment Reports
- JSON format deployment records
- Performance metrics collection
- Error tracking and analysis
- Historical deployment data

### Notifications
- Slack webhook integration
- Custom webhook support
- GitHub deployment status
- Email notifications (configurable)

## Examples

See `example-usage.js` for comprehensive examples:

```bash
# View all examples
node src/deployment/example-usage.js examples

# Show configuration examples  
node src/deployment/example-usage.js config

# Performance optimization tips
node src/deployment/example-usage.js performance

# Error handling examples
node src/deployment/example-usage.js errors

# Quick health check
node src/deployment/example-usage.js health https://your-app.pages.dev
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify `CLOUDFLARE_API_TOKEN` is set
   - Check token permissions (Zone:Edit, Workers:Edit)
   - Run `wrangler whoami` to verify authentication

2. **Build Failures**
   - Check `package.json` build script
   - Verify all dependencies are installed
   - Review build logs for specific errors

3. **Deployment Timeout**
   - Increase timeout values in options
   - Check network connectivity
   - Verify Cloudflare service status

4. **Verification Failures**
   - Adjust response time thresholds
   - Check deployment URL accessibility
   - Review security header configuration

### Debug Mode

Enable debug logging:

```bash
DEBUG=true node src/deployment/deploy.js
```

### Log Files

Deployment logs are saved to:
- `.deployment-reports/` - Deployment records
- `.verification-reports/` - Verification results
- `.ci-deployments/` - CI deployment tracking

## Contributing

When contributing to the deployment automation suite:

1. Follow existing code patterns
2. Add comprehensive error handling
3. Include progress indicators for long operations
4. Write tests for new functionality
5. Update documentation for new features

## License

Part of the PurAir Cloudflare Setup Tool - Internal Use Only