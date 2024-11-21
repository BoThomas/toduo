import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";

const app = new Elysia({
  serve: {
    tls:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            cert: Bun.file("./tls/cert.pem"),
            key: Bun.file("./tls/key.pem"),
          },
  },
})
  .use(
    staticPlugin({
      assets: "./frontend/dist",
      prefix: "",
    })
  )
  .get("/", async () => {
    return Bun.file("./frontend/dist/index.html");
  })
  .listen(process.env.PORT || 3000);

console.log(`ToDuo running at https://${app.server?.hostname}:${app.server?.port}`);
