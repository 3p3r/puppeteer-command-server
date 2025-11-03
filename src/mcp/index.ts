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

      const updatedConfig = updateConfig({
        chromePath: args.chromePath ?? undefined,
        port: args.port
      });

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

  return server;
}
