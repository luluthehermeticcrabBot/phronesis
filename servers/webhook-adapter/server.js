#!/usr/bin/env node
/**
 * Phronesis Webhook Adapter
 *
 * Translates incoming webhooks from Slack, Discord, Telegram, and other
 * platforms into OpenCode API queries, then returns the response.
 *
 * Usage:
 *   PORT=4098 OPENCODE_URL=http://localhost:4097 node server.js
 */

import express from "express";
import { handleSlack } from "./handlers/slack.js";
import { handleDiscord } from "./handlers/discord.js";
import { handleTelegram } from "./handlers/telegram.js";
import { handleGeneric } from "./handlers/generic.js";
import { queryOpenCode } from "./lib/opencode-client.js";

const PORT = parseInt(process.env.PORT || "4098", 10);
const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4097";

const app = express();

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Request logging ----
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[webhook-adapter] ${timestamp} ${req.method} ${req.path}`);
  next();
});

// ---- Health check ----
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ---- Platform handlers ----

/**
 * POST /webhook/slack
 * Slack slash commands (application/x-www-form-urlencoded).
 */
app.post("/webhook/slack", async (req, res) => {
  try {
    const result = await handleSlack(req.body, OPENCODE_URL);
    res.json(result);
  } catch (err) {
    console.error(`[webhook-adapter] slack fatal: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /webhook/discord
 * Discord interactions (application/json).
 */
app.post("/webhook/discord", async (req, res) => {
  // Discord requires responding within 3 seconds
  // For longer queries, use defer: { type: 5 } then send follow-up
  try {
    // Check if this is a verification (PING) from Discord
    if (req.body.type === 1) {
      return res.json({ type: 1 }); // PONG
    }

    const result = await handleDiscord(req.body, OPENCODE_URL);
    res.json(result);
  } catch (err) {
    console.error(`[webhook-adapter] discord fatal: ${err.message}`);
    res.status(500).json({ type: 4, data: { content: "Error processing request" } });
  }
});

/**
 * POST /webhook/telegram
 * Telegram bot updates (application/json).
 */
app.post("/webhook/telegram", async (req, res) => {
  try {
    const result = await handleTelegram(req.body, OPENCODE_URL);
    res.json(result);
  } catch (err) {
    console.error(`[webhook-adapter] telegram fatal: ${err.message}`);
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /webhook/generic
 * Generic webhook — accepts { message: "...", channel?: "..." }
 */
app.post("/webhook/generic", async (req, res) => {
  try {
    const result = await handleGeneric(req.body, OPENCODE_URL);
    res.json(result);
  } catch (err) {
    console.error(`[webhook-adapter] generic fatal: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/query
 * Direct API — no platform translation. Accepts { message: "..." }
 */
app.post("/api/query", async (req, res) => {
  const message = (req.body?.message || "").trim();

  if (!message) {
    return res.status(400).json({ error: "'message' field is required" });
  }

  try {
    const result = await queryOpenCode(message, { opencodeUrl: OPENCODE_URL, channel: "api" });
    res.json(result);
  } catch (err) {
    console.error(`[webhook-adapter] api error: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  console.error(`[webhook-adapter] unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

// ---- Start ----
app.listen(PORT, () => {
  console.error(`[webhook-adapter] listening on port ${PORT}, opencode=${OPENCODE_URL}`);
  console.error(`[webhook-adapter] endpoints:`);
  console.error(`  POST /webhook/slack`);
  console.error(`  POST /webhook/discord`);
  console.error(`  POST /webhook/telegram`);
  console.error(`  POST /webhook/generic`);
  console.error(`  POST /api/query`);
  console.error(`  GET  /health`);
});
