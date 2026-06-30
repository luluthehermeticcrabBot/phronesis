#!/usr/bin/env node
/**
 * Phronesis Dashboard — web UI for browsing sessions, viewing config,
 * and checking gateway status.
 *
 * Usage: node index.js [--port 4099] [--profile <name>]
 *
 * Environment:
 *   PORT              - server port (default: 4099)
 *   PROFILE           - profile name to use (default: active profile)
 *   PHRONESIS_HOME    - config directory (default: ~/.config/phronesis)
 */

import { spawnSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "4099", 10);
const PHRONESIS_HOME = process.env.PHRONESIS_HOME || join(homedir(), ".config", "phronesis");
const GLOBAL_CONFIG_PATH = join(PHRONESIS_HOME, "config.yaml");
const PROFILES_DIR = join(PHRONESIS_HOME, "profiles");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readYaml(path) {
  try {
    if (!existsSync(path)) return null;
    // Use Node to parse since we might not have js-yaml here — shell out to node
    const raw = readFileSync(path, "utf8");
    // Basic YAML parse via node — we can use js-yaml if available
    try {
      const result = spawnSync("node", [
        "-e",
        `const y = require("js-yaml"); console.log(JSON.stringify(y.load(process.stdin.read())));`,
      ], {
        input: raw,
        encoding: "utf8",
        timeout: 5000,
      });
      if (result.status === 0) return JSON.parse(result.stdout);
    } catch { /* fall through */ }
    return raw;
  } catch {
    return null;
  }
}

function findSearchDb(profileName) {
  const candidates = [];

  if (profileName) {
    candidates.push(join(PROFILES_DIR, profileName, "data", "phronesis_search.db"));
  }

  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  candidates.push(join(xdgData, "opencode", "phronesis_search.db"));
  candidates.push(join(homedir(), ".local", "share", "opencode", "phronesis_search.db"));

  return candidates.find((p) => existsSync(p)) || null;
}

function findSqlite() {
  for (const bin of ["sqlite3", "sqlite"]) {
    const r = spawnSync("which", [bin], { encoding: "utf8", timeout: 3000 });
    if (r.status === 0) return bin;
  }
  return null;
}

