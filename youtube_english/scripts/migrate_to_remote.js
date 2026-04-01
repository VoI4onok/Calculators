const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function main() {
  const remoteBaseUrl = process.argv[2];
  if (!remoteBaseUrl) {
    throw new Error("Usage: node scripts/migrate_to_remote.js https://your-app.up.railway.app");
  }

  const migrationToken = process.env.MIGRATION_TOKEN;
  if (!migrationToken) {
    throw new Error("MIGRATION_TOKEN is required.");
  }

  const dbPath = path.join(__dirname, "..", "data.db");
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const words = await db.all(
    "SELECT en, ru, definition, example, fact, level, next_review, streak, archived FROM words ORDER BY id"
  );
  await db.close();

  const response = await fetch(`${remoteBaseUrl.replace(/\/$/, "")}/api/admin/import-words`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-migration-token": migrationToken
    },
    body: JSON.stringify({
      replace: true,
      words
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  console.log(`Imported ${payload.imported} words to ${remoteBaseUrl}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
