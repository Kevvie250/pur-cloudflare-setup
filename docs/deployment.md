# Deployment Guide

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Environment Setup](#environment-setup)
- [Deployment Strategies](#deployment-strategies)
- [Cloudflare Workers Deployment](#cloudflare-workers-deployment)
- [Cloudflare Pages Deployment](#cloudflare-pages-deployment)
- [Multi-Environment Management](#multi-environment-management)
- [CI/CD Integration](#cicd-integration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Rollback Procedures](#rollback-procedures)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Deployment Overview

The PurAir Cloudflare Setup Tool generates projects optimized for Cloudflare's edge computing platform. This guide covers deployment strategies, environment management, and operational best practices.

### Supported Deployment Targets

- **Cloudflare Workers**: Serverless JavaScript execution
- **Cloudflare Pages**: Static site hosting with serverless functions
- **Cloudflare KV**: Key-value storage
- **Cloudflare D1**: SQL database
- **Cloudflare R2**: Object storage

### Deployment Principles

1. **Environment Parity**: Consistent environments across dev/staging/prod
2. **Infrastructure as Code**: Declarative configuration management
3. **Blue-Green Deployment**: Zero-downtime deployments
4. **Automated Testing**: Comprehensive testing before deployment
5. **Observability**: Monitoring and logging at all stages

## Environment Setup

### Prerequisites

1. **Cloudflare Account**
   - Active Cloudflare account with appropriate plan
   - Domain configured in Cloudflare
   - API token with required permissions

2. **Development Tools**
   ```bash
   # Install Wrangler CLI
   npm install -g wrangler
   
   # Install PurAir Setup Tool
   npm install -g pur-cloudflare-setup
   
   # Verify installations
   wrangler --version
   pur-cloudflare-setup --version
   ```

3. **Authentication Setup**
   ```bash
   # Login to Cloudflare
   wrangler login
   
   # Or use API token
   export CLOUDFLARE_API_TOKEN=your_api_token_here
   ```

### Project Structure

Generated projects follow this structure for optimal deployment:

```
my-project/
├── src/                    # Source code
├── public/                 # Static assets (Pages only)
├── wrangler.toml          # Cloudflare configuration
├── package.json           # Dependencies and scripts
├── .env.example           # Environment template
├── .env.development       # Development environment
├── .env.staging          # Staging environment
├── .env.production       # Production environment
└── docs/
    ├── deployment.md      # Deployment instructions
    └── README.md         # Project documentation
```

### Environment Configuration

#### Development Environment

```toml
# wrangler.toml
name = "my-project-dev"
main = "src/index.js"
compatibility_date = "2024-01-15"

[env.development]
name = "my-project-dev"
vars = { ENVIRONMENT = "development" }

[[env.development.kv_namespaces]]
binding = "MY_KV"
id = "dev_kv_namespace_id"
```

#### Staging Environment

```toml
[env.staging]
name = "my-project-staging"
vars = { ENVIRONMENT = "staging" }
routes = ["staging.example.com/*"]

[[env.staging.kv_namespaces]]
binding = "MY_KV"
id = "staging_kv_namespace_id"
```

#### Production Environment

```toml
[env.production]
name = "my-project-prod"
vars = { ENVIRONMENT = "production" }
routes = ["example.com/*", "www.example.com/*"]

[[env.production.kv_namespaces]]
binding = "MY_KV"
id = "production_kv_namespace_id"
```

## Deployment Strategies

### 1. Direct Deployment

Simple deployment for development and testing:

```bash
# Deploy to development
wrangler publish --env development

# Deploy to staging
wrangler publish --env staging

# Deploy to production
wrangler publish --env production
```

### 2. Blue-Green Deployment

Zero-downtime deployment strategy:

```bash
#!/bin/bash
# deploy-blue-green.sh

ENVIRONMENT=${1:-production}
CURRENT_WORKER="my-project-${ENVIRONMENT}"
NEW_WORKER="my-project-${ENVIRONMENT}-new"

echo "Starting blue-green deployment to ${ENVIRONMENT}..."

# Deploy new version
wrangler publish --name $NEW_WORKER --env $ENVIRONMENT

# Test new version
echo "Testing new deployment..."
curl -f "https://${NEW_WORKER}.workers.dev/health" || {
    echo "Health check failed, rolling back..."
    wrangler delete $NEW_WORKER
    exit 1
}

# Switch traffic to new version
echo "Switching traffic to new version..."
wrangler publish --name $CURRENT_WORKER --env $ENVIRONMENT

# Cleanup old version
echo "Cleaning up old version..."
wrangler delete "${CURRENT_WORKER}-old" 2>/dev/null || true

echo "Deployment completed successfully!"
```

### 3. Canary Deployment

Gradual traffic shifting:

```bash
#!/bin/bash
# canary-deploy.sh

ENVIRONMENT=${1:-production}
CANARY_PERCENTAGE=${2:-10}

echo "Starting canary deployment (${CANARY_PERCENTAGE}% traffic)..."

# Deploy canary version
wrangler publish --name "my-project-${ENVIRONMENT}-canary" --env $ENVIRONMENT

# Configure traffic splitting (requires Cloudflare Load Balancer)
curl -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/load_balancers/${LB_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Canary deployment load balancer",
    "name": "my-project-lb",
    "fallback_pool": "main-pool",
    "default_pools": ["main-pool"],
    "region_pools": {
      "WNAM": ["canary-pool"],
      "ENAM": ["canary-pool"]
    },
    "rules": [{
      "name": "canary-rule",
      "condition": "http.request.uri.path matches \"^/api/.*\"",
      "fixed_response": {
        "message_body": "canary",
        "status_code": 200
      }
    }]
  }'

echo "Canary deployment configured with ${CANARY_PERCENTAGE}% traffic"
```

### 4. Feature Flag Deployment

Controlled feature rollouts:

```javascript
// src/featureFlags.js
export class FeatureFlags {
  constructor(env) {
    this.env = env;
    this.flags = new Map();
    this.loadFlags();
  }
  
  loadFlags() {
    // Load from KV storage or environment variables
    const flags = JSON.parse(this.env.FEATURE_FLAGS || '{}');
    Object.entries(flags).forEach(([key, value]) => {
      this.flags.set(key, value);
    });
  }
  
  isEnabled(flagName, userId = null) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    
    // Simple percentage-based rollout
    if (flag.percentage) {
      const hash = this.hashUserId(userId || 'anonymous');
      return (hash % 100) < flag.percentage;
    }
    
    return flag.enabled || false;
  }
  
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// Usage in Worker
export default {
  async fetch(request, env) {
    const featureFlags = new FeatureFlags(env);
    
    if (featureFlags.isEnabled('new-api-endpoint')) {
      return handleNewApiEndpoint(request);
    }
    
    return handleLegacyApiEndpoint(request);
  }
};
```

## Cloudflare Workers Deployment

### Worker Configuration

```toml
# wrangler.toml for Workers
name = "my-api-worker"
main = "src/index.js"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]

# Environment variables
[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"

# Durable Objects
[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"

# R2 Buckets
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-storage-bucket"

# D1 Databases
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your_database_id"
```

### Deployment Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev --env development",
    "deploy:dev": "wrangler publish --env development",
    "deploy:staging": "wrangler publish --env staging",
    "deploy:prod": "wrangler publish --env production",
    "logs:dev": "wrangler tail --env development",
    "logs:prod": "wrangler tail --env production"
  }
}
```

### Advanced Worker Features

```javascript
// src/index.js - Advanced Worker example
import { FeatureFlags } from './featureFlags.js';
import { RateLimiter } from './rateLimiter.js';
import { Logger } from './logger.js';

export { RateLimiter };

export default {
  async fetch(request, env, ctx) {
    const logger = new Logger(env);
    const featureFlags = new FeatureFlags(env);
    
    try {
      // Rate limiting
      const rateLimiter = env.RATE_LIMITER.get(
        env.RATE_LIMITER.idFromName("global")
      );
      
      const rateLimit = await rateLimiter.fetch(request);
      if (rateLimit.status === 429) {
        return rateLimit;
      }
      
      // Feature flag check
      if (featureFlags.isEnabled('maintenance-mode')) {
        return new Response('Service temporarily unavailable', {
          status: 503,
          headers: { 'Retry-After': '3600' }
        });
      }
      
      // Route handling
      const url = new URL(request.url);
      const response = await handleRoute(url, request, env);
      
      // Add security headers
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      
      // Log request
      ctx.waitUntil(logger.logRequest(request, response));
      
      return response;
      
    } catch (error) {
      logger.logError(error, { url: request.url });
      
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

async function handleRoute(url, request, env) {
  const path = url.pathname;
  
  switch (true) {
    case path === '/health':
      return new Response('OK', { status: 200 });
      
    case path.startsWith('/api/'):
      return handleApiRequest(url, request, env);
      
    default:
      return new Response('Not Found', { status: 404 });
  }
}
```

## Cloudflare Pages Deployment

### Pages Configuration

```toml
# wrangler.toml for Pages Functions
name = "my-static-site"
compatibility_date = "2024-01-15"

[env.production]
name = "my-static-site"

# Pages Functions configuration
[[env.production.d1_databases]]
binding = "DB"
database_name = "site-database"
database_id = "your_database_id"
```

### Build Configuration

```json
{
  "build": {
    "command": "npm run build",
    "destination": "dist",
    "rootDir": ".",
    "environment": {
      "NODE_VERSION": "18"
    }
  },
  "functions": {
    "directory": "functions",
    "compatibility_date": "2024-01-15"
  }
}
```

### Pages Functions

```javascript
// functions/api/users/[id].js
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const userId = params.id;
  
  try {
    // Query D1 database
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return new Response('User not found', { status: 404 });
    }
    
    return Response.json(user);
  } catch (error) {
    console.error('Database error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const userData = await request.json();
    
    // Insert user into D1 database
    const result = await env.DB.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).bind(userData.name, userData.email).run();
    
    return Response.json({ id: result.meta.last_row_id });
  } catch (error) {
    console.error('Database error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### Static Site Deployment

```bash
#!/bin/bash
# deploy-pages.sh

ENVIRONMENT=${1:-production}
BUILD_DIR="dist"

echo "Building site for ${ENVIRONMENT}..."

# Set environment variables
export NODE_ENV=$ENVIRONMENT
export NEXT_PUBLIC_API_URL="https://api.example.com"

# Build the site
npm run build

# Deploy to Cloudflare Pages
wrangler pages publish $BUILD_DIR --project-name "my-site-${ENVIRONMENT}"

echo "Site deployed successfully!"
```

## Multi-Environment Management

### Environment-Specific Configuration

```javascript
// src/config/index.js
const configs = {
  development: {
    apiUrl: 'http://localhost:8787',
    debug: true,
    logLevel: 'debug'
  },
  staging: {
    apiUrl: 'https://api-staging.example.com',
    debug: true,
    logLevel: 'info'
  },
  production: {
    apiUrl: 'https://api.example.com',
    debug: false,
    logLevel: 'warn'
  }
};

export const getConfig = (environment = 'production') => {
  return {
    ...configs[environment],
    environment,
    version: process.env.npm_package_version
  };
};
```

### Database Migration Management

```javascript
// scripts/migrate.js
import { getConfig } from '../src/config/index.js';

class MigrationManager {
  constructor(env) {
    this.db = env.DB;
    this.config = getConfig(env.ENVIRONMENT);
  }
  
  async runMigrations() {
    console.log(`Running migrations for ${this.config.environment}...`);
    
    // Create migration tracking table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get applied migrations
    const applied = await this.db.prepare(
      'SELECT name FROM migrations'
    ).all();
    
    const appliedNames = new Set(applied.results.map(r => r.name));
    
    // Apply pending migrations
    const migrations = await this.getMigrations();
    for (const migration of migrations) {
      if (!appliedNames.has(migration.name)) {
        await this.applyMigration(migration);
      }
    }
    
    console.log('Migrations completed successfully');
  }
  
  async applyMigration(migration) {
    console.log(`Applying migration: ${migration.name}`);
    
    try {
      await this.db.exec(migration.sql);
      await this.db.prepare(
        'INSERT INTO migrations (name) VALUES (?)'
      ).bind(migration.name).run();
      
      console.log(`✓ Applied: ${migration.name}`);
    } catch (error) {
      console.error(`✗ Failed: ${migration.name}`, error);
      throw error;
    }
  }
  
  async getMigrations() {
    // Load migration files
    return [
      {
        name: '001_create_users_table',
        sql: `
          CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: '002_add_user_status',
        sql: `
          ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'
        `
      }
    ];
  }
}

// Usage in deployment script
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === '0 2 * * *') { // Daily at 2 AM
      const migrationManager = new MigrationManager(env);
      await migrationManager.runMigrations();
    }
  }
};
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging, development]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run security audit
        run: npm audit --audit-level moderate

  deploy-development:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/development'
    environment: development
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Development
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: development
          preCommands: |
            echo "Deploying to development environment"
          postCommands: |
            echo "Development deployment completed"

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          API_URL: https://api-staging.example.com
      
      - name: Deploy to Staging
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: staging
      
      - name: Run smoke tests
        run: npm run test:smoke
        env:
          API_URL: https://api-staging.example.com

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build production assets
        run: npm run build
        env:
          NODE_ENV: production
      
      - name: Deploy to Production
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: production
      
      - name: Run production health checks
        run: npm run test:health
        env:
          API_URL: https://api.example.com
      
      - name: Notify deployment success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: success()
