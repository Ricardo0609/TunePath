// ─────────────────────────────────────────────
// WAVESET — Spotify PKCE Auth Utilities
// ─────────────────────────────────────────────

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/callback`;

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-top-read',
].join(' ');

// ── PKCE helpers ─────────────────────────────

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', data);
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ── Public API ────────────────────────────────

export async function initiateLogin() {
  const verifier = randomString(128);
  const challenge = base64url(await sha256(verifier));

  localStorage.setItem('ws_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'false',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code) {
  const verifier = localStorage.getItem('ws_pkce_verifier');
  if (!verifier) throw new Error('No PKCE verifier found');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || 'Token exchange failed');
  }

  const data = await res.json();
  _storeTokens(data);
  localStorage.removeItem('ws_pkce_verifier');
  return data;
}

async function _refreshToken() {
  const refresh = localStorage.getItem('ws_refresh_token');
  if (!refresh) throw new Error('No refresh token — please log in again');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  _storeTokens(data);
  return data.access_token;
}

function _storeTokens(data) {
  localStorage.setItem('ws_access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('ws_refresh_token', data.refresh_token);
  localStorage.setItem('ws_expires_at', Date.now() + data.expires_in * 1000);
}

export async function getToken() {
  const expiresAt = Number(localStorage.getItem('ws_expires_at') || 0);
  // Refresh 60 seconds before expiry
  if (Date.now() > expiresAt - 60_000) {
    return _refreshToken();
  }
  return localStorage.getItem('ws_access_token');
}

export const isLoggedIn = () => !!localStorage.getItem('ws_access_token');

export function logout() {
  const keys = ['ws_access_token', 'ws_refresh_token', 'ws_expires_at', 'ws_user', 'ws_artists', 'ws_history'];
  keys.forEach(k => localStorage.removeItem(k));
}
