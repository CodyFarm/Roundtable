# Philosopher's Roundtable

A React + Express app for hosting AI-powered philosophical roundtable discussions.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

The dev server will start via `tsx server.ts`, serving both the Express API and the Vite React frontend.
