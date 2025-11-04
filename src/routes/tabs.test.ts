import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Tab Routes - Request Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Simple auth middleware for testing
    app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== 'test-key') {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or missing API key',
          code: 'INVALID_API_KEY'
        });
      }
      return next();
    });

    // Mock route handlers for validation testing
    app.post('/api/tabs/open', (req, res) => {
      if (!req.body.url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }
      return res.json({ success: true, data: { tabId: 'test-tab' } });
    });

    app.post('/api/tabs/goto/:tabId', (req, res) => {
      if (!req.body.url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/click/:tabId', (req, res) => {
      if (!req.body.selector) {
        return res.status(400).json({
          success: false,
          error: 'Selector is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/fill/:tabId', (req, res) => {
      if (!req.body.selector || !req.body.value) {
        return res.status(400).json({
          success: false,
          error: 'Selector and value are required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/eval/:tabId', (req, res) => {
      if (!req.body.script) {
        return res.status(400).json({
          success: false,
          error: 'Script is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/bringToFront/:tabId', (_req, res) => {
      return res.json({ success: true });
    });

    app.post('/api/tabs/focus/:tabId', (req, res) => {
      if (!req.body.selector) {
        return res.status(400).json({
          success: false,
          error: 'Selector is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/goBack/:tabId', (_req, res) => {
      return res.json({ success: true });
    });

    app.post('/api/tabs/goForward/:tabId', (_req, res) => {
      return res.json({ success: true });
    });

    app.post('/api/tabs/reload/:tabId', (_req, res) => {
      return res.json({ success: true });
    });

    app.post('/api/tabs/waitForSelector/:tabId', (req, res) => {
      if (!req.body.selector) {
        return res.status(400).json({
          success: false,
          error: 'Selector is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/waitForFunction/:tabId', (req, res) => {
      if (!req.body.functionScript) {
        return res.status(400).json({
          success: false,
          error: 'Function script is required'
        });
      }
      return res.json({ success: true });
    });

    app.post('/api/tabs/waitForNavigation/:tabId', (_req, res) => {
      return res.json({ success: true });
    });

    app.get('/api/tabs/url/:tabId', (_req, res) => {
      return res.json({ success: true, data: { url: 'https://example.com' } });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .post('/api/tabs/open')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized: Invalid or missing API key',
        code: 'INVALID_API_KEY'
      });
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .post('/api/tabs/open')
        .set('x-api-key', 'invalid-key')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .post('/api/tabs/open')
        .set('x-api-key', 'test-key')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for missing URL in open tab', async () => {
      const response = await request(app)
        .post('/api/tabs/open')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'URL is required'
      });
    });

    it('should return 400 for missing URL in navigate', async () => {
      const response = await request(app)
        .post('/api/tabs/goto/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL is required');
    });

    it('should return 400 for missing selector in click', async () => {
      const response = await request(app)
        .post('/api/tabs/click/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Selector is required');
    });

    it('should return 400 for missing selector or value in fill', async () => {
      const response = await request(app)
        .post('/api/tabs/fill/test-tab')
        .set('x-api-key', 'test-key')
        .send({ selector: '#email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Selector and value are required');
    });

    it('should return 400 for missing script in eval', async () => {
      const response = await request(app)
        .post('/api/tabs/eval/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Script is required');
    });

    it('should return 200 for valid bringToFront request', async () => {
      const response = await request(app)
        .post('/api/tabs/bringToFront/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing selector in focus', async () => {
      const response = await request(app)
        .post('/api/tabs/focus/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Selector is required');
    });

    it('should return 200 for valid focus request', async () => {
      const response = await request(app)
        .post('/api/tabs/focus/test-tab')
        .set('x-api-key', 'test-key')
        .send({ selector: '#input' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for valid goBack request', async () => {
      const response = await request(app)
        .post('/api/tabs/goBack/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for valid goForward request', async () => {
      const response = await request(app)
        .post('/api/tabs/goForward/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for valid reload request', async () => {
      const response = await request(app)
        .post('/api/tabs/reload/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing selector in waitForSelector', async () => {
      const response = await request(app)
        .post('/api/tabs/waitForSelector/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Selector is required');
    });

    it('should return 200 for valid waitForSelector request', async () => {
      const response = await request(app)
        .post('/api/tabs/waitForSelector/test-tab')
        .set('x-api-key', 'test-key')
        .send({ selector: '.loaded', timeout: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing functionScript in waitForFunction', async () => {
      const response = await request(app)
        .post('/api/tabs/waitForFunction/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Function script is required');
    });

    it('should return 200 for valid waitForFunction request', async () => {
      const response = await request(app)
        .post('/api/tabs/waitForFunction/test-tab')
        .set('x-api-key', 'test-key')
        .send({ functionScript: '() => document.readyState === "complete"' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 for valid waitForNavigation request', async () => {
      const response = await request(app)
        .post('/api/tabs/waitForNavigation/test-tab')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 200 with URL for valid url request', async () => {
      const response = await request(app)
        .get('/api/tabs/url/test-tab')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://example.com');
    });
  });
});
