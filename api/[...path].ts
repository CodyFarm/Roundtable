// Vercel serverless function entry point (catch-all for /api/*).
// Normalizes the request path so Express routes on /api/* always work.

import express from "express";
import { createApp } from "./server-routes";

const app = express();

app.use((req, res, next) => {
  // Vercel dynamic routes may strip or keep the /api prefix depending on
  // the exact invocation path. Ensure routes always see /api/...
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  next();
});

app.use(createApp());

export default app;
