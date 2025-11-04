import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_IMAGES } from './resources.js';

describe('Resources Routes - Request Validation', () => {
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
    app.delete('/api/resources/clean', (req, res) => {
      const { uri } = req.body;

      if (!uri) {
        return res.status(400).json({
          success: false,
          error: 'URI is required'
        });
      }

      const existed = ALL_IMAGES.has(uri);
      ALL_IMAGES.delete(uri);

      return res.json({
        success: true,
        data: { removed: existed }
      });
    });

    app.delete('/api/resources/cleanAll', (_req, res) => {
      const count = ALL_IMAGES.size;
      ALL_IMAGES.clear();

      return res.json({
        success: true,
        data: { count }
      });
    });

    // Clear ALL_IMAGES before each test
    ALL_IMAGES.clear();
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app).delete('/api/resources/clean').send({ uri: 'test-uri' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized: Invalid or missing API key',
        code: 'INVALID_API_KEY'
      });
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .delete('/api/resources/clean')
        .set('x-api-key', 'invalid-key')
        .send({ uri: 'test-uri' });

      expect(response.status).toBe(401);
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .delete('/api/resources/clean')
        .set('x-api-key', 'test-key')
        .send({ uri: 'test-uri' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Clean Resource', () => {
    it('should return 400 for missing URI', async () => {
      const response = await request(app)
        .delete('/api/resources/clean')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'URI is required'
      });
    });

    it('should return success when URI does not exist', async () => {
      const response = await request(app)
        .delete('/api/resources/clean')
        .set('x-api-key', 'test-key')
        .send({ uri: 'non-existent-uri' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { removed: false }
      });
    });

    it('should remove existing URI and return success', async () => {
      // Add a mock resource
      const testUri = 'mcp://browser_screenshots/test-tab/123.png';
      ALL_IMAGES.set(testUri, {
        list: { uri: testUri, name: 'Test', mimeType: 'image/png' },
        read: { uri: testUri, name: 'Test', mimeType: 'image/png', blob: 'base64data' }
      });

      const response = await request(app)
        .delete('/api/resources/clean')
        .set('x-api-key', 'test-key')
        .send({ uri: testUri });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { removed: true }
      });
      expect(ALL_IMAGES.has(testUri)).toBe(false);
    });
  });

  describe('Clean All Resources', () => {
    it('should return success with count of 0 when no resources exist', async () => {
      const response = await request(app)
        .delete('/api/resources/cleanAll')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { count: 0 }
      });
    });

    it('should clear all resources and return correct count', async () => {
      // Add multiple mock resources
      ALL_IMAGES.set('uri1', {
        list: { uri: 'uri1', name: 'Test1', mimeType: 'image/png' },
        read: { uri: 'uri1', name: 'Test1', mimeType: 'image/png', blob: 'data1' }
      });
      ALL_IMAGES.set('uri2', {
        list: { uri: 'uri2', name: 'Test2', mimeType: 'image/png' },
        read: { uri: 'uri2', name: 'Test2', mimeType: 'image/png', blob: 'data2' }
      });
      ALL_IMAGES.set('uri3', {
        list: { uri: 'uri3', name: 'Test3', mimeType: 'image/png' },
        read: { uri: 'uri3', name: 'Test3', mimeType: 'image/png', blob: 'data3' }
      });

      expect(ALL_IMAGES.size).toBe(3);

      const response = await request(app)
        .delete('/api/resources/cleanAll')
        .set('x-api-key', 'test-key')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { count: 3 }
      });
      expect(ALL_IMAGES.size).toBe(0);
    });
  });
});
