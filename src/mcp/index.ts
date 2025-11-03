import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManagerSingleton } from '../browser/BrowserManager.js';
import { loadConfig, updateConfig } from '../config/index.js';
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
    'Open a new browser tab',
    {
      url: z.string().describe('URL to navigate to'),
      headless: z.boolean().optional().describe('Whether to run in headless mode')
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

  server.tool('browser_list_tabs', 'List all open browser tabs', {}, async () => {
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
    'Navigate a tab to a new URL',
    {
      tabId: z.string().describe('Tab ID to navigate'),
      url: z.string().describe('URL to navigate to')
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
    'Take a screenshot of a tab',
    {
      tabId: z.string().describe('Tab ID to screenshot'),
      fullPage: z.boolean().optional().describe('Whether to capture full page')
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
    'Click an element in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector'),
      waitForNavigation: z.boolean().optional().describe('Wait for navigation after click')
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
    'Hover over an element in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector')
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
    'Fill a form field in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector'),
      value: z.string().describe('Value to fill')
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
    'Select an option in a dropdown',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector'),
      value: z.string().describe('Option value to select')
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
    'Execute JavaScript in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      script: z.string().describe('JavaScript code to execute')
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
    'Close a browser tab',
    {
      tabId: z.string().describe('Tab ID to close')
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

  server.tool('browser_get_config', 'Get current configuration', {}, async () => {
    const config = loadConfig();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, data: config })
        }
      ]
    };
  });

  server.tool(
    'browser_set_config',
    'Update configuration',
    {
      chromePath: z.string().nullable().optional().describe('Path to Chrome executable'),
      port: z.number().optional().describe('Server port (1-65535)')
    },
    async args => {
      // Validate port if provided
      if (args.port !== undefined && (args.port < 1 || args.port > 65535)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Port must be between 1 and 65535'
              })
            }
          ]
        };
      }

      const configUpdate: any = {};
      if (args.chromePath !== undefined) configUpdate.chromePath = args.chromePath;
      if (args.port !== undefined) configUpdate.port = args.port;
      const updatedConfig = updateConfig(configUpdate);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data: updatedConfig })
          }
        ]
      };
    }
  );

  server.tool(
    'browser_bring_to_front',
    'Bring a tab to the front',
    {
      tabId: z.string().describe('Tab ID')
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
    'Focus on an element in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector of element to focus')
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
    'Navigate back in browser history',
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
    'Navigate forward in browser history',
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
    'Reload a tab',
    {
      tabId: z.string().describe('Tab ID'),
      waitUntil: z.string().optional().describe('When to consider navigation complete (networkidle2, load, etc.)')
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
    'Wait for a selector to appear in a tab',
    {
      tabId: z.string().describe('Tab ID'),
      selector: z.string().describe('CSS selector to wait for'),
      timeout: z.number().optional().describe('Timeout in milliseconds'),
      visible: z.boolean().optional().describe('Wait for element to be visible')
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
    'Wait for a function to return truthy value',
    {
      tabId: z.string().describe('Tab ID'),
      functionScript: z.string().describe('JavaScript function to wait for'),
      timeout: z.number().optional().describe('Timeout in milliseconds')
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
    'Wait for navigation to complete',
    {
      tabId: z.string().describe('Tab ID'),
      timeout: z.number().optional().describe('Timeout in milliseconds'),
      waitUntil: z.string().optional().describe('When to consider navigation complete (networkidle2, load, etc.)')
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
    'Get the current URL of a tab',
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
