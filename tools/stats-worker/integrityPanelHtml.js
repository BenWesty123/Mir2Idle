export const INTEGRITY_PANEL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LOM Idle V2 Integrity Review</title>
  <style>
    :root { color-scheme: dark; --bg:#120f0c; --panel:#211911; --line:#594324; --text:#f3e5c4; --muted:#b39868; --gold:#e1b45d; --bad:#e06b55; --good:#67c9a8; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; padding:24px; background:#120f0c; color:var(--text); font:14px/1.45 system-ui,sans-serif; }
    main { width:min(1120px,100%); margin:auto; }
    h1 { margin:0; color:var(--gold); font:700 27px Georgia,serif; }
    .sub,.status { color:var(--muted); }
    .login,.toolbar,.review,.manual-remove { border:1px solid var(--line); background:var(--panel); }
    .login { display:flex; gap:8px; margin:18px 0; padding:12px; }
    input,button,select { min-height:36px; border:1px solid var(--line); background:#0d0a08; color:var(--text); padding:7px 10px; }
    input { flex:1; min-width:160px; }
    button { cursor:pointer; }
    button:hover { border-color:var(--gold); }
    button.danger { border-color:#8b3d31; color:#ffc0b4; }
    button.good { border-color:#2f7962; color:#a9efda; }
    .toolbar { display:flex; gap:8px; align-items:center; padding:10px; margin:0 0 12px; }
    .manual-remove { display:grid; gap:8px; padding:12px; margin:0 0 12px; }
    .manual-remove strong { color:#ffe0a0; }
    .manual-remove-row { display:flex; gap:8px; }
    .manual-remove .meta { margin:0; }
    .toolbar button.active { border-color:var(--gold); color:var(--gold); }
    .status { min-height:21px; margin:10px 0; }
    .reviews { display:grid; gap:10px; }
    .review { padding:12px; }
    .review header { display:flex; justify-content:space-between; gap:12px; align-items:start; }
    .review h2 { margin:0; font-size:16px; color:#ffe0a0; }
    .meta { color:var(--muted); font-size:12px; }
    .pill { padding:3px 7px; border:1px solid var(--line); font-size:11px; text-transform:uppercase; }
    .pill.flagged { color:#ffd185; border-color:#9a6d27; }
    .pill.excluded { color:#ff9d8b; border-color:#8b3d31; }
    .violations { display:grid; gap:5px; margin:10px 0; }
    .violation { padding:7px 9px; border-left:3px solid var(--bad); background:#150d0a; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .empty { padding:28px; border:1px dashed var(--line); color:var(--muted); text-align:center; }
    code { color:#e8c887; }
    [hidden] { display:none !important; }
  </style>
</head>
<body>
  <main>
    <h1>Integrity Review</h1>
    <p class="sub">Flagged players remain visible in Social until you approve their removal.</p>
    <section class="login" id="login">
      <input id="token" type="password" autocomplete="current-password" placeholder="Admin token" />
      <button id="connect" type="button">Open Review Queue</button>
    </section>
    <section id="reviewArea" hidden>
      <div class="manual-remove">
        <strong>Manual Social Removal</strong>
        <div class="manual-remove-row">
          <input id="manualPlayer" type="text" autocomplete="off" placeholder="Player XXXXXXXX or full player ID" />
          <button id="manualRemove" type="button" class="danger">Remove From Social</button>
        </div>
        <p class="meta">Use the identifier shown on the Social page. Ambiguous short identifiers are refused.</p>
      </div>
      <div class="toolbar">
        <button type="button" data-filter="flagged" class="active">Pending</button>
        <button type="button" data-filter="excluded">Removed</button>
        <button type="button" data-filter="all">All</button>
        <button type="button" id="refresh">Refresh</button>
        <button type="button" id="logout">Lock</button>
      </div>
      <p class="status" id="status"></p>
      <div class="reviews" id="reviews"></div>
    </section>
  </main>
  <script>
    const tokenInput = document.getElementById("token");
    const login = document.getElementById("login");
    const reviewArea = document.getElementById("reviewArea");
    const reviews = document.getElementById("reviews");
    const status = document.getElementById("status");
    const manualPlayer = document.getElementById("manualPlayer");
    let filter = "flagged";
    let token = sessionStorage.getItem("lomIntegrityAdminToken") || "";
    tokenInput.value = token;

    function escapeHtml(value) {
      return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
    }
    function violationRows(reason) {
      let rows = [];
      try { rows = JSON.parse(reason || "[]"); } catch {}
      if (!Array.isArray(rows) || !rows.length) return '<div class="violation">No detailed reason recorded.</div>';
      return rows.map((row) => '<div class="violation"><strong>' + escapeHtml(row.detail || row.code) + '</strong><div class="meta">' + escapeHtml([row.characterClass,row.slotId,row.itemId,row.code].filter(Boolean).join(" · ")) + '</div></div>').join("");
    }
    function renderRows(rows) {
      if (!rows.length) { reviews.innerHTML = '<div class="empty">Nothing in this queue.</div>'; return; }
      reviews.innerHTML = rows.map((row) => '<article class="review">'
        + '<header><div><h2>' + escapeHtml(row.playerLabel) + '</h2><div class="meta"><code>' + escapeHtml(row.playerId) + '</code> · Rules ' + escapeHtml(row.rulesVersion || "unknown") + '</div></div><span class="pill ' + escapeHtml(row.status) + '">' + escapeHtml(row.status) + '</span></header>'
        + '<div class="violations">' + violationRows(row.reason) + '</div>'
        + '<div class="meta">Flagged: ' + escapeHtml(row.flaggedAt || "unknown") + (row.reviewedAt ? ' · Reviewed: ' + escapeHtml(row.reviewedAt) : '') + '</div>'
        + '<div class="actions">'
        + (row.status === "flagged" ? '<button type="button" class="good" data-action="keep" data-player="' + escapeHtml(row.playerId) + '">Keep Visible</button><button type="button" class="danger" data-action="exclude" data-player="' + escapeHtml(row.playerId) + '">Remove From Social</button>' : '')
        + (row.status === "excluded" ? '<button type="button" class="good" data-action="restore" data-player="' + escapeHtml(row.playerId) + '">Restore To Social</button>' : '')
        + '</div></article>').join("");
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers:{ "Authorization":"Bearer " + token, "Content-Type":"application/json", ...(options.headers || {}) }, cache:"no-store" });
      if (response.status === 401) throw new Error("Incorrect or missing admin token.");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.error || "HTTP " + response.status);
        error.matches = payload.matches || [];
        throw error;
      }
      return response.json();
    }
    async function load() {
      status.textContent = "Loading review queue...";
      try {
        const payload = await api("/admin/integrity?status=" + encodeURIComponent(filter));
        login.hidden = true; reviewArea.hidden = false;
        status.textContent = payload.rows.length + " account" + (payload.rows.length === 1 ? "" : "s") + ".";
        renderRows(payload.rows);
      } catch (error) { status.textContent = error.message; throw error; }
    }
    async function review(playerId, action) {
      status.textContent = "Saving review...";
      await api("/admin/integrity/review", { method:"POST", body:JSON.stringify({ playerId, action }) });
      await load();
    }
    async function manualExclude() {
      const player = manualPlayer.value.trim();
      if (!player) { status.textContent = "Enter a Social identifier first."; return; }
      status.textContent = "Removing player from Social...";
      try {
        const result = await api("/admin/integrity/manual-exclude", { method:"POST", body:JSON.stringify({ player }) });
        manualPlayer.value = "";
        filter = "excluded";
        document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
        await load();
        status.textContent = result.playerLabel + " removed from Social.";
      } catch (error) {
        const matches = Array.isArray(error.matches) && error.matches.length
          ? " Matches: " + error.matches.map((row) => row.playerId).join(", ")
          : "";
        status.textContent = error.message + matches;
      }
    }
    document.getElementById("connect").addEventListener("click", async () => {
      token = tokenInput.value.trim(); if (!token) return;
      sessionStorage.setItem("lomIntegrityAdminToken", token);
      try { await load(); } catch {}
    });
    document.getElementById("refresh").addEventListener("click", () => load().catch(() => {}));
    document.getElementById("logout").addEventListener("click", () => { token=""; sessionStorage.removeItem("lomIntegrityAdminToken"); reviewArea.hidden=true; login.hidden=false; tokenInput.value=""; });
    document.getElementById("manualRemove").addEventListener("click", () => manualExclude());
    manualPlayer.addEventListener("keydown", (event) => { if (event.key === "Enter") manualExclude(); });
    document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter=button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((row) => row.classList.toggle("active", row===button)); load().catch(() => {}); }));
    reviews.addEventListener("click", (event) => { const button=event.target.closest("[data-action][data-player]"); if (!button) return; review(button.dataset.player, button.dataset.action).catch((error) => { status.textContent=error.message; }); });
    if (token) load().catch(() => {});
  </script>
</body>
</html>`;
