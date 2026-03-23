import { Hono } from "hono";
import { featured } from "./featured";
import { posts } from "./posts";
import { search } from "./search";

const tenor = new Hono();
tenor.route("/", search);
tenor.route("/", featured);
tenor.route("/", posts);

export { tenor };
