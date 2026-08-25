import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { handleRevenueCatWebhook } from "./entitlements";

const http = httpRouter();

http.route({
  path: "/revenuecat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleRevenueCatWebhook(ctx, request, process.env.REVENUECAT_WEBHOOK_SECRET);
  }),
});

export default http;