function queryDb(dbPath, sql) {
  const sqlite = findSqlite();
  if (!sqlite) throw new Error("sqlite3 not found");

  const result = spawnSync(sqlite, ["-json", dbPath], {
    input: sql,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) throw new Error(`SQLite error: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`SQLite exited ${result.status}`);
  return JSON.parse(result.stdout || "[]");
}

function findOpenCodeDb() {
  const candidates = [];
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  candidates.push(join(xdgData, "opencode", "opencode.db"));
  candidates.push(join(homedir(), ".local", "share", "opencode", "opencode.db"));
  return candidates.find((p) => existsSync(p)) || null;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// Static files
app.use(express.static(join(__dirname, "public")));

// ---- API Routes ----

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global config
app.get("/api/config", (_req, res) => {
  const raw = readYaml(GLOBAL_CONFIG_PATH);
  const parsed = typeof raw === "object" ? raw : null;
  res.json({
    path: GLOBAL_CONFIG_PATH,
    exists: existsSync(GLOBAL_CONFIG_PATH),
    config: parsed,
    raw: typeof raw === "string" ? raw : null,
  });
});

// Profile info
app.get("/api/profile", (req, res) => {
  // Read active profile from global config
  const globalConfig = readYaml(GLOBAL_CONFIG_PATH);
  const activeProfile = globalConfig?.active_profile || "default";

  // List profiles
  let profiles = [];
  try {
    const entries = readdirSync(PROFILES_DIR);
    profiles = entries.filter((e) => {
      const st = statSync(join(PROFILES_DIR, e));
      return st.isDirectory();
    });
  } catch { /* no profiles dir */ }

  // Read profile config
  const profileConfig = readYaml(join(PROFILES_DIR, activeProfile, "config.yaml"));

  res.json({
    active_profile: activeProfile,
    profiles,
    profile_config: typeof profileConfig === "object" ? profileConfig : null,
    profiles_dir: PROFILES_DIR,
  });
});

// Session search
app.get("/api/sessions/search", (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const profileName = req.query.profile;

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const dbPath = findSearchDb(profileName);
    if (!dbPath) {
      return res.status(404).json({ error: "Search database not found. Run 'phronesis sessions rebuild' first." });
    }

    const escaped = query.replace(/'/g, "''");
    const ftsQuery = `"${escaped}"*`;

    const sql = [
      "SELECT session_id, session_title,",
      "snippet(session_search, 3, '<mark>', '</mark>', '...', 40) AS snippet",
      "FROM session_search",
      `WHERE session_search MATCH '${ftsQuery}'`,
      "ORDER BY rank",
      `LIMIT ${limit}`,
    ].join("\n");

    const rows = queryDb(dbPath, sql);
    res.json({ query, count: rows.length, results: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session list
app.get("/api/sessions", (req, res) => {
  try {
    const profileName = req.query.profile;
    const dbPath = findSearchDb(profileName);
    if (!dbPath) {
      return res.status(404).json({ error: "Search database not found." });
    }

    const sql = "SELECT DISTINCT session_id, session_title FROM session_search ORDER BY session_title;";
    const rows = queryDb(dbPath, sql);
    res.json({ count: rows.length, sessions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session detail (from opencode.db)
app.get("/api/sessions/:id", (req, res) => {
  try {
    const dbPath = findOpenCodeDb();
    if (!dbPath) {
      return res.status(404).json({ error: "opencode.db not found." });
    }

    const sid = req.params.id.replace(/'/g, "''");

    // Get session info
    const sessionSql = `SELECT id, title, time_created FROM session WHERE id = '${sid}';`;
    const sessionRows = queryDb(dbPath, sessionSql);

    if (sessionRows.length === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Get messages
    const msgSql = [
      "SELECT m.id, m.session_id, json_extract(m.data, '$.role') AS role, m.time_created,",
      "group_concat(json_extract(p.data, '$.text'), '\n') AS text",
      "FROM message m",
      "LEFT JOIN part p ON p.message_id = m.id",
      `WHERE m.session_id = '${sid}'`,
      "GROUP BY m.id",
      "ORDER BY m.time_created;",
    ].join("\n");
    const msgRows = queryDb(dbPath, msgSql);

    res.json({
      session: sessionRows[0],
      messages: msgRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gateway status
app.get("/api/gateway/status", (req, res) => {
  try {
    const profileName = req.query.profile;

    // Check systemd user units
    const result = spawnSync("systemctl", ["--user", "list-units", "--type=service", "--all", "--no-legend"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: "pipe",
    });

    const units = [];
    if (result.status === 0) {
      const lines = result.stdout.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const name = parts[0];
          // Only show phronesis-related services
          if (name.includes("phronesis") || name.includes("opencode-telegram") || name.includes("opencode-serve")) {
            units.push({
              name: parts[0],
              load: parts[1],
              active: parts[2],
              sub: parts[3],
              description: parts.slice(4).join(" ") || "",
            });
          }
        }
      }
    }

    res.json({
      profile: profileName || "default",
      systemctl_available: result.status === 0,
      units,
    });
  } catch (err) {
    res.json({ profile: req.query.profile || "default", systemctl_available: false, units: [], error: err.message });
  }
});

// Gateway service action
app.post("/api/gateway/:action", (req, res) => {
  const validActions = ["start", "stop", "restart", "status"];
  const action = req.params.action;

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `Invalid action. Use: ${validActions.join(", ")}` });
  }

  const { unit } = req.body;
  if (!unit) {
    return res.status(400).json({ error: "unit is required" });
  }

  try {
    const result = spawnSync("systemctl", ["--user", action, unit], {
      encoding: "utf8",
      timeout: 30000,
      stdio: "pipe",
    });

    res.json({
      action,
      unit,
      status: result.status === 0 ? "success" : "error",
      stdout: result.stdout?.trim() || "",
      stderr: result.stderr?.trim() || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start ----

const server = createServer(app);
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Phronesis Dashboard running at ${url}`);
  console.log(`Config: ${GLOBAL_CONFIG_PATH}`);
  console.log("");

  // Try to open browser
  const openCmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  try {
    spawn(openCmd, [url], { detached: true, stdio: "ignore" });
  } catch { /* no browser opener available */ }
});
