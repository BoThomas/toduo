Frontend root: /frontend
Frontend tech-stack:
Framework: Vue.js, UI Components: PrimeVue, Routing: Vue Router, Authentication: Auth0, Build Tool: Vite, Styling: PrimeVue defaults with Tailwind CSS

Backend root: /
Backend tech-stack:
Framework: Elysia, Runtime: Bun, ORM: Drizzle, Database: SQLite, Authentication: Auth0

The backend serves the frontend in production mode. The frontend is built and its static files are served by the backend using the staticPlugin from @elysiajs/static.
The frontend relies on the backend for API endpoints,
Authentication is handled via Auth0, and both frontend and backend need to be configured to work with Auth0 for secure authentication and authorization.
