// =============================================================================
// USERS — hardcoded credentials and Telegram chat IDs
// =============================================================================
const USERS = [
  { username: "saman", password: "javad123", telegram_chat_id: "YOUR_CHAT_ID" },
  { username: "javad",   password: "freedom",  telegram_chat_id: "YOUR_CHAT_ID" },
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
  const header  = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body    = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig     = await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${body}`));
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
// HTML_PAGE — "Transmission" aesthetic: dark signals + Swiss grid + orange glow
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
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(35px, 20px) scale(1.08); }
    }
    @keyframes orbB {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(-25px, 30px) scale(1.12); }
    }

    /* ── Card ── */
    .card {
      position: relative; z-index: 1;
      width: 100%; max-width: 452px;
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

    /* corner reticle marks */
    .card::before {
      content: ''; position: absolute;
      top: -1px; left: -1px;
      width: 16px; height: 16px;
      border-top: 2px solid var(--accent);
      border-left: 2px solid var(--accent);
      border-radius: 2px 0 0 0;
    }
    .card::after {
      content: ''; position: absolute;
      bottom: -1px; right: -1px;
      width: 16px; height: 16px;
      border-bottom: 2px solid var(--accent);
      border-right: 2px solid var(--accent);
      border-radius: 0 0 2px 0;
    }

    /* ── Brand ── */
    .brand {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .brand-mark {
      width: 34px; height: 34px;
      background: var(--accent);
      display: grid; place-items: center; flex-shrink: 0;
      clip-path: polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%);
    }
    .brand-mark svg { width: 17px; height: 17px; fill: #000; }
    .brand-name {
      font-family: var(--sans); font-weight: 800;
      font-size: 0.82rem; letter-spacing: 0.22em;
      text-transform: uppercase; line-height: 1;
    }
    .brand-tag {
      font-size: 0.58rem; color: var(--text-dim);
      letter-spacing: 0.14em; text-transform: uppercase; margin-top: 4px;
    }

    /* ── View headings ── */
    .view-title {
      font-family: var(--sans); font-weight: 800;
      font-size: 2rem; letter-spacing: -0.03em; line-height: 1;
      margin-bottom: 0.35rem;
    }
    .view-title em { font-style: normal; color: var(--accent); }
    .view-sub {
      font-size: 0.65rem; color: var(--text-dim);
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.8rem;
    }

    /* ── Fields ── */
    .field { margin-bottom: 1.1rem; }
    .field label {
      display: block; font-size: 0.58rem; font-weight: 500;
      color: var(--text-dim); letter-spacing: 0.2em;
      text-transform: uppercase; margin-bottom: 7px;
    }
    .field input {
      display: block; width: 100%;
      background: rgba(255,255,255,0.025);
      border: none;
      border-bottom: 1px solid rgba(255,85,0,0.22);
      border-radius: 2px 2px 0 0;
      outline: none; padding: 0.68rem 0.6rem;
      color: var(--text); font-family: var(--mono); font-size: 0.88rem;
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
      padding: 0.9rem 1rem;
      background: var(--accent); color: #000;
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
    .btn-primary:hover {
      background: var(--accent-lt);
      box-shadow: 0 0 40px rgba(255,85,0,0.5), 0 6px 24px rgba(255,85,0,0.28);
    }
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
    .alert.error {
      background: var(--error-bg); border-color: var(--error);
      color: rgba(255,80,110,0.92);
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-8px); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Upload topbar ── */
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .user-chip {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.7rem; color: var(--text-dim);
    }
    .user-chip strong { color: var(--text); font-weight: 500; }
    .live-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--success); box-shadow: 0 0 8px var(--success);
      animation: pulse 2.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .btn-logout {
      font-family: var(--mono); font-size: 0.64rem;
      letter-spacing: 0.14em; text-transform: uppercase;
      background: none; border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-dim); padding: 0.32rem 0.7rem; border-radius: 2px;
      cursor: pointer; transition: border-color 0.2s, color 0.2s;
    }
    .btn-logout:hover { border-color: var(--error); color: var(--error); }

    /* ── Drop zone ── */
    .drop-zone {
      position: relative; padding: 2.8rem 1.5rem;
      border: 1px dashed rgba(255,85,0,0.26); border-radius: 3px;
      text-align: center; cursor: pointer; overflow: hidden;
      margin-bottom: 0.85rem;
      transition: border-color 0.25s, background 0.25s;
    }
    .drop-glow {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse at 50% 115%, rgba(255,85,0,0.08), transparent 58%);
      opacity: 0; transition: opacity 0.3s;
    }
    .drop-zone:hover .drop-glow,
    .drop-zone.dragover .drop-glow { opacity: 1; }
    .drop-zone.dragover {
      border-color: var(--accent); border-style: solid;
      background: rgba(255,85,0,0.03);
    }
    .drop-zone.has-file { border-color: rgba(0,232,160,0.38); border-style: solid; }
    .drop-zone.has-file .drop-glow {
      background: radial-gradient(ellipse at 50% 115%, rgba(0,232,160,0.07), transparent 58%);
      opacity: 1;
    }

    .drop-ring {
      display: inline-flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 50%;
      border: 1px solid rgba(255,85,0,0.26); margin-bottom: 1rem;
      transition: border-color 0.25s, box-shadow 0.25s;
    }
    .drop-zone.dragover .drop-ring { border-color: var(--accent); box-shadow: 0 0 22px rgba(255,85,0,0.32); }
    .drop-zone.has-file .drop-ring { border-color: rgba(0,232,160,0.5); box-shadow: 0 0 18px rgba(0,232,160,0.2); }
    .drop-ring svg {
      width: 23px; height: 23px; stroke: var(--accent); stroke-width: 1.5;
      fill: none; stroke-linecap: round; stroke-linejoin: round;
      transition: stroke 0.25s;
    }
    .drop-zone.has-file .drop-ring svg { stroke: var(--success); }

    .drop-title {
      font-family: var(--sans); font-weight: 700; font-size: 0.9rem;
      color: var(--text); margin-bottom: 0.35rem;
    }
    .drop-hint { font-size: 0.67rem; color: var(--text-dim); letter-spacing: 0.07em; }
    .file-meta {
      display: none; margin-top: 0.75rem;
      font-size: 0.69rem; color: var(--success); letter-spacing: 0.05em;
    }
    #file-input { display: none; }

    /* ── Progress ── */
    .progress-wrap {
      display: none; height: 2px;
      background: rgba(255,255,255,0.05);
      border-radius: 2px; overflow: hidden;
      margin-bottom: 0.85rem;
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
    .result-msg.success {
      background: var(--success-bg); border-color: var(--success);
      color: rgba(0,232,160,0.92);
    }
    .result-msg.error {
      background: var(--error-bg); border-color: var(--error);
      color: rgba(255,80,110,0.92);
    }
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

  <div class="topbar">
    <div class="user-chip">
      <div class="live-dot"></div>
      <span>Session: <strong id="display-name"></strong></span>
    </div>
    <button class="btn-logout" id="logout-btn">Logout</button>
  </div>

  <div class="view-title">Trans<em>mit</em></div>
  <div class="view-sub">Max 50 MB &middot; Forwarded via Telegram Bot</div>

  <div class="drop-zone" id="drop-zone">
    <div class="drop-glow"></div>
    <div class="drop-ring">
      <svg viewBox="0 0 24 24">
        <polyline points="16 16 12 12 8 16"></polyline>
        <line x1="12" y1="12" x2="12" y2="21"></line>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
      </svg>
    </div>
    <div class="drop-title">Drop file here</div>
    <div class="drop-hint">or click to browse &middot; max 50 MB</div>
    <div class="file-meta" id="file-meta"></div>
  </div>
  <input type="file" id="file-input" />

  <div class="progress-wrap" id="progress-wrap">
    <div class="progress-bar" id="progress-bar"></div>
  </div>

  <button class="btn-primary" id="upload-btn">Transmit File</button>
  <div class="result-msg" id="result-msg"></div>

  <div class="foot">
    <div class="foot-dot"></div>
    <span>Encrypted &middot; Bot API &middot; No server storage</span>
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
  }

  // init
  (function() {
    var token = getToken();
    if (token) {
      var p = parsePayload(token);
      if (p && p.exp > Math.floor(Date.now() / 1000)) {
        document.getElementById("display-name").textContent = p.sub;
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
      document.getElementById("display-name").textContent = parsePayload(r.d.token).sub;
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

  // logout
  document.getElementById("logout-btn").addEventListener("click", function() {
    clearToken();
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    showView("login");
  });

  // drag & drop
  var selectedFile = null;
  var dropZone     = document.getElementById("drop-zone");
  var fileInput    = document.getElementById("file-input");
  var fileMeta     = document.getElementById("file-meta");

  function selectFile(file) {
    if (file.size > MAX_BYTES) {
      showResult("error", "File is too large (max 50 MB).");
      return;
    }
    selectedFile = file;
    dropZone.classList.add("has-file");
    fileMeta.textContent = file.name + "  \u2014  " + (file.size / 1048576).toFixed(2) + " MB";
    fileMeta.style.display = "block";
    document.getElementById("result-msg").style.display = "none";
  }

  dropZone.addEventListener("click", function() { fileInput.click(); });
  fileInput.addEventListener("change", function() {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });
  dropZone.addEventListener("dragover", function(e) {
    e.preventDefault(); dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", function() { dropZone.classList.remove("dragover"); });
  dropZone.addEventListener("drop", function(e) {
    e.preventDefault(); dropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  // upload via XHR for progress events
  function showResult(type, html) {
    var el = document.getElementById("result-msg");
    el.className = "result-msg " + type;
    el.innerHTML = html;
    el.style.display = "block";
  }

  document.getElementById("upload-btn").addEventListener("click", function() {
    if (!selectedFile) { showResult("error", "Please select a file first."); return; }
    var token = getToken();
    if (!token) { clearToken(); showView("login"); return; }

    var progressWrap = document.getElementById("progress-wrap");
    var progressBar  = document.getElementById("progress-bar");
    var uploadBtn    = document.getElementById("upload-btn");

    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Transmitting\u2026";
    document.getElementById("result-msg").style.display = "none";

    var form = new FormData();
    form.append("file", selectedFile, selectedFile.name);

    var xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", function(e) {
      if (e.lengthComputable) {
        progressBar.style.width = Math.round(e.loaded / e.total * 100) + "%";
      }
    });

    xhr.addEventListener("load", function() {
      progressBar.style.width = "100%";
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Transmit File";

      try {
        var data = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && data.success) {
          var link = data.message_link
            ? " &mdash; <a href='" + data.message_link + "' target='_blank' rel='noopener'>View in Telegram</a>"
            : "";
          showResult("success", "&#10003; File delivered to Telegram." + link);
          selectedFile = null;
          dropZone.classList.remove("has-file");
          fileMeta.style.display = "none";
          fileInput.value = "";
        } else {
          showResult("error", data.error || "Upload failed.");
        }
      } catch(e) {
        showResult("error", "Unexpected server response.");
      }
      setTimeout(function() { progressWrap.style.display = "none"; }, 1800);
    });

    xhr.addEventListener("error", function() {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Transmit File";
      progressWrap.style.display = "none";
      showResult("error", "Network error \u2014 transmission failed.");
    });

    xhr.open("POST", "/upload");
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.send(form);
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

  const exp   = Math.floor(Date.now() / 1000) + 86400; // 24 h
  const token = await createToken(
    { sub: user.username, chat_id: user.telegram_chat_id, exp },
    env.JWT_SECRET
  );

  return Response.json({ token }, { headers: corsHeaders() });
}

async function handleUpload(request, env) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

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
  } catch (err) {
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
    const numericId = chatId.slice(4);
    messageLink = `https://t.me/c/${numericId}/${messageId}`;
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

    if (method === "GET"  && pathname === "/") {
      return new Response(HTML_PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (method === "POST" && pathname === "/login") {
      return handleLogin(request, env);
    }

    if (method === "POST" && pathname === "/upload") {
      return handleUpload(request, env);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
