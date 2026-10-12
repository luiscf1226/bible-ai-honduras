import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { adminHttp } from "./adminAdapter";
import { handleRevenueCatWebhook } from "./entitlements";

const http = httpRouter();

http.route({
  path: "/revenuecat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleRevenueCatWebhook(ctx, request, process.env.REVENUECAT_WEBHOOK_SECRET);
  }),
});

// Dashboard de admin multi-app (#235, contrato v1 de lcf-admin#1). Solo
// agregados; pide `Authorization: Bearer <ADMIN_API_TOKEN>`.
http.route({
  pathPrefix: "/admin/",
  method: "GET",
  handler: adminHttp,
});

export default http;
