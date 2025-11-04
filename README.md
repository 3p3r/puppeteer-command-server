# puppeteer-command-server

Exposes basic browser automation through HTTP and MCP for generative UI apps.

- [Methodology](#methodology)
- [Authentication](#authentication)
  - [1. API Key Authentication (Default: Enabled)](#1-api-key-authentication-default-enabled)
  - [2. JWT Bearer Token Authentication (Default: Disabled)](#2-jwt-bearer-token-authentication-default-disabled)
  - [MCP Server Authentication](#mcp-server-authentication)
- [Platforms](#platforms)
- [Distribution](#distribution)
- [Environment](#environment)
- [Development](#development)
  - [Building Binaries](#building-binaries)
- [Implementation](#implementation)
- [References](#references)
- [License](#license)

## Methodology

This project on launch exposes the following endpoints:

- a RESTful API HTTP server
- a Swagger docs server
- a MCP server

For example:

- `http://localhost:3000/api`: the RESTful API
- `http://localhost:3000/mcp`: the MCP endpoint
- `http://localhost:3000/docs`: the Swagger docs endpoint

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

Both strategies can be enabled simultaneously. If both are enabled, either valid
API key OR valid JWT token will grant access.

### MCP Server Authentication

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

## License

MIT License
