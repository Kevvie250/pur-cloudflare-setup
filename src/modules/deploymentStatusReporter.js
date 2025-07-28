import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { progressIndicator } from '../utils/progressIndicator.js';

export class DeploymentStatusReporter {
  constructor() {
    this.reportFormats = ['json', 'markdown', 'github-summary'];
    this.statusLevels = ['success', 'warning', 'error', 'info'];
    this.ghActionsEnvironment = this.detectGitHubActions();
  }

  /**
   * Detect if running in GitHub Actions environment
   */
  detectGitHubActions() {
    return {
      isGitHubActions: !!process.env.GITHUB_ACTIONS,
      runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER,
      actor: process.env.GITHUB_ACTOR,
      repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      eventName: process.env.GITHUB_EVENT_NAME,
      workflow: process.env.GITHUB_WORKFLOW,
      job: process.env.GITHUB_JOB,
      stepSummaryFile: process.env.GITHUB_STEP_SUMMARY
    };
  }

  /**
   * Generate comprehensive deployment status report
   */
  async generateDeploymentReport(deploymentResult, verificationResult, options = {}) {
    try {
      const reportData = {
        metadata: {
          timestamp: new Date().toISOString(),
          deploymentId: deploymentResult.deploymentId,
          environment: options.environment || 'unknown',
          project: options.projectName || 'unknown',
          version: options.version || 'unknown',
          duration: deploymentResult.duration,
          githubContext: this.ghActionsEnvironment.isGitHubActions ? {
            runId: this.ghActionsEnvironment.runId,
            runNumber: this.ghActionsEnvironment.runNumber,
            actor: this.ghActionsEnvironment.actor,
            repository: this.ghActionsEnvironment.repository,
            ref: this.ghActionsEnvironment.ref,
            sha: this.ghActionsEnvironment.sha?.substring(0, 8),
            workflow: this.ghActionsEnvironment.workflow
          } : null
        },
        deployment: {
          status: deploymentResult.success ? 'success' : 'failed',
          url: deploymentResult.result?.url,
          error: deploymentResult.error?.message,
          rollbackPerformed: deploymentResult.rollbackPerformed || false
        },
        verification: verificationResult ? {
          status: this.calculateVerificationStatus(verificationResult),
          summary: verificationResult.summary,
          suites: verificationResult.suites,
          performanceMetrics: verificationResult.performanceMetrics,
          criticalFailures: this.extractCriticalFailures(verificationResult),
          warnings: this.extractWarnings(verificationResult)
        } : null,
        recommendations: this.generateRecommendations(deploymentResult, verificationResult),
        nextSteps: this.generateNextSteps(deploymentResult, verificationResult, options)
      };

      const reports = {};

      // Generate different report formats
      if (options.formats?.includes('json') || !options.formats) {
        reports.json = await this.generateJSONReport(reportData, options);
      }

      if (options.formats?.includes('markdown') || !options.formats) {
        reports.markdown = await this.generateMarkdownReport(reportData, options);
      }

      if (options.formats?.includes('github-summary') || 
          (this.ghActionsEnvironment.isGitHubActions && !options.formats)) {
        reports.githubSummary = await this.generateGitHubSummary(reportData, options);
      }

      // Output to GitHub Actions if running in that environment
      if (this.ghActionsEnvironment.isGitHubActions) {
        await this.outputToGitHubActions(reportData, options);
      }

      return {
        success: true,
        reportData,
        reports,
        files: Object.values(reports).filter(r => r.filePath).map(r => r.filePath)
      };

    } catch (error) {
      logger.error('Failed to generate deployment report:', error.message);
      throw error;
    }
  }

  /**
   * Calculate overall verification status
   */
  calculateVerificationStatus(verificationResult) {
    if (!verificationResult.results) return 'unknown';

    const failed = verificationResult.results.filter(r => r.status === 'fail').length;
    const warnings = verificationResult.results.filter(r => r.status === 'warn').length;

    if (failed > 0) return 'failed';
    if (warnings > 0) return 'warning';
    return 'passed';
  }

  /**
   * Extract critical failures from verification results
   */
  extractCriticalFailures(verificationResult) {
    if (!verificationResult.results) return [];

    return verificationResult.results
      .filter(r => r.status === 'fail' && !r.optional)
      .map(r => ({
        suite: r.suite,
        test: r.test,
        message: r.message,
        details: r.details
      }));
  }

