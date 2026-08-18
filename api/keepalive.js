import { kv } from "@vercel/kv";

const KEY = "ae_keepalive";

// Daily no-op touch on the Upstash KV so the free-tier database is never
// flagged inactive. Upstash's inactivity watchdog trips well inside the
// heartbeat's biweekly cadence, so the keep-alive cannot ride on /api/heartbeat.
// No Anthropic call, no Slack post - just one read + one write.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers["authorization"] || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const now = new Date().toISOString();
  try {
    const previous = await kv.get(KEY);
    await kv.set(KEY, now);
    return res.status(200).json({ ok: true, previous, now });
  } catch (e) {
    console.error("KV keepalive failed:", e);
    return res.status(500).json({ error: "kv_failed", detail: String(e).slice(0, 300) });
  }
}
