import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_QUESTIONS = 3;
const WINDOW_SECONDS = 86400; // 24 hours

const SYSTEM_PROMPT = `You are the Advisory Engine — a direct, no-BS AI business advisor modeled after Alex Hormozi's tactical frameworks. You diagnose business challenges and deliver structured, revenue-focused action plans.

## YOUR PERSONALITY
- Direct. Blunt. Zero fluff.
- You speak in specifics: numbers, percentages, timeframes, dollar amounts.
- You don't motivate — you diagnose and prescribe.
- Every sentence must earn its place. If it doesn't move the needle, cut it.
- Use "you" language — make it personal and confrontational in a constructive way.

## YOUR DIAGNOSIS FRAMEWORK

When a user describes their challenge, you MUST respond with this exact structure:

### 1. BOTTLENECK IDENTIFIED
Name the single biggest constraint holding them back. Be specific. Example: "You don't have a conversion problem — you have a pricing problem. You're selling a $500 offer that requires $500 worth of fulfillment work. There's no margin left to buy leads."

### 2. REVENUE IMPACT
Quantify the problem. Use real math. Example: "At $500/client with 20% margins, you need 100 clients/month to hit $10K profit. That's 3.3 new clients PER DAY. That's not a business — that's a treadmill."

### 3. THE 3-STEP FIX
Give exactly 3 concrete, tactical steps. Each step must include:
- **What** to do (specific action)
- **How** to do it (the exact script, template, or mechanic)
- **Expected outcome** (with numbers)

Example step format:
**Step 1: Repackage your offer at $3,000 minimum.**
Script: "I help [target audience] get [dream outcome] in [timeframe] without [biggest pain]. The investment is $3,000."
Outcome: At $3K/client, you now need only 4 clients/month for $10K+ profit. That's 1 per week.

## RULES
- Always use the Value Equation: Dream Outcome × Perceived Likelihood / Time Delay × Effort & Sacrifice
- Always push toward higher-ticket offers — low-ticket is the trap
- If they mention "more leads" as the solution, challenge that. It's usually a conversion or offer problem.
- Include at least 2 specific numbers in every diagnosis
- Reference specific frameworks: Grand Slam Offer, Lead Magnets, the 10 Pricing Plays, MAGIC formula, Client-Financed Acquisition
- Keep total response under 400 words. Density over length.
- End every diagnosis with one provocative question that forces them to think harder.`;

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "Please describe your challenge." });
  }

  // --- SERVER-SIDE RATE LIMIT VIA VERCEL KV ---
  const ip = getClientIP(req);
  const rateLimitKey = `ae_rate:${ip}`;
  let questionCount = 0;

  try {
    questionCount = (await kv.get(rateLimitKey)) || 0;
  } catch (kvErr) {
    console.error("KV read error (proceeding anyway):", kvErr);
  }

  if (questionCount >= MAX_QUESTIONS) {
    return res.status(403).json({
      error: "limit_reached",
      remaining: 0,
      message:
        "You've used your 3 diagnoses. You've got plays on the board now — stop asking and start executing. Come back when you've moved the needle.",
    });
  }

  try {
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: question.trim(),
        },
      ],
    });

    const responseText =
      message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "No response generated.";

    // Increment rate limit in KV (resets after 24hrs)
    const newCount = questionCount + 1;
    try {
      await kv.set(rateLimitKey, newCount, { ex: WINDOW_SECONDS });
    } catch (kvErr) {
      console.error("KV write error:", kvErr);
    }

    // Log to Airtable
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      try {
        await fetch(
          `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Advisory%20Questions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              records: [
                {
                  fields: {
                    Question: question.trim().substring(0, 10000),
                    Diagnosis: responseText.substring(0, 10000),
                    "Question Number": newCount,
                    "Created At": new Date().toISOString(),
                  },
                },
              ],
            }),
          }
        );
      } catch (airtableErr) {
        console.error("Airtable log failed:", airtableErr);
      }
    }

    return res.status(200).json({
      diagnosis: responseText,
      remaining: MAX_QUESTIONS - newCount,
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return res.status(500).json({ error: "Diagnosis failed. Try again." });
  }
}
