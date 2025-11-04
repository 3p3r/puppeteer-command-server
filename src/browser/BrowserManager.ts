import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import memoize from 'lodash/memoize.js';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { findChromeBrowser } from '../chrome/FindChrome.js';
import {
  BrowserError,
  type OpenTabRequest,
  type TabInfo,
  TabNotFoundError
} from '../types/index.js';

export class BrowserManager {
  private browsers: Map<boolean, Browser | null> = new Map();
  private tabs: Map<string, { page: Page; visible: boolean }> = new Map();
  private chromePath: string | null = null;

  constructor(chromePath?: string | null) {
    this.chromePath = chromePath || null;
    this.browsers.set(true, null); // headless
    this.browsers.set(false, null); // visible
  }

  async initialize(headless = true): Promise<void> {
    try {
      await this.close();
      const executablePath = await this.getChromePath();
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--mute-audio',
        `--user-data-dir=${path.resolve(os.homedir(), '.pcs-browser')}`
        // `--user-data-dir=${path.resolve(process.cwd(), '.browser')}`
      ];

      const browser = await puppeteer.launch({
        defaultViewport: null,
        executablePath,
        headless,
        args
      });

      this.browsers.set(headless, browser);

      // Handle browser disconnection
      browser.on('disconnected', () => {
        console.log('Browser disconnected, clearing tabs');
        for (const [tabId, tab] of this.tabs) {
          if (tab.visible === headless) {
            this.tabs.delete(tabId);
          }
        }
        this.browsers.set(headless, null);
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
    const headless = request.headless ?? true;

    if (!this.browsers.get(headless)) {
      await this.initialize(headless);
    }

    const browser = this.browsers.get(headless);

    if (!browser) {
      throw new BrowserError('Browser not initialized');
    }

    assert(browser);

    try {
      const page = await browser.newPage();
      const tabId = randomUUID();

      this.tabs.set(tabId, { page, visible: headless });

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
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.goto(url, { waitUntil: 'networkidle2' });
    } catch (error) {
      throw new BrowserError(`Failed to navigate tab: ${error}`);
    }
  }

  async screenshotTab(tabId: string, fullPage = false): Promise<string> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      const screenshot = await tab.page.screenshot({
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
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      if (waitForNavigation) {
        await Promise.all([
          tab.page.waitForNavigation({ waitUntil: 'networkidle2' }),
          tab.page.click(selector)
        ]);
      } else {
        await tab.page.click(selector);
      }
    } catch (error) {
      throw new BrowserError(`Failed to click element: ${error}`);
    }
  }

  async hoverElement(tabId: string, selector: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.hover(selector);
    } catch (error) {
      throw new BrowserError(`Failed to hover element: ${error}`);
    }
  }

  async fillField(tabId: string, selector: string, value: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.type(selector, value);
    } catch (error) {
      throw new BrowserError(`Failed to fill field: ${error}`);
    }
  }

  async selectOption(tabId: string, selector: string, value: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.select(selector, value);
    } catch (error) {
      throw new BrowserError(`Failed to select option: ${error}`);
    }
  }

  async evaluateScript(tabId: string, script: string): Promise<any> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      return await tab.page.evaluate(script);
    } catch (error) {
      throw new BrowserError(`Failed to evaluate script: ${error}`);
    }
  }

  async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.close();
      this.tabs.delete(tabId);
      // close the browser if no tabs are left
      const headless = tab.visible;
      const anyTabsLeft = Array.from(this.tabs.values()).some(t => t.visible === headless);
      if (!anyTabsLeft) {
        const browser = this.browsers.get(headless);
        if (browser) {
          await browser.close();
          this.browsers.set(headless, null);
        }
      }
    } catch (error) {
      throw new BrowserError(`Failed to close tab: ${error}`);
    }
  }

  async bringToFront(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.bringToFront();
    } catch (error) {
      throw new BrowserError(`Failed to bring tab to front: ${error}`);
    }
  }

  async focusElement(tabId: string, selector: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.$eval(selector, (el: any) => el.focus());
    } catch (error) {
      throw new BrowserError(`Failed to focus element: ${error}`);
    }
  }

  async goBack(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.goBack({ waitUntil: 'networkidle2' });
    } catch (error) {
      throw new BrowserError(`Failed to go back: ${error}`);
    }
  }

  async goForward(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.goForward({ waitUntil: 'networkidle2' });
    } catch (error) {
      throw new BrowserError(`Failed to go forward: ${error}`);
    }
  }

  async reloadTab(tabId: string, waitUntil?: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.reload({ waitUntil: (waitUntil || 'networkidle2') as any });
    } catch (error) {
      throw new BrowserError(`Failed to reload tab: ${error}`);
    }
  }

  async waitForSelector(
    tabId: string,
    selector: string,
    options?: { timeout?: number; visible?: boolean }
  ): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.waitForSelector(selector, options);
    } catch (error) {
      throw new BrowserError(`Failed to wait for selector: ${error}`);
    }
  }

  async waitForFunction(tabId: string, fn: string, options?: { timeout?: number }): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      await tab.page.waitForFunction(fn, options);
    } catch (error) {
      throw new BrowserError(`Failed to wait for function: ${error}`);
    }
  }

  async waitForNavigation(
    tabId: string,
    options?: { timeout?: number; waitUntil?: string }
  ): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      const waitOptions: any = {};
      if (options?.timeout) waitOptions.timeout = options.timeout;
      if (options?.waitUntil) waitOptions.waitUntil = options.waitUntil;
      else waitOptions.waitUntil = 'networkidle2';

      await tab.page.waitForNavigation(waitOptions);
    } catch (error) {
      throw new BrowserError(`Failed to wait for navigation: ${error}`);
    }
  }

  async getTabUrl(tabId: string): Promise<string> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new TabNotFoundError(tabId);
    }

    try {
      return tab.page.url();
    } catch (error) {
      throw new BrowserError(`Failed to get tab URL: ${error}`);
    }
  }

  async getTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];

    for (const [tabId, { page }] of this.tabs) {
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
    for (const [headless, browser] of this.browsers) {
      if (browser) {
        await browser.close();
        this.browsers.set(headless, null);
      }
    }
    this.tabs.clear();
  }

  updateChromePath(chromePath: string | null): void {
    this.chromePath = chromePath;
  }
}

export const BrowserManagerSingleton = memoize(
  (chromePath?: string | null) => new BrowserManager(chromePath)
);
