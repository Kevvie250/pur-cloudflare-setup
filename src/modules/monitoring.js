import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { templateEngine } from './templateEngine.js';
import { configValidator } from './configValidator.js';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Monitoring Service
 * 
 * Provides comprehensive monitoring and health check capabilities
 * for deployed Cloudflare Workers and Pages projects
 */
export class MonitoringService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates/monitoring');
    this.spinner = ora();
    this.healthCheckHistory = new Map(); // Store health check results
    this.alertHandlers = new Map(); // Store alert handlers
    this.metricCollectors = new Map(); // Store metric collectors
  }

  /**
   * Generate monitoring templates for a project
   */
  async generateMonitoringTemplates(config, outputDir) {
    this.spinner.start('Generating monitoring templates...');
    
    try {
      // Ensure monitoring directory exists
      const monitoringDir = path.join(outputDir, 'monitoring');
      await fs.ensureDir(monitoringDir);
      
      // Prepare monitoring configuration
      const monitoringConfig = this.prepareMonitoringConfig(config);
      
      // Generate health check worker
      const healthCheckContent = await templateEngine.loadAndProcess(
        'monitoring/health-check.js.hbs',
        monitoringConfig
      );
      
      await fs.writeFile(
        path.join(monitoringDir, 'health-check.js'),
        healthCheckContent,
        'utf-8'
      );
      
      // Generate monitoring dashboard
      const dashboardContent = await templateEngine.loadAndProcess(
        'monitoring/dashboard.html.hbs',
        monitoringConfig
      );
      
      await fs.writeFile(
        path.join(monitoringDir, 'dashboard.html'),
        dashboardContent,
        'utf-8'
      );
      
      // Generate monitoring configuration
      const monitoringConfigFile = {
        service: config.projectName,
        version: config.version || '1.0.0',
        environment: config.environment || 'production',
        endpoints: monitoringConfig.healthCheckEndpoints || [],
        thresholds: monitoringConfig.thresholds || {},
        alerts: monitoringConfig.alerts || {},
        dashboardConfig: {
          refreshInterval: 30000,
          maxDataPoints: 100,
          enableRealTimeUpdates: true
        }
      };
      
      await fs.writeJSON(
        path.join(monitoringDir, 'monitoring-config.json'),
        monitoringConfigFile,
        { spaces: 2 }
      );
      
      // Generate deployment script for monitoring
      await this.generateMonitoringDeploymentScript(config, monitoringDir);
      
      // Generate monitoring documentation
      await this.generateMonitoringDocs(config, monitoringDir);
      
      this.spinner.succeed('Monitoring templates generated successfully');
      
      return {
        healthCheckPath: path.join(monitoringDir, 'health-check.js'),
        dashboardPath: path.join(monitoringDir, 'dashboard.html'),
        configPath: path.join(monitoringDir, 'monitoring-config.json'),
        deploymentScript: path.join(monitoringDir, 'deploy-monitoring.sh'),
        documentation: path.join(monitoringDir, 'README.md')
      };
      
    } catch (error) {
      this.spinner.fail('Failed to generate monitoring templates');
      logger.error('Monitoring template generation failed:', error);
      throw error;
    }
  }

  /**
   * Prepare monitoring configuration from project config
   */
  prepareMonitoringConfig(config) {
    const monitoringConfig = {
      projectName: config.projectName,
      version: config.version || '1.0.0',
      environment: config.environment || 'production',
      deploymentId: this.generateDeploymentId(),
      timestamp: new Date().toISOString(),
      
      // Health check endpoints
      healthCheckEndpoints: this.generateHealthCheckEndpoints(config),
      
      // Performance thresholds
      thresholds: {
        responseTime: config.monitoring?.responseTimeThreshold || 1000,
        errorRate: config.monitoring?.errorRateThreshold || 0.05,
        cpuUsage: config.monitoring?.cpuThreshold || 0.80,
        memoryUsage: config.monitoring?.memoryThreshold || 0.80
      },
      
      // API configuration
      apiType: config.apiType,
      corsEnabled: config.corsEnabled,
      
      // Required environment variables
      requiredEnvVars: this.getRequiredEnvVars(config),
      
      // Reset configuration
      resetAuthRequired: config.monitoring?.resetAuthRequired || false,
      resetToken: config.monitoring?.resetToken || this.generateSecureToken(),
      
      // Dashboard configuration
      healthEndpoint: '/health/detailed',
      metricsEndpoint: '/health/metrics',
      configEndpoint: '/health/config',
      refreshInterval: config.monitoring?.refreshInterval || 30000
    };
    
    return monitoringConfig;
  }

  /**
   * Generate health check endpoints based on project configuration
   */
  generateHealthCheckEndpoints(config) {
    const endpoints = [];
    
    // Main application endpoint
    if (config.domain) {
      endpoints.push({
        name: 'main_app',
        url: `https://${config.domain}/`
      });
    }
    
    // API endpoints
    if (config.apiType) {
      endpoints.push({
        name: 'api_health',
        url: `https://${config.domain}/api/health`
      });
    }
    
    // Additional monitoring endpoints
    if (config.monitoring?.additionalEndpoints) {
      endpoints.push(...config.monitoring.additionalEndpoints);
    }
    
    return endpoints;
  }

  /**
   * Get required environment variables based on configuration
   */
  getRequiredEnvVars(config) {
    const envVars = [];
    
    if (config.apiType === 'airtable') {
      envVars.push('AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID');
    }
    
    if (config.corsEnabled) {
      envVars.push('ALLOWED_ORIGINS');
    }
    
    // Add custom environment variables
    if (config.envVars) {
      envVars.push(...Object.keys(config.envVars));
    }
    
    return envVars;
  }

  /**
   * Generate monitoring deployment script
   */
  async generateMonitoringDeploymentScript(config, outputDir) {
    const deployScript = `#!/bin/bash
# Monitoring Deployment Script for ${config.projectName}
# Generated by PurAir Cloudflare Setup Tool

set -e

echo "🚀 Deploying monitoring for ${config.projectName}..."

# Check if Wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "❌ Wrangler CLI not found. Please install: npm install -g wrangler"
  exit 1
fi

# Deploy health check worker
echo "📊 Deploying health check worker..."
wrangler deploy health-check.js --name "${config.projectName}-health" --compatibility-date="$(date +%Y-%m-%d)"

# Deploy dashboard (if using Pages)
if [ -f "dashboard.html" ]; then
  echo "📈 Deploying monitoring dashboard..."
  
  # Create temporary directory for Pages deployment
  mkdir -p .pages-build
  cp dashboard.html .pages-build/index.html
  cp monitoring-config.json .pages-build/
  
  wrangler pages deploy .pages-build --project-name="${config.projectName}-dashboard"
  
  # Cleanup
  rm -rf .pages-build
fi

echo "✅ Monitoring deployment completed!"
echo ""
echo "Health Check Endpoint: https://${config.projectName}-health.${config.cloudflareAccountId || 'your-account'}.workers.dev/health"
echo "Dashboard: https://${config.projectName}-dashboard.pages.dev"
echo ""
echo "Next steps:"
echo "1. Configure alerts in your monitoring system"
echo "2. Set up automated health checks"
echo "3. Review the monitoring documentation"
`;

    await fs.writeFile(
      path.join(outputDir, 'deploy-monitoring.sh'),
      deployScript,
      'utf-8'
    );
    
    // Make script executable
    await fs.chmod(path.join(outputDir, 'deploy-monitoring.sh'), 0o755);
  }

  /**
   * Generate monitoring documentation
   */
  async generateMonitoringDocs(config, outputDir) {
    const docs = `# ${config.projectName} - Monitoring System

This directory contains monitoring and health check components for your ${config.projectName} project.

## Components

### Health Check Worker (\`health-check.js\`)
A Cloudflare Worker that provides comprehensive health monitoring:

- **Basic Health**: \`/health\` - Simple status check
- **Detailed Health**: \`/health/detailed\` - Full system status
- **Metrics**: \`/health/metrics\` - Performance metrics
- **Configuration**: \`/health/config\` - Config validation
- **Reset**: \`/health/reset\` - Reset metrics (requires auth)

### Monitoring Dashboard (\`dashboard.html\`)
A real-time dashboard that displays:

- Service health status
- Performance metrics
- Configuration status
- Error tracking
- Performance history

### Configuration (\`monitoring-config.json\`)
Central configuration for all monitoring components.

## Deployment

### Quick Deployment
\`\`\`bash
chmod +x deploy-monitoring.sh
./deploy-monitoring.sh
\`\`\`

### Manual Deployment

1. **Deploy Health Check Worker**:
   \`\`\`bash
   wrangler deploy health-check.js --name "${config.projectName}-health"
   \`\`\`

2. **Deploy Dashboard** (optional):
   \`\`\`bash
   wrangler pages deploy dashboard.html --project-name="${config.projectName}-dashboard"
   \`\`\`

## Configuration

### Environment Variables
${this.getRequiredEnvVars(config).length > 0 ? 
  'Required environment variables:\n' + 
  this.getRequiredEnvVars(config).map(v => `- \`${v}\``).join('\n') :
  'No additional environment variables required.'}

