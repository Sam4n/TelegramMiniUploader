# TelegramMiniUploader

A Telegram bot with a web-based upload interface, built on Cloudflare Workers. Users log in through a mobile-friendly web app, upload files, and the bot delivers them to the corresponding Telegram chat.

## Features

- **Web Upload UI** - Clean, mobile-first upload page with drag-and-drop support
- **JWT Authentication** - Secure login with HMAC-SHA256 signed tokens
- **Telegram Delivery** - Uploaded files are sent directly to the user's Telegram chat via the Bot API
- **Avatar Support** - Optional user avatars displayed in the web interface
- **Admin Role** - Admin users can manage uploads and view all activity
- **Serverless** - Runs entirely on Cloudflare Workers with static assets

## Tech Stack

- Cloudflare Workers (vanilla JavaScript)
- Telegram Bot API
- JWT auth (Web Crypto API, no dependencies)
- Static assets served via Cloudflare Workers

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://workers.dev) (free tier works)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Configure users in `src/index.js` — update the `USERS` array with your own usernames, passwords, and Telegram chat IDs.

3. Set secrets:
   ```bash
   wrangler secret put BOT_TOKEN      # Your Telegram bot token
   wrangler secret put JWT_SECRET     # Any random string for signing JWTs
   ```

4. Optionally add avatar images to `public/avatars/`.

## Development

```bash
wrangler dev
```

Create a `.dev.vars` file for local secrets:
```
BOT_TOKEN=your-telegram-bot-token
JWT_SECRET=your-jwt-secret
```

## Deploy

```bash
wrangler deploy
```

## License

MIT
