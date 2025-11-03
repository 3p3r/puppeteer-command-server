import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManagerSingleton } from '../browser/BrowserManager.js';
import { z } from 'zod';

export function initializeMcpServer(chromePath?: string | null): McpServer {
  const browserManager = BrowserManagerSingleton(chromePath);

  const server = new McpServer({
    name: 'puppeteer-command-server',
    version: '1.0.0'
  });

  // Register browser automation tools
  server.tool(
    'browser_open_tab',
    'Launch a new browser tab with Chrome/Chromium and navigate to a URL. Opens a Puppeteer-controlled page instance that can be automated with other browser commands. Supports both headless (no UI) and headed (visible browser) modes for testing, scraping, and automation tasks.',
    {
      url: z.string().describe('URL to navigate to (e.g., https://example.com)'),
      headless: z.boolean().optional().describe('Whether to run in headless mode (default: false). Set to true for server environments.')
    },
    async args => {
      const tabId = await browserManager.openTab({
        url: args.url,
        headless: args.headless ?? false
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, tabId })
          }
        ]
      };
    }
  );

  server.tool('browser_list_tabs', 'List all currently open browser tabs managed by Puppeteer. Returns an array of tab objects with their IDs and metadata. Useful for managing multiple pages, checking what tabs are active, and selecting which tab to interact with.', {}, async () => {
    const tabs = await browserManager.getTabs();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, tabs })
        }
      ]
    };
  });

  server.tool(
    'browser_navigate',
    'Navigate an existing browser tab to a different URL. Waits for the page to load completely before returning. Useful for moving between pages in a multi-step automation workflow or testing navigation flows.',
    {
      tabId: z.string().describe('Tab ID to navigate (obtained from browser_open_tab or browser_list_tabs)'),
      url: z.string().describe('URL to navigate to (e.g., https://example.com/page)')
    },
    async args => {
      await browserManager.navigateTab(args.tabId, args.url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_screenshot',
    'Capture a screenshot of a browser tab as a PNG image. Can capture either the visible viewport or the entire scrollable page. Returns base64-encoded image data. Perfect for visual testing, documentation, monitoring, or debugging web pages.',
    {
      tabId: z.string().describe('Tab ID to screenshot'),
      fullPage: z.boolean().optional().describe('Whether to capture the entire scrollable page (true) or just the visible viewport (false, default)')
    },
    async args => {
      const screenshot = await browserManager.screenshotTab(args.tabId, args.fullPage || false);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, screenshot })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_click',
    'Click an element on a web page using a CSS selector. Simulates a real mouse click on buttons, links, or any clickable element. Optionally waits for page navigation to complete after clicking, useful for links and form submissions.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector to target the element (e.g., "#submit-button", ".menu-item", "button[type=submit]")'),
      waitForNavigation: z.boolean().optional().describe('Wait for navigation/page load after click (default: false). Set to true for links and form submissions.')
    },
    async args => {
      await browserManager.clickElement(args.tabId, args.selector, args.waitForNavigation || false);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_hover',
    'Move the mouse cursor over an element to trigger hover effects. Useful for testing dropdown menus, tooltips, or any hover-triggered UI elements. Simulates the mouseover event just like a real user hovering with their mouse.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector of the element to hover over (e.g., ".dropdown-trigger", "#menu-item")')
    },
    async args => {
      await browserManager.hoverElement(args.tabId, args.selector);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_fill_form',
    'Type text into an input field or textarea on a web page. Clears existing content and fills the field with the specified value. Works with text inputs, password fields, search boxes, textareas, and other text entry elements. Essential for form automation and testing.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector of the input field (e.g., "input[name=username]", "#email", "textarea.description")'),
      value: z.string().describe('Text value to type into the field')
    },
    async args => {
      await browserManager.fillField(args.tabId, args.selector, args.value);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_select_option',
    'Select an option from a dropdown menu (<select> element). Chooses an option by its value attribute. Triggers change events as if a user selected the option manually. Perfect for automated form filling and testing select dropdowns.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector of the <select> element (e.g., "select[name=country]", "#category-dropdown")'),
      value: z.string().describe('Value attribute of the <option> to select (not the visible text)')
    },
    async args => {
      await browserManager.selectOption(args.tabId, args.selector, args.value);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_eval_js',
    'Execute custom JavaScript code in the context of a web page and return the result. Runs in the page\'s JavaScript environment with access to the DOM, window object, and page variables. Use for extracting data, manipulating page content, or calling page functions. Returns serializable values (strings, numbers, objects, arrays).',
    {
      tabId: z.string().describe('Tab ID'),
      script: z.string().describe('JavaScript code to execute (e.g., "document.title", "window.scrollTo(0, 100)", "Array.from(document.querySelectorAll(\'a\')).map(a => a.href)")')
    },
    async args => {
      const result = await browserManager.evaluateScript(args.tabId, args.script);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, result })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_close_tab',
    'Close and cleanup a browser tab. Closes the Puppeteer page instance and releases associated resources. Use when finished with a tab to free up memory and browser resources.',
    {
      tabId: z.string().describe('Tab ID to close (obtained from browser_open_tab or browser_list_tabs)')
    },
    async args => {
      await browserManager.closeTab(args.tabId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_bring_to_front',
    'Activate and bring a browser tab to the foreground. Makes the specified tab the active tab in the browser window, similar to clicking on a browser tab. Useful when working with multiple tabs in headed mode.',
    {
      tabId: z.string().describe('Tab ID to bring to front')
    },
    async args => {
      await browserManager.bringToFront(args.tabId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_focus_element',
    'Set keyboard focus on a specific element on the page. Triggers focus events and prepares the element to receive keyboard input. Commonly used before typing into fields, testing keyboard navigation, or triggering focus-dependent behaviors.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector of the element to focus (e.g., "input[name=search]", "#comment-box")')
    },
    async args => {
      await browserManager.focusElement(args.tabId, args.selector);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_go_back',
    'Navigate backward in the browser history, equivalent to clicking the back button. Goes to the previous page in the tab\'s navigation history. Useful for testing navigation flows or returning to previous pages in multi-step processes.',
    {
      tabId: z.string().describe('Tab ID')
    },
    async args => {
      await browserManager.goBack(args.tabId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_go_forward',
    'Navigate forward in the browser history, equivalent to clicking the forward button. Goes to the next page in the tab\'s navigation history after going back. Only works if you\'ve previously navigated backward.',
    {
      tabId: z.string().describe('Tab ID')
    },
    async args => {
      await browserManager.goForward(args.tabId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_reload',
    'Reload the current page in a tab, equivalent to pressing F5 or clicking the refresh button. Refreshes all page content and re-executes scripts. Optionally specify when to consider the reload complete (e.g., wait for network to be idle or just the load event).',
    {
      tabId: z.string().describe('Tab ID'),
      waitUntil: z.string().optional().describe('When to consider navigation complete: "load" (default), "domcontentloaded", "networkidle0" (no network connections for 500ms), or "networkidle2" (max 2 network connections for 500ms)')
    },
    async args => {
      await browserManager.reloadTab(args.tabId, args.waitUntil);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_wait_for_selector',
    'Wait for an element matching a CSS selector to appear in the DOM. Pauses execution until the element is found or timeout is reached. Optionally wait for the element to be visible (not just present in DOM). Essential for handling dynamic content, SPAs, and elements loaded via JavaScript.',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector to wait for (e.g., ".loading-complete", "#dynamic-content")'),
      timeout: z.number().optional().describe('Maximum time to wait in milliseconds (default: 30000)'),
      visible: z.boolean().optional().describe('Wait for element to be visible, not just present in DOM (default: false)')
    },
    async args => {
      const options: any = {};
      if (args.timeout !== undefined) options.timeout = args.timeout;
      if (args.visible !== undefined) options.visible = args.visible;
      await browserManager.waitForSelector(args.tabId, args.selector, options);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_wait_for_function',
    'Wait for a custom JavaScript function to return a truthy value. Repeatedly evaluates the provided function in the page context until it returns true or timeout is reached. More flexible than wait_for_selector - use for waiting on custom conditions like variable values, element counts, or complex page states.',
    {
      tabId: z.string().describe('Tab ID'),
      functionScript: z.string().describe('JavaScript function/expression to evaluate repeatedly (e.g., "() => document.querySelectorAll(\'.item\').length > 5", "() => window.dataLoaded === true")'),
      timeout: z.number().optional().describe('Maximum time to wait in milliseconds (default: 30000)')
    },
    async args => {
      const options: any = {};
      if (args.timeout !== undefined) options.timeout = args.timeout;
      await browserManager.waitForFunction(args.tabId, args.functionScript, options);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_wait_for_navigation',
    'Wait for a page navigation event to complete. Waits for the page to finish loading after actions that trigger navigation (like clicking links or submitting forms). Specify different completion criteria based on your needs - wait for initial load or for network to become idle.',
    {
      tabId: z.string().describe('Tab ID'),
      timeout: z.number().optional().describe('Maximum time to wait in milliseconds (default: 30000)'),
      waitUntil: z.string().optional().describe('When to consider navigation complete: "load" (default), "domcontentloaded", "networkidle0", or "networkidle2"')
    },
    async args => {
      const options: any = {};
      if (args.timeout !== undefined) options.timeout = args.timeout;
      if (args.waitUntil !== undefined) options.waitUntil = args.waitUntil;
      await browserManager.waitForNavigation(args.tabId, options);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_get_url',
    'Get the current URL of a browser tab. Returns the complete URL currently loaded in the tab, including any changes from navigation, redirects, or hash/query parameter updates. Useful for verifying navigation, checking redirects, or tracking page state.',
    {
      tabId: z.string().describe('Tab ID')
    },
    async args => {
      const url = await browserManager.getTabUrl(args.tabId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, url })
          }
        ]
      };
    }
  );

  return server;
}
