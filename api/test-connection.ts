// Minimal test function to isolate the issue.
// Returns a simple JSON response without importing server-routes.

export default function handler(req: any, res: any) {
  res.status(200).json({ ok: true, message: "API routing works!" });
}
