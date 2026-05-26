# Custom Icon Generator

<p align="center">
  <img src="https://custom-icon-generator.vercel.app/api/asset/react.svg?color=random&size=40" alt="React" width="40" height="40">
  <img src="https://custom-icon-generator.vercel.app/api/asset/typescript.svg?color=random&size=40" alt="TypeScript" width="40" height="40">
  <img src="https://custom-icon-generator.vercel.app/api/asset/tailwindcss.svg?color=random&size=40" alt="Tailwind CSS" width="40" height="40">
  <img src="https://custom-icon-generator.vercel.app/api/asset/vite.svg?color=random&size=40" alt="Vite" width="40" height="40">
  <img src="https://custom-icon-generator.vercel.app/api/asset/simpleicons.svg?color=random&size=40" alt="Simple Icons" width="40" height="40">
  <img src="https://custom-icon-generator.vercel.app/api/asset/vercel.svg?color=random&size=40" alt="Vercel" width="40" height="40">
</p>

Search, customize, and download thousands of brand icons in SVG, PNG, or ICO — and access them programmatically via a REST API.

---

## Features

| Feature | Description |
| :--- | :--- |
| **Dynamic Color Picker** | Apply any hex color to icons in real-time |
| **Recent Colors** | Save and reuse favorite palettes |
| **Powerful Search** | Filter 3000+ icons by name or slug with smart sorting |
| **Custom Resolution** | Configure PNG/ICO downloads up to 4096×4096px |
| **Batch Download** | Select multiple icons, download as a single ZIP |
| **SVG Code Viewer** | Inspect and copy colored SVG markup |
| **API Playground** | Interactive docs at `/playground` — test every endpoint live |
| **Public REST API** | Programmatic access: SVG, PNG, ICO, JSON |

---

## REST API

Full interactive docs at `/playground`. All endpoints are `GET`, CORS-enabled (`*`), and rate-limited.

### Icons

| Path | Description |
| :--- | :--- |
| `GET /api/search?q=github` | Fuzzy search by name or slug. Optional `?limit=` (max 100). |
| `GET /api/icons` | Lightweight list `[{title, slug, hex}]`. Optional `?page=&limit=`. |
| `GET /api/icons/all` | Full dataset including SVG path data (~3 MB). Cached 24h. |
| `GET /api/icons/{slug}` | Single icon metadata: title, slug, hex, path, svg, source, guidelines, license. |

### Assets

| Path | Description |
| :--- | :--- |
| `GET /api/asset/{slug}.svg` | Colored SVG. Supports `?color=` and `?size=`. |
| `GET /api/asset/{slug}.png` | Rasterized PNG via resvg. Default 128×128px. |
| `GET /api/asset/{slug}.ico` | ICO format (PNG-in-ICO). Ideal for favicons. Default 32×32px. |
| `GET /api/asset/{slug}.json` | Icon metadata + pre-built SVG string. |

### Random & Meta

| Path | Description |
| :--- | :--- |
| `GET /api/random.svg` | Random icon as SVG. Never cached. Supports `?color=` and `?size=`. |
| `GET /api/random.json` | Random icon as JSON with full metadata. Never cached. |
| `GET /api/stats` | Total icon count, simple-icons version, formats, and rate limit tiers. |

### Color and size parameters

Both `?color=` and `?size=` accept special values:

| Value | Behavior |
| :--- | :--- |
| `brand` | Use the icon's official brand color (default) |
| `random` | Pick a random color / random size (16–512px) each request |
| `#hex` or `hex` | Specific hex color, e.g. `FF0000` or `#FF0000` |
| `16`–`512` | Pixel size for raster outputs |

```
# Random color, specific size
GET /api/asset/github.svg?color=random&size=64

# Brand color, random size
GET /api/asset/react.png?color=brand&size=random

# Custom color
GET /api/asset/typescript.svg?color=3178c6
```

---

## Rate Limiting

