---
name: fix-node-exec-sync-args
description: >
  Fix Node.js execSync calls that silently ignore args parameter
  by switching to spawnSync, and fix related SQL/FTS5 issues.
trigger: >
  When a Node.js script uses execSync with an `args` field, or when
  sqlite3 CLI-based tools return empty results despite correct queries.
tools: [read, edit, bash, grep]
---

# Fix execSync args bug

## Steps

1. **Identify the bug pattern**: Search for `execSync` calls that pass `{ args: [...] }`. Node.js `execSync(command, options)` does NOT have an `args` option — it's silently ignored, running the command with zero arguments.

2. **Fix by switching to spawnSync**: `spawnSync(command, args, options)` has the correct signature:
   - ❌ `execSync('sqlite3', { args: [dbPath, query], encoding: 'utf8' })`
   - ✅ `spawnSync('sqlite3', [dbPath, query], { encoding: 'utf8' })`

3. **Fix SQL quoting**: If using `JSON.stringify(val)` in SQL INSERT, JSON produces double-quoted strings which SQLite interprets as identifiers. Replace with single-quote escaping:
   ```js
   function sqlEscape(val) {
     if (val === null || val === undefined) return 'NULL';
     return "'" + String(val).replace(/'/g, "''") + "'";
   }
   ```

4. **Fix FTS5 snippet column index**: `snippet(table, colIndex, ...)` — ensure `colIndex` points to an FTS5-indexed column (not UNINDEXED).

5. **Verify with correct environment**: `docker exec -e HOME=/data` vs default HOME=/root — ensure environment variables match the server process.
