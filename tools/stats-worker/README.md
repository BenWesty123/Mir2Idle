# LOM Idle V2 Stats Worker

This is a small anonymous leaderboard backend for the itch prototype. It stores only the generated player ID, level, XP, kills, per-boss kill counts, gold, current zone, playtime, and save version, with no player name field.

The game posts an account summary plus per-character summaries. The Worker stores one account row per generated player ID and keeps per-character levels/stats JSON on that row. The default `/leaderboard` response ranks account rows by combined character levels, then Awakening Souls held.

## Recovery-code cloud saves

The game keeps local saves as its primary storage and uploads one latest backup every ten minutes while open. Each browser receives a visible recovery code in Options. No account, email address, or password is required.

Cloud-save routes:

```text
POST /cloud-save
POST /cloud-save/restore
```

Both routes accept JSON bodies, so recovery codes are not placed in URLs. Before deploying the cloud-save Worker changes to an existing database, run:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-cloud-saves.sql --remote
npx wrangler deploy --keep-vars
```

The Options page supports copying the current code, saving immediately, finding a backup by code, and confirming restoration. A full local reset generates a new recovery code so the new blank game does not overwrite the previous backup.

## Integrity review

The Worker validates equipped item enhancement components against a generated, versioned ruleset. Suspicious submissions are marked `flagged` but remain visible on the public Social leaderboard until an administrator explicitly removes them.

`INTEGRITY_ENFORCE_AFTER` provides a client-update grace period. Before that timestamp, submissions without the current rules version remain `legacy`; current-version submissions are still fully validated. After the timestamp, missing or outdated versions also enter review.

The private review page is available at:

```text
/integrity
```

The page also supports manual Social removal using either the visible `Player XXXXXXXX` label or the full player ID. A shortened label is accepted only when it matches exactly one account; ambiguous prefixes are refused and return the matching full IDs.

Protect its API with a Worker secret. Run this from `tools/stats-worker` and enter a long, unique token when prompted:

```powershell
npx wrangler secret put ADMIN_TOKEN
```

The token is requested by the review page and retained only in that browser tab's session storage. The review page supports:

- **Keep Visible**: approves the current violation fingerprint so the same report does not immediately reappear.
- **Remove From Social**: changes the account to `excluded`; public leaderboard queries then hide it.
- **Restore To Social**: clears the exclusion and returns the account to public results.

Before deploying this feature to an existing D1 database, run:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-integrity-review.sql --remote
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

Regenerate item rules after changing item definitions, gem/orb rules, refinement caps, smith caps, or empowerment tables:

```powershell
npm run integrity:rules
```

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
- `characters`: per-class summary array for display (each entry includes `equipment` as a slot-to-`{ itemId, smithLevel }` map and `skills` as a learned-spell-id-to-level map, used to render other players' character pages in-game)
- `characterLevels`: raw class-to-level map
- `characterStats`: raw per-class stat summaries
- `bossKills`: per-boss counts keyed by zone id, e.g. `{ "zone-wooma-temple-kr": 12, "zone-bug-cave-kr": 3 }`
- `bossKillsTotal`: sum of all boss kill counts on that row

If you already deployed the Worker before account ranking fields were added, run the migrations against the live D1 database:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-boss-kills.sql --remote
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-account-stats.sql --remote
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-ranking-stats.sql --remote
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-town-messages.sql --remote
```

Then redeploy the Worker so `/stats` stores account ranking fields and `/leaderboard` returns them.

The town noticeboard uses `GET /town-messages` and `POST /town-messages`. Messages are plain text, expire after 14 days, and each anonymous player identity can post once per minute.

## Player aliases (display names)

Players can claim a public display name that replaces the derived `Player XXXXXXXX`
label on the Social tab and town noticeboard. Aliases are stored in the
`player_aliases` table, keyed to the account `player_id`, and are case-insensitively
unique. Only the `recovery_code` that first claimed a `player_id` can rename it.
Labels are resolved at read time, so changing an alias updates the name shown on
old noticeboard posts too.

Endpoints:

- `GET /player/alias?playerId=...` returns `{ ok, alias }` (alias is `null` if unset)
- `POST /player/alias` with `{ playerId, recoveryCode, alias }` claims/renames it
  (returns 400 invalid, 403 `ALIAS_LOCKED`, 409 `ALIAS_TAKEN`)

Before deploying to an existing D1 database, create the table:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\migrate-player-aliases.sql --remote
npx wrangler deploy --keep-vars
```

Moderate public messages at:

```text
/messages
```

The moderation page uses the same `ADMIN_TOKEN` secret as `/integrity`. **Delete Message** immediately hides a post from players but keeps it in the Removed tab for recovery. **Restore Message** makes it public again; restoring an expired message renews it for 14 days.

To wipe bad or legacy leaderboard data and start fresh:

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\reset-leaderboard.sql --remote
```

This deletes all rows. New submissions will repopulate the board using the current account-only format.

To remove existing rows with impossible character levels (any class above level 100):

```powershell
npx wrangler d1 execute lom-idle-v2-stats --file .\purge-cheater-levels.sql --remote
```

The Worker now flags submissions above that cap for private review. They remain visible until an administrator chooses **Remove From Social** on `/integrity`.

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
  "cloudSaveEndpoint": "https://your-worker.your-subdomain.workers.dev/cloud-save",
  "panel": "https://your-worker.your-subdomain.workers.dev/panel"
}
```

The game posts progress roughly once per minute, on level up, and when the page is hidden or closed.