```

### GitLab CI/CD Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - deploy-dev
  - deploy-staging
  - deploy-prod

variables:
  NODE_VERSION: "18"

.node-template: &node-template
  image: node:${NODE_VERSION}
  cache:
    paths:
      - node_modules/

test:
  <<: *node-template
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm test
    - npm audit --audit-level moderate
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

deploy-development:
  <<: *node-template
  stage: deploy-dev
  script:
    - npm ci
    - npx wrangler publish --env development
  environment:
    name: development
    url: https://my-project-dev.workers.dev
  only:
    - development

deploy-staging:
  <<: *node-template
  stage: deploy-staging
  script:
    - npm ci
    - npx wrangler publish --env staging
    - npm run test:smoke -- --env staging
  environment:
    name: staging
    url: https://api-staging.example.com
  only:
    - staging

deploy-production:
  <<: *node-template
  stage: deploy-prod
  script:
    - npm ci
    - npm run build
    - npx wrangler publish --env production
    - npm run test:health -- --env production
  environment:
    name: production
    url: https://api.example.com
  when: manual
  only:
    - main
```

## Monitoring & Maintenance

### Health Check Implementation

```javascript
// src/healthCheck.js
export class HealthChecker {
  constructor(env) {
    this.env = env;
  }
  
  async performHealthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };
    
    // Database connectivity
    try {
      await this.env.DB.prepare('SELECT 1').first();
      checks.checks.database = { status: 'healthy' };
    } catch (error) {
      checks.checks.database = { 
        status: 'unhealthy', 
        error: error.message 
      };
      checks.status = 'unhealthy';
    }
    
    // KV storage
    try {
      await this.env.CACHE.put('health-check', 'ok', { expirationTtl: 60 });
      const value = await this.env.CACHE.get('health-check');
      checks.checks.kv_storage = { 
        status: value === 'ok' ? 'healthy' : 'unhealthy' 
      };
    } catch (error) {
      checks.checks.kv_storage = { 
        status: 'unhealthy', 
        error: error.message 
      };
      checks.status = 'unhealthy';
    }
    
    // External API dependencies
    try {
      const response = await fetch('https://external-api.example.com/health', {
        signal: AbortSignal.timeout(5000)
      });
      checks.checks.external_api = { 
        status: response.ok ? 'healthy' : 'unhealthy',
        response_time: response.headers.get('x-response-time')
      };
    } catch (error) {
      checks.checks.external_api = { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
    
    return checks;
  }
}

// Health endpoint
export async function handleHealthCheck(request, env) {
  const healthChecker = new HealthChecker(env);
  const health = await healthChecker.performHealthCheck();
  
  const status = health.status === 'healthy' ? 200 : 503;
  
  return new Response(JSON.stringify(health, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}
```

