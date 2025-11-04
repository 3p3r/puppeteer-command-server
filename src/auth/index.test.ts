import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateApiKey, loadApiKey } from './index.js';

// Mock fs module
vi.mock('fs');

const mockFs = vi.mocked(fs);

describe('Authentication System', () => {
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

  describe('generateApiKey', () => {
    it('should generate 64-character hex API keys', () => {
      const key = generateApiKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique keys on multiple calls', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('loadApiKey', () => {
    it('should create and save new API key when .secret does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const key = loadApiKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), '.secret'),
        expect.any(String)
      );
    });

    it('should load existing API key from .secret file', () => {
      const existingKey = 'a'.repeat(64);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingKey);

      const key = loadApiKey();

      expect(key).toBe(existingKey);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(path.join(process.cwd(), '.secret'), 'utf8');
    });

    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const key = loadApiKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });
});
