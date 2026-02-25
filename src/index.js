// =============================================================================
// USERS — credentials, Telegram chat IDs, and avatar filenames
// Place avatar images in public/avatars/<filename>
// If a user has no avatar, set avatar to null
// =============================================================================
const USERS = [
  { username: "saman", password: "javad123", telegram_chat_id: "YOUR_CHAT_ID", avatar: "saman.jpg" },
  { username: "javad", password: "freedom",  telegram_chat_id: "YOUR_CHAT_ID", avatar: "javad.jpg" },
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
// HTML_PAGE — "Transmission" aesthetic with avatar + multi-file upload
// =============================================================================

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Uplink &mdash; Secure File Transfer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Azeret+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:          #07090e;
      --surface:     rgba(11, 14, 21, 0.94);
      --border:      rgba(255, 85, 0, 0.15);
      --accent:      #ff5500;
      --accent-lt:   #ff7a2e;
      --accent-gold: #ffb547;
      --text:        #ebe5dd;
      --text-dim:    rgba(235, 229, 221, 0.4);
      --success:     #00e8a0;
      --success-bg:  rgba(0, 232, 160, 0.07);
      --error:       #ff3355;
      --error-bg:    rgba(255, 51, 85, 0.08);
      --mono: 'Azeret Mono', 'Courier New', monospace;
      --sans: 'Syne', system-ui, sans-serif;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      background: var(--bg);
      display: grid;
      place-items: center;
      font-family: var(--mono);
      color: var(--text);
      overflow: hidden;
      position: relative;
    }

    /* ── Background ── */
    .bg-grid {
      position: fixed; inset: 0;
      background-image: radial-gradient(circle, rgba(255,85,0,0.055) 1px, transparent 1px);
      background-size: 26px 26px;
      pointer-events: none; z-index: 0;
    }
    .bg-orb {
      position: fixed; border-radius: 50%;
      filter: blur(100px); pointer-events: none; z-index: 0;
    }
    .bg-orb-1 {
      width: 640px; height: 640px;
      background: radial-gradient(circle, rgba(255,85,0,0.16) 0%, transparent 65%);
      top: -220px; right: -160px;
      animation: orbA 24s ease-in-out infinite alternate;
    }
    .bg-orb-2 {
      width: 520px; height: 520px;
      background: radial-gradient(circle, rgba(255,181,71,0.09) 0%, transparent 65%);
      bottom: -160px; left: -120px;
      animation: orbB 30s ease-in-out infinite alternate;
    }
    .bg-orb-3 {
      width: 380px; height: 380px;
      background: radial-gradient(circle, rgba(255,85,0,0.07) 0%, transparent 65%);
      top: 55%; left: 45%;
      animation: orbA 38s ease-in-out infinite alternate-reverse;
    }
    @keyframes orbA {
      from { transform: translate(0,0) scale(1); }
      to   { transform: translate(35px,20px) scale(1.08); }
    }
    @keyframes orbB {
      from { transform: translate(0,0) scale(1); }
      to   { transform: translate(-25px,30px) scale(1.12); }
    }

    /* ── Card ── */
    .card {
      position: relative; z-index: 1;
      width: 100%; max-width: 468px;
      margin: 1.5rem;
      padding: 2.25rem 2.25rem 2rem;
      background: var(--surface);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid var(--border);
      border-radius: 2px;
      box-shadow:
        0 0 0 1px rgba(255,85,0,0.04) inset,
        0 50px 100px rgba(0,0,0,0.75),
        0 0 90px rgba(255,85,0,0.07);
      animation: cardIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(28px) scale(0.96); }
      to   { opacity: 1; transform: none; }
    }
    .card::before {
      content: ''; position: absolute;
      top: -1px; left: -1px; width: 16px; height: 16px;
      border-top: 2px solid var(--accent); border-left: 2px solid var(--accent);
      border-radius: 2px 0 0 0;
    }
    .card::after {
      content: ''; position: absolute;
      bottom: -1px; right: -1px; width: 16px; height: 16px;
      border-bottom: 2px solid var(--accent); border-right: 2px solid var(--accent);
      border-radius: 0 0 2px 0;
    }

    /* ── Brand ── */
    .brand {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 2rem; padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .brand-mark {
      width: 34px; height: 34px; background: var(--accent);
      display: grid; place-items: center; flex-shrink: 0;
      clip-path: polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%);
    }
    .brand-mark svg { width: 17px; height: 17px; fill: #000; }
    .brand-name {
      font-family: var(--sans); font-weight: 800; font-size: 0.82rem;
      letter-spacing: 0.22em; text-transform: uppercase; line-height: 1;
    }
    .brand-tag {
      font-size: 0.58rem; color: var(--text-dim);
      letter-spacing: 0.14em; text-transform: uppercase; margin-top: 4px;
    }

    /* ── View headings ── */
    .view-title {
      font-family: var(--sans); font-weight: 800;
      font-size: 2rem; letter-spacing: -0.03em; line-height: 1; margin-bottom: 0.35rem;
    }
    .view-title em { font-style: normal; color: var(--accent); }
    .view-sub {
      font-size: 0.65rem; color: var(--text-dim);
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.8rem;
    }

    /* ── Login fields ── */
    .field { margin-bottom: 1.1rem; }
    .field label {
      display: block; font-size: 0.58rem; font-weight: 500;
      color: var(--text-dim); letter-spacing: 0.2em;
      text-transform: uppercase; margin-bottom: 7px;
    }
    .field input {
      display: block; width: 100%;
      background: rgba(255,255,255,0.025);
      border: none; border-bottom: 1px solid rgba(255,85,0,0.22);
      border-radius: 2px 2px 0 0; outline: none;
      padding: 0.68rem 0.6rem; color: var(--text);
      font-family: var(--mono); font-size: 0.88rem;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .field input::placeholder { color: var(--text-dim); opacity: 0.55; }
    .field input:focus {
      background: rgba(255,85,0,0.04);
      border-bottom-color: var(--accent);
      box-shadow: 0 2px 0 rgba(255,85,0,0.18);
    }

    /* ── Primary button ── */
    .btn-primary {
      display: block; width: 100%; margin-top: 1.3rem;
      padding: 0.9rem 1rem; background: var(--accent); color: #000;
      border: none; border-radius: 2px;
      font-family: var(--sans); font-weight: 700;
      font-size: 0.77rem; letter-spacing: 0.2em; text-transform: uppercase;
      cursor: pointer; position: relative; overflow: hidden;
      transition: background 0.18s, box-shadow 0.18s, transform 0.1s;
    }
    .btn-primary::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(120deg, rgba(255,255,255,0.22) 0%, transparent 55%);
      opacity: 0; transition: opacity 0.2s;
    }
    .btn-primary:hover { background: var(--accent-lt); box-shadow: 0 0 40px rgba(255,85,0,0.5), 0 6px 24px rgba(255,85,0,0.28); }
    .btn-primary:hover::after { opacity: 1; }
    .btn-primary:active { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.38; cursor: not-allowed; box-shadow: none; }

    /* ── Alert ── */
    .alert {
      display: none; margin-top: 0.8rem;
      padding: 0.62rem 0.8rem; font-size: 0.74rem;
      border-left: 2px solid; border-radius: 0 2px 2px 0;
      letter-spacing: 0.03em; animation: slideIn 0.25s ease;
    }
    .alert.error { background: var(--error-bg); border-color: var(--error); color: rgba(255,80,110,0.92); }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-8px); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Upload topbar with avatar ── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .user-chip { display: flex; align-items: center; gap: 10px; min-width: 0; }

    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar-img {
      width: 54px; height: 54px; border-radius: 50%;
      object-fit: cover; display: block;
      border: 2px solid rgba(255,85,0,0.45);
      box-shadow: 0 0 18px rgba(255,85,0,0.3);
    }
    .avatar-fb {
      width: 54px; height: 54px; border-radius: 50%;
      background: var(--accent); color: #000;
      display: none; align-items: center; justify-content: center;
      font-family: var(--sans); font-weight: 800; font-size: 1rem;
      letter-spacing: 0.05em;
      border: 2px solid var(--accent-lt);
      box-shadow: 0 0 18px rgba(255,85,0,0.35);
    }
    .live-dot {
      position: absolute; bottom: 1px; right: 1px;
      width: 11px; height: 11px; border-radius: 50%;
      background: var(--success); box-shadow: 0 0 7px var(--success);
      border: 2px solid var(--bg);
      animation: pulse 2.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

    .user-info { min-width: 0; }
    .user-label { font-size: 0.58rem; color: var(--text-dim); letter-spacing: 0.14em; text-transform: uppercase; }
    .user-name-text { font-size: 0.82rem; color: var(--text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .btn-logout {
      font-family: var(--mono); font-size: 0.64rem;
      letter-spacing: 0.14em; text-transform: uppercase;
      background: none; border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-dim); padding: 0.32rem 0.7rem; border-radius: 2px;
      cursor: pointer; flex-shrink: 0;
      transition: border-color 0.2s, color 0.2s;
    }
    .btn-logout:hover { border-color: var(--error); color: var(--error); }

    /* ── Drop zone ── */
    .drop-zone {
      position: relative;
      padding: 2.5rem 1.5rem;
      border: 1px dashed rgba(255,85,0,0.26); border-radius: 3px;
      text-align: center; cursor: pointer; overflow: hidden;
      margin-bottom: 0.75rem;
      transition: border-color 0.25s, background 0.25s, padding 0.3s;
    }
    .drop-zone.compact { padding: 1rem 1.5rem; }
    .drop-zone.compact .drop-ring { width: 32px; height: 32px; margin-bottom: 0.5rem; }
    .drop-zone.compact .drop-ring svg { width: 14px; height: 14px; }
    .drop-zone.compact .drop-title { font-size: 0.78rem; margin-bottom: 0.1rem; }
    .drop-zone.compact .drop-hint  { font-size: 0.62rem; }

    .drop-glow {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse at 50% 115%, rgba(255,85,0,0.08), transparent 58%);
      opacity: 0; transition: opacity 0.3s;
    }
    .drop-zone:hover .drop-glow,
    .drop-zone.dragover .drop-glow { opacity: 1; }
    .drop-zone.dragover { border-color: var(--accent); border-style: solid; background: rgba(255,85,0,0.03); }

    .drop-ring {
      display: inline-flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 50%;
      border: 1px solid rgba(255,85,0,0.26); margin-bottom: 1rem;
      transition: border-color 0.25s, box-shadow 0.25s, width 0.3s, height 0.3s;
    }
    .drop-zone.dragover .drop-ring { border-color: var(--accent); box-shadow: 0 0 22px rgba(255,85,0,0.32); }
    .drop-ring svg {
      width: 23px; height: 23px; stroke: var(--accent); stroke-width: 1.5;
      fill: none; stroke-linecap: round; stroke-linejoin: round;
      transition: stroke 0.25s, width 0.3s, height 0.3s;
    }
    .drop-title {
      font-family: var(--sans); font-weight: 700; font-size: 0.9rem;
      color: var(--text); margin-bottom: 0.35rem;
      transition: font-size 0.3s;
    }
    .drop-hint {
      font-size: 0.67rem; color: var(--text-dim); letter-spacing: 0.07em;
      transition: font-size 0.3s;
    }
    #file-input { display: none; }

    /* ── File queue ── */
    .file-list {
      display: none;
      border: 1px solid var(--border);
      border-radius: 3px; overflow: hidden;
      margin-bottom: 0.6rem;
      max-height: 220px; overflow-y: auto;
    }
    .file-list::-webkit-scrollbar { width: 4px; }
    .file-list::-webkit-scrollbar-track { background: transparent; }
    .file-list::-webkit-scrollbar-thumb { background: rgba(255,85,0,0.3); border-radius: 2px; }

    .file-item {
      display: flex; align-items: center; gap: 10px;
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid rgba(255,85,0,0.08);
      transition: background 0.2s;
    }
    .file-item:last-child { border-bottom: none; }
    .file-item.uploading { background: rgba(255,85,0,0.06); }
    .file-item.done      { background: rgba(0,232,160,0.05); }
    .file-item.error     { background: rgba(255,51,85,0.07); }

    .fi-icon {
      font-size: 0.8rem; width: 16px; text-align: center; flex-shrink: 0;
      line-height: 1;
    }
    .fi-icon.pending  { color: var(--text-dim); }
    .fi-icon.uploading { color: var(--accent); animation: iconBob 0.7s ease-in-out infinite alternate; }
    .fi-icon.done     { color: var(--success); }
    .fi-icon.error    { color: var(--error); }
    @keyframes iconBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }

    .fi-info { flex: 1; min-width: 0; }
    .fi-name {
      font-size: 0.75rem; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .fi-meta { font-size: 0.63rem; color: var(--text-dim); margin-top: 2px; }
    .fi-meta.err { color: var(--error); opacity: 0.85; }

    .fi-remove {
      background: none; border: none; cursor: pointer;
      color: var(--text-dim); font-size: 1rem; padding: 0 3px; line-height: 1;
      flex-shrink: 0; transition: color 0.15s;
    }
    .fi-remove:hover { color: var(--error); }

    .queue-summary {
      font-size: 0.62rem; color: var(--text-dim);
      letter-spacing: 0.1em; text-transform: uppercase;
      text-align: right; margin-bottom: 0.6rem;
    }

    /* ── Progress ── */
    .progress-label {
      display: none;
      font-size: 0.63rem; color: var(--text-dim);
      letter-spacing: 0.08em; margin-bottom: 5px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .progress-wrap {
      display: none; height: 2px;
      background: rgba(255,255,255,0.05);
      border-radius: 2px; overflow: hidden; margin-bottom: 0.85rem;
    }
    .progress-bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent-gold));
      border-radius: 2px;
      transition: width 0.1s linear;
      box-shadow: 0 0 8px rgba(255,85,0,0.6);
      position: relative; overflow: hidden;
    }
    .progress-bar::after {
      content: ''; position: absolute;
      top: 0; bottom: 0; right: 0; width: 60px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
      animation: shim 0.9s linear infinite;
    }
    @keyframes shim {
      from { transform: translateX(-60px); }
      to   { transform: translateX(60px); }
    }

    /* ── Result ── */
    .result-msg {
      display: none; margin-top: 0.75rem;
      padding: 0.62rem 0.8rem; font-size: 0.74rem;
      border-left: 2px solid; border-radius: 0 2px 2px 0;
      letter-spacing: 0.03em;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .result-msg.success { background: var(--success-bg); border-color: var(--success); color: rgba(0,232,160,0.92); }
    .result-msg.error   { background: var(--error-bg);   border-color: var(--error);   color: rgba(255,80,110,0.92); }
    .result-msg a { color: var(--accent-gold); text-decoration: none; }
    .result-msg a:hover { text-decoration: underline; }

    /* ── Footer ── */
    .foot {
      display: flex; align-items: center; gap: 7px;
      margin-top: 1.3rem; padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.58rem; color: var(--text-dim);
      letter-spacing: 0.14em; text-transform: uppercase;
    }
    .foot-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      background: var(--success); box-shadow: 0 0 6px var(--success);
    }
  </style>
