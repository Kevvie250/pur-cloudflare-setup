import chalk from 'chalk';
import https from 'https';
import dns from 'dns/promises';
import { progressIndicator } from '../utils/progressIndicator.js';
import { errorHandler, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import Table from 'cli-table3';

export class DeploymentVerifier {
  constructor() {
    this.verificationSuites = {
      health: 'Health Checks',
      api: 'API Endpoint Testing',
      config: 'Configuration Validation',
      performance: 'Performance Monitoring',
      security: 'Security Verification'
    };
    
    this.verificationResults = [];
    this.performanceMetrics = {};
  }

  /**
   * Comprehensive deployment verification
   */
  async verifyDeployment(deploymentUrl, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue.bold('🔍 Starting Deployment Verification'));
      console.log(chalk.gray(`Target: ${deploymentUrl}`));
      console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}`));
      console.log('');

      this.verificationResults = [];
      this.performanceMetrics = {};

      // Run all verification suites
      const suites = [
        { name: 'health', fn: () => this.verifyHealthChecks(deploymentUrl, options) },
        { name: 'api', fn: () => this.verifyAPIEndpoints(deploymentUrl, options) },
        { name: 'config', fn: () => this.verifyConfiguration(deploymentUrl, options) },
        { name: 'performance', fn: () => this.verifyPerformance(deploymentUrl, options) },
        { name: 'security', fn: () => this.verifySecurityHeaders(deploymentUrl, options) }
      ];

      // Run suites with progress tracking
      const taskStates = progressIndicator.createTaskList(
        suites.map(suite => ({ 
          id: suite.name, 
          name: this.verificationSuites[suite.name] 
        }))
      );

      for (const suite of suites) {
        progressIndicator.startTask(taskStates, suite.name);
        
        try {
          await suite.fn();
          progressIndicator.completeTask(taskStates, suite.name, true);
        } catch (error) {
          progressIndicator.completeTask(taskStates, suite.name, false, error.message);
          
          // Continue with other suites unless critical failure
          if (!options.stopOnFailure) {
            logger.warn(`Suite ${suite.name} failed: ${error.message}`);
          } else {
            throw error;
          }
        }
      }

      // Generate verification report
      const report = await this.generateVerificationReport(deploymentUrl, startTime);

      console.log('');
      console.log(chalk.green.bold('✅ Deployment Verification Completed'));
      
      return report;

    } catch (error) {
      logger.error(`Deployment verification failed: ${error.message}`);
      throw error;
    } finally {
      progressIndicator.cleanup();
    }
  }

  /**
   * Verify health checks
   */
  async verifyHealthChecks(deploymentUrl, options) {
    const healthChecks = [
      {
        name: 'Basic Connectivity',
        url: deploymentUrl,
        method: 'HEAD',
        expectedStatus: [200, 301, 302],
        timeout: 10000
      },
      {
        name: 'Root Endpoint',
        url: deploymentUrl,
        method: 'GET',
        expectedStatus: [200],
        timeout: 10000
      },
      {
        name: 'Health Endpoint',
        url: `${deploymentUrl}/health`,
        method: 'GET',
        expectedStatus: [200, 404], // 404 is acceptable if not implemented
        timeout: 5000,
        optional: true
      },
      {
        name: 'API Status',
        url: `${deploymentUrl}/api/status`,
        method: 'GET',
        expectedStatus: [200, 404], // 404 is acceptable if not implemented
        timeout: 5000,
        optional: true
      }
    ];

    for (const check of healthChecks) {
      try {
        const result = await this.performHealthCheck(check);
        
        this.verificationResults.push({
          suite: 'health',
          test: check.name,
          status: result.success ? 'pass' : 'fail',
          message: result.message,
          details: result.details,
          optional: check.optional || false
        });
        
      } catch (error) {
        this.verificationResults.push({
          suite: 'health',
          test: check.name,
          status: 'fail',
          message: error.message,
          optional: check.optional || false
        });
      }
    }
  }

  /**
   * Perform individual health check
   */
  async performHealthCheck(check) {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(check.url, {
        method: check.method,
        timeout: check.timeout,
        followRedirects: true
      });

      const responseTime = Date.now() - startTime;
      const statusOk = check.expectedStatus.includes(response.statusCode);

      return {
        success: statusOk,
        message: statusOk ? 
          `Response: ${response.statusCode} (${responseTime}ms)` :
          `Unexpected status: ${response.statusCode}`,
        details: {
          statusCode: response.statusCode,
          responseTime,
          headers: response.headers
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Request failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Verify API endpoints
   */
  async verifyAPIEndpoints(deploymentUrl, options) {
    const apiTests = [
      {
        name: 'API Base Route',
        url: `${deploymentUrl}/api`,
        method: 'GET',
        expectedStatus: [200, 404],
        validate: (response) => {
          // Basic validation - endpoint exists or returns 404
          return response.statusCode === 200 || response.statusCode === 404;
        }
      },
      {
        name: 'CORS Headers',
        url: `${deploymentUrl}/api`,
        method: 'OPTIONS',
        expectedStatus: [200, 204, 404],
        headers: {
          'Origin': 'https://test.com',
          'Access-Control-Request-Method': 'GET'
        },
        validate: (response) => {
          // Check if CORS headers are present when endpoint exists
          if (response.statusCode === 404) return true;
          return response.headers['access-control-allow-origin'] || 
                 response.headers['Access-Control-Allow-Origin'];
        }
      }
    ];

    // Add project-specific API tests
    if (options.apiTests && Array.isArray(options.apiTests)) {
      apiTests.push(...options.apiTests);
    }

    for (const test of apiTests) {
      try {
        const result = await this.performAPITest(test);
        
        this.verificationResults.push({
          suite: 'api',
          test: test.name,
          status: result.success ? 'pass' : 'fail',
          message: result.message,
          details: result.details
        });
        
      } catch (error) {
        this.verificationResults.push({
          suite: 'api',
          test: test.name,
          status: 'fail',
          message: error.message
        });
      }
    }
  }

  /**
   * Perform individual API test
   */
  async performAPITest(test) {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(test.url, {
        method: test.method,
        headers: test.headers,
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;
      const statusOk = test.expectedStatus.includes(response.statusCode);
      
      let validationResult = true;
      if (test.validate && typeof test.validate === 'function') {
        validationResult = test.validate(response);
      }

      const success = statusOk && validationResult;

      return {
        success,
        message: success ? 
          `API test passed (${responseTime}ms)` :
          `API test failed - Status: ${response.statusCode}`,
        details: {
          statusCode: response.statusCode,
          responseTime,
          headers: response.headers,
          validationPassed: validationResult
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `API test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Verify configuration
   */
  async verifyConfiguration(deploymentUrl, options) {
    const configTests = [
      {
        name: 'SSL Certificate',
        test: () => this.verifySSLCertificate(deploymentUrl)
      },
      {
        name: 'DNS Resolution',
        test: () => this.verifyDNSResolution(deploymentUrl)
      },
      {
        name: 'Cloudflare Headers',
        test: () => this.verifyCloudflareHeaders(deploymentUrl)
      },
      {
        name: 'Cache Configuration',
        test: () => this.verifyCacheHeaders(deploymentUrl)
      }
    ];

    for (const test of configTests) {
      try {
        const result = await test.test();
        
        this.verificationResults.push({
          suite: 'config',
          test: test.name,
          status: result.success ? 'pass' : 'fail',
          message: result.message,
          details: result.details || {}
        });
        
      } catch (error) {
        this.verificationResults.push({
          suite: 'config',
          test: test.name,
          status: 'fail',
          message: error.message
        });
      }
    }
  }

  /**
   * Verify SSL certificate
   */
  async verifySSLCertificate(deploymentUrl) {
    try {
      const url = new URL(deploymentUrl);
      
      if (url.protocol !== 'https:') {
        return {
          success: false,
          message: 'Deployment is not using HTTPS'
        };
      }

      const response = await this.makeRequest(deploymentUrl, {
        method: 'HEAD',
        timeout: 10000
      });

      return {
        success: true,
        message: 'SSL certificate is valid',
        details: {
          protocol: 'https',
          statusCode: response.statusCode
        }
      };
      
    } catch (error) {
      if (error.code === 'CERT_HAS_EXPIRED') {
        return {
          success: false,
          message: 'SSL certificate has expired'
        };
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        return {
          success: false,
          message: 'SSL certificate cannot be verified'
        };
      }
      
      return {
        success: false,
        message: `SSL verification failed: ${error.message}`
      };
    }
  }

  /**
   * Verify DNS resolution
   */
  async verifyDNSResolution(deploymentUrl) {
    try {
      const url = new URL(deploymentUrl);
      const hostname = url.hostname;

      const addresses = await dns.resolve4(hostname);
      
      return {
        success: true,
        message: `DNS resolves to ${addresses.length} address(es)`,
        details: {
          hostname,
          addresses
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `DNS resolution failed: ${error.message}`
      };
    }
  }

  /**
   * Verify Cloudflare headers
   */
  async verifyCloudflareHeaders(deploymentUrl) {
    try {
      const response = await this.makeRequest(deploymentUrl, {
        method: 'HEAD',
        timeout: 10000
      });

      const cfHeaders = [
        'cf-ray',
        'cf-cache-status',
        'server'
      ];

      const foundHeaders = cfHeaders.filter(header => 
        response.headers[header] || response.headers[header.toLowerCase()]
      );

      const isCloudflare = foundHeaders.length > 0 || 
                          (response.headers.server && response.headers.server.includes('cloudflare'));

      return {
        success: true,
        message: isCloudflare ? 
          'Cloudflare headers detected' : 
          'No Cloudflare headers found',
        details: {
          isCloudflare,
          foundHeaders,
          server: response.headers.server
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Header verification failed: ${error.message}`
      };
    }
  }

  /**
   * Verify cache headers
   */
  async verifyCacheHeaders(deploymentUrl) {
    try {
      const response = await this.makeRequest(deploymentUrl, {
        method: 'GET',
        timeout: 10000
      });

      const cacheHeaders = {
        'cache-control': response.headers['cache-control'],
        'expires': response.headers['expires'],
        'etag': response.headers['etag'],
        'last-modified': response.headers['last-modified']
      };

      const hasCacheHeaders = Object.values(cacheHeaders).some(value => value);

      return {
        success: true,
        message: hasCacheHeaders ? 
          'Cache headers configured' : 
          'No cache headers found',
        details: {
          hasCacheHeaders,
          headers: cacheHeaders
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Cache header verification failed: ${error.message}`
      };
    }
  }

  /**
   * Verify performance metrics
   */
  async verifyPerformance(deploymentUrl, options) {
    const performanceTests = [
      {
        name: 'Response Time',
        test: () => this.measureResponseTime(deploymentUrl),
        threshold: options.responseTimeThreshold || 2000 // 2 seconds
      },
      {
        name: 'Time to First Byte',
        test: () => this.measureTTFB(deploymentUrl),
        threshold: options.ttfbThreshold || 800 // 800ms
      },
      {
        name: 'Concurrent Requests',
        test: () => this.testConcurrentRequests(deploymentUrl),
        threshold: options.concurrencyThreshold || 10
      }
    ];

    for (const test of performanceTests) {
      try {
        const result = await test.test();
        const withinThreshold = result.value <= test.threshold;
        
        this.performanceMetrics[test.name.toLowerCase().replace(' ', '_')] = result.value;
        
        this.verificationResults.push({
          suite: 'performance',
          test: test.name,
          status: withinThreshold ? 'pass' : 'warn',
          message: `${result.message} (threshold: ${test.threshold}ms)`,
          details: {
            value: result.value,
            threshold: test.threshold,
            withinThreshold
          }
        });
        
      } catch (error) {
        this.verificationResults.push({
          suite: 'performance',
          test: test.name,
          status: 'fail',
          message: error.message
        });
      }
    }
  }

  /**
   * Measure response time
   */
  async measureResponseTime(deploymentUrl) {
    const startTime = process.hrtime.bigint();
    
    try {
      await this.makeRequest(deploymentUrl, {
        method: 'GET',
        timeout: 10000
      });

      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms

      return {
        value: Math.round(responseTime),
        message: `Response time: ${Math.round(responseTime)}ms`
      };
      
    } catch (error) {
      throw new Error(`Response time measurement failed: ${error.message}`);
    }
  }

  /**
   * Measure Time to First Byte
   */
  async measureTTFB(deploymentUrl) {
    // This is a simplified TTFB measurement
    return await this.measureResponseTime(deploymentUrl);
  }

  /**
   * Test concurrent requests
   */
  async testConcurrentRequests(deploymentUrl, concurrency = 5) {
    const startTime = Date.now();
    
    try {
      const requests = Array(concurrency).fill().map(() => 
        this.makeRequest(deploymentUrl, {
          method: 'HEAD',
          timeout: 10000
        })
      );

      await Promise.all(requests);
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / concurrency;

      return {
        value: Math.round(avgTime),
        message: `Concurrent requests (${concurrency}): ${Math.round(avgTime)}ms avg`
      };
      
    } catch (error) {
      throw new Error(`Concurrent request test failed: ${error.message}`);
    }
  }

  /**
   * Verify security headers
   */
  async verifySecurityHeaders(deploymentUrl, options) {
    const securityHeaders = [
      {
        name: 'X-Frame-Options',
        header: 'x-frame-options',
        expected: ['DENY', 'SAMEORIGIN'],
        required: false
      },
      {
        name: 'X-Content-Type-Options',
        header: 'x-content-type-options',
        expected: ['nosniff'],
        required: false
      },
      {
        name: 'X-XSS-Protection',
        header: 'x-xss-protection',
        expected: ['1; mode=block', '0'],
        required: false
      },
      {
        name: 'Strict-Transport-Security',
        header: 'strict-transport-security',
        expected: null, // Any value is acceptable
        required: true
      },
      {
        name: 'Content-Security-Policy',
        header: 'content-security-policy',
        expected: null, // Any value is acceptable
        required: false
      }
    ];

    try {
      const response = await this.makeRequest(deploymentUrl, {
        method: 'HEAD',
        timeout: 10000
      });

      for (const securityHeader of securityHeaders) {
        const headerValue = response.headers[securityHeader.header] || 
                           response.headers[securityHeader.header.toLowerCase()];
        
        let status = 'pass';
        let message = '';

        if (!headerValue) {
          status = securityHeader.required ? 'fail' : 'warn';
          message = `${securityHeader.name} header not found`;
        } else if (securityHeader.expected && 
                   !securityHeader.expected.some(exp => headerValue.includes(exp))) {
          status = 'warn';
          message = `${securityHeader.name}: ${headerValue} (unexpected value)`;
        } else {
          message = `${securityHeader.name}: ${headerValue}`;
        }

        this.verificationResults.push({
          suite: 'security',
          test: securityHeader.name,
          status,
          message,
          details: {
            headerValue,
            expected: securityHeader.expected,
            required: securityHeader.required
          }
        });
      }
      
    } catch (error) {
      this.verificationResults.push({
        suite: 'security',
        test: 'Security Headers',
        status: 'fail',
        message: `Security header verification failed: ${error.message}`
      });
    }
  }

  /**
   * Generate comprehensive verification report
   */
  async generateVerificationReport(deploymentUrl, startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Calculate summary statistics
    const totalTests = this.verificationResults.length;
    const passedTests = this.verificationResults.filter(r => r.status === 'pass').length;
    const failedTests = this.verificationResults.filter(r => r.status === 'fail').length;
    const warnTests = this.verificationResults.filter(r => r.status === 'warn').length;

    // Group results by suite
    const suiteSummary = {};
    this.verificationResults.forEach(result => {
      if (!suiteSummary[result.suite]) {
        suiteSummary[result.suite] = { pass: 0, fail: 0, warn: 0 };
      }
      suiteSummary[result.suite][result.status]++;
    });

    // Display results table
    this.displayResultsTable();

    // Display performance metrics
    if (Object.keys(this.performanceMetrics).length > 0) {
      this.displayPerformanceMetrics();
    }

    // Display summary
    console.log('\n' + chalk.bold.underline('Verification Summary'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Target:')} ${deploymentUrl}`);
    console.log(`${chalk.cyan('Duration:')} ${duration}s`);
    console.log(`${chalk.green('Passed:')} ${passedTests}/${totalTests}`);
    if (warnTests > 0) console.log(`${chalk.yellow('Warnings:')} ${warnTests}`);
    if (failedTests > 0) console.log(`${chalk.red('Failed:')} ${failedTests}`);
    console.log('');

    // Suite breakdown
    console.log(chalk.bold('Suite Breakdown:'));
    Object.entries(suiteSummary).forEach(([suite, counts]) => {
      const total = counts.pass + counts.fail + counts.warn;
      console.log(`  ${chalk.cyan(this.verificationSuites[suite] || suite)}: ` +
                  `${chalk.green(counts.pass)} pass, ${chalk.yellow(counts.warn)} warn, ${chalk.red(counts.fail)} fail`);
    });

    const report = {
      deploymentUrl,
      timestamp: new Date().toISOString(),
      duration: parseFloat(duration),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        warnings: warnTests
      },
      suites: suiteSummary,
      results: this.verificationResults,
      performanceMetrics: this.performanceMetrics
    };

    // Save report
    await this.saveVerificationReport(report);

    return report;
  }

  /**
   * Display results in a formatted table
   */
  displayResultsTable() {
    console.log('\n' + chalk.bold('Verification Results:'));
    
    const table = new Table({
      head: ['Suite', 'Test', 'Status', 'Details'],
      colWidths: [15, 25, 8, 40],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    // Group and sort results
    const groupedResults = {};
    this.verificationResults.forEach(result => {
      if (!groupedResults[result.suite]) {
        groupedResults[result.suite] = [];
      }
      groupedResults[result.suite].push(result);
    });

    Object.entries(groupedResults).forEach(([suite, results]) => {
      results.forEach((result, index) => {
        const statusIcon = result.status === 'pass' ? chalk.green('✓') :
                          result.status === 'warn' ? chalk.yellow('⚠') :
                          chalk.red('✗');
        
        const statusText = result.status === 'pass' ? chalk.green('PASS') :
                          result.status === 'warn' ? chalk.yellow('WARN') :
                          chalk.red('FAIL');

        table.push([
          index === 0 ? chalk.cyan.bold(this.verificationSuites[suite] || suite) : '',
          result.test,
          `${statusIcon} ${statusText}`,
          chalk.gray(result.message.substring(0, 35) + (result.message.length > 35 ? '...' : ''))
        ]);
      });
    });

    console.log(table.toString());
  }

  /**
   * Display performance metrics
   */
  displayPerformanceMetrics() {
    console.log('\n' + chalk.bold('Performance Metrics:'));
    
    const metricsTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 20],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    Object.entries(this.performanceMetrics).forEach(([metric, value]) => {
      const displayMetric = metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      metricsTable.push([displayMetric, `${value}ms`]);
    });

    console.log(metricsTable.toString());
  }

  /**
   * Save verification report
   */
  async saveVerificationReport(report) {
    try {
      const reportsDir = path.join(process.cwd(), '.verification-reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const reportPath = path.join(reportsDir, `verification-${Date.now()}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`Verification report saved: ${reportPath}`);
    } catch (error) {
      logger.warn('Failed to save verification report:', error.message);
    }
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObject = new URL(url);
      const isHttps = urlObject.protocol === 'https:';
      const httpModule = isHttps ? https : require('http');

      const requestOptions = {
        hostname: urlObject.hostname,
        port: urlObject.port || (isHttps ? 443 : 80),
        path: urlObject.pathname + urlObject.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'PurAir-Verification-Tool/1.0',
          ...options.headers
        },
        timeout: options.timeout || 10000
      };

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(options.timeout || 10000);
      req.end();
    });
  }

  /**
   * Quick health check for simple verification
   */
  async quickHealthCheck(deploymentUrl) {
    try {
      const response = await this.makeRequest(deploymentUrl, {
        method: 'HEAD',
        timeout: 5000
      });

      return {
        healthy: response.statusCode >= 200 && response.statusCode < 400,
        statusCode: response.statusCode,
        responseTime: Date.now() // Simplified
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const deploymentVerifier = new DeploymentVerifier();

// CLI entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deploymentUrl = process.argv[2];
  
  if (!deploymentUrl) {
    console.error(chalk.red('Usage: node verify-deployment.js <deployment-url>'));
    process.exit(1);
  }

  deploymentVerifier.verifyDeployment(deploymentUrl, {
    stopOnFailure: process.argv.includes('--stop-on-failure'),
    responseTimeThreshold: 2000,
    ttfbThreshold: 800
  }).catch(error => {
    console.error(chalk.red('Verification failed:'), error.message);
    process.exit(1);
  });
}

// Export convenience functions
export async function verifyDeployment(deploymentUrl, options = {}) {
  return await deploymentVerifier.verifyDeployment(deploymentUrl, options);
}

export async function quickHealthCheck(deploymentUrl) {
  return await deploymentVerifier.quickHealthCheck(deploymentUrl);
}