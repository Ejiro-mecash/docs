# Ask AI Endpoint (self hosted)

Minimal Express + Groq endpoint for the docs widget at `/ask-ai-widget.html`.

## Setup

```bash
cd ask-ai-endpoint
npm install
cp .env.example .env
# Add GROQ_API_KEY (get a free key from https://console.groq.com/keys)
npm run dev
```

The endpoint listens on `http://localhost:8787/ask` by default (see `PORT` in `.env`).

## Configure CORS

Set `ALLOWED_ORIGINS` in `.env` to the URL of your docs site, e.g.:

```
ALLOWED_ORIGINS="http://localhost:3000,https://docs.me-cash.com"
```

## Point the widget to the endpoint

- Edit `public/ask-ai-widget.html` and set `API_URL` to your endpoint.
- Or call it with a query param: `/ask-ai-widget.html?endpoint=https://your-domain.com/ask`.

## Payload contract

`POST /ask` with JSON:

```json
{
  "question": "How do I create a payout?",
  "history": [
    { "role": "user", "content": "Prev question" },
    { "role": "assistant", "content": "Prev answer" }
  ]
}
```

Returns:

```json
{ "answer": "Use POST /payout/create-payout with a valid quoteId." }
```

## Deployment hints

- Deploy on any Node-friendly host (Render, Railway, Fly.io, Vercel functions/Edge, Cloudflare Workers adapter).
- Keep your API key secret server-side only; the widget never needs it.
- Add basic auth or rate limiting if you expose it publicly.
