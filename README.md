# puppeteer-command-server

Exposes basic browser automation through HTTP and MCP

## Methodology

This project on launch exposes three functional endpoints:

- a reverse HTTP proxy to browser tabs
- a RESTful HTTP server
- a MCP server

For example:

- `http://localhost:3000/api`: the RESTful API
- `http://localhost:3000/mcp`: the MCP endpoint
- `http://localhost:3000/proxy/:tabId/:requestUrl`: the reverse HTTP proxy URL to the tab with the given ID

Port is configurable with the `PORT` environment variable (default: `3000`).

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
- `config/get`: gets the current configuration (e.g., Chrome path)
- `config/set`: sets configuration options (e.g., Chrome path)

Browser automation happens through Puppeteer. Session management is automatic.

A Swagger endpoint is available at `/docs` for easy exploration of the RESTful API.

The server is implemented in Express and Typescript and all routes are protected
with authentication. All routes are protected with better-auth.

Strategy of better-auth is a simple static list of users for now.

## Platforms

Windows, WSL, Linux, and MacOS.

- `pcs.exe` for Windows
- `pcs` for WSL, Linux, and MacOS

## Distribution

The project is coded in Typescript and compiled into native binaries using Nexe.

When Nexe is used to compile the project, executables are generated for Windows,
Linux, and MacOS operating systems. The Linux binary runs on WSL as well.

After that, the executables are compressed and obfuscated to reduce size and
create unique signatures for production.

Resulting binaries are entirely self-contained and do not require any external
dependencies beyond the target platform's standard libraries.

## Implementation

Code is organized in Object Oriented manner with classes. Logic is maintained at
a level that the code is readable and easy to reason about.

## References

- <https://github.com/expressjs/express>
- <https://github.com/http-party/node-http-proxy>
- <https://github.com/better-auth/better-auth>
- <https://www.better-auth.com/docs/integrations/express>
- <https://www.npmjs.com/package/puppeteer-core>
- <https://github.com/mbalabash/find-chrome-bin>
- <https://github.com/jellydn/next-swagger-doc>
- <https://github.com/nexe/nexe>
- <https://github.com/upx/upx>

## License

MIT License
