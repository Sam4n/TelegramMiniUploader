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
// HTML_PAGE — full single-page frontend
// =============================================================================

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Telegram Uploader</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #e2e8f0;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.5);
    }

    .logo {
      text-align: center;
      margin-bottom: 1.75rem;
    }

    .logo svg { width: 48px; height: 48px; }

    h1 {
      text-align: center;
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: .25rem;
      color: #f1f5f9;
    }

    .subtitle {
      text-align: center;
      font-size: .85rem;
      color: #64748b;
      margin-bottom: 1.75rem;
    }

    label {
      display: block;
      font-size: .8rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: .4rem;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    input[type="text"], input[type="password"] {
      width: 100%;
      padding: .7rem 1rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f1f5f9;
      font-size: .95rem;
      margin-bottom: 1rem;
      outline: none;
      transition: border-color .2s;
    }

    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #3b82f6;
    }

    .btn {
      display: block;
      width: 100%;
      padding: .75rem;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .2s, transform .1s;
    }

    .btn:hover  { background: #2563eb; }
    .btn:active { transform: scale(.98); }
    .btn:disabled { background: #1e40af; opacity: .6; cursor: not-allowed; }

    .error-msg {
      margin-top: .75rem;
      padding: .65rem 1rem;
      background: #450a0a;
      border: 1px solid #b91c1c;
      border-radius: 8px;
      font-size: .85rem;
      color: #fca5a5;
      display: none;
    }

    /* ---- upload view ---- */
    .user-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }

    .user-name {
      font-size: .9rem;
      color: #94a3b8;
    }

    .user-name strong { color: #f1f5f9; }

    .logout-btn {
      background: none;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: .3rem .75rem;
      border-radius: 6px;
      font-size: .8rem;
      cursor: pointer;
      transition: border-color .2s, color .2s;
    }

    .logout-btn:hover { border-color: #64748b; color: #e2e8f0; }

    .drop-zone {
      border: 2px dashed #334155;
      border-radius: 12px;
      padding: 2.5rem 1.5rem;
      text-align: center;
      cursor: pointer;
      transition: border-color .2s, background .2s;
      margin-bottom: 1.25rem;
      position: relative;
    }

    .drop-zone.dragover {
      border-color: #3b82f6;
      background: rgba(59,130,246,.07);
    }

    .drop-zone.has-file {
      border-color: #22c55e;
      background: rgba(34,197,94,.05);
    }

    .drop-icon { font-size: 2.5rem; margin-bottom: .5rem; }

    .drop-text { font-size: .9rem; color: #64748b; }
    .drop-text strong { color: #94a3b8; }

    .file-name {
      margin-top: .5rem;
      font-size: .85rem;
      color: #22c55e;
      word-break: break-all;
      display: none;
    }

    #file-input { display: none; }

    .progress-wrap {
      height: 6px;
      background: #0f172a;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 1rem;
      display: none;
    }

    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #3b82f6, #06b6d4);
      border-radius: 3px;
      transition: width .1s linear;
    }

    .result-msg {
      margin-top: .75rem;
      padding: .65rem 1rem;
      border-radius: 8px;
      font-size: .85rem;
      display: none;
    }

    .result-msg.success {
      background: #052e16;
      border: 1px solid #16a34a;
      color: #86efac;
    }

    .result-msg.error {
      background: #450a0a;
      border: 1px solid #b91c1c;
      color: #fca5a5;
    }

    .result-msg a { color: #67e8f9; }
  </style>
</head>
<body>

<!-- ===================== LOGIN VIEW ===================== -->
<div class="card" id="login-view">
  <div class="logo">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#2563EB"/>
      <path d="M10 24L22 36L38 14" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <h1>Telegram Uploader</h1>
  <p class="subtitle">Sign in to send files to Telegram</p>

  <form id="login-form" autocomplete="off">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" placeholder="for example javad :D" required />

    <label for="password">Password</label>
    <input type="password" id="password" name="password" placeholder="••••••••" required />

    <button class="btn" type="submit" id="login-btn">Sign In</button>
    <div class="error-msg" id="login-error"></div>
  </form>
</div>

<!-- ===================== UPLOAD VIEW ===================== -->
<div class="card" id="upload-view" style="display:none">
  <div class="user-bar">
    <span class="user-name">Signed in as <strong id="display-name"></strong></span>
    <button class="logout-btn" id="logout-btn">Logout</button>
  </div>

  <h1>Send a File</h1>
  <p class="subtitle" style="margin-bottom:1.25rem">Max 50 MB · Sent via Telegram Bot</p>

  <div class="drop-zone" id="drop-zone">
    <div class="drop-icon">📂</div>
    <p class="drop-text"><strong>Drag &amp; drop</strong> a file here<br/>or click to browse</p>
    <div class="file-name" id="file-name-label"></div>
  </div>
  <input type="file" id="file-input" />

  <div class="progress-wrap" id="progress-wrap">
    <div class="progress-bar" id="progress-bar"></div>
  </div>

  <button class="btn" id="upload-btn">Upload</button>
  <div class="result-msg" id="result-msg"></div>
</div>

<script>
  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

  // ---- helpers ----
  function getToken()       { return localStorage.getItem("tmu_token"); }
  function setToken(t)      { localStorage.setItem("tmu_token", t); }
  function clearToken()     { localStorage.removeItem("tmu_token"); }

  function parseJwtPayload(token) {
    try {
      const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64));
    } catch { return null; }
  }

  function showView(name) {
    document.getElementById("login-view").style.display  = name === "login"  ? "" : "none";
    document.getElementById("upload-view").style.display = name === "upload" ? "" : "none";
  }

  // ---- init ----
  (function init() {
    const token = getToken();
    if (token) {
      const payload = parseJwtPayload(token);
      if (payload && payload.exp > Math.floor(Date.now() / 1000)) {
        document.getElementById("display-name").textContent = payload.sub;
        showView("upload");
        return;
      }
      clearToken();
    }
    showView("login");
  })();

  // ---- login ----
  document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("username").value,
          password: document.getElementById("password").value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setToken(data.token);
      document.getElementById("display-name").textContent = parseJwtPayload(data.token).sub;
      showView("upload");
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });

  // ---- logout ----
  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    showView("login");
  });

  // ---- drag & drop / file picker ----
  let selectedFile = null;
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileNameLabel = document.getElementById("file-name-label");

  function selectFile(file) {
    if (file.size > MAX_BYTES) {
      showResult("error", "File is too large (max 50 MB).");
      return;
    }
    selectedFile = file;
    dropZone.classList.add("has-file");
    fileNameLabel.textContent = file.name + " (" + (file.size / 1024 / 1024).toFixed(2) + " MB)";
    fileNameLabel.style.display = "block";
    document.getElementById("result-msg").style.display = "none";
  }

  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  // ---- upload with XHR for progress events ----
  function showResult(type, html) {
    const el = document.getElementById("result-msg");
    el.className = "result-msg " + type;
    el.innerHTML = html;
    el.style.display = "block";
  }

  document.getElementById("upload-btn").addEventListener("click", () => {
    if (!selectedFile) { showResult("error", "Please select a file first."); return; }

    const token = getToken();
    if (!token) { clearToken(); showView("login"); return; }

    const progressWrap = document.getElementById("progress-wrap");
    const progressBar  = document.getElementById("progress-bar");
    const uploadBtn    = document.getElementById("upload-btn");

    progressWrap.style.display = "block";
    progressBar.style.width = "0%";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    document.getElementById("result-msg").style.display = "none";

    const form = new FormData();
    form.append("file", selectedFile, selectedFile.name);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) {
        progressBar.style.width = Math.round(e.loaded / e.total * 100) + "%";
      }
    });

    xhr.addEventListener("load", () => {
      progressBar.style.width = "100%";
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";

      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && data.success) {
          const linkHtml = data.message_link
            ? ' &mdash; <a href="' + data.message_link + '" target="_blank" rel="noopener">View in Telegram</a>'
            : "";
          showResult("success", "File sent to Telegram!" + linkHtml);
          // reset
          selectedFile = null;
          dropZone.classList.remove("has-file");
          fileNameLabel.style.display = "none";
          fileInput.value = "";
        } else {
          showResult("error", data.error || "Upload failed.");
        }
      } catch {
        showResult("error", "Unexpected response from server.");
      }

      setTimeout(() => { progressWrap.style.display = "none"; }, 1500);
    });

    xhr.addEventListener("error", () => {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
      progressWrap.style.display = "none";
      showResult("error", "Network error — upload failed.");
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
  // Verify JWT
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Parse multipart form
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

  // Forward to Telegram
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

  // Build public link for supergroups (chat_id starts with -100)
  let messageLink = null;
  if (chatId.startsWith("-100")) {
    const numericId = chatId.slice(4); // strip -100
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

    // CORS preflight
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
