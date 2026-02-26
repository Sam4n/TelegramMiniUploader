// =============================================================================
// USERS — credentials, Telegram chat IDs, and avatar filenames
// Place avatar images in public/avatars/<filename>
// If a user has no avatar, set avatar to null
// =============================================================================
const USERS = [
  { username: "saman", password: "CHANGE_ME_admin_password", telegram_chat_id: "YOUR_CHAT_ID", avatar: "saman.jpg", isAdmin: true },
  { username: "javad", password: "CHANGE_ME_user1_password",  telegram_chat_id: "USER1_CHAT_ID", avatar: "javad.jpg" },
  { username: "domenico",  password: "CHANGE_ME_admin_password", telegram_chat_id: "123456789", avatar: "saeed.jpg" }
];

// =============================================================================
// JWT HELPERS — HMAC-SHA256 via crypto.subtle (Workers built-in, no library)
// =============================================================================

function b64urlEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad), c => c.charCodeAt(0));
}

async function createToken(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body   = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig    = await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64urlEncode(sig)}`;
}

async function verifyToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sigB64] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC", key,
    b64urlDecode(sigB64),
    enc.encode(`${header}.${body}`)
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// =============================================================================
// HTML_PAGE — warm dark product UI, orange accent, refined (not cyber)
// =============================================================================

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Uplink &mdash; File Uploader</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Azeret+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:          #07090e;
      --surface:     rgba(13, 16, 25, 0.92);
      --border:      rgba(255, 255, 255, 0.07);
      --border-warm: rgba(255, 85, 0, 0.2);
      --accent:      #ff5500;
      --accent-lt:   #ff7a2e;
      --accent-gold: #ffb547;
      --text:        #ebe5dd;
      --text-muted:  rgba(235, 229, 221, 0.45);
      --success:     #00e8a0;
      --success-bg:  rgba(0, 232, 160, 0.08);
      --error:       #ff3355;
      --error-bg:    rgba(255, 51, 85, 0.09);
      --mono: 'Azeret Mono', 'Courier New', monospace;
      --sans: 'Syne', system-ui, sans-serif;
      --radius-card: 18px;
      --radius-el:   10px;
      --radius-sm:   7px;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      background: var(--bg);
      display: grid;
      place-items: center;
      font-family: var(--mono);
      color: var(--text);
      position: relative;
      overflow: hidden;
    }

    /* ── Soft ambient background ── */
    .bg-orb {
      position: fixed; border-radius: 50%;
      filter: blur(120px); pointer-events: none; z-index: 0;
    }
    .bg-orb-1 {
      width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(255,85,0,0.09) 0%, transparent 65%);
      top: -250px; right: -200px;
      animation: orbA 28s ease-in-out infinite alternate;
    }
    .bg-orb-2 {
      width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(255,160,60,0.06) 0%, transparent 65%);
      bottom: -200px; left: -150px;
      animation: orbB 34s ease-in-out infinite alternate;
    }
    @keyframes orbA {
      from { transform: translate(0, 0); }
      to   { transform: translate(30px, 18px); }
    }
    @keyframes orbB {
      from { transform: translate(0, 0); }
      to   { transform: translate(-20px, 28px); }
    }

    /* ── Card ── */
    .card {
      position: relative; z-index: 1;
      width: 100%; max-width: 460px;
      margin: 1.5rem;
      padding: 2.5rem 2.5rem 2.25rem;
      background: var(--surface);
      backdrop-filter: blur(32px);
      -webkit-backdrop-filter: blur(32px);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.03) inset,
        0 40px 80px rgba(0,0,0,0.6),
        0 0 60px rgba(255,85,0,0.05);
      animation: cardIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(22px) scale(0.97); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Brand header ── */
    .brand {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .brand-icon {
      width: 36px; height: 36px;
      background: var(--accent);
      border-radius: 9px;
      display: grid; place-items: center; flex-shrink: 0;
      box-shadow: 0 4px 16px rgba(255,85,0,0.35);
    }
    .brand-icon svg { width: 18px; height: 18px; fill: #000; }
    .brand-name {
      font-family: var(--sans); font-weight: 700;
      font-size: 1rem; letter-spacing: 0.04em; color: var(--text);
    }
    .brand-sub {
      font-size: 0.68rem; color: var(--text-muted);
      margin-top: 2px; letter-spacing: 0.02em;
    }

    /* ── Login headings ── */
    .view-title {
      font-family: var(--sans); font-weight: 800;
      font-size: 1.85rem; letter-spacing: -0.02em; line-height: 1.1;
      margin-bottom: 0.3rem;
    }
    .view-title em { font-style: normal; color: var(--accent); }
    .view-sub {
      font-size: 0.78rem; color: var(--text-muted);
      margin-bottom: 1.75rem; letter-spacing: 0.01em;
    }

    /* ── Form fields ── */
    .field { margin-bottom: 1rem; }
    .field label {
      display: block; font-size: 0.7rem; font-weight: 500;
      color: var(--text-muted); letter-spacing: 0.06em;
      text-transform: uppercase; margin-bottom: 6px;
    }
    .field input {
      display: block; width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      outline: none; padding: 0.7rem 0.85rem;
      color: var(--text); font-family: var(--mono); font-size: 0.9rem;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .field input::placeholder { color: var(--text-muted); opacity: 0.6; }
    .field input:focus {
      border-color: rgba(255,85,0,0.5);
      background: rgba(255,85,0,0.04);
      box-shadow: 0 0 0 3px rgba(255,85,0,0.1);
    }

    /* ── Primary button ── */
    .btn-primary {
      display: block; width: 100%; margin-top: 1.25rem;
      padding: 0.85rem 1rem;
      background: var(--accent); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-family: var(--sans); font-weight: 700;
      font-size: 0.85rem; letter-spacing: 0.06em;
      cursor: pointer; position: relative; overflow: hidden;
      transition: background 0.18s, box-shadow 0.18s, transform 0.1s;
    }
    .btn-primary::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
      opacity: 0; transition: opacity 0.2s;
    }
    .btn-primary:hover {
      background: var(--accent-lt);
      box-shadow: 0 0 32px rgba(255,85,0,0.4), 0 4px 16px rgba(255,85,0,0.2);
    }
    .btn-primary:hover::after { opacity: 1; }
    .btn-primary:active { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

    /* ── Alerts ── */
    .alert {
      display: none; margin-top: 0.85rem;
      padding: 0.65rem 0.9rem; font-size: 0.78rem;
      border-radius: var(--radius-sm);
      border: 1px solid; letter-spacing: 0.01em;
      animation: fadeUp 0.2s ease;
    }
    .alert.error { background: var(--error-bg); border-color: rgba(255,51,85,0.3); color: rgba(255,100,120,0.95); }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Upload topbar with avatar ── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.75rem;
    }
    .user-chip { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar-img {
      width: 54px; height: 54px; border-radius: 50%;
      object-fit: cover; display: block;
      border: 2px solid rgba(255,85,0,0.35);
      box-shadow: 0 0 20px rgba(255,85,0,0.22);
    }
    .avatar-fb {
      width: 54px; height: 54px; border-radius: 50%;
      background: var(--accent); color: #000;
      display: none; align-items: center; justify-content: center;
      font-family: var(--sans); font-weight: 800; font-size: 1rem;
      border: 2px solid var(--accent-lt);
      box-shadow: 0 0 20px rgba(255,85,0,0.3);
    }
    .live-dot {
      position: absolute; bottom: 1px; right: 1px;
      width: 11px; height: 11px; border-radius: 50%;
      background: var(--success); box-shadow: 0 0 7px var(--success);
      border: 2px solid var(--bg);
      animation: pulse 2.4s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
    .user-info { min-width: 0; }
    .user-label { font-size: 0.62rem; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
    .user-name-text { font-family: var(--sans); font-size: 0.95rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-logout {
      font-family: var(--mono); font-size: 0.68rem;
      letter-spacing: 0.06em; text-transform: uppercase;
      background: none; border: 1px solid var(--border);
      color: var(--text-muted); padding: 0.35rem 0.8rem;
      border-radius: var(--radius-sm); cursor: pointer; flex-shrink: 0;
      transition: border-color 0.2s, color 0.2s;
    }
    .btn-logout:hover { border-color: rgba(255,51,85,0.4); color: var(--error); }

    /* ── Section label ── */
    .section-label {
      font-size: 0.68rem; font-weight: 500; color: var(--text-muted);
      letter-spacing: 0.1em; text-transform: uppercase;
      margin-bottom: 0.75rem;
    }

    /* ── Drop zone ── */
    .drop-zone {
      position: relative;
      padding: 2.25rem 1.5rem;
      border: 1px dashed rgba(255,85,0,0.22);
      border-radius: var(--radius-el);
      text-align: center; cursor: pointer; overflow: hidden;
      margin-bottom: 0.75rem;
      transition: border-color 0.2s, background 0.2s, padding 0.3s;
    }
    .drop-zone.compact { padding: 1rem 1.5rem; }
    .drop-zone.compact .drop-ring { width: 30px; height: 30px; margin-bottom: 0.4rem; }
    .drop-zone.compact .drop-ring svg { width: 13px; height: 13px; }
    .drop-zone.compact .drop-title { font-size: 0.8rem; margin-bottom: 0; }
    .drop-zone.compact .drop-hint  { font-size: 0.62rem; }

    .drop-bg {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse at 50% 120%, rgba(255,85,0,0.07), transparent 55%);
      opacity: 0; transition: opacity 0.3s; border-radius: inherit;
    }
    .drop-zone:hover .drop-bg, .drop-zone.dragover .drop-bg { opacity: 1; }
    .drop-zone.dragover { border-color: rgba(255,85,0,0.5); border-style: solid; background: rgba(255,85,0,0.03); }

    .drop-ring {
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 50%;
      border: 1px solid rgba(255,85,0,0.22); margin-bottom: 0.85rem;
      transition: border-color 0.2s, box-shadow 0.2s, width 0.3s, height 0.3s;
    }
    .drop-zone.dragover .drop-ring { border-color: var(--accent); box-shadow: 0 0 18px rgba(255,85,0,0.25); }
    .drop-ring svg {
      width: 22px; height: 22px; stroke: var(--accent); stroke-width: 1.5;
      fill: none; stroke-linecap: round; stroke-linejoin: round;
      transition: width 0.3s, height 0.3s;
    }
    .drop-title {
      font-family: var(--sans); font-weight: 600; font-size: 0.92rem;
      color: var(--text); margin-bottom: 0.3rem;
      transition: font-size 0.3s;
    }
    .drop-hint { font-size: 0.72rem; color: var(--text-muted); transition: font-size 0.3s; }
    #file-input { display: none; }

    /* ── File queue ── */
    .file-list {
      display: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-el); overflow: hidden;
      margin-bottom: 0.6rem;
      max-height: 210px; overflow-y: auto;
    }
    .file-list::-webkit-scrollbar { width: 4px; }
    .file-list::-webkit-scrollbar-track { background: transparent; }
    .file-list::-webkit-scrollbar-thumb { background: rgba(255,85,0,0.25); border-radius: 2px; }

    .file-item {
      display: flex; align-items: center; gap: 10px;
      padding: 0.6rem 0.85rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s;
    }
    .file-item:last-child { border-bottom: none; }
    .file-item.uploading { background: rgba(255,85,0,0.05); }
    .file-item.done      { background: rgba(0,232,160,0.04); }
    .file-item.error     { background: rgba(255,51,85,0.05); }

    .fi-icon { font-size: 0.8rem; width: 16px; text-align: center; flex-shrink: 0; line-height: 1; }
    .fi-icon.pending   { color: var(--text-muted); }
    .fi-icon.uploading { color: var(--accent); animation: iconBob 0.7s ease-in-out infinite alternate; }
    .fi-icon.done      { color: var(--success); }
    .fi-icon.error     { color: var(--error); }
    @keyframes iconBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }

    .fi-info { flex: 1; min-width: 0; }
    .fi-name { font-size: 0.78rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fi-meta { font-size: 0.65rem; color: var(--text-muted); margin-top: 2px; }
    .fi-meta.err { color: rgba(255,80,110,0.85); }
    .fi-remove {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 1.05rem; padding: 0 3px; line-height: 1;
      flex-shrink: 0; transition: color 0.15s;
    }
    .fi-remove:hover { color: var(--error); }

    .queue-summary {
      font-size: 0.65rem; color: var(--text-muted);
      letter-spacing: 0.06em; text-transform: uppercase;
      text-align: right; margin-bottom: 0.65rem;
    }

    /* ── Progress ── */
    .progress-label {
      display: none; font-size: 0.68rem; color: var(--text-muted);
      letter-spacing: 0.03em; margin-bottom: 6px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .progress-wrap {
      display: none; height: 3px;
      background: rgba(255,255,255,0.06);
      border-radius: 3px; overflow: hidden; margin-bottom: 0.85rem;
    }
    .progress-bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent-gold));
      border-radius: 3px; transition: width 0.1s linear;
      box-shadow: 0 0 6px rgba(255,85,0,0.5);
      position: relative; overflow: hidden;
    }
    .progress-bar::after {
      content: ''; position: absolute;
      top: 0; bottom: 0; right: 0; width: 50px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: shim 1s linear infinite;
    }
    @keyframes shim {
      from { transform: translateX(-50px); }
      to   { transform: translateX(50px); }
    }

    /* ── Result messages ── */
    .result-msg {
      display: none; margin-top: 0.75rem;
      padding: 0.65rem 0.9rem; font-size: 0.78rem;
      border-radius: var(--radius-sm); border: 1px solid;
      letter-spacing: 0.01em; animation: fadeUp 0.25s ease;
    }
    .result-msg.success { background: var(--success-bg); border-color: rgba(0,232,160,0.25); color: rgba(0,220,150,0.95); }
    .result-msg.error   { background: var(--error-bg);   border-color: rgba(255,51,85,0.3);  color: rgba(255,100,120,0.95); }
    .result-msg a { color: var(--accent-gold); text-decoration: none; }
    .result-msg a:hover { text-decoration: underline; }

    /* ── Download link in queue ── */
    .fi-dl {
      font-size: 0.65rem; color: var(--accent-gold);
      text-decoration: none; flex-shrink: 0; white-space: nowrap;
    }
    .fi-dl:hover { text-decoration: underline; }

    /* ── Retry button ── */
    .fi-retry {
      background: none; border: 1px solid rgba(255,181,71,0.35); cursor: pointer;
      color: var(--accent-gold); font-size: 0.72rem; padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm); flex-shrink: 0; line-height: 1.4;
      transition: background 0.15s, color 0.15s;
    }
    .fi-retry:hover { background: rgba(255,181,71,0.12); }

    /* ── Footer ── */
    .foot {
      display: flex; align-items: center; gap: 8px;
      margin-top: 1.5rem; padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.04em;
    }
    .foot-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      background: var(--success); box-shadow: 0 0 5px var(--success);
    }

    /* ── Admin panel ── */
    .admin-panel {
      display: none;
      margin-top: 1.25rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-el);
      background: rgba(255,181,71,0.04);
    }
    .admin-panel .section-label { margin-bottom: 0.6rem; color: var(--accent-gold); }
    .webhook-status {
      font-size: 0.75rem; color: var(--text-muted);
      margin-bottom: 0.75rem; word-break: break-all;
    }
    .webhook-status span { color: var(--text); }
    .admin-btns { display: flex; gap: 0.6rem; }
    .btn-admin {
      flex: 1; padding: 0.55rem 0.7rem;
      font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.04em;
      border-radius: var(--radius-sm); cursor: pointer; border: 1px solid;
      transition: background 0.15s, color 0.15s;
    }
    .btn-set-wh  { background: rgba(255,181,71,0.1); border-color: rgba(255,181,71,0.3); color: var(--accent-gold); }
    .btn-set-wh:hover  { background: rgba(255,181,71,0.18); }
    .btn-del-wh  { background: rgba(255,51,85,0.07); border-color: rgba(255,51,85,0.25); color: var(--error); }
    .btn-del-wh:hover  { background: rgba(255,51,85,0.13); }
  </style>
</head>
<body>

<div class="bg-orb bg-orb-1"></div>
<div class="bg-orb bg-orb-2"></div>

<!-- ═══════════════ LOGIN VIEW ═══════════════ -->
<div class="card" id="login-view">

  <div class="brand">
    <div class="brand-icon">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </div>
    <div>
      <div class="brand-name">Uplink</div>
      <div class="brand-sub">Telegram File Uploader</div>
    </div>
  </div>

  <div class="view-title">Sign <em>in</em></div>
  <div class="view-sub">Send files straight to Telegram.</div>

  <form id="login-form" autocomplete="off">
    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" placeholder="e.g. saman" required />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" required />
    </div>
    <button class="btn-primary" type="submit" id="login-btn">Sign In</button>
    <div class="alert error" id="login-error"></div>
  </form>

  <div class="foot">
    <div class="foot-dot"></div>
    <span>Secured with JWT &middot; Sessions last 24 hours</span>
  </div>

</div>

<!-- ═══════════════ UPLOAD VIEW ═══════════════ -->
<div class="card" id="upload-view" style="display:none">

  <div class="topbar">
    <div class="user-chip">
      <div class="avatar-wrap">
        <img id="avatar-img" class="avatar-img" src="" alt=""
             onerror="this.style.display='none';document.getElementById('avatar-fb').style.display='flex'" />
        <div id="avatar-fb" class="avatar-fb"><span id="avatar-initials"></span></div>
        <div class="live-dot"></div>
      </div>
      <div class="user-info">
        <div class="user-label">Signed in as</div>
        <div class="user-name-text" id="display-name"></div>
      </div>
    </div>
    <button class="btn-logout" id="logout-btn">Log out</button>
  </div>

  <div class="section-label">Upload files</div>

  <div class="drop-zone" id="drop-zone">
    <div class="drop-bg"></div>
    <div class="drop-ring">
      <svg viewBox="0 0 24 24">
        <polyline points="16 16 12 12 8 16"></polyline>
        <line x1="12" y1="12" x2="12" y2="21"></line>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
      </svg>
    </div>
    <div class="drop-title" id="drop-title">Drop files here</div>
    <div class="drop-hint">or click to browse &middot; up to 50 MB each</div>
  </div>
  <input type="file" id="file-input" multiple />

  <div class="file-list" id="file-list"></div>
  <div class="queue-summary" id="queue-summary"></div>

  <div class="progress-label" id="progress-label"></div>
  <div class="progress-wrap" id="progress-wrap">
    <div class="progress-bar" id="progress-bar"></div>
  </div>

  <button class="btn-primary" id="upload-btn">Upload Files</button>
  <div class="result-msg" id="result-msg"></div>

  <div class="foot">
    <div class="foot-dot"></div>
    <span>Files are forwarded directly to Telegram &middot; nothing is stored</span>
  </div>

  <div class="admin-panel" id="admin-panel">
    <div class="section-label">&#9881; Webhook</div>
    <div class="webhook-status" id="webhook-status">Loading&hellip;</div>
    <div class="admin-btns">
      <button class="btn-admin btn-set-wh" id="set-wh-btn">Set Webhook</button>
      <button class="btn-admin btn-del-wh" id="del-wh-btn">Delete Webhook</button>
    </div>
  </div>

</div>

<script>
  var MAX_BYTES = 50 * 1024 * 1024;

  function getToken()   { return localStorage.getItem("tmu_token"); }
  function setToken(t)  { localStorage.setItem("tmu_token", t); }
  function clearToken() { localStorage.removeItem("tmu_token"); }

  function parsePayload(token) {
    try {
      var b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64));
    } catch(e) { return null; }
  }

  function showView(name) {
    document.getElementById("login-view").style.display  = name === "login"  ? "" : "none";
    document.getElementById("upload-view").style.display = name === "upload" ? "" : "none";
    if (name === "upload") maybeShowAdmin();
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function escHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function initials(name) { return name ? name.slice(0,2).toUpperCase() : "??"; }

  function applyAvatar(payload) {
    var img = document.getElementById("avatar-img");
    var fb  = document.getElementById("avatar-fb");
    var ini = document.getElementById("avatar-initials");
    ini.textContent = initials(payload.sub);
    if (payload.avatar) {
      img.src = "/avatars/" + payload.avatar;
      img.style.display = "block";
      fb.style.display = "none";
    } else {
      img.style.display = "none";
      fb.style.display = "flex";
    }
  }

  // init
  (function() {
    var token = getToken();
    if (token) {
      var p = parsePayload(token);
      if (p && p.exp > Math.floor(Date.now() / 1000)) {
        document.getElementById("display-name").textContent = p.sub;
        applyAvatar(p);
        showView("upload");
        return;
      }
      clearToken();
    }
    showView("login");
  })();

  // login
  document.getElementById("login-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var btn   = document.getElementById("login-btn");
    var errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Signing in\u2026";

    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    })
    .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, d: d }; }); })
    .then(function(r) {
      if (!r.ok) throw new Error(r.d.error || "Login failed");
      setToken(r.d.token);
      var p = parsePayload(r.d.token);
      document.getElementById("display-name").textContent = p.sub;
      applyAvatar(p);
      showView("upload");
    })
    .catch(function(err) {
      errEl.textContent = err.message;
      errEl.style.display = "block";
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = "Sign In";
    });
  });

  // logout
  document.getElementById("logout-btn").addEventListener("click", function() {
    clearToken();
    fileQueue = [];
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    showView("login");
  });

  // file queue
  var fileQueue = [];

  function renderQueue() {
    var listEl    = document.getElementById("file-list");
    var summaryEl = document.getElementById("queue-summary");
    var dropZone  = document.getElementById("drop-zone");
    var dropTitle = document.getElementById("drop-title");

    if (fileQueue.length === 0) {
      listEl.style.display = "none";
      summaryEl.style.display = "none";
      dropZone.classList.remove("compact");
      dropTitle.textContent = "Drop files here";
      return;
    }

    dropZone.classList.add("compact");
    dropTitle.textContent = "Drop more files";

    listEl.innerHTML = "";
    var totalBytes = 0;
    fileQueue.forEach(function(item, i) {
      totalBytes += item.file.size;
      var iconChar = item.status === "done"      ? "&#10003;"
                   : item.status === "error"     ? "&#10007;"
                   : item.status === "uploading" ? "&#8593;"
                   : "&middot;";
      var row = document.createElement("div");
      row.className = "file-item " + item.status;
      row.innerHTML =
        '<div class="fi-icon ' + item.status + '">' + iconChar + '</div>' +
        '<div class="fi-info">' +
          '<div class="fi-name">' + escHtml(item.file.name) + '</div>' +
          '<div class="fi-meta' + (item.errMsg ? ' err' : '') + '">' +
            (item.errMsg ? escHtml(item.errMsg) : fmtSize(item.file.size)) +
          '</div>' +
        '</div>' +
        (item.status === "pending"
          ? '<button class="fi-remove" data-i="' + i + '" title="Remove">&times;</button>'
          : '') +
        (item.status === "error"
          ? '<button class="fi-retry" data-i="' + i + '" title="Retry">&#8635; Retry</button>'
          : '') +
        (item.status === "done" && item.downloadUrl
          ? ' <a class="fi-dl" href="' + item.downloadUrl + '" download="' + escHtml(item.file.name) + '">&#8595; Download</a>'
          : '');
      listEl.appendChild(row);
    });

    listEl.querySelectorAll(".fi-remove").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        fileQueue.splice(parseInt(this.getAttribute("data-i"), 10), 1);
        renderQueue();
      });
    });

    listEl.querySelectorAll(".fi-retry").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        retryFile(parseInt(this.getAttribute("data-i"), 10));
      });
    });

    listEl.style.display = "block";
    var pendingCount = fileQueue.filter(function(f) { return f.status === "pending"; }).length;
    summaryEl.textContent = fileQueue.length + " file" + (fileQueue.length !== 1 ? "s" : "")
      + " \u00B7 " + fmtSize(totalBytes)
      + (pendingCount < fileQueue.length ? " \u00B7 " + pendingCount + " pending" : "");
    summaryEl.style.display = "block";
  }

  function addFiles(fileList) {
    var existingNames = fileQueue.map(function(f) { return f.file.name; });
    var rejected = [];
    Array.prototype.forEach.call(fileList, function(file) {
      if (existingNames.indexOf(file.name) !== -1) return;
      if (file.size > MAX_BYTES) { rejected.push(file.name); return; }
      fileQueue.push({ file: file, status: "pending", errMsg: "" });
      existingNames.push(file.name);
    });
    renderQueue();
    if (rejected.length) {
      showResult("error", "Skipped (too large): " + rejected.map(escHtml).join(", "));
    } else {
      document.getElementById("result-msg").style.display = "none";
    }
  }

  var dropZone  = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  dropZone.addEventListener("click", function() { fileInput.click(); });
  fileInput.addEventListener("change", function() {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = "";
  });
  dropZone.addEventListener("dragover",  function(e) { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", function()  { dropZone.classList.remove("dragover"); });
  dropZone.addEventListener("drop", function(e) {
    e.preventDefault(); dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  function showResult(type, html) {
    var el = document.getElementById("result-msg");
    el.className = "result-msg " + type;
    el.innerHTML = html;
    el.style.display = "block";
  }

  function uploadFile(file, token, progressBar) {
    return new Promise(function(resolve, reject) {
      var form = new FormData();
      form.append("file", file, file.name);
      var xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", function(e) {
        if (e.lengthComputable) progressBar.style.width = Math.round(e.loaded / e.total * 100) + "%";
      });
      xhr.addEventListener("load", function() {
        try {
          var data = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && data.success) { resolve(data); return; }
          reject(new Error(data.error || "HTTP " + xhr.status));
        } catch(e) { reject(new Error("Server error")); }
      });
      xhr.addEventListener("error", function() { reject(new Error("Network error")); });
      xhr.open("POST", "/upload");
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.send(form);
    });
  }

  // ── Admin panel ──
  function isAdmin() {
    var p = parsePayload(getToken());
    return p && p.isAdmin === true;
  }

  function loadWebhookInfo() {
    var statusEl = document.getElementById("webhook-status");
    statusEl.innerHTML = "Loading&hellip;";
    fetch("/admin/webhook-info", { headers: { "Authorization": "Bearer " + getToken() } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.result && d.result.url) {
          statusEl.innerHTML = "Active: <span>" + escHtml(d.result.url) + "</span>"
            + (d.result.pending_update_count ? " &middot; " + d.result.pending_update_count + " pending" : "");
        } else {
          statusEl.innerHTML = '<span style="color:var(--text-muted)">Not set</span>';
        }
      })
      .catch(function() { statusEl.textContent = "Failed to load."; });
  }

  function maybeShowAdmin() {
    var panel = document.getElementById("admin-panel");
    if (isAdmin()) {
      panel.style.display = "block";
      loadWebhookInfo();
    } else {
      panel.style.display = "none";
    }
  }

  document.getElementById("set-wh-btn").addEventListener("click", function() {
    fetch("/admin/set-webhook", {
      method: "POST",
      headers: { "Authorization": "Bearer " + getToken() }
    })
    .then(function(r) { return r.json(); })
    .then(function() { loadWebhookInfo(); })
    .catch(function() {});
  });

  document.getElementById("del-wh-btn").addEventListener("click", function() {
    fetch("/admin/delete-webhook", {
      method: "POST",
      headers: { "Authorization": "Bearer " + getToken() }
    })
    .then(function(r) { return r.json(); })
    .then(function() { loadWebhookInfo(); })
    .catch(function() {});
  });

  async function retryFile(i) {
    var item = fileQueue[i];
    if (!item || item.status !== "error") return;
    var token = getToken();
    if (!token) { clearToken(); showView("login"); return; }

    var progressWrap = document.getElementById("progress-wrap");
    var progressBar  = document.getElementById("progress-bar");
    var progressLbl  = document.getElementById("progress-label");

    item.status = "uploading"; item.errMsg = "";
    renderQueue();
    progressBar.style.width = "0%";
    progressWrap.style.display = "block";
    progressLbl.style.display = "block";
    progressLbl.textContent = "Retrying \u2014 " + item.file.name;

    try {
      var result = await uploadFile(item.file, token, progressBar);
      item.status = "done"; item.downloadUrl = result.download_url || null;
    } catch(err) {
      item.status = "error"; item.errMsg = err.message;
    }

    renderQueue();
    progressLbl.style.display = "none";
    progressBar.style.width = "100%";
    setTimeout(function() { progressWrap.style.display = "none"; }, 1500);
  }

  document.getElementById("upload-btn").addEventListener("click", async function() {
    var pending = fileQueue.filter(function(f) { return f.status === "pending"; });
    if (pending.length === 0) { showResult("error", "No files queued. Drop some files first."); return; }
    var token = getToken();
    if (!token) { clearToken(); showView("login"); return; }

    var btn          = document.getElementById("upload-btn");
    var progressWrap = document.getElementById("progress-wrap");
    var progressBar  = document.getElementById("progress-bar");
    var progressLbl  = document.getElementById("progress-label");

    btn.disabled = true;
    btn.textContent = "Uploading\u2026";
    progressWrap.style.display = "block";
    progressLbl.style.display = "block";
    document.getElementById("result-msg").style.display = "none";

    var successCount = 0, errorCount = 0, doneIdx = 0;

    for (var i = 0; i < fileQueue.length; i++) {
      var item = fileQueue[i];
      if (item.status !== "pending") continue;
      doneIdx++;
      item.status = "uploading";
      renderQueue();
      progressBar.style.width = "0%";
      progressLbl.textContent = "Uploading " + doneIdx + " of " + pending.length + " \u2014 " + item.file.name;
      try {
        var result = await uploadFile(item.file, token, progressBar);
        item.status = "done"; item.downloadUrl = result.download_url || null; successCount++;
      } catch(err) {
        item.status = "error"; item.errMsg = err.message; errorCount++;
      }
      renderQueue();
    }

    btn.disabled = false;
    btn.textContent = "Upload Files";
    progressLbl.style.display = "none";
    progressBar.style.width = "100%";
    setTimeout(function() { progressWrap.style.display = "none"; }, 1500);

    if (errorCount === 0) {
      showResult("success", "&#10003; " + successCount + " file" + (successCount !== 1 ? "s" : "") + " sent to Telegram.");
      setTimeout(function() {
        fileQueue = fileQueue.filter(function(f) { return f.status !== "done"; });
        renderQueue();
      }, 2000);
    } else if (successCount === 0) {
      showResult("error", "All " + errorCount + " file" + (errorCount !== 1 ? "s" : "") + " failed. See details above.");
    } else {
      showResult("error", successCount + " sent, " + errorCount + " failed. See details above.");
    }
  });
</script>
</body>
</html>`;

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { username, password } = body ?? {};
  if (!username || !password) {
    return Response.json({ error: "Missing credentials" }, { status: 400 });
  }

  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const exp   = Math.floor(Date.now() / 1000) + 86400;
  const token = await createToken(
    { sub: user.username, chat_id: user.telegram_chat_id, avatar: user.avatar ?? null,
      isAdmin: user.isAdmin ?? false, exp },
    env.JWT_SECRET
  );

  return Response.json({ token }, { headers: corsHeaders() });
}

