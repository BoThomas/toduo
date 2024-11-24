import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Context } from 'elysia';

const JWKS = createRemoteJWKSet(
  new URL('https://thmsdev.eu.auth0.com/.well-known/jwks.json'),
);

export const authMiddleware = async (ctx: Context) => {
  const authHeader = ctx.headers?.['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ctx.error(401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://thmsdev.eu.auth0.com/',
      audience: 'toduo-backend-api',
    });

    // @ts-ignore (elysia decorator to complicated :D)
    ctx.userId = payload.sub;

    console.log('Authenticated as:', payload.sub);
  } catch (err) {
    return ctx.error(401);
  }
};