</head>
<body>

<div class="bg-grid"></div>
<div class="bg-orb bg-orb-1"></div>
<div class="bg-orb bg-orb-2"></div>
<div class="bg-orb bg-orb-3"></div>

<!-- ═══════════════ LOGIN VIEW ═══════════════ -->
<div class="card" id="login-view">

  <div class="brand">
    <div class="brand-mark">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </div>
    <div>
      <div class="brand-name">Uplink</div>
      <div class="brand-tag">Telegram File Transfer</div>
    </div>
  </div>

  <div class="view-title">Sign <em>In</em></div>
  <div class="view-sub">Authenticate to transmit files</div>

  <form id="login-form" autocomplete="off">
    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" placeholder="e.g. saman" required />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" required />
    </div>
    <button class="btn-primary" type="submit" id="login-btn">Authenticate</button>
    <div class="alert error" id="login-error"></div>
  </form>

  <div class="foot">
    <div class="foot-dot"></div>
    <span>JWT &middot; HMAC-SHA256 &middot; No storage</span>
  </div>

</div>

<!-- ═══════════════ UPLOAD VIEW ═══════════════ -->
<div class="card" id="upload-view" style="display:none">

  <div class="brand">
    <div class="brand-mark">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </div>
    <div>
      <div class="brand-name">Uplink</div>
      <div class="brand-tag">Telegram File Transfer</div>
    </div>
  </div>

  <!-- Topbar with avatar -->
  <div class="topbar">
    <div class="user-chip">
      <div class="avatar-wrap">
        <img id="avatar-img" class="avatar-img" src="" alt=""
             onerror="this.style.display='none';document.getElementById('avatar-fb').style.display='flex'" />
        <div id="avatar-fb" class="avatar-fb"><span id="avatar-initials"></span></div>
        <div class="live-dot"></div>
      </div>
      <div class="user-info">
        <div class="user-label">Session</div>
        <div class="user-name-text" id="display-name"></div>
      </div>
    </div>
    <button class="btn-logout" id="logout-btn">Logout</button>
  </div>

  <div class="view-title">Trans<em>mit</em></div>
  <div class="view-sub">Drag files &middot; Max 50 MB each &middot; Bot API</div>

  <!-- Drop zone (becomes compact when files are queued) -->
  <div class="drop-zone" id="drop-zone">
    <div class="drop-glow"></div>
    <div class="drop-ring">
      <svg viewBox="0 0 24 24">
        <polyline points="16 16 12 12 8 16"></polyline>
        <line x1="12" y1="12" x2="12" y2="21"></line>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
      </svg>
    </div>
    <div class="drop-title" id="drop-title">Drop files here</div>
    <div class="drop-hint">or click to browse &middot; select multiple</div>
  </div>
  <input type="file" id="file-input" multiple />

  <!-- File queue list -->
  <div class="file-list" id="file-list"></div>
  <div class="queue-summary" id="queue-summary"></div>

  <!-- Progress -->
  <div class="progress-label" id="progress-label"></div>
  <div class="progress-wrap" id="progress-wrap">
    <div class="progress-bar" id="progress-bar"></div>
  </div>

  <button class="btn-primary" id="upload-btn">Transmit Files</button>
  <div class="result-msg" id="result-msg"></div>

  <div class="foot">
    <div class="foot-dot"></div>
    <span>Encrypted &middot; Bot API &middot; No server storage</span>
  </div>