### Logging and Observability

```javascript
// src/logger.js
export class Logger {
  constructor(env) {
    this.env = env;
    this.logLevel = env.LOG_LEVEL || 'info';
  }
  
  async logRequest(request, response) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'request',
      method: request.method,
      url: request.url,
      status: response.status,
      duration: Date.now() - request.startTime,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.cf?.country,
      ray: request.headers.get('CF-Ray')
    };
    
    await this.writeLog(logEntry);
  }
  
  async logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'error',
      message: error.message,
      stack: error.stack,
      context
    };
    
    await this.writeLog(logEntry);
  }
  
  async writeLog(entry) {
    // Write to console (visible in wrangler tail)
    console.log(JSON.stringify(entry));
    
    // Optional: Store in KV for later analysis
    if (this.env.LOG_STORAGE) {
      const key = `log:${entry.timestamp}:${Math.random()}`;
      await this.env.LOG_STORAGE.put(key, JSON.stringify(entry), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
    }
    
    // Optional: Send to external logging service
    if (this.env.LOG_WEBHOOK && entry.level === 'error') {
      await fetch(this.env.LOG_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    }
  }
}
```

### Performance Monitoring

```javascript
// src/metrics.js
export class MetricsCollector {
  constructor(env) {
    this.env = env;
    this.metrics = new Map();
  }
  
  startTimer(name) {
    this.metrics.set(name, Date.now());
  }
  
  endTimer(name) {
    const startTime = this.metrics.get(name);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.metrics.delete(name);
      return duration;
    }
    return 0;
  }
  
  incrementCounter(name, value = 1) {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }
  
  async flush() {
    const timestamp = Date.now();
    const metricsData = {
      timestamp,
      metrics: Object.fromEntries(this.metrics)
    };
    
    // Send to analytics service
    if (this.env.ANALYTICS_ENDPOINT) {
      await fetch(this.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsData)
      });
    }
    
    // Store in KV for aggregation
    if (this.env.METRICS_KV) {
      const key = `metrics:${timestamp}`;
      await this.env.METRICS_KV.put(key, JSON.stringify(metricsData), {
        expirationTtl: 24 * 60 * 60 // 24 hours
      });
    }
    
    this.metrics.clear();
  }
}
```

