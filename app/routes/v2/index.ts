import { Hono } from "hono";
import featured from "./featured";
import posts from "./posts";
import search from "./search";

const app = new Hono();
app.route("/", search);
app.route("/", featured);
app.route("/", posts);

export default app;
