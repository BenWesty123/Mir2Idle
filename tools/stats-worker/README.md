# LOM Idle V2 Stats Worker

This is a small anonymous leaderboard backend for the itch prototype. It stores only the generated player ID, level, XP, kills, per-boss kill counts, gold, current zone, playtime, and save version, with no player name field.

The game posts an account summary plus per-character summaries. The Worker stores one account row per generated player ID and keeps per-character levels/stats JSON on that row. The default `/leaderboard` response ranks account rows by combined character levels, then Awakening Souls held.

Useful leaderboard URLs:

```text
/panel
/leaderboard
/leaderboard?scope=accounts
/leaderboard?scope=characters
/leaderboard?scope=all
/leaderboard?limit=500
```

The default limit is 250 rows. The maximum accepted `limit` is 500.

Each account leaderboard row now includes:

- `combinedCharacterLevels`: sum of Warrior + Wizard + Taoist levels
- `awakeningSoulsHeld`: total Awakening Souls held account-wide
- `characters`: per-class summary array for display
- `characterLevels`: raw class-to-level map
- `characterStats`: raw per-class stat summaries
- `bossKills`: per-boss counts keyed by zone id, e.g. `{ "zone-wooma-temple-kr": 12, "zone-bug-cave-kr": 3 }`
- `bossKillsTotal`: sum of all boss kill counts on that row

If you already deployed the Worker before account ranking fields were added, run the migrations against the live D1 database:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-boss-kills.sql --remote
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-account-stats.sql --remote
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-ranking-stats.sql --remote
```

Then redeploy the Worker so `/stats` stores account ranking fields and `/leaderboard` returns them.

To wipe bad or legacy leaderboard data and start fresh:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\reset-leaderboard.sql --remote
```

This deletes all rows. New submissions will repopulate the board using the current account-only format.

To remove existing rows with impossible character levels (any class above level 100):

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\purge-cheater-levels.sql --remote
```

The Worker also rejects new `/stats` submissions above that cap and hides them from `/leaderboard` responses. Redeploy after updating `worker.js` so the live API enforces the rule.

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
  "endpoint": "https://your-worker.your-subdomain.workers.dev/stats",
  "panel": "https://your-worker.your-subdomain.workers.dev/panel"
}
```

The game posts progress roughly once per minute, on level up, and when the page is hidden or closed.
