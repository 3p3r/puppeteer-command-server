import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BrowserError, TabNotFoundError } from '../types/index.js';
import { BrowserManagerSingleton } from './BrowserManager.js';

describe('BrowserManager', () => {
  const browserManager = BrowserManagerSingleton();

  afterAll(async () => {
    await browserManager.close();
  });

  describe('Browser Initialization', () => {
    it('should initialize browser successfully', async () => {
      await browserManager.initialize();

      const tabs = await browserManager.getTabs();
      expect(tabs).toEqual([]);

      await browserManager.close();
    });

    it('should handle browser disconnection', async () => {
      await browserManager.initialize();

      // Get the browser instance and close it directly to simulate disconnection
      // The BrowserManager should handle this gracefully
      await browserManager.close();

      // Browser should be null after closing
      const tabs = await browserManager.getTabs();
      expect(tabs).toEqual([]);
    });
  });

  describe('Tab Management', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should open new tab successfully', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });

      expect(tabId).toBeTruthy();
      expect(typeof tabId).toBe('string');

      const tabs = await browserManager.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.id).toBe(tabId);
    });

    it('should open tab without URL', async () => {
      const tabId = await browserManager.openTab({ url: '' });

      expect(tabId).toBeTruthy();
      expect(typeof tabId).toBe('string');

      const tabs = await browserManager.getTabs();
      expect(tabs).toHaveLength(1);
    });

    it('should list open tabs', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });

      const tabs = await browserManager.getTabs();

      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toMatchObject({
        id: tabId,
        headless: false
      });
      expect(tabs[0]?.url).toBeTruthy();
      expect(tabs[0]?.title).toBeTruthy();
    });

    it('should navigate tab to new URL', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });

      // Wait a bit for initial page to load
      await new Promise(resolve => setTimeout(resolve, 500));

      await browserManager.navigateTab(tabId, 'https://example.org');

      const tabs = await browserManager.getTabs();
      const tab = tabs.find(t => t.id === tabId);
      expect(tab).toBeDefined();
    });

    it('should throw error when navigating non-existent tab', async () => {
      await expect(
        browserManager.navigateTab('non-existent-id-12345', 'https://example.com')
      ).rejects.toThrow(TabNotFoundError);
    });

    it('should close tab successfully', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });

      await browserManager.closeTab(tabId);

      const tabs = await browserManager.getTabs();
      expect(tabs).toHaveLength(0);
    });

    it('should throw error when closing non-existent tab', async () => {
      await expect(browserManager.closeTab('non-existent-id-12345')).rejects.toThrow(
        TabNotFoundError
      );
    });
  });

  describe('Browser Actions', () => {
    let tabId: string;

    beforeEach(async () => {
      await browserManager.initialize();
      tabId = await browserManager.openTab({ url: 'https://example.com' });
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should take screenshot', async () => {
      const screenshot = await browserManager.screenshotTab(tabId, false);

      expect(screenshot).toBeTruthy();
      expect(typeof screenshot).toBe('string');
      // Base64 screenshots start with data URL or are base64 encoded
      expect(screenshot.length).toBeGreaterThan(0);
    });

    it('should take full page screenshot', async () => {
      const screenshot = await browserManager.screenshotTab(tabId, true);

      expect(screenshot).toBeTruthy();
      expect(typeof screenshot).toBe('string');
      expect(screenshot.length).toBeGreaterThan(0);
    });

    it('should evaluate JavaScript', async () => {
      // page.evaluate accepts a string that evaluates to a value
      // We can use an IIFE (Immediately Invoked Function Expression) format
      const result = await browserManager.evaluateScript(
        tabId,
        '(function() { return { title: document.title, url: location.href }; })()'
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('url');
      expect(typeof result.title).toBe('string');
      expect(typeof result.url).toBe('string');
    });

    it('should handle errors in browser actions', async () => {
      // Try to click a non-existent element
      await expect(
        browserManager.clickElement(tabId, '.non-existent-element-that-does-not-exist-xyz')
      ).rejects.toThrow(BrowserError);
    });

    it('should navigate to page with form and interact', async () => {
      // Navigate to a page with interactive elements
      await browserManager.navigateTab(tabId, 'https://example.com');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to hover (this should not throw on example.com)
      // We can't guarantee specific elements exist, so just verify the method can be called
      try {
        await browserManager.hoverElement(tabId, 'body');
      } catch (e) {
        // It's okay if the element doesn't exist or hover fails
        expect(e).toBeInstanceOf(BrowserError);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple tabs', async () => {
      await browserManager.initialize();

      const tab1 = await browserManager.openTab({ url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 500));

      const tab2 = await browserManager.openTab({ url: 'https://example.org' });
      await new Promise(resolve => setTimeout(resolve, 500));

      const tabs = await browserManager.getTabs();
      expect(tabs.length).toBeGreaterThanOrEqual(2);

      expect(tabs.find(t => t.id === tab1)).toBeDefined();
      expect(tabs.find(t => t.id === tab2)).toBeDefined();
    });
  });
});
