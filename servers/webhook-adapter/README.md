# Phronesis Webhook Adapter

Translates webhooks from Slack, Discord, Telegram, and other platforms into OpenCode queries.

## Quick Start

```bash
cd servers/webhook-adapter
npm install
PORT=4098 OPENCODE_URL=http://localhost:4097 node server.js
```

## Endpoints

| Method | Path               | Platform    | Content-Type          |
|--------|--------------------|-------------|-----------------------|
| POST   | `/webhook/slack`   | Slack       | `application/x-www-form-urlencoded` |
| POST   | `/webhook/discord` | Discord     | `application/json`    |
| POST   | `/webhook/telegram`| Telegram    | `application/json`    |
| POST   | `/webhook/generic` | Generic     | `application/json`    |
| POST   | `/api/query`       | Direct API  | `application/json`    |
| GET    | `/health`          | Health      | —                     |

## Environment Variables

| Variable       | Default                  | Description              |
|----------------|--------------------------|--------------------------|
| `PORT`         | `4098`                   | Server listen port       |
| `OPENCODE_URL` | `http://localhost:4097`  | OpenCode server URL      |

## Slack Setup

1. Create a Slack app with a Slash Command (e.g., `/ask`)
2. Set the Request URL to `https://your-server/webhook/slack`
3. The adapter responds with `response_type: in_channel`

## Discord Setup

1. Create a Discord Application with a Slash Command
2. Set the Interactions Endpoint URL to `https://your-server/webhook/discord`
3. The adapter handles the PING verification automatically

## Telegram Setup

1. Set your bot's webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-server/webhook/telegram`
2. Telegram expects a quick acknowledgment — responses are sent asynchronously

## Generic Webhook

```bash
curl -X POST http://localhost:4098/webhook/generic \
  -H "Content-Type: application/json" \
  -d '{"message": "what is the weather?", "channel": "my-app"}'
```

## Systemd Service

```ini
[Unit]
Description=Phronesis Webhook Adapter
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/phronesis/servers/webhook-adapter/server.js
Environment=PORT=4098
Environment=OPENCODE_URL=http://localhost:4097
Restart=always

[Install]
WantedBy=multi-user.target
```
