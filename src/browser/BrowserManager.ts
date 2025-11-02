import puppeteer, { Browser, Page } from 'puppeteer-core';
import { randomUUID } from 'crypto';
import { TabInfo, OpenTabRequest, BrowserError, TabNotFoundError } from '../types/index.js';
import { findChromeBrowser } from '../chrome/FindChrome.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private tabs: Map<string, Page> = new Map();
  private chromePath: string | null = null;

  constructor(chromePath?: string | null) {
    this.chromePath = chromePath || null;
  }

  async initialize(): Promise<void> {
    try {
      const executablePath = await this.getChromePath();
      
      this.browser = await puppeteer.launch({
        executablePath,
        headless: false, // Default to headed mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          // todo: browser's context needs to be isolated from the main user profile
          // todo: we need to browser instances, one headless and one headed
          '--headless'
        ]
      });

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        console.log('Browser disconnected, clearing tabs');
        this.tabs.clear();
        this.browser = null;
      });

      console.log('Browser initialized successfully');
    } catch (error) {
      throw new BrowserError(`Failed to initialize browser: ${error}`);
    }
  }

  private async getChromePath(): Promise<string> {
    if (this.chromePath) {
      return this.chromePath;
    }

    try {
      const chromePath = await findChromeBrowser();
      if (chromePath) {
        return chromePath;
      }
    } catch (error) {
      console.warn('Failed to find Chrome automatically:', error);
    }

    throw new BrowserError('Chrome executable not found. Please specify chromePath in config.');
  }

  async openTab(request: OpenTabRequest): Promise<string> {
    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new BrowserError('Browser not initialized');
    }

    try {
      const page = await this.browser.newPage();
      const tabId = randomUUID();
      
      this.tabs.set(tabId, page);

      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to URL if provided
      if (request.url) {
        await page.goto(request.url, { waitUntil: 'networkidle2' });
      }

      // Handle page close
      page.on('close', () => {
        this.tabs.delete(tabId);
      });

      return tabId;
    } catch (error) {
      throw new BrowserError(`Failed to open tab: ${error}`);
    }
  }

  async navigateTab(tabId: string, url: string): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
    } catch (error) {
      throw new BrowserError(`Failed to navigate tab: ${error}`);
    }
  }

  async screenshotTab(tabId: string, fullPage = false): Promise<string> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      const screenshot = await page.screenshot({ 
        type: 'png', 
        fullPage,
        encoding: 'base64'
      });
      return screenshot as string;
    } catch (error) {
      throw new BrowserError(`Failed to take screenshot: ${error}`);
    }
  }

  async clickElement(tabId: string, selector: string, waitForNavigation = false): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      if (waitForNavigation) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click(selector)
        ]);
      } else {
        await page.click(selector);
      }
    } catch (error) {
      throw new BrowserError(`Failed to click element: ${error}`);
    }
  }

  async hoverElement(tabId: string, selector: string): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await page.hover(selector);
    } catch (error) {
      throw new BrowserError(`Failed to hover element: ${error}`);
    }
  }

  async fillField(tabId: string, selector: string, value: string): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await page.type(selector, value);
    } catch (error) {
      throw new BrowserError(`Failed to fill field: ${error}`);
    }
  }

  async selectOption(tabId: string, selector: string, value: string): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await page.select(selector, value);
    } catch (error) {
      throw new BrowserError(`Failed to select option: ${error}`);
    }
  }

  async evaluateScript(tabId: string, script: string): Promise<any> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      return await page.evaluate(script);
    } catch (error) {
      throw new BrowserError(`Failed to evaluate script: ${error}`);
    }
  }

  async closeTab(tabId: string): Promise<void> {
    const page = this.tabs.get(tabId);
    if (!page) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await page.close();
      this.tabs.delete(tabId);
    } catch (error) {
      throw new BrowserError(`Failed to close tab: ${error}`);
    }
  }

  async getTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    
    for (const [tabId, page] of this.tabs) {
      tabs.push({
        id: tabId,
        url: page.url(),
        title: await page.title(),
        headless: false // We'll track this if needed
      });
    }
    
    return tabs;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.tabs.clear();
    }
  }

  updateChromePath(chromePath: string | null): void {
    this.chromePath = chromePath;
  }
}
