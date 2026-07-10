# Forge — Chat-Based AI Image & Video Generator

A working chat app for text-to-image, image-to-image, and image-to-video generation, built on the Replicate API.

## Why a backend (not just a browser page)

Image/video models need an API key, and no image/video provider (Replicate, OpenAI, Stability, Runway) lets you call them safely straight from a browser — your key would be visible to anyone who opens dev tools. This project uses a small Node/Express server that holds your key and proxies requests, which is the same pattern real products use.

## 1. Setup

```bash
cd ai-image-chat
npm install
cp .env.example .env
```

Get a Replicate API token at **https://replicate.com/account/api-tokens** and paste it into `.env`:

```
REPLICATE_API_TOKEN=r8_your_token_here
```

Replicate bills per generation (pennies per image, a bit more for video) — no separate GPU needed.

## 2. Run it

```bash
npm start
```

Open **http://localhost:3000**.

## 3. How it's wired

| Mode | Endpoint | Model |
|---|---|---|
| Text → Image | `POST /api/text-to-image` | `black-forest-labs/flux-1.1-pro` |
| Image → Image | `POST /api/image-to-image` | `black-forest-labs/flux-kontext-pro` |
| Image → Video | `POST /api/image-to-video` | `wan-video/wan-2.5-i2v-fast` |

Swap any model name in `server.js` → `MODELS` for another one from **replicate.com/explore** — the request/response shape is the same for every model on the platform, so most swaps are a one-line change. Good alternatives:
- Faster/cheaper images: `black-forest-labs/flux-schnell`
- Higher quality video: `kwaivgi/kling-v2.1` or `google/veo-3.1-fast` (check pricing, video is the most expensive mode)

## 4. Deploying so it's not just on your laptop

Any Node host works — Railway, Render, Fly.io, a $5 VPS. The pattern is always:
1. Push this folder to a git repo
2. Set `REPLICATE_API_TOKEN` as an environment variable on the host (never commit `.env`)
3. Deploy — most of these platforms auto-detect `npm start`

## 5. On self-training / uncensored models

If you fine-tune or self-host your own model (e.g. via Replicate's Cog, or locally with something like a LoRA/Dreambooth pipeline on Stable Diffusion/FLUX), you're responsible for what it's used to generate — hosting providers, app stores, and payment processors all enforce content policies (most critically around sexual content involving minors, non-consensual imagery, and real-person likenesses), and violating those has legal consequences independent of what any single API allows. Happy to help with the actual fine-tuning pipeline (training scripts, dataset prep, LoRA configs) if you want to go that route — that's a separate, meatier project from this chat app.

## 6. Extending it

- Add a "history" panel by storing generations in a database (SQLite is easiest to start)
- Add auth (e.g. `express-session` + a login page) before you deploy this publicly, or anyone with the URL can spend your Replicate credits
- Stream partial progress instead of a spinner using Replicate's webhook support, for long video jobs