## Rollback Procedures

### Automated Rollback Script

```bash
#!/bin/bash
# rollback.sh

ENVIRONMENT=${1:-production}
WORKER_NAME="my-project-${ENVIRONMENT}"

echo "Starting rollback for ${ENVIRONMENT} environment..."

# Get current deployment
CURRENT_DEPLOYMENT=$(wrangler deployments list --name $WORKER_NAME --json | jq -r '.[0].id')

if [ "$CURRENT_DEPLOYMENT" == "null" ]; then
    echo "Error: No current deployment found"
    exit 1
fi

echo "Current deployment: $CURRENT_DEPLOYMENT"

# Get previous deployment
PREVIOUS_DEPLOYMENT=$(wrangler deployments list --name $WORKER_NAME --json | jq -r '.[1].id')

if [ "$PREVIOUS_DEPLOYMENT" == "null" ]; then
    echo "Error: No previous deployment found"
    exit 1
fi

echo "Previous deployment: $PREVIOUS_DEPLOYMENT"

# Confirm rollback
read -p "Are you sure you want to rollback to $PREVIOUS_DEPLOYMENT? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# Perform rollback
echo "Rolling back to previous deployment..."
wrangler rollback $PREVIOUS_DEPLOYMENT --name $WORKER_NAME

# Verify rollback
echo "Verifying rollback..."
sleep 5

curl -f "https://${WORKER_NAME}.workers.dev/health" || {
    echo "Health check failed after rollback!"
    exit 1
}

echo "Rollback completed successfully!"

# Send notification
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔄 Rollback completed for ${ENVIRONMENT}: ${CURRENT_DEPLOYMENT} → ${PREVIOUS_DEPLOYMENT}\"}" \
        $SLACK_WEBHOOK
fi
```

