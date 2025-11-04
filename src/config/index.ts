import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../types';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

function getDefaultPort(): number {
  // @ts-ignore
  const port = 'PCS_PORT' in process.env ? +process.env.PCS_PORT : 3000;
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
}

const DEFAULT_CONFIG: Config = {
  chromePath: null,
  port: getDefaultPort()
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
