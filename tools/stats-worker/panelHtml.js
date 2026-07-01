export const PANEL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LOM Idle V2 Stats</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #17130f;
      --panel: #221b14;
      --line: #4a3a28;
      --text: #f3e5c4;
      --muted: #a98d5d;
      --accent: #d4a24a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 Georgia, "Times New Roman", serif;
      background: radial-gradient(circle at top, #2a2118, var(--bg));
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      color: var(--accent);
    }
    .sub {
      margin: 0 0 18px;
      color: var(--muted);
    }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    button, select {
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--line);
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); }
    .status {
      margin: 0 0 14px;
      color: var(--muted);
      min-height: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:last-child td { border-bottom: 0; }
    .rank { width: 56px; color: var(--accent); font-weight: bold; }
    .player { min-width: 140px; }
    .metric { font-variant-numeric: tabular-nums; }
    .characters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.18);
    }
    .empty {
      padding: 24px;
      border: 1px dashed var(--line);
      color: var(--muted);
      text-align: center;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin: 0 0 22px;
    }
    .metric-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 12px 14px;
    }
    .metric-card .value {
      font-size: 24px;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .metric-card .label {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 2px;
    }
    .metric-card .sub-value {
      font-size: 12px;
      color: var(--muted);
      margin-top: 6px;
    }
    .section-title {
      font-size: 14px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0 0 10px;
    }
    @media (max-width: 720px) {
      table, thead, tbody, th, td, tr { display: block; }
      thead { display: none; }
      tr {
        border-bottom: 1px solid var(--line);
        padding: 10px 0;
      }
      td {
        border: 0;
        padding: 4px 12px;
      }
      td::before {
        display: inline-block;
        width: 120px;
        color: var(--muted);
        content: attr(data-label);
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>LOM Idle V2 Stats</h1>
    <p class="sub">Players ranked by combined character levels, then Awakening Souls held.</p>
    <p class="section-title">Live Activity</p>
    <p class="status" id="metricsStatus">Loading activity...</p>
    <div class="metrics" id="metrics"></div>
    <p class="section-title">Leaderboard</p>
    <div class="toolbar">
      <button type="button" id="refresh">Refresh</button>
      <select id="limit">
        <option value="50">Top 50</option>
        <option value="100">Top 100</option>
        <option value="250" selected>Top 250</option>
        <option value="500">Top 500</option>
      </select>
    </div>
    <p class="status" id="status">Loading leaderboard...</p>
    <div id="tableWrap"></div>
  </main>
  <script>
    const statusEl = document.getElementById("status");
    const tableWrap = document.getElementById("tableWrap");
    const limitEl = document.getElementById("limit");
    const refreshBtn = document.getElementById("refresh");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function characterChips(characters) {
      if (!Array.isArray(characters) || !characters.length) {
        return '<span class="chip">No character data</span>';
      }
      return characters.map((entry) => {
        const label = entry.characterClass || "Unknown";
        const level = Number(entry.level) || 1;
        return '<span class="chip">' + escapeHtml(label) + ' Lv ' + level + '</span>';
      }).join("");
    }

    function renderRows(rows) {
      if (!rows.length) {
        tableWrap.innerHTML = '<div class="empty">No player stats submitted yet.</div>';
        return;
      }
      const body = rows.map((row) => {
        return '<tr>'
          + '<td class="rank" data-label="Rank">#' + row.rank + '</td>'
          + '<td class="player" data-label="Player">' + escapeHtml(row.player) + '</td>'
          + '<td class="metric" data-label="Combined Levels">' + (row.combinedCharacterLevels ?? 0) + '</td>'
          + '<td class="metric" data-label="Awakening Souls">' + (row.awakeningSoulsHeld ?? 0) + '</td>'
          + '<td class="metric" data-label="Top Level">' + (row.level ?? 1) + '</td>'
          + '<td class="metric" data-label="Rebirths">' + (row.rebirthCount ?? 0) + '</td>'
          + '<td data-label="Characters"><div class="characters">' + characterChips(row.characters) + '</div></td>'
          + '</tr>';
      }).join("");
      tableWrap.innerHTML = '<table><thead><tr>'
        + '<th>Rank</th><th>Player</th><th>Combined Levels</th><th>Awakening Souls</th><th>Top Level</th><th>Rebirths</th><th>Characters</th>'
        + '</tr></thead><tbody>' + body + '</tbody></table>';
    }

    async function loadLeaderboard() {
      const limit = Number(limitEl.value) || 250;
      statusEl.textContent = "Loading leaderboard...";
      tableWrap.innerHTML = "";
      try {
        const response = await fetch("/leaderboard?scope=accounts&limit=" + limit, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const payload = await response.json();
        statusEl.textContent = "Showing " + (payload.rows?.length ?? 0) + " players. Last updated " + new Date().toLocaleString() + ".";
        renderRows(payload.rows ?? []);
      } catch (error) {
        statusEl.textContent = "Unable to load leaderboard.";
        tableWrap.innerHTML = '<div class="empty">' + escapeHtml(error?.message || "Unknown error") + '</div>';
      }
    }

    const metricsEl = document.getElementById("metrics");
    const metricsStatusEl = document.getElementById("metricsStatus");

    function metricCard(value, label, sub) {
      return '<div class="metric-card">'
        + '<div class="value">' + escapeHtml(value) + '</div>'
        + '<div class="label">' + escapeHtml(label) + '</div>'
        + (sub ? '<div class="sub-value">' + escapeHtml(sub) + '</div>' : '')
        + '</div>';
    }

    function splitPercent(a, b) {
      const total = Number(a) + Number(b);
      if (!total) return "0% / 0%";
      const pa = Math.round((Number(a) / total) * 100);
      return pa + "% / " + (100 - pa) + "%";
    }

    async function loadMetrics() {
      metricsStatusEl.textContent = "Loading activity...";
      try {
        const response = await fetch("/metrics", { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const m = await response.json();
        const day = m.last24h || {};
        const all = m.allTime || {};
        metricsEl.innerHTML = [
          metricCard(m.onlineNow ?? 0, "Playing now", "last 5 min"),
          metricCard(m.dau ?? 0, "Players today", "last 24h"),
          metricCard(m.wau ?? 0, "Players this week", "last 7 days"),
          metricCard(m.totalPlayers ?? 0, "Players all-time", (m.totalSessions ?? 0) + " sessions"),
          metricCard((day.avgSessionMinutes ?? 0) + "m", "Avg session (24h)", (day.sessions ?? 0) + " sessions"),
          metricCard(splitPercent(day.foregroundHours, day.backgroundHours), "Foreground / background", (day.foregroundHours ?? 0) + "h / " + (day.backgroundHours ?? 0) + "h (24h)"),
          metricCard(splitPercent(day.combatHours, day.idleHours), "Active / idle play", (day.combatHours ?? 0) + "h / " + (day.idleHours ?? 0) + "h (24h)"),
          metricCard((all.totalHours ?? 0) + "h", "Total play all-time", (all.combatHours ?? 0) + "h active / " + (all.idleHours ?? 0) + "h idle"),
        ].join("");
        metricsStatusEl.textContent = "Updated " + new Date().toLocaleString() + ".";
      } catch (error) {
        metricsStatusEl.textContent = "Unable to load activity.";
        metricsEl.innerHTML = '<div class="empty">' + escapeHtml(error?.message || "Unknown error") + '</div>';
      }
    }

    refreshBtn.addEventListener("click", () => { loadMetrics(); loadLeaderboard(); });
    limitEl.addEventListener("change", loadLeaderboard);
    loadMetrics();
    loadLeaderboard();
  </script>
</body>
</html>`;
