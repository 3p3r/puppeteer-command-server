# puppeteer-command-server

Exposes basic browser automation through HTTP and MCP for generative UI apps.

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
- `tabs/bringToFront/:tabId`: brings the tab with the given ID to front
- `tabs/focus/:tabId`: focuses on a specific element via selector in the tab with the given ID
- `tabs/goBack/:tabId`: navigates back in browser history for the tab with the given ID
- `tabs/goForward/:tabId`: navigates forward in browser history for the tab with the given ID
- `tabs/reload/:tabId`: reloads the tab with the given ID
- `tabs/waitForSelector/:tabId`: waits for a selector to appear in the tab with the given ID
- `tabs/waitForFunction/:tabId`: waits for a function to return truthy value in the tab with the given ID
- `tabs/waitForNavigation/:tabId`: waits for navigation to complete in the tab with the given ID
- `tabs/url/:tabId`: gets the current URL of the tab with the given ID

Browser automation happens through Puppeteer. Session management is automatic.

The server is implemented in Express and Typescript and all routes are protected
with a basic api key authentication for now.

To interact and test the MCP server, you can use:

```bash
npx @modelcontextprotocol/inspector
```

And in the UI, ensure "Transport Type" is set to `Streamable HTTP` and also add
the API key in `.secret` to the headers, with key name: `x-api-key`.

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

## Implementation

Code is organized in Object Oriented manner with classes. Logic is maintained at
a level that the code is readable and easy to reason about.

## References

- <https://github.com/expressjs/express>
- <https://github.com/better-auth/better-auth>
- <https://www.better-auth.com/docs/integrations/express>
- <https://www.npmjs.com/package/puppeteer-core>
- <https://github.com/mbalabash/find-chrome-bin>
- <https://github.com/jellydn/next-swagger-doc>
- <https://github.com/vercel/pkg>
- <https://github.com/upx/upx>

## License

MIT License
