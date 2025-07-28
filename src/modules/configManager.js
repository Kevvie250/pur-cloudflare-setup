import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { validateProjectConfig, isValidPath, resolveSafePath } from '../utils/validation.js';

export class ConfigManager {
  constructor() {
    // Default config directory in user's home
    this.configDir = path.join(os.homedir(), '.pur-cloudflare-setup');
    this.configFile = 'configs.json';
    this._initialized = false;
    this._initError = null;
  }

  async ensureConfigDir() {
    if (this._initialized) return;
    
    try {
      await fs.ensureDir(this.configDir);
      this._initialized = true;
    } catch (error) {
      this._initError = error;
      const errorMessage = `Failed to create config directory: ${error.message}`;
      console.error(chalk.red(errorMessage));
      throw new Error(errorMessage);
    }
  }

  async initialize() {
    if (!this._initialized && !this._initError) {
      await this.ensureConfigDir();
    }
    if (this._initError) {
      throw this._initError;
    }
  }

  getConfigPath() {
    return path.join(this.configDir, this.configFile);
  }

  async loadAllConfigs() {
    await this.initialize();
    const configPath = this.getConfigPath();
    
    try {
      if (await fs.pathExists(configPath)) {
        const data = await fs.readJson(configPath);
        return data.configs || {};
      }
    } catch (error) {
      const errorMessage = `Failed to load configs: ${error.message}`;
      console.error(chalk.yellow('Warning:'), errorMessage);
      // Return empty configs but log the error - allow graceful degradation
      return {};
    }
    
    return {};
  }

  async saveAllConfigs(configs) {
    await this.initialize();
    const configPath = this.getConfigPath();
    
    try {
      await fs.writeJson(configPath, { configs }, { spaces: 2 });
    } catch (error) {
      const errorMessage = `Failed to save configurations: ${error.message}`;
      console.error(chalk.red(errorMessage));
      throw new Error(errorMessage);
    }
  }

  async save(name, config) {
    if (!name || !isValidPath(name)) {
      throw new Error('Invalid configuration name');
    }

    // Validate configuration
    const validatedConfig = validateProjectConfig(config);

    const configs = await this.loadAllConfigs();
    
    // Add metadata
    configs[name] = {
      ...validatedConfig,
      _metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    await this.saveAllConfigs(configs);
    return configs[name];
  }

  async load(nameOrPath) {
    // Check if it's a file path
    if (nameOrPath.includes('/') || nameOrPath.includes('\\') || nameOrPath.endsWith('.json')) {
      return this.loadFromFile(nameOrPath);
    }
    
    // Otherwise, load from saved configs
    const configs = await this.loadAllConfigs();
    const config = configs[nameOrPath];
    
    if (!config) {
      throw new Error(`Configuration '${nameOrPath}' not found`);
    }
    
    // Remove metadata before returning
    const { _metadata, ...configData } = config;
    return configData;
  }

  async loadFromFile(filePath) {
    if (!isValidPath(filePath)) {
      throw new Error('Invalid file path');
    }

    try {
      // Use secure path resolution
      const absolutePath = resolveSafePath(filePath);
      
      if (!await fs.pathExists(absolutePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }

      const config = await fs.readJson(absolutePath);
      
      // Validate loaded configuration
      return validateProjectConfig(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      if (error.message.includes('Path traversal')) {
        throw new Error('Invalid file path: security violation detected');
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  async get(name) {
    try {
      return await this.load(name);
    } catch {
      return null;
    }
  }

  async list() {
    const configs = await this.loadAllConfigs();
    
    return Object.entries(configs).map(([name, config]) => ({
      name,
      description: `${config.projectType} - ${config.domain}`,
      created: config._metadata?.created || 'Unknown',
      updated: config._metadata?.updated || 'Unknown'
    }));
  }

  async delete(name) {
    const configs = await this.loadAllConfigs();
    
    if (!configs[name]) {
      return false;
    }
    
    delete configs[name];
    await this.saveAllConfigs(configs);
    return true;
  }

  async exists(name) {
    const configs = await this.loadAllConfigs();
    return !!configs[name];
  }

  async update(name, updates) {
    const configs = await this.loadAllConfigs();
    
    if (!configs[name]) {
      throw new Error(`Configuration '${name}' not found`);
    }
    
    // Merge updates
    const updatedConfig = {
      ...configs[name],
      ...updates,
      _metadata: {
        ...configs[name]._metadata,
        updated: new Date().toISOString()
      }
    };
    
    // Validate updated configuration
    const { _metadata, ...configData } = updatedConfig;
    const validatedConfig = validateProjectConfig(configData);
    
    configs[name] = {
      ...validatedConfig,
      _metadata
    };
    
    await this.saveAllConfigs(configs);
    return configs[name];
  }

  async export(name, outputPath) {
    const config = await this.load(name);
    
    if (!isValidPath(outputPath)) {
      throw new Error('Invalid output path');
    }
    
    try {
      // Use secure path resolution
      const absolutePath = resolveSafePath(outputPath);
      
      await fs.writeJson(absolutePath, config, { spaces: 2 });
      return absolutePath;
    } catch (error) {
      if (error.message.includes('Path traversal')) {
        throw new Error('Invalid output path: security violation detected');
      }
      throw new Error(`Failed to export configuration: ${error.message}`);
    }
  }

  async import(filePath, name) {
    const config = await this.loadFromFile(filePath);
    return this.save(name, config);
  }
}