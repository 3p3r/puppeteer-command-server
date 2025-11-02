import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class BrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserError';
  }
}

export class TabNotFoundError extends Error {
  constructor(tabId: string) {
    super(`Tab with ID ${tabId} not found`);
    this.name = 'TabNotFoundError';
  }
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function loadApiKey(): string {
  const secretPath = path.join(process.cwd(), '.secret');
  
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (error) {
      console.warn('Failed to read .secret file, generating new key:', error);
      const apiKey = generateApiKey();
      fs.writeFileSync(secretPath, apiKey);
      return apiKey;
    }
  }
  
  const apiKey = generateApiKey();
  fs.writeFileSync(secretPath, apiKey);
  return apiKey;
}

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  // Check both lowercase and original case headers
  const providedKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  const validKey = loadApiKey();
  
  if (!providedKey || providedKey !== validKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }
  
  next();
}

loadApiKey(); // Ensure API key is loaded on module import
