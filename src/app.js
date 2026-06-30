/**
 * Game entry point. The ENTIRE live game is src/app.monolith.js.
 * There is no other copy: do not create or revive a parallel src/game/ split.
 *
 * Cache-busting: the "?v=" token below is re-stamped per release build by
 * tools/package-itch.mjs, so itch.io's long-lived CDN can never serve a stale
 * monolith. You do NOT need to bump it by hand. In local dev, tools/server.mjs
 * sends "Cache-Control: no-store", so the browser always re-fetches and the
 * value here is irrelevant.
 */
import "./app.monolith.js?v=20260628-swarm-directions";


