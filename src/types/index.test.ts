import { describe, it, expect } from 'vitest';
import { BrowserError, TabNotFoundError } from './index.js';

describe('Error Classes', () => {
  describe('BrowserError', () => {
    it('should create BrowserError with correct name and message', () => {
      const error = new BrowserError('Test browser error');
      expect(error.name).toBe('BrowserError');
      expect(error.message).toBe('Test browser error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should inherit from Error', () => {
      const error = new BrowserError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.stack).toBeDefined();
    });
  });

  describe('TabNotFoundError', () => {
    it('should create TabNotFoundError with correct name and message', () => {
      const error = new TabNotFoundError('tab-123');
      expect(error.name).toBe('TabNotFoundError');
      expect(error.message).toBe('Tab with ID tab-123 not found');
      expect(error).toBeInstanceOf(Error);
    });

    it('should inherit from Error', () => {
      const error = new TabNotFoundError('tab-456');
      expect(error).toBeInstanceOf(Error);
      expect(error.stack).toBeDefined();
    });

    it('should include tab ID in error message', () => {
      const tabId = 'unique-tab-id';
      const error = new TabNotFoundError(tabId);
      expect(error.message).toContain(tabId);
    });
  });
});
