# puppeteer-command-server

Exposes basic browser automation through HTTP and MCP for generative UI apps.

- [Methodology](#methodology)
- [Authentication](#authentication)
  - [1. API Key Authentication (Default: Enabled)](#1-api-key-authentication-default-enabled)
  - [2. JWT Bearer Token Authentication (Default: Disabled)](#2-jwt-bearer-token-authentication-default-disabled)
    - [Browser-Based JWT Verification](#browser-based-jwt-verification)
  - [MCP Server testing](#mcp-server-testing)
- [Platforms](#platforms)
- [Distribution](#distribution)
- [Environment](#environment)
- [Development](#development)
  - [Building Binaries](#building-binaries)
- [Implementation](#implementation)
- [References](#references)
- [Installation](#installation)
- [License](#license)

## Methodology

This project on launch exposes the following endpoints:

- a RESTful API HTTP server
- a Swagger docs server
- a MCP server

For example:

- <http://localhost:3000/api>: the RESTful API
- <http://localhost:3000/mcp>: the MCP endpoint
- <http://localhost:3000/docs>: the Swagger docs endpoint
- <http://localhost:3000/jose>: Jose library browser modules (for JWT verification)
- <http://localhost:3000/jwt-verify>: Browser-based JWT verification page

Port is configurable with the `PCS_PORT` environment variable (default: `3000`).

On running the server, it attempts to find the first available Chrome or Chrome
adjacent installation on the host machine. This setting can be updated over HTTP
and MCP as well as a config file in the executable's current directory.

Assuming access to the path of the Chrome executable, the server offers this API:

- `tabs/list`: lists all open tabs with their IDs and URLs
- `tabs/open`: opens a new tab with an initial URL (optionally headless)
- `tabs/goto/:tabId`: navigates the tab with the given ID to a new URL
- `tabs/screenshot/:tabId`: takes a screenshot of the tab with the given ID
- `tabs/click/:tabId`: clicks at specified selector in the tab with the given ID
- `tabs/hover/:tabId`: hovers over specified selector in the tab with the given ID
- `tabs/fill/:tabId`: fills a form field at specified selector in the tab with the given ID
- `tabs/select/:tabId`: selects an option in a dropdown at specified selector in the tab with the given ID
- `tabs/eval/:tabId`: evaluates JavaScript in the context of the tab with the given ID
- `tabs/close/:tabId`: closes the tab with the given ID
- `tabs/closeAll`: closes all open tabs
- `tabs/bringToFront/:tabId`: brings the tab with the given ID to front
- `tabs/focus/:tabId`: focuses on a specific element via selector in the tab with the given ID
- `tabs/goBack/:tabId`: navigates back in browser history for the tab with the given ID
- `tabs/goForward/:tabId`: navigates forward in browser history for the tab with the given ID
- `tabs/reload/:tabId`: reloads the tab with the given ID
- `tabs/waitForSelector/:tabId`: waits for a selector to appear in the tab with the given ID
- `tabs/waitForFunction/:tabId`: waits for a function to return truthy value in the tab with the given ID
- `tabs/waitForNavigation/:tabId`: waits for navigation to complete in the tab with the given ID
- `tabs/url/:tabId`: gets the current URL of the tab with the given ID
- `tabs/html/:tabId`: gets the current HTML content of the tab with the given ID
- `resources/clean`: removes a specific screenshot resource by URI
- `resources/cleanAll`: removes all screenshot resources

Browser automation happens through Puppeteer. Session management is automatic.

The server is implemented in Express and Typescript. All routes are protected
with configurable authentication strategies.

## Authentication

The server supports two optional authentication strategies:

### 1. API Key Authentication (Default: Enabled)

On first run, the server generates a random API key and saves it to `.secret` in
the current working directory. Use this key in the `x-api-key` header:

```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/api/tabs/list
```

### 2. JWT Bearer Token Authentication (Default: Disabled)

The server can verify external JWT tokens (issued by another service). Configure
JWT verification in `config.json` (see `config.json.example` for a template):

```json
{
  "chromePath": "/path/to/chrome",
  "port": 3000,
  "auth": {
    "apiKey": {
      "enabled": true
    },
    "jwt": {
      "enabled": true,
      "jwksUrl": "https://your-auth-server.com/.well-known/jwks.json",
      "issuer": "https://your-auth-server.com",
      "audience": "https://your-api-domain.com"
    }
  }
}
```

Use JWT tokens in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/tabs/list
```

#### Browser-Based JWT Verification

For JWT verification that needs to happen in a browser context (e.g., for testing browser-side authentication flows), enable the `proxy` option:

```json
{
  "auth": {
    "jwt": {
      "enabled": true,
      "proxy": true,
      "jwksUrl": "https://your-auth-server.com/.well-known/jwks.json",
      "issuer": "https://your-auth-server.com",
      "audience": "https://your-api-domain.com"
    }
  }
}
```

When `proxy: true` is set, JWT verification happens in a browser tab using the Jose library loaded as an ES module. This allows verification to occur in the same environment as your browser automation, which can be useful for debugging or working around network restrictions.

The server automatically serves:
- `/jose/*` - Jose library browser modules from `node_modules`
- `/jwt-verify` - HTML page that implements browser-based JWT verification

Both strategies can be enabled simultaneously. If both are enabled, either valid
API key OR valid JWT token will grant access.

### MCP Server testing

To interact and test the MCP server, you can use:

```bash
npx @modelcontextprotocol/inspector
```

In the UI, ensure "Transport Type" is set to `Streamable HTTP` and add
authentication headers:

- For API Key: Add `x-api-key` header with the key from `.secret`
- For JWT: Add `Authorization` header with value `Bearer YOUR_JWT_TOKEN`

## Platforms

Windows, WSL, Linux, and MacOS.

- `pcs.exe` for Windows
- `pcs` for WSL, Linux, and MacOS

## Distribution

The project is coded in Typescript and compiled into native binaries using PKG.

When PKG is used to compile the project, executables are generated for Windows,
Linux, and MacOS operating systems. The Linux binary runs on WSL as well.

After that, the executables are compressed and obfuscated to reduce size and
create unique signatures for production.

Resulting binaries are entirely self-contained and do not require any external
dependencies beyond the target platform's standard libraries.

## Environment

- `Node.js` version 18+ and `npm`
- `Go` version 1.16+ (for signature generation)
- `lipo` (MacOS only) or `llvm-lipo` (non MacOS)
- `upx` (for executable compression)
- `Docker` (to build `ldid` if you don't have MacOS)

## Development

### Building Binaries

Compile the project into native binaries:

```bash
npm run compile
```

**Flags:**

- `--fast`: Fast build mode (skips Brotli compression, uses UPX level 1)
- `--linux`: Build Linux binaries only
- `--mac`: Build macOS binaries only
- `--win`: Build Windows binaries only

Platform flags can be combined. Without any platform flag, all platforms are built.

**Examples:**

```bash
# Fast build for Linux only
npm run compile -- --linux --fast

# Build for Windows and macOS
npm run compile -- --win --mac

# Full build (all platforms, maximum compression)
npm run compile
```

## Implementation

Code is organized in Object Oriented manner with classes. Logic is maintained at
a level that the code is readable and easy to reason about.

## References

- <https://github.com/expressjs/express> - To build the HTTP server
- <https://www.npmjs.com/package/puppeteer-core> - To control Chrome browser
- <https://www.npmjs.com/package/puppeteer-extra> - Puppeteer plugins framework
- <https://github.com/panva/jose> - JWT verification library
- <https://github.com/vercel/pkg> - To compile Node.js project into binaries
- <https://github.com/upx/upx> - Executable compressor

## Installation

<details>
<summary><b>Install in Cursor</b></summary>

Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

Pasting the following configuration into your Cursor `~/.cursor/mcp.json` file is the recommended approach. You may also install in a specific project by creating `.cursor/mcp.json` in your project folder. See [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more info.

> Since Cursor 1.0, you can click the install button below for instant one-click installation.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pcs&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvbWNwIn0=)

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Run this command. See [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp) for more info.

```sh
claude mcp add --transport http pcs http://localhost:3000/mcp --header "x-api-key: YOUR_API_KEY"
```

</details>

<details>
<summary><b>Install in Amp</b></summary>

Run this command in your terminal. See [Amp MCP docs](https://ampcode.com/manual#mcp) for more info.

```sh
amp mcp add pcs --header "x-api-key=YOUR_API_KEY" http://localhost:3000/mcp
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Add this to your Windsurf MCP config file. See [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) for more info.

```json
{
  "mcpServers": {
    "pcs": {
      "serverUrl": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Add this to your VS Code MCP config file. See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

```json
"mcp": {
  "servers": {
    "pcs": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Cline</b></summary>

You can directly edit MCP servers configuration:

1. Open **Cline**.
2. Click the hamburger menu icon (☰) to enter the **MCP Servers** section.
3. Choose **Remote Servers** tab.
4. Click the **Edit Configuration** button.
5. Add pcs to `mcpServers`:

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "type": "streamableHttp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zed</b></summary>

Add this to your Zed `settings.json`. See [Zed Context Server docs](https://zed.dev/docs/assistant/context-servers) for more info.

```json
{
  "context_servers": {
    "pcs": {
      "source": "url",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Augment Code</b></summary>

To configure PCS MCP in Augment Code, use manual configuration:

1. Press Cmd/Ctrl Shift P or go to the hamburger menu in the Augment panel
2. Select Edit Settings
3. Under Advanced, click Edit in settings.json
4. Add the server configuration to the `mcpServers` array in the `augment.advanced` object

```json
"augment.advanced": {
  "mcpServers": [
    {
      "name": "pcs",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  ]
}
```

Once the MCP server is added, restart your editor. If you receive any errors, check the syntax to make sure closing brackets or commas are not missing.

</details>

<details>
<summary><b>Install in Roo Code</b></summary>

Add this to your Roo Code MCP configuration file. See [Roo Code MCP docs](https://docs.roocode.com/features/mcp/using-mcp-in-roo) for more info.

```json
{
  "mcpServers": {
    "pcs": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Gemini CLI</b></summary>

See [Gemini CLI Configuration](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for details.

1.  Open the Gemini CLI settings file. The location is `~/.gemini/settings.json` (where `~` is your home directory).
2.  Add the following to the `mcpServers` object in your `settings.json` file:

```json
{
  "mcpServers": {
    "pcs": {
      "httpUrl": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

If the `mcpServers` object does not exist, create it.

</details>

<details>
<summary><b>Install in Qwen Coder</b></summary>

See [Qwen Coder MCP Configuration](https://qwenlm.github.io/qwen-code-docs/en/tools/mcp-server/#how-to-set-up-your-mcp-server) for details.

1.  Open the Qwen Coder settings file. The location is `~/.qwen/settings.json` (where `~` is your home directory).
2.  Add the following to the `mcpServers` object in your `settings.json` file:

```json
{
  "mcpServers": {
    "pcs": {
      "httpUrl": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

If the `mcpServers` object does not exist, create it.

</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Open Claude Desktop and navigate to Settings > Connectors > Add Custom Connector. Enter the name as `PCS` and the MCP server URL as `http://localhost:3000/mcp`. Add `x-api-key` header with your API key.

Or edit your `claude_desktop_config.json` file to add the following configuration. See [Claude Desktop MCP docs](https://modelcontextprotocol.io/quickstart/user) for more info.

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Opencode</b></summary>

Add this to your Opencode configuration file. See [Opencode MCP docs](https://opencode.ai/docs/mcp-servers) for more info.

```json
"mcp": {
  "pcs": {
    "type": "remote",
    "url": "http://localhost:3000/mcp",
    "headers": {
      "x-api-key": "YOUR_API_KEY"
    },
    "enabled": true
  }
}
```

</details>

<details>
<summary><b>Install in OpenAI Codex</b></summary>

See [OpenAI Codex](https://github.com/openai/codex) for more information.

Add the following configuration to your OpenAI Codex MCP server settings:

```toml
[mcp_servers.pcs]
url = "http://localhost:3000/mcp"
http_headers = { "x-api-key" = "YOUR_API_KEY" }
```

</details>

<details>

<summary><b>Install in JetBrains AI Assistant</b></summary>

See [JetBrains AI Assistant Documentation](https://www.jetbrains.com/help/ai-assistant/configure-an-mcp-server.html) for more details.

1. In JetBrains IDEs, go to `Settings` -> `Tools` -> `AI Assistant` -> `Model Context Protocol (MCP)`
2. Click `+ Add`.
3. Click on `Command` in the top-left corner of the dialog and select the As JSON option from the list
4. Add this configuration and click `OK`

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

5. Click `Apply` to save changes.
6. The same way pcs could be added for JetBrains Junie in `Settings` -> `Tools` -> `Junie` -> `MCP Settings`

</details>

<details>
  
<summary><b>Install in Kiro</b></summary>

See [Kiro Model Context Protocol Documentation](https://kiro.dev/docs/mcp/configuration/) for details.

1. Navigate `Kiro` > `MCP Servers`
2. Add a new MCP server by clicking the `+ Add` button.
3. Paste the configuration given below:

```json
{
  "mcpServers": {
    "PCS": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      },
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

4. Click `Save` to apply the changes.

</details>

<details>
<summary><b>Install in Trae</b></summary>

Use the Add manually feature and fill in the JSON configuration information for that MCP server.
For more details, visit the [Trae documentation](https://docs.trae.ai/ide/model-context-protocol?_lang=en).

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>



<details>
<summary><b>Install in Amazon Q Developer CLI</b></summary>

Add this to your Amazon Q Developer CLI configuration file. See [Amazon Q Developer CLI docs](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html) for more details.

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Warp</b></summary>

See [Warp Model Context Protocol Documentation](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server) for details.

1. Navigate `Settings` > `AI` > `Manage MCP servers`.
2. Add a new MCP server by clicking the `+ Add` button.
3. Paste the configuration given below:

```json
{
  "PCS": {
    "url": "http://localhost:3000/mcp",
    "headers": {
      "x-api-key": "YOUR_API_KEY"
    },
    "env": {},
    "working_directory": null,
    "start_on_launch": true
  }
}
```

4. Click `Save` to apply the changes.

</details>

<details>

<summary><b>Install in Copilot Coding Agent</b></summary>

Add the following configuration to the `mcp` section of your Copilot Coding Agent configuration file Repository->Settings->Copilot->Coding agent->MCP configuration:

```json
{
  "mcpServers": {
    "pcs": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

For more information, see the [official GitHub documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

</details>

<details>
<summary><b>Install in Copilot CLI</b></summary>

1.  Open the Copilot CLI MCP config file. The location is `~/.copilot/mcp-config.json` (where `~` is your home directory).
2.  Add the following to the `mcpServers` object in your `mcp-config.json` file:

```json
{
  "mcpServers": {
    "pcs": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

If the `mcp-config.json` file does not exist, create it.

</details>

<details>
<summary><b>Install in LM Studio</b></summary>

See [LM Studio MCP Support](https://lmstudio.ai/blog/lmstudio-v0.3.17) for more information.

1. Navigate to `Program` (right side) > `Install` > `Edit mcp.json`.
2. Paste the configuration given below:

```json
{
  "mcpServers": {
    "PCS": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

3. Click `Save` to apply the changes.
4. Toggle the MCP server on/off from the right hand side, under `Program`, or by clicking the plug icon at the bottom of the chat box.

</details>

<details>
<summary><b>Install in Visual Studio 2022</b></summary>

You can configure Context7 MCP in Visual Studio 2022 by following the [Visual Studio MCP Servers documentation](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).

Add this to your Visual Studio MCP config file (see the [Visual Studio docs](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022) for details):

```json
{
  "inputs": [],
  "servers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

Or, for a local server:

```json
{
  "mcp": {
    "servers": {
      "pcs": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "x-api-key": "YOUR_API_KEY"
        }
      }
    }
  }
}
```

For more information and troubleshooting, refer to the [Visual Studio MCP Servers documentation](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).

</details>

<details>
<summary><b>Install in Crush</b></summary>

Add this to your Crush configuration file. See [Crush MCP docs](https://github.com/charmbracelet/crush#mcps) for more info.

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "pcs": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in BoltAI</b></summary>

Open the "Settings" page of the app, navigate to "Plugins," and enter the following JSON:

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

Once saved, you can use the PCS MCP server for browser automation. More information is available on [BoltAI's Documentation site](https://docs.boltai.com/docs/plugins/mcp-servers). For BoltAI on iOS, [see this guide](https://docs.boltai.com/docs/boltai-mobile/mcp-servers).

</details>

<details>
<summary><b>Install in Rovo Dev CLI</b></summary>

Edit your Rovo Dev CLI MCP config by running the command below -

```bash
acli rovodev mcp
```

Example config -

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zencoder</b></summary>

To configure PCS MCP in Zencoder, follow these steps:

1. Go to the Zencoder menu (...)
2. From the dropdown menu, select Agent tools
3. Click on the Add custom MCP
4. Add the name and server configuration from below, and make sure to hit the Install button

```json
{
  "url": "http://localhost:3000/mcp",
  "headers": {
    "x-api-key": "YOUR_API_KEY"
  }
}
```

Once the MCP server is added, you can easily continue using it.

</details>

<details>
<summary><b>Install in Qodo Gen</b></summary>

See [Qodo Gen docs](https://docs.qodo.ai/qodo-documentation/qodo-gen/qodo-gen-chat/agentic-mode/agentic-tools-mcps) for more details.

1. Open Qodo Gen chat panel in VSCode or IntelliJ.
2. Click Connect more tools.
3. Click + Add new MCP.
4. Add the following configuration:

```json
{
  "mcpServers": {
    "pcs": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Install in Perplexity Desktop</b></summary>

See [Local and Remote MCPs for Perplexity](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity) for more information.

1. Navigate `Perplexity` > `Settings`
2. Select `Connectors`.
3. Click `Add Connector`.
4. Select `Advanced`.
5. Enter Server Name: `PCS`
6. Paste the following JSON in the text area:

```json
{
  "url": "http://localhost:3000/mcp",
  "headers": {
    "x-api-key": "YOUR_API_KEY"
  },
  "env": {}
}
```

7. Click `Save`.
</details>

<details>
<summary><b>Install in Factory</b></summary>

Factory's droid supports MCP servers through its CLI. See [Factory MCP docs](https://docs.factory.ai/cli/configuration/mcp) for more info.

Run this command in your terminal:

```sh
droid mcp add pcs http://localhost:3000/mcp --type http --header "x-api-key: YOUR_API_KEY"
```

Once configured, PCS tools will be available in your droid sessions. Type `/mcp` within droid to manage servers, authenticate, and view available tools.

</details>

## License

MIT License
