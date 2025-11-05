import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { generateApiKey, loadApiKey, createAuthMiddleware } from './index.js';
import type { Config } from '../types/index.js';

// Mock fs module
vi.mock('fs');

// Mock jose module - only mock for unit tests, preserve real implementations
vi.mock('jose', async importOriginal => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(() => vi.fn()),
    jwtVerify: vi.fn()
  };
});

const mockFs = vi.mocked(fs);

describe('Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate 64-character hex API keys', () => {
      const key = generateApiKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique keys on multiple calls', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('loadApiKey', () => {
    it('should create and save new API key when .secret does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const key = loadApiKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), '.secret'),
        expect.any(String)
      );
    });

    it('should load existing API key from .secret file', () => {
      const existingKey = 'a'.repeat(64);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingKey);

      const key = loadApiKey();

      expect(key).toBe(existingKey);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(path.join(process.cwd(), '.secret'), 'utf8');
    });

    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const key = loadApiKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('createAuthMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      jsonMock = vi.fn();
      statusMock = vi.fn(() => ({ json: jsonMock }));

      mockReq = {
        headers: {}
      };
      mockRes = {
        status: statusMock,
        json: jsonMock
      };
      mockNext = vi.fn();

      // Mock loadApiKey to return a consistent test key
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        'test-key-1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    describe('API Key Authentication', () => {
      it('should accept valid API key (default enabled)', async () => {
        const config: Config = { chromePath: null, port: 3000 };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = {
          'x-api-key': 'test-key-1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should accept valid API key with uppercase header', async () => {
        const config: Config = { chromePath: null, port: 3000 };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = {
          'X-API-KEY': 'test-key-1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should reject invalid API key', async () => {
        const config: Config = { chromePath: null, port: 3000 };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = { 'x-api-key': 'invalid-key' };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Unauthorized'),
            code: 'INVALID_CREDENTIALS'
          })
        );
      });

      it('should reject missing API key', async () => {
        const config: Config = { chromePath: null, port: 3000 };
        const middleware = createAuthMiddleware(config);

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
      });

      it('should respect disabled API key auth', async () => {
        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: false }
          }
        };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = {
          'x-api-key': 'test-key-1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'NO_AUTH_CONFIGURED'
          })
        );
      });
    });

    describe('JWT Authentication', () => {
      it('should reject JWT when JWT auth is disabled (default)', async () => {
        const config: Config = { chromePath: null, port: 3000 };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = { authorization: 'Bearer valid-jwt-token' };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
      });

      it('should accept valid JWT when enabled', async () => {
        const { jwtVerify } = await import('jose');
        vi.mocked(jwtVerify).mockResolvedValue({ payload: {}, protectedHeader: {} } as any);

        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: false },
            jwt: {
              enabled: true,
              jwksUrl: 'https://example.com/.well-known/jwks.json',
              issuer: 'https://example.com',
              audience: 'https://api.example.com'
            }
          }
        };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = { authorization: 'Bearer valid-jwt-token' };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should reject invalid JWT', async () => {
        const { jwtVerify } = await import('jose');
        vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'));

        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: false },
            jwt: {
              enabled: true,
              jwksUrl: 'https://example.com/.well-known/jwks.json'
            }
          }
        };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = { authorization: 'Bearer invalid-jwt-token' };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
      });

      it('should reject malformed Authorization header', async () => {
        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: false },
            jwt: {
              enabled: true,
              jwksUrl: 'https://example.com/.well-known/jwks.json'
            }
          }
        };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = { authorization: 'InvalidFormat' };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
      });
    });

    describe('Multiple Authentication Strategies', () => {
      it('should accept either valid API key or valid JWT when both enabled', async () => {
        const { jwtVerify } = await import('jose');
        vi.mocked(jwtVerify).mockResolvedValue({ payload: {}, protectedHeader: {} } as any);

        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: true },
            jwt: {
              enabled: true,
              jwksUrl: 'https://example.com/.well-known/jwks.json'
            }
          }
        };
        const middleware = createAuthMiddleware(config);

        // Test with valid JWT
        mockReq.headers = { authorization: 'Bearer valid-jwt-token' };
        await middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);

        // Reset mocks
        vi.clearAllMocks();
        jsonMock = vi.fn();
        statusMock = vi.fn(() => ({ json: jsonMock }));
        mockRes.status = statusMock;
        mockNext = vi.fn();

        // Test with valid API key
        mockReq.headers = {
          'x-api-key': 'test-key-1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        };
        await middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
      });

      it('should reject when both strategies fail', async () => {
        const { jwtVerify } = await import('jose');
        vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'));

        const config: Config = {
          chromePath: null,
          port: 3000,
          auth: {
            apiKey: { enabled: true },
            jwt: {
              enabled: true,
              jwksUrl: 'https://example.com/.well-known/jwks.json'
            }
          }
        };
        const middleware = createAuthMiddleware(config);

        mockReq.headers = {
          'x-api-key': 'invalid-key',
          authorization: 'Bearer invalid-jwt'
        };

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('API key'),
            code: 'INVALID_CREDENTIALS'
          })
        );
      });
    });
  });
});

