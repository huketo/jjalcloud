import { cors } from "hono/cors";
import { createRoute } from "honox/factory";

export default createRoute(cors());