async function handleUpload(request, env) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  let formData;
  try { formData = await request.formData(); }
  catch { return Response.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
  }

  const tgForm = new FormData();
  tgForm.append("chat_id", payload.chat_id);
  tgForm.append("document", file, file.name);

  let tgRes;
  try {
    tgRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`,
      { method: "POST", body: tgForm }
    );
  } catch {
    return Response.json({ error: "Failed to reach Telegram API" }, { status: 502 });
  }

  const tgData = await tgRes.json();
  if (!tgData.ok) {
    return Response.json(
      { error: `Telegram error: ${tgData.description ?? "unknown"}` },
      { status: 502 }
    );
  }

  const messageId = tgData.result.message_id;
  const chatId    = String(payload.chat_id);
  let messageLink = null;
  if (chatId.startsWith("-100")) {
    messageLink = `https://t.me/c/${chatId.slice(4)}/${messageId}`;
  }

  const fileId = tgData.result.document?.file_id ?? null;
  let downloadUrl = null;
  if (fileId) {
    const dlExp = Math.floor(Date.now() / 1000) + 7 * 86400; // 7-day token
    const dlToken = await createToken(
      { file_id: fileId, name: file.name, exp: dlExp },
      env.JWT_SECRET
    );
    downloadUrl = "/dl/" + dlToken;
  }

  return Response.json(
    { success: true, message_id: messageId, message_link: messageLink, download_url: downloadUrl },
    { headers: corsHeaders() }
  );
}

