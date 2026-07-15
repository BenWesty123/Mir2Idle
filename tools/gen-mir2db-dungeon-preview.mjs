/**
 * Summarize Mir2DB dungeon lists vs our zones/bosses.
 * Usage: node tools/gen-mir2db-dungeon-preview.mjs
 */
import fs from "fs";

const data = JSON.parse(fs.readFileSync("tmp-mir2db-dungeon-mobs.json", "utf8"));
const zones = JSON.parse(fs.readFileSync("tmp-mir2db-zones.json", "utf8"));

const OUR_BOSS_BY_THEME = {
  54: { have: true, boss: "Wooma Taurus", zone: "zone-wooma-temple-kr" },
  58: { have: true, boss: "Evil Centipede", zone: "zone-bug-cave-kr", note: "KR mob names didn't auto-match EN crystal names" },
  63: { have: true, boss: "Evil Snake", zone: "zone-stone-temple-kr", note: "Mir2DB 邪恶毒蛇 ≈ Evil Snake" },
  65: { have: true, boss: "Zuma Taurus", zone: "zone-zuma-temple-kr" },
  72: { have: true, boss: "Dream and Dark Devourer / Red Moon line", zone: "zone-red-cavern-kr" },
  77: { have: true, boss: "Bone Lord", zone: "zone-prajna-cave-kr", note: "CN skeleton names map to Bone* roster" },
  78: { have: true, boss: "Minotaur King", zone: "zone-prajna-temple-kr", note: "邪牛天王 ≈ Minotaur King" },
  81: { have: "partial", boss: "破凰魔神 (Phoenix-breaker demon)", zone: "zone-bdd-*", note: "We have Black Dragon Dungeon floors; not 1:1 with Mir2DB Evil Dragon Mountain" },
};

const MISSING_ZONES = [
  { listId: 66, en: "Sorrow Moon Mountain", cn: "悲月山", why: "Fox/tiger mountain temple — related vibe to Fox Cave but KR-official layout; boss 悲月天珠 ~30k HP" },
  { listId: 68, en: "Sand Ruins", cn: "沙遗迹", why: "High-level (~84) ruin complex; several mini-bosses" },
  { listId: 73, en: "Moon Valley", cn: "月之谷", why: "Lv70–80 moon shrine; boss 石魔兽 30k HP" },
  { listId: 74, en: "Crescent Forest", cn: "弦月林", why: "Lv66–80 forest + class champions in 弦月堂" },
  { listId: 76, en: "Spirit Ghost Path", cn: "神穿鬼路", why: "Lv82+ dragon/spirit path (穷奇, 麒麟, 水龙…)" },
  { listId: 80, en: "Pianmu Island", cn: "片木岛", why: "Island + ghost ships; no LOM Idle zone" },
  { listId: 89, en: "Southern Barbarian Land", cn: "南蛮", why: "Lv70–99; dual bosses 万兽之王 / 丹墨" },
];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

