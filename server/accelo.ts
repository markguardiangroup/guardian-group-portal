import { pool } from "./db";

const REDIRECT_URI = "https://guardiangroup.ai/auth/accelo/callback";

export interface AcceloIntegration {
  id: string;
  sourceCode: string;
  deployment: string;
  clientId: string;
  clientSecret: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface AcceloIntegrationPublic {
  id: string;
  sourceCode: string;
  sourceLabel?: string;
  deployment: string;
  connected: boolean;
  expiresAt?: Date | null;
  isActive: boolean;
}

async function ensureIntegrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accelo_integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_code text NOT NULL UNIQUE,
      deployment text NOT NULL,
      client_id text NOT NULL,
      client_secret text NOT NULL,
      access_token text,
      refresh_token text,
      expires_at timestamptz,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // One-time migration: copy existing accelo_tokens row into accelo_integrations
  const existing = await pool.query(
    `SELECT COUNT(*) FROM accelo_integrations WHERE source_code = 'GS'`
  );
  if (Number(existing.rows[0].count) === 0) {
    const clientId     = process.env.ACCELO_CLIENT_ID     ?? "";
    const clientSecret = process.env.ACCELO_CLIENT_SECRET ?? "";
    // Migrate token row if it exists
    try {
      const tokenRow = await pool.query(
        `SELECT access_token, refresh_token, expires_at FROM accelo_tokens WHERE id = 1`
      );
      if (tokenRow.rows.length > 0) {
        const r = tokenRow.rows[0];
        await pool.query(
          `INSERT INTO accelo_integrations
             (source_code, deployment, client_id, client_secret, access_token, refresh_token, expires_at)
           VALUES ('GS', 'guardiansupport', $1, $2, $3, $4, $5)
           ON CONFLICT (source_code) DO NOTHING`,
          [clientId, clientSecret, r.access_token, r.refresh_token, r.expires_at]
        );
      } else if (clientId) {
        await pool.query(
          `INSERT INTO accelo_integrations (source_code, deployment, client_id, client_secret)
           VALUES ('GS', 'guardiansupport', $1, $2)
           ON CONFLICT (source_code) DO NOTHING`,
          [clientId, clientSecret]
        );
      }
    } catch { /* accelo_tokens may not exist yet — that's fine */ }
  }
}

// ── Low-level DB helpers ───────────────────────────────────────────────────────

export async function getIntegration(sourceCode: string): Promise<AcceloIntegration | null> {
  await ensureIntegrationsTable();
  const result = await pool.query(
    `SELECT id, source_code, deployment, client_id, client_secret,
            access_token, refresh_token, expires_at, is_active, created_at
     FROM accelo_integrations WHERE source_code = $1`,
    [sourceCode]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id:           r.id,
    sourceCode:   r.source_code,
    deployment:   r.deployment,
    clientId:     r.client_id,
    clientSecret: r.client_secret,
    accessToken:  r.access_token,
    refreshToken: r.refresh_token,
    expiresAt:    r.expires_at ? new Date(r.expires_at) : null,
    isActive:     r.is_active,
    createdAt:    new Date(r.created_at),
  };
}

export async function listIntegrations(): Promise<AcceloIntegration[]> {
  await ensureIntegrationsTable();
  const result = await pool.query(
    `SELECT id, source_code, deployment, client_id, client_secret,
            access_token, refresh_token, expires_at, is_active, created_at
     FROM accelo_integrations ORDER BY created_at`
  );
  return result.rows.map(r => ({
    id:           r.id,
    sourceCode:   r.source_code,
    deployment:   r.deployment,
    clientId:     r.client_id,
    clientSecret: r.client_secret,
    accessToken:  r.access_token,
    refreshToken: r.refresh_token,
    expiresAt:    r.expires_at ? new Date(r.expires_at) : null,
    isActive:     r.is_active,
    createdAt:    new Date(r.created_at),
  }));
}

export async function createIntegration(data: {
  sourceCode: string;
  deployment: string;
  clientId: string;
  clientSecret: string;
}): Promise<AcceloIntegration> {
  await ensureIntegrationsTable();
  const result = await pool.query(
    `INSERT INTO accelo_integrations (source_code, deployment, client_id, client_secret)
     VALUES ($1, $2, $3, $4)
     RETURNING id, source_code, deployment, client_id, client_secret,
               access_token, refresh_token, expires_at, is_active, created_at`,
    [data.sourceCode, data.deployment, data.clientId, data.clientSecret]
  );
  const r = result.rows[0];
  return {
    id: r.id, sourceCode: r.source_code, deployment: r.deployment,
    clientId: r.client_id, clientSecret: r.client_secret,
    accessToken: null, refreshToken: null, expiresAt: null,
    isActive: r.is_active, createdAt: new Date(r.created_at),
  };
}