Sliding-window algorithm backed by [Upstash Redis](https://upstash.com). Limits scale by endpoint cost.

| Tier | How to activate | Metadata | SVG | PNG / ICO | Full dataset |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Anonymous** | No key (per IP) | 200 / min | 60 / min | 20 / min | 5 / min |
| **Basic** | `X-API-Key: <key>` | 800 / min | 400 / min | 150 / min | 30 / min |
| **Master** | `X-API-Key: <key>` | Unlimited | Unlimited | Unlimited | Unlimited |

Every response includes rate limit headers:

```
X-RateLimit-Tier: anonymous
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1718000000
```

On `429 Too Many Requests`, a `Retry-After` header is included. Unrecognized keys silently fall back to anonymous — the API never reveals whether a key exists.

**Import collection:** the `/playground` page has an **"Import collection"** button to download a pre-configured Postman or Insomnia file with all endpoints and the correct base URL.

---

## Tech Stack

<table align="center">
  <tr>
    <td align="center" width="140">
      <a href="https://react.dev/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/react.svg?color=random&size=48" alt="React" width="48" height="48">
        <br>React 18
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://www.typescriptlang.org/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/typescript.svg?color=random&size=48" alt="TypeScript" width="48" height="48">
        <br>TypeScript
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://tailwindcss.com/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/tailwindcss.svg?color=random&size=48" alt="Tailwind CSS" width="48" height="48">
        <br>Tailwind CSS
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://simpleicons.org/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/simpleicons.svg?color=random&size=48" alt="Simple Icons" width="48" height="48">
        <br>Simple Icons
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="140">
      <a href="https://vitejs.dev/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/vite.svg?color=random&size=48" alt="Vite" width="48" height="48">
        <br>Vite + PWA
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://ui.shadcn.com/">
        <img src="./public/tech-icons/shadcnuisvg.svg" alt="Shadcn/ui" width="48" height="48">
        <br>Shadcn/ui
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://vercel.com/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/vercel.svg?color=random&size=48" alt="Vercel" width="48" height="48">
        <br>Vercel
      </a>
    </td>
    <td align="center" width="140">
      <a href="https://upstash.com/">
        <img src="https://custom-icon-generator.vercel.app/api/asset/upstash.svg?color=random&size=48" alt="Upstash" width="48" height="48">
        <br>Upstash Redis
      </a>
    </td>
  </tr>
</table>

---

## Development Setup

**Prerequisites:** Node.js v18+ and pnpm.

```bash
# 1. Clone
git clone https://github.com/kauafpssx/custom-icon-generator.git
cd custom-icon-generator

# 2. Install
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
# Leave blank for local dev — rate limiting runs in-memory

# 4. Start dev server
pnpm dev
# → http://localhost:8080
```

---

## Deploying to Vercel

1. Import the repository in the Vercel dashboard.
2. Set environment variables under **Project → Settings → Environment Variables**:

   | Variable | Value |
   | :--- | :--- |
   | `UPSTASH_REDIS_REST_URL` | From [Upstash console](https://console.upstash.com) |
   | `UPSTASH_REDIS_REST_TOKEN` | From [Upstash console](https://console.upstash.com) |
   | `API_KEYS_BASIC` | Comma-separated basic-tier keys |
   | `API_KEYS_MASTER` | Comma-separated master-tier keys |

3. Deploy. The `api/index.ts` serverless function is auto-detected.

**Generating API keys:**

```bash
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('hex'))"
```

Run once per key. Add to `API_KEYS_BASIC` or `API_KEYS_MASTER` (comma-separated).

---

## Usage Guide

**Search:** Type a brand name (e.g., `GitHub`) or slug (e.g., `github`) in the search bar. Toggle A-Z, Z-A, or Random sort.

**Color:** Click the color swatch to open the hex picker, hit Shuffle for a random color, or Bookmark to save it to your recent list.

**Resolution:** Click the resolution button (e.g., `256x256`) to configure PNG/ICO size, up to 4096px.

**Download:** Each icon card has SVG / PNG / ICO buttons. Select 2+ cards to enable the batch panel — downloads a ZIP.

**API Playground:** Click **API System** or visit `/playground` to explore every endpoint interactively. Authorize with your API key to unlock higher rate limits.

---

## Contributing

1. Open an **Issue** to report bugs or propose enhancements.
2. Submit a **Pull Request** with your changes.

## License

MIT License — see [LICENSE](LICENSE) for details.

<p align="center">Made with care by <a href="https://github.com/kauafpssx">Kauã Ferreira</a></p>
