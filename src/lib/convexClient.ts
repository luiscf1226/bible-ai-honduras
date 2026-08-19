import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Falta EXPO_PUBLIC_CONVEX_URL. Corré `npx convex dev` (o copiá .env.example a .env.local) antes de levantar la app."
  );
}

export const convexClient = new ConvexReactClient(convexUrl);
