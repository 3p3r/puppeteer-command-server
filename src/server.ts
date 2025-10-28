import express from 'express';
// import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { authenticateApiKey } from './auth/index.js';
import { loadConfig } from './config/index.js';
import { tabsRouter, initializeTabsRoutes } from './routes/tabs.js';
import { configRouter } from './routes/config.js';
import { initializeMcpServer } from './mcp/index.js';
import { sseHandlers } from 'express-mcp-handler';

const app = express();

// Load configuration
const config = loadConfig();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Puppeteer Command Server',
      version: '1.0.0',
      description: 'Browser automation server with HTTP and MCP endpoints',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    tags: [
      {
        name: 'Tabs',
        description: 'Browser tab operations',
      },
      {
        name: 'Config',
        description: 'Configuration management',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize browser manager and routes
initializeTabsRoutes(config.chromePath);

// API routes with authentication
app.use('/api/tabs', authenticateApiKey, tabsRouter);
app.use('/api/config', authenticateApiKey, configRouter);

// Reverse proxy for browser tabs
app.use('/proxy/:tabId', authenticateApiKey, (_req, res) => {
  // For now, we'll implement a simple proxy that forwards requests
  // In a full implementation, this would use CDP to proxy through the browser tab
  res.status(501).json({
    success: false,
    error: 'Proxy functionality not yet implemented'
  });
});

// MCP server setup
const mcpServer = initializeMcpServer(config.chromePath);

// MCP handlers with authentication
const mcpHandlers = sseHandlers(
  () => mcpServer,
  {
    onError: (error: Error, sessionId?: string) => {
      console.error(`[MCP][${sessionId || 'unknown'}] Error:`, error);
    },
    onClose: (sessionId: string) => {
      console.log(`[MCP] Session closed: ${sessionId}`);
    },
  }
);

// Apply authentication to MCP endpoints
app.use('/mcp/sse', authenticateApiKey, mcpHandlers.getHandler);
app.use('/mcp/messages', authenticateApiKey, mcpHandlers.postHandler);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Start server
const PORT = process.env['PORT'] || config.port;

app.listen(PORT, () => {
  console.log(`🚀 Puppeteer Command Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
  console.log(`🔧 MCP Endpoint: http://localhost:${PORT}/mcp/sse`);
  console.log(`🔑 API Key generated and saved to .secret`);
});

export default app;
