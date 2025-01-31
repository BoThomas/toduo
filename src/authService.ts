import { Elysia } from 'elysia';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// types
type AuthInfo = { id: string; group: string; name: string }; // TODO: move to a shared types file

// Auth service
let JWKS: any = undefined;
if (process.env.AUTH0_DISABLED === 'true') {
  console.log('** Auth0 disabled, auth running in development mode **');
} else {
  const JWKS_URI = process.env.AUTH0_JWKS_URI || '';
  JWKS = createRemoteJWKSet(new URL(JWKS_URI));
}
// create elysia auth service to use in the elysia app
// use derive to add a scoped function to the Context for usage in route handlers

const authService = new Elysia({ name: 'Service.Auth' }).derive(
  { as: 'scoped' },
  async ({ headers }) => ({
    authenticatedUserInfo: async (): Promise<AuthInfo> => {
      if (process.env.AUTH0_DISABLED === 'true') {
        return { id: 'auth0|123456789', group: 'default', name: 'Testuser' };
      }

      const authHeader = headers?.['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { id: '', group: '', name: '' };
      }
      const token = authHeader.split(' ')[1];
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.AUTH0_ISSUER,
        audience: process.env.AUTH0_AUDIENCE,
      });

      // extract user id
      const id = payload.sub ?? '';

      // extract user name
      const name = headers?.['x-user-name'] || '';

      // extract group permission
      const group = Array.isArray(payload.permissions)
        ? payload.permissions
            .find((p: string) => p.startsWith('group:'))
            ?.split(':')[1] || ''
        : '';

      return { id, group, name };
    },
  }),
);

export default authService;