export async function updateIntegration(
  sourceCode: string,
  data: Partial<{ deployment: string; clientId: string; clientSecret: string; isActive: boolean }>
): Promise<boolean> {
  await ensureIntegrationsTable();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (data.deployment   !== undefined) { sets.push(`deployment    = $${idx++}`); params.push(data.deployment); }
  if (data.clientId     !== undefined) { sets.push(`client_id     = $${idx++}`); params.push(data.clientId); }
  if (data.clientSecret !== undefined) { sets.push(`client_secret = $${idx++}`); params.push(data.clientSecret); }
  if (data.isActive     !== undefined) { sets.push(`is_active     = $${idx++}`); params.push(data.isActive); }
  if (sets.length === 0) return false;
  params.push(sourceCode);
  const result = await pool.query(
    `UPDATE accelo_integrations SET ${sets.join(", ")} WHERE source_code = $${idx} RETURNING id`,
    params
  );
  return result.rows.length > 0;
}

export async function deleteIntegration(sourceCode: string): Promise<boolean> {
  await ensureIntegrationsTable();
  const result = await pool.query(
    `DELETE FROM accelo_integrations WHERE source_code = $1 RETURNING id`,
    [sourceCode]
  );
  return result.rows.length > 0;
}

// ── Token management (per source) ─────────────────────────────────────────────

export async function saveTokens(
  sourceCode: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date }
): Promise<void> {
  await ensureIntegrationsTable();
  await pool.query(
    `UPDATE accelo_integrations
     SET access_token = $1, refresh_token = $2, expires_at = $3
     WHERE source_code = $4`,
    [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, sourceCode]
  );
}

export async function clearTokens(sourceCode: string): Promise<void> {
  await ensureIntegrationsTable();
  await pool.query(
    `UPDATE accelo_integrations
     SET access_token = NULL, refresh_token = NULL, expires_at = NULL
     WHERE source_code = $1`,
    [sourceCode]
  );
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

export function buildAuthUrl(sourceCode: string, nonce: string): string {
  // State encodes both the nonce and the source so the callback knows which integration to save to
  const statePayload = Buffer.from(JSON.stringify({ nonce, sourceCode })).toString("base64url");
  // We need the integration's client_id and deployment synchronously — callers should pre-fetch
  // and pass them in. This overload accepts them directly to avoid async here.
  throw new Error("Use buildAuthUrlFromIntegration instead");
}

export function buildAuthUrlFromIntegration(
  integration: AcceloIntegration,
  statePayload: string
): string {
  const AUTH_URL = `https://${integration.deployment}.api.accelo.com/oauth2/v0/authorize`;
  const base = [
    `response_type=code`,
    `client_id=${encodeURIComponent(integration.clientId)}`,
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    `scope=read(all)`,
    `state=${encodeURIComponent(statePayload)}`,
  ].join("&");
  return `${AUTH_URL}?${base}`;
}

export async function exchangeCode(
  sourceCode: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const integration = await getIntegration(sourceCode);
  if (!integration) throw new Error(`Accelo integration not found for source: ${sourceCode}`);
  const TOKEN_URL = `https://${integration.deployment}.api.accelo.com/oauth2/v0/token`;
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    client_id:     integration.clientId,
    client_secret: integration.clientSecret,
    redirect_uri:  REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(
  integration: AcceloIntegration
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  if (!integration.refreshToken) throw new Error("No refresh token stored");
  const TOKEN_URL = `https://${integration.deployment}.api.accelo.com/oauth2/v0/token`;
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: integration.refreshToken,
    client_id:     integration.clientId,
    client_secret: integration.clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getValidAccessToken(sourceCode: string): Promise<string> {
  const integration = await getIntegration(sourceCode);
  if (!integration?.accessToken) {
    throw new Error(`Accelo not connected — no tokens stored for source ${sourceCode}`);
  }
  const bufferMs = 60 * 1000;
  if (integration.expiresAt && integration.expiresAt.getTime() - bufferMs > Date.now()) {
    return integration.accessToken;
  }
  const fresh = await refreshAccessToken(integration);
  await saveTokens(sourceCode, fresh);
  return fresh.accessToken;
}

export async function acceloGet<T = any>(sourceCode: string, path: string): Promise<T> {
  const integration = await getIntegration(sourceCode);
  if (!integration) throw new Error(`Accelo integration not found: ${sourceCode}`);
  const token = await getValidAccessToken(sourceCode);
  const BASE_URL = `https://${integration.deployment}.api.accelo.com/api/v0`;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Accelo GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getConnectionStatus(sourceCode: string): Promise<{ connected: boolean; expiresAt?: Date }> {
  const integration = await getIntegration(sourceCode);
  if (!integration?.accessToken) return { connected: false };
  return { connected: true, expiresAt: integration.expiresAt ?? undefined };
}

// Decode OAuth state payload
export function decodeOAuthState(statePayload: string): { nonce: string; sourceCode: string } | null {
  try {
    return JSON.parse(Buffer.from(statePayload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

// Return a code→label map from the sources table (empty string if source not found)
export async function getSourceLabels(): Promise<Record<string, string>> {
  try {
    const result = await pool.query(`SELECT code, label FROM sources`);
    const map: Record<string, string> = {};
    result.rows.forEach((r: any) => { map[r.code] = r.label; });
    return map;
  } catch {
    return {};
  }
}
