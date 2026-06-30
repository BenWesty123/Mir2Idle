export const MESSAGE_MODERATION_PANEL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LOM Idle V2 Message Moderation</title>
  <style>
    :root { color-scheme:dark; --bg:#120f0c; --panel:#211911; --line:#594324; --text:#f3e5c4; --muted:#b39868; --gold:#e1b45d; --bad:#e06b55; --good:#67c9a8; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; padding:24px; background:var(--bg); color:var(--text); font:14px/1.45 system-ui,sans-serif; }
    main { width:min(920px,100%); margin:auto; }
    h1 { margin:0; color:var(--gold); font:700 27px Georgia,serif; }
    .sub,.status,.meta { color:var(--muted); }
    .login,.toolbar,.message { border:1px solid var(--line); background:var(--panel); }
    .login { display:flex; gap:8px; margin:18px 0; padding:12px; }
    input,button { min-height:36px; border:1px solid var(--line); background:#0d0a08; color:var(--text); padding:7px 10px; }
    input { flex:1; min-width:160px; }
    button { cursor:pointer; }
    button:hover { border-color:var(--gold); }
    button.active { border-color:var(--gold); color:var(--gold); }
    button.danger { border-color:#8b3d31; color:#ffc0b4; }
    button.good { border-color:#2f7962; color:#a9efda; }
    .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px; margin:0 0 12px; }
    .status { min-height:21px; margin:10px 0; }
    .messages { display:grid; gap:10px; }
    .message { padding:12px; }
    .message header { display:flex; justify-content:space-between; gap:12px; align-items:start; }
    .message h2 { margin:0; font-size:16px; color:#ffe0a0; }
    .meta { font-size:12px; overflow-wrap:anywhere; }
    .body { margin:12px 0; padding:10px; border-left:3px solid var(--gold); background:#130e09; white-space:pre-wrap; overflow-wrap:anywhere; }
    .pill { padding:3px 7px; border:1px solid var(--line); font-size:11px; text-transform:uppercase; }
    .pill.visible { color:#a9efda; border-color:#2f7962; }
    .pill.removed { color:#ff9d8b; border-color:#8b3d31; }
    .actions { display:flex; gap:8px; margin-top:10px; }
    .empty { padding:28px; border:1px dashed var(--line); color:var(--muted); text-align:center; }
    code { color:#e8c887; }
    [hidden] { display:none !important; }
    @media (max-width:600px) { body{padding:12px}.login{display:grid}.message header{display:grid}.toolbar button{flex:1} }
  </style>
</head>
<body>
  <main>
    <h1>Town Message Moderation</h1>
    <p class="sub">Delete messages from the public board or restore anything removed by mistake.</p>
    <section class="login" id="login">
      <input id="token" type="password" autocomplete="current-password" placeholder="Admin token" />
      <button id="connect" type="button">Open Moderation</button>
    </section>
    <section id="moderationArea" hidden>
      <div class="toolbar">
        <button type="button" data-filter="visible" class="active">Live</button>
        <button type="button" data-filter="removed">Removed</button>
        <button type="button" data-filter="all">All</button>
        <button type="button" id="refresh">Refresh</button>
        <button type="button" id="logout">Lock</button>
      </div>
      <p class="status" id="status"></p>
      <div class="messages" id="messages"></div>
    </section>
  </main>
  <script>
    const tokenInput = document.getElementById("token");
    const login = document.getElementById("login");
    const moderationArea = document.getElementById("moderationArea");
    const messages = document.getElementById("messages");
    const status = document.getElementById("status");
    let filter = "visible";
    let token = sessionStorage.getItem("lomIntegrityAdminToken") || "";
    tokenInput.value = token;

    function escapeHtml(value) {
      return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
    }
    function renderRows(rows) {
      if (!rows.length) { messages.innerHTML = '<div class="empty">No messages in this view.</div>'; return; }
      messages.innerHTML = rows.map((row) => '<article class="message">'
        + '<header><div><h2>' + escapeHtml(row.playerLabel) + ' - ' + escapeHtml(row.characterClass) + ' Lv ' + escapeHtml(row.characterLevel) + '</h2>'
        + '<div class="meta"><code>' + escapeHtml(row.playerId) + '</code> | Posted ' + escapeHtml(row.createdAt || "unknown") + ' | Expires ' + escapeHtml(row.expiresAt || "unknown") + '</div></div>'
        + '<span class="pill ' + escapeHtml(row.status) + '">' + escapeHtml(row.status) + '</span></header>'
        + '<div class="body">' + escapeHtml(row.body) + '</div>'
        + '<div class="actions">'
        + (row.status === "visible" ? '<button type="button" class="danger" data-action="remove" data-message-id="' + escapeHtml(row.id) + '">Delete Message</button>' : '')
        + (row.status === "removed" ? '<button type="button" class="good" data-action="restore" data-message-id="' + escapeHtml(row.id) + '">Restore Message</button>' : '')
        + '</div></article>').join("");
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers:{ "Authorization":"Bearer " + token, "Content-Type":"application/json", ...(options.headers || {}) }, cache:"no-store" });
      if (response.status === 401) throw new Error("Incorrect or missing admin token.");
      if (!response.ok) { const data=await response.json().catch(()=>({})); throw new Error(data.error || "HTTP " + response.status); }
      return response.json();
    }
    async function load() {
      status.textContent = "Loading messages...";
      try {
        const payload = await api("/admin/town-messages?status=" + encodeURIComponent(filter));
        login.hidden = true; moderationArea.hidden = false;
        status.textContent = payload.rows.length + " message" + (payload.rows.length === 1 ? "" : "s") + ".";
        renderRows(payload.rows);
      } catch (error) { status.textContent = error.message; throw error; }
    }
    async function review(messageId, action) {
      status.textContent = action === "remove" ? "Deleting message..." : "Restoring message...";
      await api("/admin/town-messages/review", { method:"POST", body:JSON.stringify({ messageId, action }) });
      await load();
    }
    document.getElementById("connect").addEventListener("click", async () => {
      token = tokenInput.value.trim(); if (!token) return;
      sessionStorage.setItem("lomIntegrityAdminToken", token);
      try { await load(); } catch {}
    });
    document.getElementById("refresh").addEventListener("click", () => load().catch(() => {}));
    document.getElementById("logout").addEventListener("click", () => { token=""; sessionStorage.removeItem("lomIntegrityAdminToken"); moderationArea.hidden=true; login.hidden=false; tokenInput.value=""; });
    document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter=button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((row) => row.classList.toggle("active", row===button)); load().catch(() => {}); }));
    messages.addEventListener("click", (event) => { const button=event.target.closest("[data-action][data-message-id]"); if (!button) return; review(Number(button.dataset.messageId), button.dataset.action).catch((error) => { status.textContent=error.message; }); });
    if (token) load().catch(() => {});
  </script>
</body>
</html>`;
