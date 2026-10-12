import { defineApp } from "convex/server";

import adminKit from "./adminKit/convex.config";

const app = defineApp();
app.use(adminKit);

export default app;