const classic = data.filter((d) => OUR_BOSS_BY_THEME[d.listId]);
const missing = data.filter((d) => MISSING_ZONES.some((m) => m.listId === d.listId));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mir2DB dungeons / bosses / monsters vs LOM Idle</title>
<style>
  :root {
    --bg: #141210; --panel: #221c18; --ink: #f2e8d8; --muted: #9a8c78;
    --accent: #e0a050; --ok: #6aaf70; --miss: #d07050; --line: #3a3028;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: "Trebuchet MS", "Segoe UI", sans-serif; color: var(--ink);
    background: radial-gradient(ellipse at 10% 0%, #2a2218, transparent 50%), var(--bg);
  }
  header, main, footer { max-width: 1100px; margin: 0 auto; padding: 24px 28px; }
  h1 { margin: 0 0 8px; color: var(--accent); font-size: 1.5rem; }
  h2 { margin: 28px 0 10px; font-size: 1.15rem; color: var(--accent); }
  p, li { color: var(--muted); line-height: 1.45; }
  a { color: #deb060; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px;
  }
  .card h3 { margin: 0 0 6px; font-size: 1rem; color: var(--ink); }
  .badge {
    display: inline-block; font-size: 0.7rem; padding: 2px 6px; border-radius: 3px; margin-bottom: 8px;
  }
  .badge.ok { background: #1e3020; color: var(--ok); }
  .badge.partial { background: #302818; color: #d0a050; }
  .badge.miss { background: #302018; color: var(--miss); }
  .mobs { margin: 8px 0 0; padding: 0; list-style: none; font-size: 0.82rem; }
  .mobs li {
    display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; align-items: center;
    padding: 4px 0; border-top: 1px solid #2a241e; color: var(--ink);
  }
  .mobs img { width: 28px; height: 28px; image-rendering: pixelated; }
  .mobs .stat { color: var(--muted); white-space: nowrap; }
  .note { font-size: 0.8rem; color: #b09070; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  code { color: #e0c090; }
</style>
</head>
<body>
<header>
  <h1>Mir2DB monsters, bosses &amp; dungeons</h1>
  <p>
    Mir2DB is strongest here as a <strong style="color:var(--ink)">map + spawn roster</strong> database
    (floors, portals, which mobs spawn, levels/HP/icons) — not as drop tables.
    Our idle zones mostly come from <em>Crystal</em>; Mir2DB is Korean official layout, so overlap is high on classics but not identical.
  </p>
  <p>
    Browse lists on the site under maps, e.g.
    <a href="https://www.mir2db.com/list/54" target="_blank" rel="noopener">Wooma (list/54)</a>,
    <a href="https://www.mir2db.com/list/65" target="_blank" rel="noopener">Zuma (list/65)</a>,
    <a href="https://www.mir2db.com/map/54" target="_blank" rel="noopener">map detail</a>.
    API: <code>api.php?type=list|map|mob&amp;id=…</code>, icons <code>cdn.mir2db.com/images/mob/{img}.png</code>.
  </p>
</header>
<main>
  <h2>Classic dungeons we already cover</h2>
  <p>Same thematic bosses; Mir2DB names are often CN/KR while ours are Crystal English — auto-match undercounts mobs.</p>
  <div class="cards">
    ${classic
      .map((d) => {
        const theme = OUR_BOSS_BY_THEME[d.listId];
        const bosses = d.mobs
          .filter((m) => m.spawnSlots <= 3 && m.hp >= 1000)
          .slice(0, 6);
        const badge =
          theme.have === true ? "ok" : theme.have === "partial" ? "partial" : "miss";
        const badgeText =
          theme.have === true ? "In LOM Idle" : theme.have === "partial" ? "Partial overlap" : "Missing";
        return `<article class="card">
          <span class="badge ${badge}">${badgeText}</span>
          <h3>${esc(d.label)}</h3>
          <div style="font-size:0.8rem;color:var(--muted)">Mir2DB list/${d.listId} · ${d.mapCount} maps · our ${esc(theme.zone)}</div>
          <div style="font-size:0.85rem;margin-top:6px">Boss line: <strong style="color:var(--ink)">${esc(theme.boss)}</strong></div>
          <ul class="mobs">
            ${bosses
              .map(
                (m) => `<li>
              <img src="${esc(m.icon)}" alt="" />
              <span>${esc(m.en || m.cn || m.kr)}</span>
              <span class="stat">Lv${m.lv} · ${m.hp.toLocaleString()} HP</span>
            </li>`,
              )
              .join("")}
          </ul>
          ${theme.note ? `<div class="note">${esc(theme.note)}</div>` : ""}
        </article>`;
      })
      .join("")}
  </div>

  <h2>Mir2DB dungeons with no LOM Idle zone</h2>
  <p>These look like the real “new content” targets from this site (KR-official later areas).</p>
  <div class="cards">
    ${MISSING_ZONES.map((mz) => {
      const d = missing.find((x) => x.listId === mz.listId) || data.find((x) => x.listId === mz.listId);
      const bosses = (d?.mobs || [])
        .filter((m) => m.spawnSlots <= 3 && m.hp >= 1000)
        .slice(0, 5);
      const top = (d?.mobs || []).slice(0, 6);
      const show = bosses.length ? bosses : top;
      return `<article class="card">
        <span class="badge miss">No zone yet</span>
        <h3>${esc(mz.en)}</h3>
        <div style="font-size:0.8rem;color:var(--muted)">${esc(mz.cn)} · list/${mz.listId} · ${(d?.mapCount) || "?"} maps</div>
        <p class="note" style="margin-top:8px">${esc(mz.why)}</p>
        <ul class="mobs">
          ${show
            .map(
              (m) => `<li>
            <img src="${esc(m.icon)}" alt="" />
            <span>${esc(m.cn || m.en || m.kr)}</span>
            <span class="stat">Lv${m.lv} · ${m.hp.toLocaleString()} HP</span>
          </li>`,
            )
            .join("")}
        </ul>
        <div style="margin-top:8px;font-size:0.8rem"><a href="https://www.mir2db.com/list/${mz.listId}" target="_blank" rel="noopener">Open on Mir2DB</a></div>
      </article>`;
    }).join("")}
  </div>

  <h2>Our zones / bosses (for cross-check)</h2>
  <table>
    <thead><tr><th>Zone</th><th>Boss</th></tr></thead>
    <tbody>
      ${(zones.bosses || [])
        .map((b) => `<tr><td><code>${esc(b.zoneId)}</code></td><td>${esc(b.boss)}</td></tr>`)
        .join("")}
    </tbody>
  </table>

  <h2>What Mir2DB is / isn’t good for</h2>
  <ul>
    <li><strong style="color:var(--ink)">Good:</strong> dungeon floor lists, spawn rosters, monster level/HP/exp, mob icons, portal connections.</li>
    <li><strong style="color:var(--ink)">Weak:</strong> English names (often empty), drop tables (not in the mob/map API), Crystal-specific layouts (Fox Cave came from Crystal <code>Fox01–03</code>, not this KR DB).</li>
    <li><strong style="color:var(--ink)">Ancient_* lists</strong> (55, 57, 69, 70, 79) are harder KR variants of classics we already themed.</li>
  </ul>
</main>
<footer>
  Generated from Mir2DB API snapshots. Local preview:
  <code>http://localhost:4177/info/docs/.../</code> →
  <code>http://localhost:4177/docs/mir2db-dungeons-preview.html</code>
</footer>
</body>
</html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/mir2db-dungeons-preview.html", html, "utf8");
console.log("Wrote docs/mir2db-dungeons-preview.html");
console.log("Missing zone count:", MISSING_ZONES.length);
console.log("Classic covered:", classic.map((d) => d.label).join(", "));
