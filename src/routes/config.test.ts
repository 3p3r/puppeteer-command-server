import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { configRouter } from './config.js';
import { authenticateApiKey } from '../auth/index.js';
import { loadConfig, updateConfig } from '../config/index.js';

// Mock dependencies
vi.mock('../auth/index.js');
vi.mock('../config/index.js');

const mockAuthenticateApiKey = vi.mocked(authenticateApiKey);
const mockLoadConfig = vi.mocked(loadConfig);
const mockUpdateConfig = vi.mocked(updateConfig);

describe('Config Routes', () => {
  let app: express.Application;
  let apiKey: string;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup auth mock
    apiKey = 'test-api-key-123';
    mockAuthenticateApiKey.mockImplementation((req, res, next) => {
      const providedKey = req.headers['x-api-key'];
      if (providedKey !== apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or missing API key',
          code: 'INVALID_API_KEY'
        });
      }
      return next();
    });

    // Setup config mock
    mockLoadConfig.mockReturnValue({
      chromePath: '/usr/bin/chrome',
      port: 3000
    });

    mockUpdateConfig.mockImplementation(updates => ({
      chromePath: updates.chromePath ?? '/usr/bin/chrome',
      port: updates.port ?? 3000
    }));

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/config', authenticateApiKey, configRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/config/get', () => {
    it('should return current config', async () => {
      const mockConfig = { chromePath: '/usr/bin/chrome', port: 3000 };
      mockLoadConfig.mockReturnValue(mockConfig);

      const response = await request(app).get('/api/config/get').set('x-api-key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockConfig
      });
    });

    it('should reject requests without API key', async () => {
      const response = await request(app).get('/api/config/get');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized: Invalid or missing API key',
        code: 'INVALID_API_KEY'
      });
    });
  });

  describe('POST /api/config/set', () => {
    it('should update config successfully', async () => {
      const updatedConfig = { chromePath: '/new/chrome/path', port: 4000 };
      mockUpdateConfig.mockReturnValue(updatedConfig);

      const response = await request(app)
        .post('/api/config/set')
        .set('x-api-key', apiKey)
        .send({ chromePath: '/new/chrome/path', port: 4000 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: updatedConfig
      });
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        chromePath: '/new/chrome/path',
        port: 4000
      });
    });

    it('should validate port range', async () => {
      const response = await request(app)
        .post('/api/config/set')
        .set('x-api-key', apiKey)
        .send({ port: 70000 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Port must be between 1 and 65535');
    });

    it('should handle partial updates', async () => {
      const updatedConfig = { chromePath: '/usr/bin/chrome', port: 4000 };
      mockUpdateConfig.mockReturnValue(updatedConfig);

      const response = await request(app)
        .post('/api/config/set')
        .set('x-api-key', apiKey)
        .send({ port: 4000 });

      expect(response.status).toBe(200);
      expect(mockUpdateConfig).toHaveBeenCalledWith({ port: 4000 });
    });

    it('should reject requests without API key', async () => {
      const response = await request(app).post('/api/config/set').send({ port: 4000 });

      expect(response.status).toBe(401);
    });
  });
});
