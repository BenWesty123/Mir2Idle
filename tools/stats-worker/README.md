# LOM Idle V2 Stats Worker

This is a small anonymous leaderboard backend for the itch prototype. It stores only the generated player ID, level, XP, kills, per-boss kill counts, gold, current zone, playtime, and save version, with no player name field.

The game now posts an account summary plus per-character summaries. The Worker keeps the account row under the generated player ID and stores character rows as `playerId:Warrior`, `playerId:Wizard`, etc. The default `/leaderboard` response ranks character rows so the response includes `characterClass`; if there are no character rows yet it falls back to account rows.

Useful leaderboard URLs:

```text
/leaderboard
/leaderboard?scope=accounts
/leaderboard?scope=all
/leaderboard?limit=500
```

The default limit is 250 rows. The maximum accepted `limit` is 500.

Each leaderboard row now includes:

- `bossKills`: per-boss counts keyed by zone id, e.g. `{ "zone-wooma-temple-kr": 12, "zone-bug-cave-kr": 3 }`
- `bossKillsTotal`: sum of all boss kill counts on that row

If you already deployed the Worker before boss kills were added, run the migration against the live D1 database:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-boss-kills.sql --remote
```

Then redeploy the Worker so `/stats` stores boss kills and `/leaderboard` returns them.

## Deploy Outline

1. Create a Cloudflare D1 database.
2. Copy `wrangler.toml.example` to `wrangler.toml` and fill in the D1 database ID.
3. Run the schema against the database:

   ```powershell
   npx wrangler d1 execute lom-idle-v2-stats --file .\schema.sql --remote
   ```

4. Deploy the Worker:

   ```powershell
   npx wrangler deploy
   ```

5. Put the Worker `/stats` URL into `public/stats/config.json` and set `enabled` to `true`, then rebuild the itch package.

Example config:

```json
{
  "enabled": true,
  "endpoint": "https://your-worker.your-subdomain.workers.dev/stats"
}
```

The game posts progress roughly once per minute, on level up, and when the page is hidden or closed.
