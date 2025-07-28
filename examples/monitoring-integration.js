/**
 * Monitoring Integration Example
 * 
 * Shows how to integrate monitoring and health checks into your PurAir
 * Cloudflare projects using the monitoring service
 */

import { monitoringService } from '../src/modules/monitoring.js';
import { projectStructureCreator } from '../src/modules/projectStructureCreator.js';
import chalk from 'chalk';

/**
 * Example 1: Basic Monitoring Setup
 */
async function basicMonitoringSetup() {
  console.log(chalk.blue.bold('📊 Basic Monitoring Setup Example\n'));
  
  const config = {
    projectName: 'my-purair-project',
    domain: 'myproject.example.com',
    apiType: 'airtable',
    projectType: 'fullstack',
    enableMonitoring: true,
    monitoring: {
      responseTimeThreshold: 1000,
      errorRateThreshold: 0.05,
      refreshInterval: 30000
    }
  };
  
  try {
    // Generate project with monitoring
    const projectPath = './my-project-with-monitoring';
    await projectStructureCreator.createProjectStructure(projectPath, config);
    
    console.log(chalk.green('✅ Project created with monitoring enabled'));
    console.log(chalk.gray('  - Health check worker: ./monitoring/health-check.js'));
    console.log(chalk.gray('  - Monitoring dashboard: ./monitoring/dashboard.html'));
    console.log(chalk.gray('  - Deployment script: ./monitoring/deploy-monitoring.sh'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
  }
}

/**
 * Example 2: Advanced Monitoring Configuration
 */
async function advancedMonitoringSetup() {
  console.log(chalk.blue.bold('⚙️  Advanced Monitoring Configuration Example\n'));
  
  const config = {
    projectName: 'advanced-purair-project',
    domain: 'advanced.example.com',
    apiType: 'airtable',
    projectType: 'fullstack',
    enableMonitoring: true,
    monitoring: {
      // Custom thresholds
      responseTimeThreshold: 500,  // Stricter response time
      errorRateThreshold: 0.01,    // Lower error tolerance
      cpuThreshold: 0.70,
      memoryThreshold: 0.75,
      
      // Custom refresh rate
      refreshInterval: 15000,  // 15 seconds
      
      // Security
      resetAuthRequired: true,
      resetToken: 'secure-reset-token-here',
      
      // Additional monitoring endpoints
      additionalEndpoints: [
        {
          name: 'external_api',
          url: 'https://api.third-party.com/health'
        },
        {
          name: 'database_health',
          url: 'https://db.example.com/ping'
        }
      ]
    },
    
    // Environment variables for monitoring
    envVars: {
      MONITORING_ENABLED: 'true',
      ALERT_WEBHOOK_URL: 'https://hooks.slack.com/services/...',
      HEALTH_CHECK_SECRET: 'monitoring-secret-key'
    }
  };
  
  try {
    const projectPath = './advanced-monitoring-project';
    
    // Validate monitoring configuration first
    const validation = await monitoringService.validateMonitoringConfig(config);
    
    if (!validation.valid) {
      console.log(chalk.yellow('⚠️  Configuration issues found:'));
      validation.issues.forEach(issue => {
        console.log(chalk.gray(`  - ${issue.message || issue.type}`));
      });
    }
    
    // Generate monitoring templates
    const monitoringFiles = await monitoringService.generateMonitoringTemplates(
      config,
      projectPath
    );
    
    console.log(chalk.green('✅ Advanced monitoring setup completed'));
    console.log(chalk.gray('Generated files:'));
    Object.entries(monitoringFiles).forEach(([key, path]) => {
      console.log(chalk.gray(`  - ${key}: ${path}`));
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Advanced setup failed:'), error.message);
  }
}

/**
 * Example 3: Shared Worker Monitoring
 */
async function sharedWorkerMonitoring() {
  console.log(chalk.blue.bold('🔗 Shared Worker Monitoring Example\n'));
  
  const config = {
    projectName: 'shared-worker-client',
    domain: 'client.example.com',
    useSharedWorker: true,
    sharedWorkerUrl: 'api.modernpurairint.com',
    enableMonitoring: true,
    monitoring: {
      // Monitor both local and shared worker endpoints
      additionalEndpoints: [
        {
          name: 'shared_worker_health',
          url: 'https://api.modernpurairint.com/health'
        },
        {
          name: 'shared_worker_metrics',
          url: 'https://api.modernpurairint.com/metrics'
        }
      ],
      
      // Custom dashboard configuration
      refreshInterval: 20000,
      responseTimeThreshold: 800
    }
  };
  
  try {
    // Generate monitoring for shared worker setup
    const monitoringFiles = await monitoringService.generateMonitoringTemplates(
      config,
      './shared-worker-monitoring'
    );
    
    console.log(chalk.green('✅ Shared worker monitoring configured'));
    console.log(chalk.gray('This setup monitors both local and shared worker endpoints'));
    
  } catch (error) {
    console.error(chalk.red('❌ Shared worker monitoring failed:'), error.message);
  }
}

/**
 * Example 4: Real-time Health Checking
 */
async function realtimeHealthChecking() {
  console.log(chalk.blue.bold('🔄 Real-time Health Checking Example\n'));
  
  const endpoints = [
    { name: 'main_app', url: 'https://example.com/' },
    { name: 'api_endpoint', url: 'https://api.example.com/health' },
    { name: 'cdn_endpoint', url: 'https://cdn.example.com/ping' }
  ];
  
  try {
    console.log('Starting health checks...\n');
    
    // Perform health check
    const healthResult = await monitoringService.performHealthCheck(endpoints);
    
    // Display results
    console.log(`Overall Status: ${
      healthResult.overall === 'healthy' 
        ? chalk.green('HEALTHY') 
        : chalk.red('UNHEALTHY')
    }`);
    
    console.log('\nService Details:');
    Object.entries(healthResult.services).forEach(([name, service]) => {
      const statusColor = service.status === 'healthy' ? chalk.green : 
                         service.status === 'unhealthy' ? chalk.red : chalk.yellow;
      
      console.log(`  ${name}: ${statusColor(service.status.toUpperCase())}`);
      if (service.responseTime) {
        console.log(chalk.gray(`    Response Time: ${service.responseTime}ms`));
      }
      if (service.error) {
        console.log(chalk.gray(`    Error: ${service.error}`));
      }
    });
    
    // Display alerts
    if (healthResult.alerts && healthResult.alerts.length > 0) {
      console.log('\n🚨 Alerts:');
      healthResult.alerts.forEach(alert => {
        const alertColor = alert.severity === 'critical' ? chalk.red : chalk.yellow;
        console.log(`  ${alertColor(alert.type.toUpperCase())}: ${alert.message}`);
      });
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Health check failed:'), error.message);
  }
}

/**
 * Example 5: Metrics Collection and Export
 */
async function metricsCollectionExample() {
  console.log(chalk.blue.bold('📈 Metrics Collection Example\n'));
  
  const metricSources = [
    { name: 'worker-1', url: 'https://worker1.example.com' },
    { name: 'worker-2', url: 'https://worker2.example.com' }
  ];
  
  try {
    // Collect metrics from multiple sources
    const metrics = await monitoringService.collectMetrics(metricSources);
    
    console.log('Collected Metrics:');
    console.log(`  Total Requests: ${metrics.aggregated.totalRequests}`);
    console.log(`  Total Errors: ${metrics.aggregated.totalErrors}`);
    console.log(`  Average Error Rate: ${(metrics.aggregated.errorRate * 100).toFixed(2)}%`);
    
    // Export metrics in different formats
    const jsonExport = monitoringService.exportMonitoringData('json');
    const csvExport = monitoringService.exportMonitoringData('csv');
    
    console.log(chalk.green('\n✅ Metrics exported successfully'));
    console.log(chalk.gray(`JSON export size: ${jsonExport.length} characters`));
    console.log(chalk.gray(`CSV export available for spreadsheet import`));
    
  } catch (error) {
    console.error(chalk.red('❌ Metrics collection failed:'), error.message);
  }
}

/**
 * Example 6: Custom Alert Handlers
 */
async function customAlertHandlers() {
  console.log(chalk.blue.bold('🔔 Custom Alert Handlers Example\n'));
  
  // Register custom alert handlers
  monitoringService.registerAlertHandler('service_unhealthy', async (alert) => {
    console.log(chalk.red(`🚨 ALERT: Service ${alert.service} is unhealthy!`));
    // Here you could send to Slack, email, PagerDuty, etc.
    // await sendSlackAlert(alert);
    // await sendEmailAlert(alert);
  });
  
  monitoringService.registerAlertHandler('slow_response', async (alert) => {
    console.log(chalk.yellow(`⚠️  WARNING: ${alert.service} responding slowly`));
    // Log to monitoring service
    // await logToDatadog(alert);
  });
  
  monitoringService.registerAlertHandler('error_rate', async (alert) => {
    console.log(chalk.red(`💥 CRITICAL: High error rate detected!`));
    // Trigger incident response
    // await createPagerDutyIncident(alert);
  });
  
  console.log(chalk.green('✅ Custom alert handlers registered'));
  console.log(chalk.gray('Alerts will now trigger custom actions when conditions are met'));
}

/**
 * Main execution
 */
async function runExamples() {
  console.log(chalk.cyan.bold('🌟 PurAir Monitoring Integration Examples\n'));
  
  try {
    // Comment/uncomment examples to run specific ones
    
    // await basicMonitoringSetup();
    // await advancedMonitoringSetup();
    // await sharedWorkerMonitoring();
    await realtimeHealthChecking();
    // await metricsCollectionExample();
    await customAlertHandlers();
    
    console.log(chalk.green.bold('\n🎉 All examples completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Example execution failed:'), error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}

export {
  basicMonitoringSetup,
  advancedMonitoringSetup,
  sharedWorkerMonitoring,
  realtimeHealthChecking,
  metricsCollectionExample,
  customAlertHandlers
};