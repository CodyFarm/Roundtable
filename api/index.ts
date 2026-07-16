// Vercel serverless function entry point.
// Imports the shared Express app and exports it for Vercel's Node.js runtime.

import { createApp } from "./server-routes";

const app = createApp();

export default app;
