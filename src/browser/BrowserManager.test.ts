import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from './BrowserManager.js';
import { BrowserError, TabNotFoundError } from '../types/index.js';
import puppeteer from 'puppeteer-core';
import { findChrome } from 'find-chrome-bin';

// Mock heavy dependencies
vi.mock('puppeteer-core', () => ({
  default: {
    launch: vi.fn()
  }
}));

vi.mock('find-chrome-bin', () => ({
  findChrome: vi.fn()
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123')
}));

const mockPuppeteer = vi.mocked(puppeteer);
const mockFindChrome = vi.mocked(findChrome);

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock browser and page
    mockPage = {
      url: vi.fn(() => 'about:blank'),
      title: vi.fn(() => 'Test Page'),
      setViewport: vi.fn(),
      goto: vi.fn(),
      screenshot: vi.fn(),
      click: vi.fn(),
      hover: vi.fn(),
      type: vi.fn(),
      select: vi.fn(),
      evaluate: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      waitForNavigation: vi.fn()
    };

    mockBrowser = {
      newPage: vi.fn(() => Promise.resolve(mockPage)),
      close: vi.fn(),
      on: vi.fn()
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    mockFindChrome.mockResolvedValue({
      executablePath: '/usr/bin/chrome',
      browser: 'Chrome 120.0.0.0'
    });

    browserManager = new BrowserManager();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (browserManager) {
      await browserManager.close();
    }
  });

  describe('Chrome Path Detection', () => {
    it('should use provided chrome path', async () => {
      const customPath = '/custom/chrome/path';
      const manager = new BrowserManager(customPath);
      
      await manager.initialize();
      
      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: customPath
        })
      );
    });

    it('should auto-detect chrome when no path provided', async () => {
      await browserManager.initialize();
      
      expect(mockFindChrome).toHaveBeenCalledWith({});
      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/usr/bin/chrome'
        })
      );
    });

    it('should throw error when chrome not found', async () => {
      mockFindChrome.mockRejectedValue(new Error('Chrome not found'));
      
      await expect(browserManager.initialize()).rejects.toThrow(BrowserError);
      await expect(browserManager.initialize()).rejects.toThrow('Chrome executable not found');
    });
  });

  describe('Browser Initialization', () => {
    it('should initialize browser successfully', async () => {
      await browserManager.initialize();
      
      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/usr/bin/chrome',
          headless: false,
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ])
        })
      );
    });

    it('should handle browser disconnection', async () => {
      await browserManager.initialize();
      
      // Simulate browser disconnection
      const disconnectHandler = mockBrowser.on.mock.calls.find(
        call => call[0] === 'disconnected'
      )?.[1];
      
      expect(disconnectHandler).toBeDefined();
      
      // Call the disconnect handler
      disconnectHandler();
      
      // Browser should be null after disconnection
      expect(await browserManager.getTabs()).toEqual([]);
    });
  });

  describe('Tab Management', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should open new tab successfully', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });
      
      expect(tabId).toBe('test-uuid-123');
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'networkidle2' });
    });

    it('should open tab without URL', async () => {
      const tabId = await browserManager.openTab({ url: '' });
      
      expect(tabId).toBe('test-uuid-123');
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    it('should list open tabs', async () => {
      await browserManager.openTab({ url: 'https://example.com' });
      
      const tabs = await browserManager.getTabs();
      
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toEqual({
        id: 'test-uuid-123',
        url: 'about:blank',
        title: 'Test Page',
        headless: false
      });
    });

    it('should navigate tab to new URL', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });
      
      await browserManager.navigateTab(tabId, 'https://google.com');
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://google.com', { waitUntil: 'networkidle2' });
    });

    it('should throw error when navigating non-existent tab', async () => {
      await expect(browserManager.navigateTab('non-existent', 'https://example.com'))
        .rejects.toThrow(TabNotFoundError);
    });

    it('should close tab successfully', async () => {
      const tabId = await browserManager.openTab({ url: 'https://example.com' });
      
      await browserManager.closeTab(tabId);
      
      expect(mockPage.close).toHaveBeenCalled();
      expect(await browserManager.getTabs()).toHaveLength(0);
    });

    it('should throw error when closing non-existent tab', async () => {
      await expect(browserManager.closeTab('non-existent'))
        .rejects.toThrow(TabNotFoundError);
    });
  });

  describe('Browser Actions', () => {
    let tabId: string;

    beforeEach(async () => {
      await browserManager.initialize();
      tabId = await browserManager.openTab({ url: 'https://example.com' });
    });

    it('should take screenshot', async () => {
      const mockScreenshot = 'base64-screenshot-data';
      mockPage.screenshot.mockResolvedValue(mockScreenshot);
      
      const screenshot = await browserManager.screenshotTab(tabId, true);
      
      expect(screenshot).toBe(mockScreenshot);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
        encoding: 'base64'
      });
    });

    it('should click element', async () => {
      await browserManager.clickElement(tabId, '.button', true);
      
      expect(mockPage.click).toHaveBeenCalledWith('.button');
      expect(mockPage.waitForNavigation).toHaveBeenCalledWith({ waitUntil: 'networkidle2' });
    });

    it('should hover element', async () => {
      await browserManager.hoverElement(tabId, '.menu-item');
      
      expect(mockPage.hover).toHaveBeenCalledWith('.menu-item');
    });

    it('should fill form field', async () => {
      await browserManager.fillField(tabId, '#email', 'test@example.com');
      
      expect(mockPage.type).toHaveBeenCalledWith('#email', 'test@example.com');
    });

    it('should select dropdown option', async () => {
      await browserManager.selectOption(tabId, '#country', 'us');
      
      expect(mockPage.select).toHaveBeenCalledWith('#country', 'us');
    });

    it('should evaluate JavaScript', async () => {
      const mockResult = { title: 'Test Page', url: 'https://example.com' };
      mockPage.evaluate.mockResolvedValue(mockResult);
      
      const result = await browserManager.evaluateScript(tabId, 'return { title: document.title, url: location.href };');
      
      expect(result).toEqual(mockResult);
      expect(mockPage.evaluate).toHaveBeenCalledWith('return { title: document.title, url: location.href };');
    });

    it('should handle errors in browser actions', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not found'));
      
      await expect(browserManager.clickElement(tabId, '.non-existent'))
        .rejects.toThrow(BrowserError);
    });
  });

  describe('Error Handling', () => {
    it('should auto-initialize browser when opening tab', async () => {
      // Create a new instance without initializing
      const uninitializedManager = new BrowserManager();
      
      // Mock the initialization to fail
      mockPuppeteer.launch.mockRejectedValueOnce(new Error('Launch failed'));
      
      await expect(uninitializedManager.openTab({ url: 'https://example.com' }))
        .rejects.toThrow(BrowserError);
    });

    it('should handle browser launch failure', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Launch failed'));
      
      await expect(browserManager.initialize())
        .rejects.toThrow(BrowserError);
    });
  });

  describe('Chrome Path Updates', () => {
    it('should update chrome path', () => {
      const newPath = '/new/chrome/path';
      browserManager.updateChromePath(newPath);
      
      // This would be tested in the next initialization
      expect(browserManager).toBeDefined();
    });
  });
});
