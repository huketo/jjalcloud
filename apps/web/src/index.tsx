import { Hono } from "hono";
import type { HonoEnv } from "./auth";
import { renderer } from "./renderer";
import feedRoutes from "./routes/feed";
import gifRoutes from "./routes/gif";
import likeRoutes from "./routes/like";
import oauthRoutes from "./routes/oauth";
import pageRoutes from "./routes/page";

const app = new Hono<HonoEnv>();

app.use(renderer);

app.route("/oauth", oauthRoutes);

app.route("/api/gif", gifRoutes);
app.route("/api/like", likeRoutes);
app.route("/api", feedRoutes);

app.route("/", pageRoutes);

export default app;
