import { pool } from "./db";

const DEPLOYMENT = "guardiansupport";
const BASE_URL = `https://${DEPLOYMENT}.api.accelo.com/api/v0`;
const TOKEN_URL = `https://${DEPLOYMENT}.api.accelo.com/oauth2/v0/token`;
const AUTH_URL = `https://${DEPLOYMENT}.api.accelo.com/oauth2/v0/authorize`;

const CLIENT_ID = process.env.ACCELO_CLIENT_ID!;
const CLIENT_SECRET = process.env.ACCELO_CLIENT_SECRET!;
const REDIRECT_URI = "https://guardiangroup.ai/auth/accelo/callback";

export interface AcceloTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function ensureTokenTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accelo_tokens (
      id integer PRIMARY KEY DEFAULT 1,
      access_token text NOT NULL,
      refresh_token text NOT NULL,
      expires_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);
}

export async function saveTokens(tokens: AcceloTokens): Promise<void> {
  await ensureTokenTable();
  await pool.query(
    `INSERT INTO accelo_tokens (id, access_token, refresh_token, expires_at, updated_at)
     VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at,
           updated_at = now()`,
    [tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
  );
}

export async function loadTokens(): Promise<AcceloTokens | null> {
  await ensureTokenTable();
  const result = await pool.query(
    `SELECT access_token, refresh_token, expires_at FROM accelo_tokens WHERE id = 1`
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.expires_at),
  };
}

export async function clearTokens(): Promise<void> {
  await ensureTokenTable();
  await pool.query(`DELETE FROM accelo_tokens WHERE id = 1`);
}

export function buildAuthUrl(state: string): string {
  // URLSearchParams encodes parentheses (%28/%29) which Accelo rejects.
  // Build the query string manually so scope value is passed literally.
  const base = [
    `response_type=code`,
    `client_id=${encodeURIComponent(CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    `scope=read(all)`,
    `state=${encodeURIComponent(state)}`,
  ].join("&");
  return `${AUTH_URL}?${base}`;
}

export async function exchangeCode(code: string): Promise<AcceloTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(refreshToken: string): Promise<AcceloTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Accelo not connected — no tokens stored");

  const bufferMs = 60 * 1000;
  if (tokens.expiresAt.getTime() - bufferMs > Date.now()) {
    return tokens.accessToken;
  }

  const fresh = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(fresh);
  return fresh.accessToken;
}

export async function acceloGet<T = any>(path: string): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getConnectionStatus(): Promise<{ connected: boolean; expiresAt?: Date }> {
  const tokens = await loadTokens();
  if (!tokens) return { connected: false };
  return { connected: true, expiresAt: tokens.expiresAt };
}
