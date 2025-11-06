import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import createDebug from 'debug';
import memoize from 'lodash/memoize.js';
import type { Config } from '../types';

const debug = createDebug('pcs:config');

function hasWriteAccessToHomeDirectory(): boolean {
  try {
    fs.accessSync(os.homedir(), fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function hasWriteAccessToCurrentDirectory(): boolean {
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function hasWriteAccessToTempDirectory(): boolean {
  try {
    fs.accessSync(os.tmpdir(), fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function getBaseWorkingDirectory(): string {
  if (hasWriteAccessToCurrentDirectory()) {
    return path.resolve(process.cwd(), '.pcs');
  }
  if (hasWriteAccessToHomeDirectory()) {
    return path.resolve(os.homedir(), '.pcs');
  }
  if (hasWriteAccessToTempDirectory()) {
    return path.resolve(os.tmpdir(), '.pcs');
  }
  throw new Error('No write access to any working directory');
}

export const ensureBaseWorkingDirectory = memoize(() => {
  const baseWorkingDirectory = getBaseWorkingDirectory();
  if (!fs.existsSync(baseWorkingDirectory)) {
    fs.mkdirSync(baseWorkingDirectory, { recursive: true });
  }
  return baseWorkingDirectory;
});

function getConfigFilePath(): string {
  const cwd = ensureBaseWorkingDirectory();
  return path.join(cwd, 'config.json');
}

function getDefaultPort(): number {
  // @ts-ignore
  const port = 'PCS_PORT' in process.env ? +process.env.PCS_PORT : 3000;
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
}

function getDefaultConfig(): Config {
  return {
    chromePath: null,
    port: getDefaultPort()
  };
}

export function loadConfig(): Config {
  const CONFIG_FILE = getConfigFilePath();
  const DEFAULT_CONFIG = getDefaultConfig();

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    debug('Failed to load config file, using defaults: %O', error);
  }

  return DEFAULT_CONFIG;
}

export function saveConfig(config: Config): void {
  const CONFIG_FILE = getConfigFilePath();

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
