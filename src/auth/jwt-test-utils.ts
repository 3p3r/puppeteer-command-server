import express from 'express';
import type { Server } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { JWK, KeyLike } from 'jose';

export interface TestKeyPair {
  publicKey: KeyLike;
  privateKey: KeyLike;
}

export interface JWKSServerInfo {
  server: Server;
  url: string;
  port: number;
  close: () => Promise<void>;
}

export interface TokenOptions {
  issuer?: string;
  audience?: string;
  expiresIn?: string | number; // seconds or time string
  notBefore?: number; // timestamp
  subject?: string;
  additionalClaims?: Record<string, any>;
}

/**
 * Generate an RSA key pair for testing
 */
export async function generateTestKeyPair(): Promise<TestKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  return { publicKey, privateKey };
}

/**
 * Create JWKS JSON from a public key
 */
export async function createJWKS(publicKey: KeyLike): Promise<{ keys: JWK[] }> {
  const jwk = await exportJWK(publicKey);
  // Add required JWKS fields
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'test-key-id';

  return {
    keys: [jwk]
  };
}

/**
 * Sign a JWT token with the given private key and options
 */
export async function signToken(privateKey: KeyLike, options: TokenOptions = {}): Promise<string> {
  const {
    issuer = 'https://test-issuer.example.com',
    audience = 'https://test-audience.example.com',
    expiresIn = 3600, // 1 hour default
    notBefore,
    subject = 'test-user',
    additionalClaims = {}
  } = options;

  let jwt = new SignJWT({
    ...additionalClaims
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuedAt()
    .setSubject(subject);

  if (issuer) {
    jwt = jwt.setIssuer(issuer);
  }

  if (audience) {
    jwt = jwt.setAudience(audience);
  }

  if (expiresIn) {
    if (typeof expiresIn === 'number') {
      jwt = jwt.setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn);
    } else {
      jwt = jwt.setExpirationTime(expiresIn);
    }
  }

  if (notBefore !== undefined) {
    jwt = jwt.setNotBefore(notBefore);
  }

  return await jwt.sign(privateKey);
}

/**
 * Create a mock JWKS HTTP server
 */
export async function createJWKSServer(publicKey: KeyLike): Promise<JWKSServerInfo> {
  const app = express();
  const jwks = await createJWKS(publicKey);

  app.get('/.well-known/jwks.json', (_req, res) => {
    res.json(jwks);
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server port'));
        return;
      }

      const port = address.port;
      const url = `http://localhost:${port}/.well-known/jwks.json`;

      resolve({
        server,
        url,
        port,
        close: () => {
          return new Promise((resolveClose, rejectClose) => {
            server.close(err => {
              if (err) {
                rejectClose(err);
              } else {
                resolveClose();
              }
            });
          });
        }
      });
    });

    server.on('error', reject);
  });
}
