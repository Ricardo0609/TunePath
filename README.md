# WAVESET 🎵

> Stop overthinking. Start listening.

Auto-generates playlists from your favorite artists and saves them directly to your Spotify.

---

## Stack

- React 18 + Vite
- React Router v6
- Spotify Web API (PKCE OAuth — no backend needed)
- Deployed on Render as a static site

---

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USER/waveset.git
cd waveset
npm install
```

### 2. Create your Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in any name/description
4. Set **Redirect URI** to: `http://127.0.0.1:5173/callback` (Spotify requires the loopback IP literal, not `localhost`, for local redirect URIs)
5. Copy your **Client ID** (you don't need the Client Secret for PKCE)

### 3. Create `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_REDIRECT_URI=http://127.0.0.1:5173/callback
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init waveset"
git remote add origin https://github.com/YOUR_USER/waveset.git
git push -u origin main
```

### 2. Create a Render Static Site

1. Go to [render.com](https://render.com) → **New → Static Site**
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add **Environment Variables:**
   - `VITE_SPOTIFY_CLIENT_ID` → your Spotify Client ID
   - `VITE_REDIRECT_URI` → `https://your-app-name.onrender.com/callback`

### 3. Update Spotify Dashboard

In [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), add your Render URL as an allowed Redirect URI:

```
https://your-app-name.onrender.com/callback
```

---

## Features

| Feature | Description |
|---|---|
| 🎲 Smart Mix | Generates a playlist from randomly picked artists from your selection |
| ⚙️ Configurable | Set songs per artist, total songs (5–50), vibe filter |
| 🎛️ Artist Filter | Choose which artists appear in your mix |
| 🔭 Discover | Recommendations based on your taste you've never heard |
| 🎤 Artist Mode | Browse full discography of one artist, chronologically or shuffled |
| 💿 Save to Spotify | Creates the playlist directly in your Spotify account |
| 📜 History | Quick access to your last 10 generated playlists |
| 🔄 Refresh | Regenerate the mix any time with one click |

---

## Project Structure

```
src/
├── pages/
│   ├── Login.jsx         # Landing + Spotify OAuth
│   ├── Callback.jsx      # OAuth redirect handler
│   ├── ArtistSelect.jsx  # Artist search & selection
│   ├── Main.jsx          # App shell + routing
│   ├── MixView.jsx       # Smart playlist generator
│   ├── ArtistView.jsx    # Discography browser
│   └── SettingsPanel.jsx # Playlist settings drawer
├── utils/
│   ├── auth.js           # PKCE OAuth + token management
│   └── spotify.js        # Spotify Web API calls
├── App.jsx               # Router
├── main.jsx              # Entry point
└── index.css             # Design system + all styles
```

---

## Notes

- No backend required — uses Spotify PKCE flow (tokens stored in `localStorage`)
- Playlists are created as **private** by default
- The app never stores your data on any server

## Spotify API changes this app works around

Spotify shipped two rounds of breaking changes to the Web API that directly affect a personal/PKCE app like this one (it runs in **Development Mode** — under 25 users, no extended quota):

**Nov 27, 2024** — `/v1/recommendations`, `/v1/audio-features` and `/v1/related-artists` were deprecated for any app not already in Extended Quota Mode. No official replacement.

**Feb 2026 "Dev Mode" migration** — for Development Mode apps specifically:
- `GET /artists/{id}/top-tracks` was **removed entirely**.
- `/search` `limit` max dropped from 50 to **10**.
- `POST /users/{id}/playlists` → `POST /me/playlists`.
- `POST /playlists/{id}/tracks` → `POST /playlists/{id}/items`.
- The `popularity` field was removed from track/album/artist objects.
- All Development Mode apps now require the app owner (you) to have an **active Spotify Premium subscription** — if it lapses, the app stops working until you resubscribe.

Full details: [developer.spotify.com/.../february-2026-migration-guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

How this app adapts:

- **Discover** pulls the genres from the artists you already picked and searches `/search` for tracks in those genres, filtering out anything from your seed artists. Not as precise as the old recommendation engine, but the closest thing the public API still allows.
- **An artist's "top tracks"** are now fetched via `/search?q=artist:"Name"&type=track`, since the dedicated endpoint is gone. Results are filtered to the exact artist ID so name collisions don't leak in.
- **Vibe** can no longer read real energy/valence/danceability/popularity data (all removed). It now appends a mood keyword (e.g. "chill") to the search query and lets Spotify's own relevance ranking do the rest. Treat it as a rough nudge, not a precise mood engine — that data doesn't exist in the public API anymore for Dev Mode apps.