async function handleDownload(request, env) {
  const token = new URL(request.url).pathname.slice(4); // strip "/dl/"
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload?.file_id) {
    return new Response("Invalid or expired download link.", { status: 401 });
  }

  // Get temporary file_path from Telegram
  const gfRes = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${payload.file_id}`
  );
  const gfData = await gfRes.json();
  if (!gfData.ok) {
    return new Response("File not found on Telegram.", { status: 404 });
  }

  // Fetch the actual file and stream it back
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${gfData.result.file_path}`
  );
  if (!fileRes.ok) {
    return new Response("Failed to fetch file from Telegram.", { status: 502 });
  }

  const safeName = encodeURIComponent(payload.name ?? "file");
  return new Response(fileRes.body, {
    headers: {
      "Content-Type":        fileRes.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Length":      fileRes.headers.get("Content-Length") ?? "",
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
      "Cache-Control":       "private, max-age=3600",
    },
  });
}

// =============================================================================
// WEBHOOK — receive Telegram updates and reply with proxy download links
// =============================================================================

async function tgSend(botToken, payload) {
  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function handleWebhook(request, env) {
  let update;
  try { update = await request.json(); } catch { return new Response("ok"); }

  const msg = update.message ?? update.channel_post;
  if (!msg) return new Response("ok");

  // Authorization: sender or chat must match a known user's telegram_chat_id
  const senderId   = String(msg.from?.id ?? "");
  const chatId     = String(msg.chat.id);
  const authorized = USERS.some(u =>
    u.telegram_chat_id === senderId || u.telegram_chat_id === chatId
  );

  if (!authorized) {
    await tgSend(env.BOT_TOKEN, {
      chat_id: msg.chat.id,
      reply_to_message_id: msg.message_id,
      text: "⛔ You are not authorized to use this bot.",
    });
    return new Response("ok");
  }

  // Detect file type and collect metadata
  const MAX_PROXY = 20 * 1024 * 1024; // Telegram bot API hard limit
  let fileId = null, fileName = null, fileSize = 0;

  if (msg.document) {
    fileId   = msg.document.file_id;
    fileName = msg.document.file_name ?? "file";
    fileSize = msg.document.file_size ?? 0;
  } else if (msg.photo) {
    const best = msg.photo[msg.photo.length - 1];
    fileId   = best.file_id;
    fileName = "photo.jpg";
    fileSize = best.file_size ?? 0;
  } else if (msg.video) {
    fileId   = msg.video.file_id;
    fileName = msg.video.file_name ?? "video.mp4";
    fileSize = msg.video.file_size ?? 0;
  } else if (msg.audio) {
    fileId   = msg.audio.file_id;
    fileName = msg.audio.file_name ?? msg.audio.title ?? "audio";
    fileSize = msg.audio.file_size ?? 0;
  }

  // No file — send instructions
  if (!fileId) {
    await tgSend(env.BOT_TOKEN, {
      chat_id: msg.chat.id,
      reply_to_message_id: msg.message_id,
      text: "📎 Send me a file (document, photo, video, or audio) and I\u2019ll reply with a proxy download link valid for 7 days.",
    });
    return new Response("ok");
  }

  // File too large to proxy via bot API
  if (fileSize > MAX_PROXY) {
    const mb = (fileSize / 1048576).toFixed(1);
    await tgSend(env.BOT_TOKEN, {
      chat_id: msg.chat.id,
      reply_to_message_id: msg.message_id,
      text: `\u26a0\ufe0f ${fileName} is ${mb}\u00a0MB \u2014 too large to proxy. Telegram limits bot downloads to 20\u00a0MB.`,
    });
    return new Response("ok");
  }

  // Build signed download link and reply with an inline button
  const origin  = new URL(request.url).origin;
  const dlExp   = Math.floor(Date.now() / 1000) + 7 * 86400;
  const dlToken = await createToken(
    { file_id: fileId, name: fileName, exp: dlExp },
    env.JWT_SECRET
  );
  const dlUrl = `${origin}/dl/${dlToken}`;

  await tgSend(env.BOT_TOKEN, {
    chat_id: msg.chat.id,
    reply_to_message_id: msg.message_id,
    text: `\ud83d\udcc1 ${fileName}`,
    reply_markup: {
      inline_keyboard: [[
        { text: "\u2b07\ufe0f Download (7 days)", url: dlUrl },
      ]],
    },
  });

  return new Response("ok");
}

// =============================================================================
// ADMIN HELPERS & ROUTE HANDLERS
// =============================================================================

async function requireAdmin(request, env) {
  const auth  = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const payload = await verifyToken(token, env.JWT_SECRET);
  return payload?.isAdmin ? payload : null;
}

async function handleAdminRoute(request, env, fn) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  return fn(request, env);
}

