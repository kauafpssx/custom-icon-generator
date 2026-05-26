# ✨ Custom Icon Generator ✨

<p align="center">
  <img src="https://img.shields.io/badge/Powered%20by-Simple%20Icons-blue?style=for-the-badge&logo=simple-icons&logoColor=white" alt="Simple Icons Badge">
  <img src="https://img.shields.io/badge/Built%20with-React%20%26%20Tailwind-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Badge">
</p>

The **Custom Icon Generator** is a fast, responsive web application designed to empower developers and designers. It allows you to effortlessly search, customize, and download thousands of popular brand icons from the Simple Icons library in various formats (SVG, PNG, ICO) and any color you desire.

---

## 🌟 Core Features

| # | Feature | Description |
| :---: | :--- | :--- |
| 🎨 | **Dynamic Color Picker** | Instantly apply any hex color to all icons in real-time. |
| 💾 | **Recent Colors** | Save and quickly reuse your favorite color palettes. |
| 🔍 | **Powerful Search** | Filter through over 3000 icons by title or slug with smart sorting. |
| 🖼️ | **Custom Resolution** | Configure raster downloads (PNG and ICO) up to a massive **4096x4096** pixels. |
| 📦 | **Batch Download** | Select multiple icons and download them all efficiently in a single ZIP file. |
| 💻 | **SVG Code Viewer** | Inspect, copy, and download the colored SVG code directly. |
| 📱 | **Responsive Design** | A seamless and intuitive experience across desktop and mobile devices. |
| 🔌 | **Public REST API** | Programmatic access to icons — SVG, PNG, ICO, and JSON. |

---

## 🔌 REST API

Full documentation lives at `/api` on the deployed site. All endpoints accept `GET` requests and return JSON or image data.

### Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/search?q=github` | Fuzzy search icons by name or slug |
| `GET` | `/api/icons` | Lightweight list `{title, slug, hex}[]` — supports `?page=&limit=` |
| `GET` | `/api/icons/all` | Full dataset including SVG path data |
| `GET` | `/api/asset/{slug}.svg` | Colored SVG — `?color=brand\|hex&size=16-512` |
| `GET` | `/api/asset/{slug}.png` | Rasterized PNG — `?color=brand\|hex&size=16-512` |
| `GET` | `/api/asset/{slug}.ico` | ICO format — `?color=brand\|hex&size=16-512` |
| `GET` | `/api/asset/{slug}.json` | Icon metadata + pre-built SVG string |

**Import collection:** click **"Import collection"** on the `/api` page to download a pre-configured **Postman** or **Insomnia** file — the base URL is injected automatically from the current deployment.

---

## 🛡️ Rate Limiting

All API routes are rate-limited using a **sliding window** algorithm backed by [Upstash Redis](https://upstash.com). Three tiers are available:

| Tier | Limit | How to activate |
| :--- | :--- | :--- |
| **Anonymous** | 30 req / min · per IP | No key needed |
| **Basic** | 200 req / min · per key | `X-API-Key: <key>` header |
| **Master** | Unlimited | `X-API-Key: <key>` header |

Every response includes rate limit headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1718000000
X-RateLimit-Tier: anonymous
```

When the limit is exceeded the API returns `429 Too Many Requests` with a `Retry-After` header.

Unrecognized API keys silently fall back to the anonymous tier — the API never reveals whether a key exists.

---

## ⚙️ Technical Architecture

### Core Technologies

<table align="center">
  <tr>
    <td align="center" width="180">
      <a href="https://react.dev/">
        <img src="./public/tech-icons/react.svg" alt="React" width="60" height="60">
        <br>React
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://www.typescriptlang.org/">
        <img src="./public/tech-icons/typescript.svg" alt="TypeScript" width="60" height="60">
        <br>TypeScript
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://tailwindcss.com/">
        <img src="./public/tech-icons/tailwindcss.svg" alt="Tailwind CSS" width="60" height="60">
        <br>Tailwind CSS
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://simpleicons.org/">
        <img src="./public/tech-icons/simpleicons.svg" alt="Simple Icons" width="60" height="60">
        <br>Simple Icons
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="180">
      <a href="https://canvg.github.io/">
        <img src="./public/tech-icons/canvag.svg" alt="Canvg" width="60" height="60">
        <br>Canvg (JS)
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://lenis.studiofreight.com/">
        <img src="./public/tech-icons/lenis.svg" alt="Lenis" width="60" height="60">
        <br>Lenis (JS)
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://ui.shadcn.com/">
        <img src="./public/tech-icons/shadcnuisvg.svg" alt="Shadcn/ui" width="60" height="60">
        <br>Shadcn/ui
      </a>
    </td>
    <td align="center" width="180">
      <a href="https://vitejs.dev/">
        <img src="./public/tech-icons/vite.svg" alt="Vite" width="60" height="60">
        <br>Vite
      </a>
    </td>
  </tr>
</table>

---

## 👨‍💻 Development Setup

### Prerequisites

Node.js v18+ and pnpm installed.

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zKauaFerreira/custom-icon-generator.git
   cd custom-icon-generator
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   # Fill in UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
   # (leave blank for local dev — rate limiting runs in fail-open mode)
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

   Available at `http://localhost:8080`.

---

## 🚀 Deploying to Vercel

1. Import the repository in the Vercel dashboard.
2. Set the following environment variables in **Project → Settings → Environment Variables**:

   | Variable | Value |
   | :--- | :--- |
   | `UPSTASH_REDIS_REST_URL` | From [Upstash console](https://console.upstash.com) |
   | `UPSTASH_REDIS_REST_TOKEN` | From [Upstash console](https://console.upstash.com) |
   | `API_KEYS_BASIC` | Comma-separated basic-tier keys |
   | `API_KEYS_MASTER` | Comma-separated master-tier keys |

3. Deploy. The `api/index.ts` serverless function is auto-detected.

### Generating new API keys

```bash
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('hex'))"
```

Run once per key. Add the output to `API_KEYS_BASIC` or `API_KEYS_MASTER` (comma-separated).

---

## 💡 Detailed Usage Guide

### Finding Your Icon 🔎

Use the search bar at the top to filter the library.

- **Search:** Type the brand name (e.g., "GitHub") or slug (e.g., "github").
- **Sorting:** Toggle between **A-Z**, **Z-A**, or **Random** order.

### Customizing the Color 🌈

- **Color Picker:** Click the main color swatch to open the hex picker.
- **Randomize:** Hit the **Shuffle** button for a random color.
- **Saving Colors:** Click **Bookmark** to save the current color to your recent list.

### Setting Resolution 📐

Click the resolution button (e.g., **256x256**) to open the configuration dialog. Choose a preset or enter a custom value up to 4096px.

### Downloading Icons ⬇️

**Individual:** Each icon card has direct SVG / PNG / ICO download buttons.

**Batch:** Select 2+ icons with the card checkboxes, then open the batch panel to download all as a ZIP.

---

## 🤝 Contributing

1. Open an **Issue** to report bugs or propose enhancements.
2. Submit a **Pull Request** with your changes.

---

## 📜 License

This project is licensed under the MIT License.

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge&logo=open-source-initiative" alt="MIT License">
</p>

---

<p align="center">
  Made with 💙 by Kauã Ferreira.
</p>
