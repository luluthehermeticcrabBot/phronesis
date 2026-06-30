import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { profileDir } from "./paths.js";

// ---------------------------------------------------------------------------
// Database discovery
// ---------------------------------------------------------------------------

/**
 * Find the phronesis_search.db, trying common locations.
 * Returns the first path that exists, or null.
 *
 * @param {string} [profileName] - profile name for profile-specific & profile config paths
 * @param {string} [extraPath] - optional custom path from profile config (checked first)
 */
export function findSearchDb(profileName, extraPath) {
  const candidates = [];

  // Custom path from profile config (checked first)
  if (extraPath) {
    candidates.push(extraPath);
  }

  // Profile-specific data directory
  if (profileName) {
    candidates.push(join(profileDir(profileName), "data", "phronesis_search.db"));
  }

  // XDG_DATA_HOME
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  candidates.push(join(xdgData, "opencode", "phronesis_search.db"));

  // Legacy ~/.local/share
  candidates.push(join(homedir(), ".local", "share", "opencode", "phronesis_search.db"));

  // Container /data volume (checked last so user paths take priority)
  candidates.push(join("/data", ".local", "share", "opencode", "phronesis_search.db"));

  return candidates.find((p) => existsSync(p)) || null;
}

// ---------------------------------------------------------------------------
// SQLite binary discovery
// ---------------------------------------------------------------------------

/** Known sqlite binary names (sqlite3 on most distros, sqlite on Alpine). */
const SQLITE_BINS = ["sqlite3", "sqlite"];

/**
 * Find a working sqlite binary in PATH.
 * Returns the binary name or null.
 */