// Integration Tests with Real JWT Verification
describe('JWT Authentication - Integration Tests', () => {
  let keyPair: Awaited<ReturnType<typeof import('./jwt-test-utils').generateTestKeyPair>>;
  let jwksServer: Awaited<ReturnType<typeof import('./jwt-test-utils').createJWKSServer>>;
  let jwksUrl: string;

  beforeAll(async () => {
    // Get real jose implementations
    const realJose = await vi.importActual<typeof import('jose')>('jose');

    // Replace mocks with real implementations for integration tests
    vi.mocked(await import('jose')).createRemoteJWKSet = realJose.createRemoteJWKSet;
    vi.mocked(await import('jose')).jwtVerify = realJose.jwtVerify;

    // Import test utilities
    const { generateTestKeyPair, createJWKSServer } = await import('./jwt-test-utils.js');

    // Generate RSA key pair
    keyPair = await generateTestKeyPair();

    // Start JWKS server
    jwksServer = await createJWKSServer(keyPair.publicKey);
    jwksUrl = jwksServer.url;
  });

  afterAll(async () => {
    // Stop JWKS server
    if (jwksServer) {
      await jwksServer.close();
    }
  });

  it('should verify valid JWT with all claims', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    const issuer = 'https://test-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    const token = await signToken(keyPair.privateKey, {
      issuer,
      audience,
      expiresIn: 3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject expired JWT token', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    const issuer = 'https://test-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    // Create token that expired 1 hour ago
    const token = await signToken(keyPair.privateKey, {
      issuer,
      audience,
      expiresIn: -3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should reject JWT with wrong issuer', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    const expectedIssuer = 'https://expected-issuer.example.com';
    const actualIssuer = 'https://wrong-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    const token = await signToken(keyPair.privateKey, {
      issuer: actualIssuer,
      audience,
      expiresIn: 3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer: expectedIssuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should reject JWT with wrong audience', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    const issuer = 'https://test-issuer.example.com';
    const expectedAudience = 'https://expected-audience.example.com';
    const actualAudience = 'https://wrong-audience.example.com';

    const token = await signToken(keyPair.privateKey, {
      issuer,
      audience: actualAudience,
      expiresIn: 3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer,
          audience: expectedAudience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should reject JWT with invalid signature', async () => {
    const { signToken, generateTestKeyPair } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    // Generate a different key pair
    const differentKeyPair = await generateTestKeyPair();

    const issuer = 'https://test-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    // Sign with different private key
    const token = await signToken(differentKeyPair.privateKey, {
      issuer,
      audience,
      expiresIn: 3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl, // Points to JWKS with original public key
          issuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should reject malformed JWT token', async () => {
    const { createAuthMiddleware } = await import('./index.js');

    const issuer = 'https://test-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    const malformedToken = 'this.is.not.a.valid.jwt';

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${malformedToken}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should verify JWT without optional issuer/audience when not required', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    // Sign token without specific issuer/audience constraints
    const token = await signToken(keyPair.privateKey, {
      issuer: 'https://any-issuer.example.com',
      audience: 'https://any-audience.example.com',
      expiresIn: 3600
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl
          // No issuer/audience requirements
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject JWT with future notBefore claim', async () => {
    const { signToken } = await import('./jwt-test-utils.js');
    const { createAuthMiddleware } = await import('./index.js');

    const issuer = 'https://test-issuer.example.com';
    const audience = 'https://test-audience.example.com';

    // Set notBefore to 1 hour in the future
    const futureTime = Math.floor(Date.now() / 1000) + 3600;

    const token = await signToken(keyPair.privateKey, {
      issuer,
      audience,
      expiresIn: 7200, // expires in 2 hours
      notBefore: futureTime
    });

    const config: Config = {
      chromePath: null,
      port: 3000,
      auth: {
        apiKey: { enabled: false },
        jwt: {
          enabled: true,
          jwksUrl,
          issuer,
          audience
        }
      }
    };

    const middleware = createAuthMiddleware(config);
    const mockReq = { headers: { authorization: `Bearer ${token}` } } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const mockNext = vi.fn();

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