### Database Rollback Strategy

```javascript
// src/rollback/database.js
export class DatabaseRollback {
  constructor(env) {
    this.db = env.DB;
  }
  
  async createBackup(backupName) {
    console.log(`Creating database backup: ${backupName}`);
    
    // Export all tables to KV storage
    const tables = await this.getTables();
    const backup = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    for (const table of tables) {
      const data = await this.db.prepare(`SELECT * FROM ${table}`).all();
      backup.tables[table] = data.results;
    }
    
    // Store backup in KV
    await this.env.BACKUP_KV.put(
      `backup:${backupName}`,
      JSON.stringify(backup),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );
    
    console.log(`Backup created successfully: ${backupName}`);
    return backupName;
  }
  
  async restoreBackup(backupName) {
    console.log(`Restoring database backup: ${backupName}`);
    
    const backupData = await this.env.BACKUP_KV.get(`backup:${backupName}`);
    if (!backupData) {
      throw new Error(`Backup not found: ${backupName}`);
    }
    
    const backup = JSON.parse(backupData);
    
    // Restore each table
    for (const [tableName, rows] of Object.entries(backup.tables)) {
      // Clear existing data
      await this.db.prepare(`DELETE FROM ${tableName}`).run();
      
      // Restore backup data
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map(() => '?').join(', ');
        
        await this.db.prepare(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
        ).bind(...values).run();
      }
    }
    
    console.log(`Database restored successfully from backup: ${backupName}`);
  }
  
  async getTables() {
    const result = await this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all();
    
    return result.results.map(row => row.name);
  }
}
```