function findSqlite() {
  for (const bin of SQLITE_BINS) {
    const result = spawnSync("which", [bin], { encoding: "utf8", timeout: 3000 });
    if (result.status === 0) return bin;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

/**
 * Search sessions using direct SQLite FTS5 query.
 * Much faster than invoking opencode run — uses zero model tokens.
 *
 * @param {string} query  - search term
 * @param {object} [opts]
 * @param {string} [opts.profile] - profile name for profile-specific DB path
 * @param {number} [opts.limit=10] - max results
 * @param {'text'|'json'} [opts.format='text'] - output format
 * @returns {Array|string} results array or formatted string
 */
export function searchSessions(query, opts = {}) {
  const limit = opts.limit || 10;
  const profileName = opts.profile;

  // Find the DB
  const dbPath = findSearchDb(profileName, opts.dbPath);
  if (!dbPath) {
    throw new Error(
      "Search database not found. Run the opencode server with phronesis plugins to build the search index.\n" +
        "The server creates phronesis_search.db in the opencode data directory."
    );
  }

  // Find sqlite
  const sqlite = findSqlite();
  if (!sqlite) {
    throw new Error("sqlite3/sqlite not found in PATH. Install it to use session search.");
  }

  // Build FTS5 query — escape single quotes, wrap in double-quote prefix match
  const escapedQuery = query.replace(/'/g, "''");
  const ftsQuery = `"${escapedQuery}"*`;

  const sql = [
    "SELECT session_id, session_title,",
    "snippet(session_search, 3, '\x1b[1m', '\x1b[0m', '...', 40) AS snippet",
    "FROM session_search",
    `WHERE session_search MATCH '${ftsQuery}'`,
    "ORDER BY rank",
    `LIMIT ${limit}`,
  ].join("\n");

  const result = spawnSync(sqlite, ["-json", dbPath, sql], {
    encoding: "utf8",
    timeout: 10000,
    stdio: "pipe",
  });

  if (result.error) {
    throw new Error(`SQLite error: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`SQLite exited with code ${result.status}: ${result.stderr?.trim() || result.stdout?.trim() || "unknown"}`);
  }

  const rows = JSON.parse(result.stdout.trim() || "[]");

  if (opts.format === "json") {
    return rows;
  }

  // Format as text
  return formatResults(rows, query);
}

/**
 * Format search results as human-readable text.
 */
export function formatResults(rows, query) {
  if (rows.length === 0) {
    return `No results found for "${query}".`;
  }

  const lines = [`Found ${rows.length} result${rows.length === 1 ? "" : "s"} for "${query}":\n`];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const shortId = (r.session_id || "").slice(0, 12);
    const title = r.session_title || "(untitled)";
    const snippet = r.snippet || "";

    lines.push(`${i + 1}. ${title} (${shortId})`);

    if (snippet) {
      // Indent snippet
      const indented = snippet
        .split("\n")
        .map((l) => `   ${l}`)
        .join("\n");
      lines.push(indented);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * List all indexed sessions from the search database.
 * Queries distinct session_id + session_title.
 *
 * @param {object} [opts]
 * @param {string} [opts.profile] - profile name for DB discovery
 * @param {string} [opts.dbPath] - explicit DB path override
 * @param {'text'|'json'} [opts.format='text'] - output format
 * @returns {Array|string} results array or formatted string
 */
export function listSessions(opts = {}) {
  const dbPath = findSearchDb(opts.profile, opts.dbPath);
  if (!dbPath) {
    throw new Error(
      "Search database not found. Run 'phronesis sessions rebuild' to create the search index."
    );
  }

  const sqlite = findSqlite();
  if (!sqlite) {
    throw new Error("sqlite3/sqlite not found in PATH.");
  }

  const sql = "SELECT DISTINCT session_id, session_title FROM session_search ORDER BY session_title;";
  const result = spawnSync(sqlite, ["-json", dbPath], {
    input: sql,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 200 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`SQLite error: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `SQLite exited with code ${result.status}: ${result.stderr?.trim() || result.stdout?.trim() || "unknown"}`
    );
  }

  const rows = JSON.parse(result.stdout.trim() || "[]");

  if (opts.format === "json") {
    return rows;
  }

  // Format as text
  if (rows.length === 0) {
    return "No sessions found in search index.";
  }

  const lines = [`${rows.length} session${rows.length === 1 ? "" : "s"} indexed:\n`];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const shortId = (r.session_id || "").slice(0, 12);
    const title = r.session_title || "(untitled)";
    lines.push(`${i + 1}. ${title} (${shortId})`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// OpenCode DB discovery
// ---------------------------------------------------------------------------

/**
 * Find the opencode.db, trying common locations.
 */
function findOpenCodeDb() {
  const candidates = [];

  // XDG_DATA_HOME
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  candidates.push(join(xdgData, "opencode", "opencode.db"));

  // Legacy ~/.local/share
  candidates.push(join(homedir(), ".local", "share", "opencode", "opencode.db"));

  // Container path (/data volume)
  candidates.push(join("/data", ".local", "share", "opencode", "opencode.db"));

  return candidates.find((p) => existsSync(p)) || null;
}

// ---------------------------------------------------------------------------
// SQL execution helpers
// ---------------------------------------------------------------------------

/** Run SQL against a database, piping through stdin (avoids E2BIG). */
function sql(db, cmd) {
  const r = spawnSync("sqlite3", [db], {
    input: cmd,
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 200 * 1024 * 1024,
  });
  if (r.error) throw new Error(`sqlite3 exec error: ${r.error.message}`);
  if (r.status !== 0)
    throw new Error(`sqlite3 exited ${r.status}: ${r.stderr?.substring(0, 200)}`);
  return r.stdout || "";
}

/** Run a query against a database, returning parsed JSON. */
function query(db, cmd) {
  const r = spawnSync("sqlite3", ["-json", db], {
    input: cmd,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 200 * 1024 * 1024,
  });
  if (r.error) throw new Error(`sqlite3 query error: ${r.error.message}`);
  if (r.status !== 0)
    throw new Error(`sqlite3 exited ${r.status}: ${r.stderr?.substring(0, 200)}`);
  return JSON.parse(r.stdout || "[]");
}

// ---------------------------------------------------------------------------
// Index rebuild
// ---------------------------------------------------------------------------

/**
 * Rebuild the FTS5 search index from opencode.db.
 *
 * @param {object} opts
 * @param {string} [opts.srcDb]  - path to opencode.db (auto-discovered if omitted)
 * @param {string} [opts.dstDb]  - path for phronesis_search.db (auto-discovered if omitted)
 * @param {boolean} [opts.overwrite] - drop and recreate the index
 * @returns {string} summary of what was indexed
 */
export function rebuildSearchIndex(opts = {}) {
  // Discover source DB
  const srcDb = opts.srcDb || findOpenCodeDb();
  if (!srcDb || !existsSync(srcDb))
    throw new Error("opencode.db not found. Specify --src or run an opencode server first.");

  // Discover or default destination DB
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dstDb =
    opts.dstDb ||
    findSearchDb(opts.profile) ||
    join("/data", ".local", "share", "opencode", "phronesis_search.db") ||
    join(xdgData, "opencode", "phronesis_search.db");

  if (opts.overwrite && existsSync(dstDb)) {
    sql(dstDb, "DROP TABLE IF EXISTS session_search;");
    sql(dstDb, "VACUUM;");
  }

  // Create FTS5 table
  sql(
    dstDb,
    "CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(" +
      "session_id UNINDEXED, session_title, role UNINDEXED, text, " +
      "tokenize='porter unicode61')"
  );

  // Extract messages
  const msgRows = query(
    srcDb,
    "SELECT s.id AS session_id, s.title AS session_title, " +
      "json_extract(m.data, '$.role') AS role, " +
      "group_concat(json_extract(p.data, '$.text'), '\n') AS text " +
      "FROM session s " +
      "JOIN message m ON m.session_id = s.id " +
      "JOIN part p ON p.message_id = m.id " +
      "WHERE json_extract(p.data, '$.text') IS NOT NULL " +
      "AND json_extract(p.data, '$.text') != '' " +
      "GROUP BY m.id HAVING length(text) > 20 " +
      "ORDER BY m.time_created;"
  );

  // Batch insert messages into FTS5
  let batch = [];
  let msgCount = 0;
  for (const r of msgRows) {
    const sid = r.session_id.replace(/'/g, "''");
    const title = (r.session_title || "").replace(/'/g, "''");
    const role = (r.role || "").replace(/'/g, "''");
    const text = (r.text || "").replace(/'/g, "''");
    batch.push(
      `INSERT INTO session_search VALUES('${sid}','${title}','${role}','${text}');`
    );
    msgCount++;
    if (batch.length >= 100) {
      sql(dstDb, batch.join("\n"));
      batch = [];
    }
  }
  if (batch.length > 0) sql(dstDb, batch.join("\n"));

  // Extract session titles
  const titleRows = query(
    srcDb,
    "SELECT id, title FROM session WHERE title NOT LIKE 'New session%';"
  );
  let titleCount = 0;
  for (const r of titleRows) {
    const t = r.title.replace(/'/g, "''");
    sql(
      dstDb,
      `INSERT INTO session_search(session_id, session_title, role, text) VALUES('${r.id}','${t}','','${t}');`
    );
    titleCount++;
  }

  // Verify
  const cnt = query(dstDb, "SELECT COUNT(*) AS cnt FROM session_search;");
  const total = cnt[0]?.cnt || 0;

  return `Search index rebuilt: ${msgCount} messages + ${titleCount} titles = ${total} total rows indexed.`;
}

/** @deprecated Use rebuildSearchIndex instead. */
export const buildSearchIndex = rebuildSearchIndex;
