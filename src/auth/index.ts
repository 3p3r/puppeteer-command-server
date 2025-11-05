import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import createDebug from 'debug';
import { BrowserManagerSingleton } from '../browser/BrowserManager';
import type { Config } from '../types';

const debug = createDebug('pcs:auth');

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function loadApiKey(): string {
  const secretPath = path.join(process.cwd(), '.secret');

  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (error) {
      debug('Failed to read .secret file, generating new key: %O', error);
      const apiKey = generateApiKey();
      try {
        fs.writeFileSync(secretPath, apiKey);
      } catch (writeError) {
        debug('Failed to write .secret file: %O', writeError);
      }
      return apiKey;
    }
  }

  const apiKey = generateApiKey();
  try {
    fs.writeFileSync(secretPath, apiKey);
  } catch (error) {
    debug('Failed to write new .secret file: %O', error);
  }
  return apiKey;
}

async function verifyJWTInBrowser(
  token: string,
  config: NonNullable<Config['auth']>['jwt'],
  port: number
): Promise<boolean> {
  const browserManager = BrowserManagerSingleton();
  const verifyUrl = `http://localhost:${port}/jwt-verify`;

  try {
    // todo: reuse tab if possible or integrate with token's timeout duration
    const tabId = await browserManager.openTab({
      url: verifyUrl,
      headless: true
    });

    const page = browserManager.getPageByTabId(tabId);

    if (!page) {
      throw new Error('Failed to get page for JWT verification');
    }

    const resultText = await page.evaluate(
      async (token, config) => {
        const r = await (globalThis as any).doVerifyJWTInBrowser(token, config);
        return r ? 'valid' : 'invalid';
      },
      token,
      config
    );

    await browserManager.closeTab(tabId);

    return resultText === 'valid';
  } catch (error) {
    debug('JWT verification in browser failed: %O', error);
    return false;
  }
}

async function verifyJWTInProcess(
  token: string,
  config: NonNullable<Config['auth']>['jwt']
): Promise<boolean> {
  if (!config || !config.jwksUrl) {
    return false;
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
    const verifyOptions: Parameters<typeof jwtVerify>[2] = {};

    if (config.issuer) {
      verifyOptions.issuer = config.issuer;
    }

    if (config.audience) {
      verifyOptions.audience = config.audience;
    }

    await jwtVerify(token, JWKS, verifyOptions);
    return true;
  } catch (error) {
    debug('JWT verification failed: %O', error);
    return false;
  }
}

function verifyApiKey(providedKey: string): boolean {
  const validKey = loadApiKey();
  return providedKey === validKey;
}

export function createAuthMiddleware(config: Config) {
  const apiKeyEnabled = config.auth?.apiKey?.enabled !== false; // default true
  const jwtEnabled = config.auth?.jwt?.enabled === true; // default false

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authStrategies: Array<() => Promise<boolean>> = [];

    // API Key strategy
    if (apiKeyEnabled) {
      authStrategies.push(async () => {
        const providedKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
        if (providedKey && verifyApiKey(providedKey)) {
          return true;
        }
        return false;
      });
    }

    // JWT strategy
    if (jwtEnabled && config.auth?.jwt) {
      authStrategies.push(async () => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          if (config?.auth?.jwt?.proxy) {
            return await verifyJWTInBrowser(token, config.auth!.jwt!, config.port);
          }
          return await verifyJWTInProcess(token, config.auth!.jwt!);
        }
        return false;
      });
    }

    // If no strategies are enabled, deny access
    if (authStrategies.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: No authentication methods configured',
        code: 'NO_AUTH_CONFIGURED'
      });
      return;
    }

    // Try all enabled strategies
    let authenticated = false;
    for (const strategy of authStrategies) {
      if (await strategy()) {
        authenticated = true;
        break;
      }
    }

    if (!authenticated) {
      const methods: string[] = [];
      if (apiKeyEnabled) methods.push('API key (x-api-key header)');
      if (jwtEnabled) methods.push('JWT Bearer token');

      res.status(401).json({
        success: false,
        error: `Unauthorized: Invalid or missing credentials. Supported methods: ${methods.join(', ')}`,
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }

    next();
  };
}

// Ensure API key is loaded on module import
loadApiKey();