### Thresholds
Configure monitoring thresholds in \`monitoring-config.json\`:

- **Response Time**: ${config.monitoring?.responseTimeThreshold || 1000}ms
- **Error Rate**: ${((config.monitoring?.errorRateThreshold || 0.05) * 100).toFixed(1)}%
- **Memory Usage**: ${((config.monitoring?.memoryThreshold || 0.80) * 100).toFixed(0)}%

## Usage

### Accessing Health Checks
\`\`\`bash
# Basic health check
curl https://${config.projectName}-health.your-account.workers.dev/health

# Detailed health report
curl https://${config.projectName}-health.your-account.workers.dev/health/detailed

# Performance metrics
curl https://${config.projectName}-health.your-account.workers.dev/health/metrics
\`\`\`

### Dashboard Access
Visit: \`https://${config.projectName}-dashboard.pages.dev\`

### Integration with External Monitoring
The health check endpoints return JSON data that can be easily integrated with:

- **Uptime monitors** (Pingdom, UptimeRobot, etc.)
- **APM tools** (Datadog, New Relic, etc.)
- **Alert systems** (PagerDuty, Slack, etc.)

## Alerting

### Setting up Alerts
1. Use external monitoring services to poll \`/health\` endpoint
2. Set up alerts based on:
   - HTTP status codes (200 = healthy, 503 = unhealthy)
   - Response time thresholds
   - Error rate increases

### Custom Alert Handlers
The monitoring system supports custom alert handlers. See the source code for implementation details.

## Security

### Authentication
Health check endpoints are publicly accessible by default. For sensitive environments:

1. Add authentication to the worker
2. Use Cloudflare Access for additional protection
3. Configure IP restrictions if needed

### Data Privacy
The monitoring system:
- Does not log sensitive data
- Sanitizes error messages
- Respects CORS policies

## Troubleshooting

### Common Issues

1. **Health checks failing**:
   - Verify environment variables are set
   - Check API connectivity
   - Review worker logs

2. **Dashboard not loading**:
   - Verify Pages deployment
   - Check CORS configuration
   - Ensure health endpoints are accessible

3. **Metrics not updating**:
   - Check worker deployment
   - Verify endpoint URLs
   - Review browser console for errors

### Getting Help
- Check worker logs in Cloudflare dashboard
- Review the health check source code
- Consult Cloudflare Workers documentation

## Generated by PurAir Cloudflare Setup Tool
Created: ${new Date().toISOString()}
`;

    await fs.writeFile(
      path.join(outputDir, 'README.md'),
      docs,
      'utf-8'
    );
  }

  /**
   * Perform health check orchestration
   */
  async performHealthCheck(endpoints) {
    const results = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      services: {},
      alerts: []
    };
    
    this.spinner.start('Performing health checks...');
    
    try {
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        try {
          const response = await fetch(endpoint.url, {
            method: 'GET',
            headers: {
              'User-Agent': 'PurAir-Monitoring/1.0',
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          const responseTime = Date.now() - startTime;
          const isHealthy = response.status >= 200 && response.status < 400;
          
          results.services[endpoint.name] = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            statusCode: response.status,
            responseTime,
            url: endpoint.url,
            lastCheck: results.timestamp
          };
          
          if (!isHealthy) {
            results.overall = 'unhealthy';
            results.alerts.push({
              type: 'service_unhealthy',
              service: endpoint.name,
              message: `Service returned status ${response.status}`,
              severity: 'critical'
            });
          }
          
          // Check response time threshold
          if (responseTime > 5000) {
            results.alerts.push({
              type: 'slow_response',
              service: endpoint.name,
              message: `Response time ${responseTime}ms exceeds threshold`,
              severity: 'warning'
            });
          }
          
        } catch (error) {
          results.services[endpoint.name] = {
            status: 'error',
            error: error.message,
            url: endpoint.url,
            lastCheck: results.timestamp
          };
          
          results.overall = 'unhealthy';
          results.alerts.push({
            type: 'service_error',
            service: endpoint.name,
            message: `Connection failed: ${error.message}`,
            severity: 'critical'
          });
        }
      }
      
      // Store results in history
      this.healthCheckHistory.set(results.timestamp, results);
      
      // Keep only last 100 results
      if (this.healthCheckHistory.size > 100) {
        const oldestKey = this.healthCheckHistory.keys().next().value;
        this.healthCheckHistory.delete(oldestKey);
      }
      
      this.spinner.succeed(`Health check completed - Status: ${results.overall}`);
      
      return results;
      
    } catch (error) {
      this.spinner.fail('Health check failed');
      logger.error('Health check orchestration failed:', error);
      throw error;
    }
  }

  /**
   * Collect and aggregate performance metrics
   */
  async collectMetrics(sources) {
    const metrics = {
      timestamp: new Date().toISOString(),
      aggregated: {
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        uptimePercentage: 100
      },
      sources: {}
    };
    
    try {
      for (const source of sources) {
        const sourceMetrics = await this.collectSourceMetrics(source);
        metrics.sources[source.name] = sourceMetrics;
        
        // Aggregate metrics
        metrics.aggregated.totalRequests += sourceMetrics.requestCount || 0;
        metrics.aggregated.totalErrors += sourceMetrics.errorCount || 0;
      }
      
      // Calculate aggregated values
      if (metrics.aggregated.totalRequests > 0) {
        metrics.aggregated.errorRate = metrics.aggregated.totalErrors / metrics.aggregated.totalRequests;
      } else {
        metrics.aggregated.errorRate = 0;
      }
      
      return metrics;
      
    } catch (error) {
      logger.error('Metrics collection failed:', error);
      throw error;
    }
  }

  /**
   * Collect metrics from a specific source
   */
  async collectSourceMetrics(source) {
    try {
      const response = await fetch(`${source.url}/health/metrics`, {
        method: 'GET',
        headers: {
          'User-Agent': 'PurAir-Monitoring/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.metrics || {};
      } else {
        return { error: `HTTP ${response.status}` };
      }
      
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Set up alert handlers
   */
  registerAlertHandler(type, handler) {
    this.alertHandlers.set(type, handler);
  }

  /**
   * Process alerts and trigger handlers
   */
  async processAlerts(alerts) {
    for (const alert of alerts) {
      const handler = this.alertHandlers.get(alert.type);
      if (handler) {
        try {
          await handler(alert);
        } catch (error) {
          logger.error(`Alert handler failed for ${alert.type}:`, error);
        }
      }
    }
  }

  /**
   * Generate deployment ID
   */
  generateDeploymentId() {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate secure token
   */
  generateSecureToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate monitoring configuration
   */
  async validateMonitoringConfig(config) {
    const issues = [];
    
    // Check required fields
    if (!config.projectName) {
      issues.push({ type: 'missing_field', field: 'projectName', severity: 'error' });
    }
    
    if (!config.domain) {
      issues.push({ type: 'missing_field', field: 'domain', severity: 'error' });
    }
    
    // Validate thresholds
    if (config.monitoring?.responseTimeThreshold && config.monitoring.responseTimeThreshold < 100) {
      issues.push({ 
        type: 'invalid_threshold', 
        field: 'responseTimeThreshold', 
        message: 'Response time threshold too low',
        severity: 'warning' 
      });
    }
    
    if (config.monitoring?.errorRateThreshold && config.monitoring.errorRateThreshold > 0.5) {
      issues.push({ 
        type: 'invalid_threshold', 
        field: 'errorRateThreshold', 
        message: 'Error rate threshold too high',
        severity: 'warning' 
      });
    }
    
    // Validate endpoints
    if (config.monitoring?.additionalEndpoints) {
      for (const endpoint of config.monitoring.additionalEndpoints) {
        if (!endpoint.name || !endpoint.url) {
          issues.push({ 
            type: 'invalid_endpoint', 
            message: 'Endpoint missing name or URL',
            severity: 'error' 
          });
        }
      }
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Get monitoring status overview
   */
  getMonitoringStatus() {
    const history = Array.from(this.healthCheckHistory.values());
    const latest = history[history.length - 1];
    
    if (!latest) {
      return {
        status: 'unknown',
        message: 'No health checks performed yet'
      };
    }
    
    const healthyCount = Object.values(latest.services)
      .filter(service => service.status === 'healthy').length;
    const totalCount = Object.keys(latest.services).length;
    
    return {
      status: latest.overall,
      healthyServices: healthyCount,
      totalServices: totalCount,
      lastCheck: latest.timestamp,
      alerts: latest.alerts.length
    };
  }

  /**
   * Export monitoring data for external systems
   */
  exportMonitoringData(format = 'json') {
    const data = {
      history: Array.from(this.healthCheckHistory.values()),
      status: this.getMonitoringStatus(),
      exportTime: new Date().toISOString()
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data.history);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert monitoring data to CSV format
   */
  convertToCSV(history) {
    if (history.length === 0) return '';
    
    const headers = ['timestamp', 'overall_status', 'service_name', 'service_status', 'response_time', 'status_code'];
    const rows = [headers.join(',')];
    
    for (const check of history) {
      for (const [serviceName, service] of Object.entries(check.services)) {
        rows.push([
          check.timestamp,
          check.overall,
          serviceName,
          service.status,
          service.responseTime || '',
          service.statusCode || ''
        ].join(','));
      }
    }
    
    return rows.join('\n');
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();