  /**
   * Extract warnings from verification results
   */
  extractWarnings(verificationResult) {
    if (!verificationResult.results) return [];

    return verificationResult.results
      .filter(r => r.status === 'warn' || (r.status === 'fail' && r.optional))
      .map(r => ({
        suite: r.suite,
        test: r.test,
        message: r.message,
        severity: r.status === 'fail' ? 'high' : 'medium'
      }));
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations(deploymentResult, verificationResult) {
    const recommendations = [];

    // Deployment-based recommendations
    if (!deploymentResult.success) {
      recommendations.push({
        type: 'error',
        category: 'deployment',
        title: 'Deployment Failed',
        description: 'Review deployment logs and fix configuration issues',
        priority: 'high'
      });
    }

    if (deploymentResult.duration > 300000) { // 5 minutes
      recommendations.push({
        type: 'warning',
        category: 'performance',
        title: 'Slow Deployment',
        description: 'Consider optimizing build process or dependency installation',
        priority: 'medium'
      });
    }

    // Verification-based recommendations
    if (verificationResult) {
      const criticalFailures = this.extractCriticalFailures(verificationResult);
      const warnings = this.extractWarnings(verificationResult);

      if (criticalFailures.length > 0) {
        recommendations.push({
          type: 'error',
          category: 'verification',
          title: 'Critical Verification Failures',
          description: `${criticalFailures.length} critical tests failed. Review and fix before production deployment.`,
          priority: 'high',
          failures: criticalFailures.slice(0, 3) // Show first 3
        });
      }

      if (warnings.length > 5) {
        recommendations.push({
          type: 'warning',
          category: 'verification',
          title: 'Multiple Warnings',
          description: `${warnings.length} warnings detected. Consider addressing these issues.`,
          priority: 'medium'
        });
      }

      // Performance recommendations
      if (verificationResult.performanceMetrics) {
        const responseTime = verificationResult.performanceMetrics.response_time;
        if (responseTime > 2000) {
          recommendations.push({
            type: 'warning',
            category: 'performance',
            title: 'Slow Response Time',
            description: `Average response time is ${responseTime}ms. Consider performance optimization.`,
            priority: 'medium'
          });
        }
      }

      // Security recommendations
      const securityFailures = verificationResult.results?.filter(r => 
        r.suite === 'security' && r.status === 'fail'
      ) || [];

      if (securityFailures.length > 0) {
        recommendations.push({
          type: 'error',
          category: 'security',
          title: 'Security Issues Detected',
          description: 'Address security vulnerabilities before production deployment',
          priority: 'high'
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate next steps based on results
   */
  generateNextSteps(deploymentResult, verificationResult, options) {
    const steps = [];

    if (!deploymentResult.success) {
      steps.push({
        action: 'Fix deployment issues',
        description: 'Review error logs and fix configuration problems',
        priority: 'immediate'
      });

      if (deploymentResult.rollbackPerformed) {
        steps.push({
          action: 'Verify rollback',
          description: 'Check that the previous version is running correctly',
          priority: 'immediate'
        });
      }

      return steps;
    }

    // Success path next steps
    if (options.environment === 'development') {
      steps.push({
        action: 'Create pull request',
        description: 'Create PR to merge changes to main branch for staging deployment',
        priority: 'normal'
      });
    } else if (options.environment === 'staging') {
      const criticalFailures = this.extractCriticalFailures(verificationResult || {});
      
      if (criticalFailures.length === 0) {
        steps.push({
          action: 'Deploy to production',
          description: 'Staging verification passed - ready for production deployment',
          priority: 'normal'
        });
      } else {
        steps.push({
          action: 'Fix critical issues',
          description: 'Address critical verification failures before production',
          priority: 'high'
        });
      }
    } else if (options.environment === 'production') {
      steps.push({
        action: 'Monitor deployment',
        description: 'Monitor application performance and error rates',
        priority: 'normal'
      });

      steps.push({
        action: 'Update documentation',
        description: 'Update deployment logs and notify stakeholders',
        priority: 'low'
      });
    }

    // Add verification-based steps
    const warnings = this.extractWarnings(verificationResult || {});
    if (warnings.length > 0) {
      steps.push({
        action: 'Address warnings',
        description: `Review and address ${warnings.length} verification warnings`,
        priority: 'low'
      });
    }

    return steps;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(reportData, options) {
    try {
      const reportPath = path.join(
        options.outputDir || '.',
        `deployment-report-${reportData.metadata.deploymentId}.json`
      );

      await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2), 'utf8');

      return {
        format: 'json',
        filePath: reportPath,
        content: JSON.stringify(reportData, null, 2)
      };

    } catch (error) {
      logger.error('Failed to generate JSON report:', error.message);
      return { format: 'json', error: error.message };
    }
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(reportData, options) {
    try {
      const md = this.buildMarkdownContent(reportData);
      
      const reportPath = path.join(
        options.outputDir || '.',
        `deployment-report-${reportData.metadata.deploymentId}.md`
      );

      await fs.writeFile(reportPath, md, 'utf8');

      return {
        format: 'markdown',
        filePath: reportPath,
        content: md
      };

    } catch (error) {
      logger.error('Failed to generate Markdown report:', error.message);
      return { format: 'markdown', error: error.message };
    }
  }

  /**
   * Build Markdown content
   */
  buildMarkdownContent(reportData) {
    const { metadata, deployment, verification, recommendations, nextSteps } = reportData;
    
    let md = `# Deployment Report: ${metadata.project}\n\n`;

    // Metadata section
    md += `## Deployment Information\n\n`;
    md += `- **Environment:** ${metadata.environment}\n`;
    md += `- **Deployment ID:** ${metadata.deploymentId}\n`;
    md += `- **Timestamp:** ${metadata.timestamp}\n`;
    md += `- **Duration:** ${(metadata.duration / 1000).toFixed(2)}s\n`;
    
    if (metadata.githubContext) {
      md += `- **GitHub Run:** [#${metadata.githubContext.runNumber}](https://github.com/${metadata.githubContext.repository}/actions/runs/${metadata.githubContext.runId})\n`;
      md += `- **Commit:** ${metadata.githubContext.sha}\n`;
      md += `- **Actor:** ${metadata.githubContext.actor}\n`;
    }
    
    md += `\n`;

    // Deployment status
    md += `## Deployment Status\n\n`;
    const deploymentIcon = deployment.status === 'success' ? '✅' : '❌';
    md += `${deploymentIcon} **Status:** ${deployment.status.toUpperCase()}\n\n`;
    
    if (deployment.url) {
      md += `🔗 **URL:** [${deployment.url}](${deployment.url})\n\n`;
    }
    
    if (deployment.error) {
      md += `❌ **Error:** ${deployment.error}\n\n`;
    }

    if (deployment.rollbackPerformed) {
      md += `🔄 **Rollback:** Automatic rollback was performed due to deployment failure\n\n`;
    }

    // Verification results
    if (verification) {
      md += `## Verification Results\n\n`;
      
      const verificationIcon = 
        verification.status === 'passed' ? '✅' :
        verification.status === 'warning' ? '⚠️' : '❌';
        
      md += `${verificationIcon} **Overall Status:** ${verification.status.toUpperCase()}\n\n`;
      
      if (verification.summary) {
        md += `### Summary\n\n`;
        md += `- **Total Tests:** ${verification.summary.total || 0}\n`;
        md += `- **Passed:** ${verification.summary.passed || 0}\n`;
        md += `- **Failed:** ${verification.summary.failed || 0}\n`;
        md += `- **Warnings:** ${verification.summary.warnings || 0}\n\n`;
      }

      // Performance metrics
      if (verification.performanceMetrics && Object.keys(verification.performanceMetrics).length > 0) {
        md += `### Performance Metrics\n\n`;
        Object.entries(verification.performanceMetrics).forEach(([metric, value]) => {
          const displayMetric = metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          md += `- **${displayMetric}:** ${value}ms\n`;
        });
        md += `\n`;
      }

      // Critical failures
      if (verification.criticalFailures && verification.criticalFailures.length > 0) {
        md += `### Critical Failures\n\n`;
        verification.criticalFailures.forEach(failure => {
          md += `- **${failure.suite}/${failure.test}:** ${failure.message}\n`;
        });
        md += `\n`;
      }

      // Warnings
      if (verification.warnings && verification.warnings.length > 0) {
        md += `### Warnings\n\n`;
        verification.warnings.slice(0, 10).forEach(warning => {
          const severityIcon = warning.severity === 'high' ? '🔴' : '🟡';
          md += `- ${severityIcon} **${warning.suite}/${warning.test}:** ${warning.message}\n`;
        });
        
        if (verification.warnings.length > 10) {
          md += `- ... and ${verification.warnings.length - 10} more warnings\n`;
        }
        md += `\n`;
      }
    }

    // Recommendations
    if (recommendations && recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      
      const highPriority = recommendations.filter(r => r.priority === 'high');
      const mediumPriority = recommendations.filter(r => r.priority === 'medium');
      const lowPriority = recommendations.filter(r => r.priority === 'low');

      if (highPriority.length > 0) {
        md += `### High Priority\n\n`;
        highPriority.forEach(rec => {
          const icon = rec.type === 'error' ? '🚨' : '⚠️';
          md += `${icon} **${rec.title}:** ${rec.description}\n\n`;
        });
      }

      if (mediumPriority.length > 0) {
        md += `### Medium Priority\n\n`;
        mediumPriority.forEach(rec => {
          md += `⚠️ **${rec.title}:** ${rec.description}\n\n`;
        });
      }

      if (lowPriority.length > 0) {
        md += `### Low Priority\n\n`;
        lowPriority.forEach(rec => {
          md += `💡 **${rec.title}:** ${rec.description}\n\n`;
        });
      }
    }

    // Next steps
    if (nextSteps && nextSteps.length > 0) {
      md += `## Next Steps\n\n`;
      
      nextSteps.forEach((step, index) => {
        const priorityIcon = 
          step.priority === 'immediate' ? '🚨' :
          step.priority === 'high' ? '🔴' :
          step.priority === 'normal' ? '🟡' : '🟢';
          
        md += `${index + 1}. ${priorityIcon} **${step.action}:** ${step.description}\n`;
      });
      md += `\n`;
    }

    md += `---\n`;
    md += `*Report generated by PurAir Deployment System*\n`;

    return md;
  }

  /**
   * Generate GitHub Actions Step Summary
   */
  async generateGitHubSummary(reportData, options) {
    try {
      if (!this.ghActionsEnvironment.stepSummaryFile) {
        return { format: 'github-summary', error: 'Not running in GitHub Actions' };
      }

      const summaryContent = this.buildGitHubSummaryContent(reportData);
      
      // Append to GitHub step summary
      await fs.appendFile(this.ghActionsEnvironment.stepSummaryFile, summaryContent, 'utf8');

      return {
        format: 'github-summary',
        filePath: this.ghActionsEnvironment.stepSummaryFile,
        content: summaryContent
      };

    } catch (error) {
      logger.error('Failed to generate GitHub summary:', error.message);
      return { format: 'github-summary', error: error.message };
    }
  }

  /**
   * Build GitHub Actions Step Summary content
   */
  buildGitHubSummaryContent(reportData) {
    const { metadata, deployment, verification, recommendations } = reportData;
    
    let summary = `## 🚀 Deployment Summary - ${metadata.project}\n\n`;

    // Status overview
    const deploymentIcon = deployment.status === 'success' ? '✅' : '❌';
    summary += `### Deployment Status\n\n`;
    summary += `${deploymentIcon} **${deployment.status.toUpperCase()}** in ${(metadata.duration / 1000).toFixed(2)}s\n\n`;
    
    if (deployment.url) {
      summary += `🔗 **Live URL:** [${deployment.url}](${deployment.url})\n\n`;
    }

    // Quick stats table
    if (verification && verification.summary) {
      summary += `### Verification Results\n\n`;
      summary += `| Metric | Count |\n`;
      summary += `|--------|-------|\n`;
      summary += `| Total Tests | ${verification.summary.total || 0} |\n`;
      summary += `| ✅ Passed | ${verification.summary.passed || 0} |\n`;
      summary += `| ❌ Failed | ${verification.summary.failed || 0} |\n`;
      summary += `| ⚠️ Warnings | ${verification.summary.warnings || 0} |\n\n`;
    }

    // Critical issues
    const criticalRecs = recommendations.filter(r => r.type === 'error' || r.priority === 'high');
    if (criticalRecs.length > 0) {
      summary += `### ⚠️ Critical Issues\n\n`;
      criticalRecs.slice(0, 3).forEach(rec => {
        summary += `- **${rec.title}:** ${rec.description}\n`;
      });
      summary += `\n`;
    }

    // Performance metrics (if available)
    if (verification && verification.performanceMetrics) {
      const responseTime = verification.performanceMetrics.response_time;
      if (responseTime) {
        const performanceStatus = responseTime < 1000 ? '🟢' : responseTime < 2000 ? '🟡' : '🔴';
        summary += `### Performance\n\n`;
        summary += `${performanceStatus} Response Time: **${responseTime}ms**\n\n`;
      }
    }

    // Environment info
    summary += `<details>\n<summary>📋 Deployment Details</summary>\n\n`;
    summary += `- **Environment:** ${metadata.environment}\n`;
    summary += `- **Deployment ID:** ${metadata.deploymentId}\n`;
    summary += `- **Timestamp:** ${metadata.timestamp}\n`;
    if (metadata.githubContext) {
      summary += `- **Commit:** ${metadata.githubContext.sha}\n`;
      summary += `- **Actor:** ${metadata.githubContext.actor}\n`;
    }
    summary += `\n</details>\n\n`;

    return summary;
  }

  /**
   * Output GitHub Actions specific outputs and annotations
   */
  async outputToGitHubActions(reportData, options) {
    try {
      const { deployment, verification } = reportData;

      // Set step outputs
      console.log(`::set-output name=deployment-status::${deployment.status}`);
      if (deployment.url) {
        console.log(`::set-output name=deployment-url::${deployment.url}`);
      }

      if (verification) {
        console.log(`::set-output name=verification-status::${verification.status}`);
        console.log(`::set-output name=tests-total::${verification.summary?.total || 0}`);
        console.log(`::set-output name=tests-failed::${verification.summary?.failed || 0}`);
      }

      // Add annotations for critical issues
      const criticalFailures = verification?.criticalFailures || [];
      criticalFailures.slice(0, 10).forEach(failure => {
        console.log(`::error::${failure.suite}/${failure.test}: ${failure.message}`);
      });

      // Add warnings for non-critical issues
      const warnings = verification?.warnings || [];
      warnings.slice(0, 10).forEach(warning => {
        console.log(`::warning::${warning.suite}/${warning.test}: ${warning.message}`);
      });

      // Add notice for successful deployment
      if (deployment.status === 'success' && deployment.url) {
        console.log(`::notice::Deployment successful: ${deployment.url}`);
      }

    } catch (error) {
      logger.error('Failed to output to GitHub Actions:', error.message);
    }
  }

  /**
   * Generate status badge data
   */
  generateStatusBadge(reportData) {
    const { deployment, verification } = reportData;
    
    let status = 'unknown';
    let color = 'lightgrey';
    
    if (deployment.status === 'success') {
      if (!verification || verification.status === 'passed') {
        status = 'passing';
        color = 'brightgreen';
      } else if (verification.status === 'warning') {
        status = 'passing-with-warnings';
        color = 'yellow';
      } else {
        status = 'failing-verification';
        color = 'orange';
      }
    } else {
      status = 'failing';
      color = 'red';
    }
    
    return {
      schemaVersion: 1,
      label: 'deployment',
      message: status,
      color,
      namedLogo: 'cloudflare'
    };
  }

  /**
   * Send deployment notification (webhook, Slack, etc.)
   */
  async sendNotification(reportData, notificationConfig) {
    if (!notificationConfig || !notificationConfig.webhook) {
      return { success: false, reason: 'No notification configuration' };
    }

    try {
      const payload = {
        project: reportData.metadata.project,
        environment: reportData.metadata.environment,
        status: reportData.deployment.status,
        url: reportData.deployment.url,
        duration: reportData.metadata.duration,
        timestamp: reportData.metadata.timestamp,
        actor: reportData.metadata.githubContext?.actor,
        commit: reportData.metadata.githubContext?.sha,
        verificationStatus: reportData.verification?.status
      };

      const response = await fetch(notificationConfig.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(notificationConfig.headers || {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Notification webhook failed: ${response.status} ${response.statusText}`);
      }

      return { success: true, response: await response.text() };

    } catch (error) {
      logger.error('Failed to send notification:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const deploymentStatusReporter = new DeploymentStatusReporter();

// Convenience functions
export async function generateDeploymentReport(deploymentResult, verificationResult, options = {}) {
  return await deploymentStatusReporter.generateDeploymentReport(deploymentResult, verificationResult, options);
}

export function generateStatusBadge(reportData) {
  return deploymentStatusReporter.generateStatusBadge(reportData);
}