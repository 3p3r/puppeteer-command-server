import crypto from 'node:crypto';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { statelessHandler } from 'express-mcp-handler';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createAuthMiddleware } from './auth/index.js';
import { loadConfig } from './config/index.js';
import { initializeMcpServer } from './mcp/index.js';
import { initializeTabsRoutes, tabsRouter } from './routes/tabs.js';
import { resourcesRouter } from './routes/resources.js';

// JWT verification script for /jwt-verify endpoint
const JWT_VERIFY_SCRIPT = `
import { createRemoteJWKSet, jwtVerify } from '/jose/index.js';

globalThis.doVerifyJWTInBrowser = async function(token, config) {
  if (!config || !config.jwksUrl) {
    return false;
  }
  
  try {
    const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
    const verifyOptions = {};
    
    if (config.issuer) {
      verifyOptions.issuer = config.issuer;
    }
    
    if (config.audience) {
      verifyOptions.audience = config.audience;
    }
    
    await jwtVerify(token, JWKS, verifyOptions);
    return true;
  } catch (error) {
    console.debug('JWT verification failed in browser:', error);
    return false;
  }
};
`;

// Calculate SHA-256 hash of the script for CSP
const JWT_VERIFY_SCRIPT_HASH = `'sha256-${crypto.createHash('sha256').update(JWT_VERIFY_SCRIPT).digest('base64')}'`;

const app = express();

app.use(morgan('combined'));
app.use(
  cors({
    origin: true,
    methods: '*',
    allowedHeaders: 'Authorization, Origin, Content-Type, Accept, *'
  })
);
app.options('*', cors());

const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives();
// biome-ignore lint/performance/noDelete: swagger won't work otherwise.
delete cspDefaults['upgrade-insecure-requests'];

// Add JWT verification script hash to existing script-src directive
const existingScriptSrc = cspDefaults['script-src'] || ["'self'"];
cspDefaults['script-src'] = [
  ...existingScriptSrc,
  // Allow inline script in /jwt-verify endpoint (hash calculated dynamically)
  JWT_VERIFY_SCRIPT_HASH
];

// fixes swagger ui in prod
// https://github.com/scottie1984/swagger-ui-express/issues/237
app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDefaults }
  })
);

// Load configuration
const config = loadConfig();

// Create authentication middleware
const authenticate = createAuthMiddleware(config);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const baseApiSearchPath = path.resolve(__dirname, '../src/routes');

// Swagger configuration
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Puppeteer Command Server',
      version: '1.0.0',
      description: 'Browser automation server with HTTP and MCP endpoints'
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key authentication (enabled by default)'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT Bearer token authentication (disabled by default, configure in config.json)'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      },
      {
        BearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Tabs',
        description: 'Browser tab operations'
      },
      {
        name: 'Resources',
        description: 'Screenshot resource management'
      }
    ]
  },
  apis: [`${baseApiSearchPath}/*.ts`]
});

// Swagger documentation
app.use(
  '/docs',
  express.static(path.resolve(__dirname, '../node_modules/swagger-ui-dist/'), { index: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Serve the swagger spec JSON
app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Serve jose browser modules for JWT verification
app.use('/jose', express.static(path.resolve(__dirname, '../node_modules/jose/dist/browser')));

// JWT verification endpoint (must be public, before auth middleware)
app.get('/jwt-verify', (_req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>JWT Verification</title>
</head>
<body>
  <script type="module">${JWT_VERIFY_SCRIPT}</script>
</body>
</html>`;
  res.send(html);
});

// Initialize browser manager and routes
initializeTabsRoutes(config.chromePath);

// API routes with authentication
app.use('/api/tabs', authenticate, tabsRouter);
app.use('/api/resources', authenticate, resourcesRouter);

// MCP server setup
const mcpServerFactory = () => initializeMcpServer(config.chromePath);

// Apply authentication to MCP endpoints
app.post(
  '/mcp',
  authenticate,
  statelessHandler(mcpServerFactory, {
    onError: (error: Error) => {
      console.error(`[MCP] Error: ${error.message}`);
    },
    onClose: () => {
      console.log('[MCP] Connection closed.');
    }
  })
);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use(
  (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', error);

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Puppeteer Command Server running on port ${config.port}`);
  console.log(`📚 API Documentation: http://localhost:${config.port}/docs`);
  console.log(`🔧 MCP Endpoint: http://localhost:${config.port}/mcp`);
  console.log('🔑 API Key generated and saved to .secret');
});

export default app;
