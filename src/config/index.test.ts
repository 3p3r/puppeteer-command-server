import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, saveConfig, updateConfig } from './index.js';

// Mock fs module
vi.mock('fs');

const mockFs = vi.mocked(fs);

describe('Configuration Management', () => {
  const CONFIG_FILE = path.join(process.cwd(), 'config.json');

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadConfig();

      expect(config).toEqual({
        chromePath: null,
        port: 3000
      });
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should load and parse config from file when it exists', () => {
      const configData = { chromePath: '/usr/bin/chrome', port: 4000 };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configData));

      const config = loadConfig();

      expect(config).toEqual(configData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(CONFIG_FILE, 'utf8');
    });

    it('should merge with defaults when file has partial config', () => {
      const partialConfig = { port: 4000 };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));

      const config = loadConfig();

      expect(config).toEqual({
        chromePath: null,
        port: 4000
      });
    });

    it('should handle malformed JSON gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const config = loadConfig();

      expect(config).toEqual({
        chromePath: null,
        port: 3000
      });
    });
  });

  describe('saveConfig', () => {
    it('should save config to file with proper formatting', () => {
      const config = { chromePath: '/usr/bin/chrome', port: 4000 };

      saveConfig(config);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        CONFIG_FILE,
        JSON.stringify(config, null, 2)
      );
    });

    it('should handle config save errors', () => {
      const config = { chromePath: '/usr/bin/chrome', port: 4000 };
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      expect(() => saveConfig(config)).toThrow('Failed to save config: Error: Write error');
    });
  });

  describe('updateConfig', () => {
    it('should update config and save to file', () => {
      const existingConfig = { chromePath: null, port: 3000 };
      const updates = { chromePath: '/usr/bin/chrome', port: 4000 };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

      const result = updateConfig(updates);

      expect(result).toEqual({
        chromePath: '/usr/bin/chrome',
        port: 4000
      });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        CONFIG_FILE,
        JSON.stringify(result, null, 2)
      );
    });

    it('should handle partial updates', () => {
      const existingConfig = { chromePath: '/usr/bin/chrome', port: 3000 };
      const updates = { port: 4000 };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

      const result = updateConfig(updates);

      expect(result).toEqual({
        chromePath: '/usr/bin/chrome',
        port: 4000
      });
    });

    it('should work when config file does not exist', () => {
      const updates = { chromePath: '/usr/bin/chrome', port: 4000 };

      mockFs.existsSync.mockReturnValue(false);

      const result = updateConfig(updates);

      expect(result).toEqual({
        chromePath: '/usr/bin/chrome',
        port: 4000
      });
    });
  });
});