</div>

<script>
  var MAX_BYTES = 50 * 1024 * 1024;

  // ── Storage helpers ──────────────────────────────────────
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
  }

  // ── Utility ──────────────────────────────────────────────
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function escHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function initials(name) {
    return name ? name.slice(0,2).toUpperCase() : "??";
  }

  // ── Avatar setup ─────────────────────────────────────────
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

  // ── Init: restore session ─────────────────────────────────
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

  // ── Login ─────────────────────────────────────────────────
  document.getElementById("login-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var btn   = document.getElementById("login-btn");
    var errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Authenticating\u2026";

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
      btn.textContent = "Authenticate";
    });
  });

  // ── Logout ────────────────────────────────────────────────
  document.getElementById("logout-btn").addEventListener("click", function() {
    clearToken();
    fileQueue = [];
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    showView("login");
  });

  // ── File queue ────────────────────────────────────────────
  // Each entry: { file: File, status: "pending"|"uploading"|"done"|"error", errMsg: "" }
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

    // Build list
    listEl.innerHTML = "";
    var totalBytes = 0;
    fileQueue.forEach(function(item, i) {
      totalBytes += item.file.size;

      var iconChar  = item.status === "done"      ? "&#10003;"
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
          : '');

      listEl.appendChild(row);
    });

    // Remove button handler
    listEl.querySelectorAll(".fi-remove").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute("data-i"), 10);
        fileQueue.splice(idx, 1);
        renderQueue();
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
      if (existingNames.indexOf(file.name) !== -1) return; // skip duplicate
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

  // ── Drop zone events ──────────────────────────────────────
  var dropZone  = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", function() { fileInput.click(); });
  fileInput.addEventListener("change", function() {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = ""; // reset so same file can be re-added after removal
  });
  dropZone.addEventListener("dragover",  function(e) { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", function()  { dropZone.classList.remove("dragover"); });
  dropZone.addEventListener("drop", function(e) {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  // ── Result helper ─────────────────────────────────────────
  function showResult(type, html) {
    var el = document.getElementById("result-msg");
    el.className = "result-msg " + type;
    el.innerHTML = html;
    el.style.display = "block";
  }

  // ── Single file XHR (returns Promise) ────────────────────
  function uploadFile(file, token, progressBar) {
    return new Promise(function(resolve, reject) {
      var form = new FormData();
      form.append("file", file, file.name);

      var xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", function(e) {
        if (e.lengthComputable) {
          progressBar.style.width = Math.round(e.loaded / e.total * 100) + "%";
        }
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

  // ── Upload all pending files sequentially ────────────────
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
    btn.textContent = "Transmitting\u2026";
    progressWrap.style.display = "block";
    progressLbl.style.display = "block";
    document.getElementById("result-msg").style.display = "none";

    var successCount = 0;
    var errorCount   = 0;
    var doneIdx      = 0;

    for (var i = 0; i < fileQueue.length; i++) {
      var item = fileQueue[i];
      if (item.status !== "pending") continue;

      doneIdx++;
      item.status = "uploading";
      renderQueue();

      progressBar.style.width = "0%";
      progressLbl.textContent =
        "File " + doneIdx + " of " + pending.length + " \u2014 " + item.file.name;

      try {
        await uploadFile(item.file, token, progressBar);
        item.status = "done";
        successCount++;
      } catch(err) {
        item.status = "error";
        item.errMsg = err.message;
        errorCount++;
      }
      renderQueue();
    }

    btn.disabled = false;
    btn.textContent = "Transmit Files";
    progressLbl.style.display = "none";
    progressBar.style.width = "100%";
    setTimeout(function() { progressWrap.style.display = "none"; }, 1500);

    if (errorCount === 0) {
      showResult("success",
        "&#10003; All " + successCount + " file" + (successCount !== 1 ? "s" : "") + " delivered to Telegram.");
      // Clear done items from queue after a moment
      setTimeout(function() {
        fileQueue = fileQueue.filter(function(f) { return f.status !== "done"; });
        renderQueue();
      }, 2000);
    } else if (successCount === 0) {
      showResult("error", "All " + errorCount + " file" + (errorCount !== 1 ? "s" : "") + " failed. See details above.");
    } else {
      showResult("error", successCount + " delivered, " + errorCount + " failed. See details above.");
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
    { sub: user.username, chat_id: user.telegram_chat_id, avatar: user.avatar ?? null, exp },
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

  return Response.json(
    { success: true, message_id: messageId, message_link: messageLink },
    { headers: corsHeaders() }
  );
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
    if (method === "GET"  && pathname === "/")       return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (method === "POST" && pathname === "/login")  return handleLogin(request, env);
    if (method === "POST" && pathname === "/upload") return handleUpload(request, env);

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