## Performance Optimization

### Caching Strategy

```javascript
// src/cache.js
export class CacheManager {
  constructor(env) {
    this.kv = env.CACHE;
    this.defaultTtl = 300; // 5 minutes
  }
  
  async get(key, options = {}) {
    const { namespace = 'default' } = options;
    const fullKey = `${namespace}:${key}`;
    
    try {
      const cached = await this.kv.get(fullKey, { type: 'json' });
      
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
    } catch (error) {
      console.warn('Cache get error:', error);
    }
    
    return null;
  }
  
  async set(key, data, options = {}) {
    const { 
      namespace = 'default', 
      ttl = this.defaultTtl 
    } = options;
    
    const fullKey = `${namespace}:${key}`;
    const cacheEntry = {
      data,
      expires: Date.now() + (ttl * 1000),
      created: Date.now()
    };
    
    try {
      await this.kv.put(fullKey, JSON.stringify(cacheEntry), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }
  
  async invalidate(pattern, options = {}) {
    const { namespace = 'default' } = options;
    const prefix = `${namespace}:${pattern}`;
    
    // List keys with prefix and delete them
    const keys = await this.kv.list({ prefix });
    
    const deletePromises = keys.keys.map(key => 
      this.kv.delete(key.name)
    );
    
    await Promise.all(deletePromises);
  }
}

// Usage in Worker
export default {
  async fetch(request, env) {
    const cache = new CacheManager(env);
    const url = new URL(request.url);
    const cacheKey = `${request.method}:${url.pathname}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      });
    }
    
    // Generate response
    const data = await generateResponse(request, env);
    
    // Cache the response
    await cache.set(cacheKey, data, { ttl: 600 }); // 10 minutes
    
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    });
  }
};
```

### Bundle Optimization

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['lodash', 'date-fns'],
          utils: ['./src/utils/index.js']
        }
      }
    }
  },
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
});
```

## Troubleshooting

### Common Deployment Issues

#### 1. Wrangler Authentication

```bash
# Clear authentication cache
wrangler logout
wrangler login

# Or use API token
export CLOUDFLARE_API_TOKEN=your_token_here
wrangler whoami
```

#### 2. Bundle Size Exceeded

```bash
# Check bundle size
wrangler publish --dry-run --outdir dist

# Analyze bundle
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/
```

#### 3. Environment Variable Issues

```bash
# Check environment variables
wrangler secret list --env production

# Set environment variable
wrangler secret put API_KEY --env production
```

#### 4. Database Connection Issues

```javascript
// Test database connection
export default {
  async fetch(request, env) {
    try {
      const result = await env.DB.prepare('SELECT 1 as test').first();
      return Response.json({ status: 'ok', result });
    } catch (error) {
      return Response.json({ 
        status: 'error', 
        message: error.message 
      }, { status: 500 });
    }
  }
};
```

### Debugging Tools

```bash
# Real-time logs
wrangler tail --env production

# Local development with debugging
wrangler dev --local --port 8787

# Debug mode
DEBUG=1 wrangler dev

# Inspect deployment
wrangler deployments list
wrangler deployments view [deployment-id]
```

### Performance Debugging

```javascript
// Performance monitoring
export default {
  async fetch(request, env, ctx) {
    const start = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      const duration = Date.now() - start;
      response.headers.set('X-Response-Time', `${duration}ms`);
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`Slow request: ${request.url} took ${duration}ms`);
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Request failed after ${duration}ms:`, error);
      throw error;
    }
  }
};
```

This deployment guide provides comprehensive coverage of deployment strategies, environment management, and operational best practices for Cloudflare projects generated by the PurAir Setup Tool.