async function handleAdminWebhookInfo(request, env) {
  const res  = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
  const data = await res.json();
  return Response.json(data, { headers: corsHeaders() });
}

async function handleAdminSetWebhook(request, env) {
  const origin = new URL(request.url).origin;
  const res    = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${origin}/webhook` }),
  });
  const data = await res.json();
  return Response.json(data, { headers: corsHeaders() });
}

async function handleAdminDeleteWebhook(request, env) {
  const res  = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteWebhook`, { method: "POST" });
  const data = await res.json();
  return Response.json(data, { headers: corsHeaders() });
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export default {
  async fetch(request, env) {
    const { method, url } = request;
    const { pathname }    = new URL(url);

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (method === "GET"  && pathname === "/")                      return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (method === "POST" && pathname === "/login")                 return handleLogin(request, env);
    if (method === "POST" && pathname === "/upload")                return handleUpload(request, env);
    if (method === "GET"  && pathname.startsWith("/dl/"))           return handleDownload(request, env);
    if (method === "POST" && pathname === "/webhook")               return handleWebhook(request, env);
    if (method === "GET"  && pathname === "/admin/webhook-info")    return handleAdminRoute(request, env, handleAdminWebhookInfo);
    if (method === "POST" && pathname === "/admin/set-webhook")     return handleAdminRoute(request, env, handleAdminSetWebhook);
    if (method === "POST" && pathname === "/admin/delete-webhook")  return handleAdminRoute(request, env, handleAdminDeleteWebhook);

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
