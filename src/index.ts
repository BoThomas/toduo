import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import type { BunFile } from "bun";

let tlsConfig: { cert: BunFile; key: BunFile } | undefined = undefined;
if (process.env.NODE_ENV === "development") {
  tlsConfig = {
    cert: Bun.file("./tls/cert.pem"),
    key: Bun.file("./tls/key.pem"),
  };
}

const app = new Elysia({
  serve: {
    tls: tlsConfig,
  },
});

if (process.env.NODE_ENV === "development") {
  // DEV: serve a simple message
  app.get("/", async () => {
    return "App running in development mode, frontend is served separately.";
  });
} else {
  // PROD: serve the frontend statically from the dist folder
  app
    .use(
      staticPlugin({
        assets: "./frontend/dist",
        prefix: "",
      })
    )
    .get("/", async () => {
      return Bun.file("./frontend/dist/index.html");
    });
}

app.listen(process.env.PORT || 3000);
console.log(`\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`);
