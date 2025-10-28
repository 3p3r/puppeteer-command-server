import fs from 'fs';
import path from 'path';
import { Config } from '../types';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: Config = {
  chromePath: null,
  port: 3000
};

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.warn('Failed to load config file, using defaults:', error);
  }
  
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error}`);
  }
}

export function updateConfig(updates: Partial<Config>): Config {
  const currentConfig = loadConfig();
  const newConfig = { ...currentConfig, ...updates };
  saveConfig(newConfig);
  return newConfig;
}
