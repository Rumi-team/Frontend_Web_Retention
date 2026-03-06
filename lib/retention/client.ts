import { GoogleAuth } from "google-auth-library";

const RETENTION_API_URL = process.env.RETENTION_API_URL || "";
const RETENTION_API_KEY = process.env.RETENTION_API_KEY || "";
const RETENTION_SA_KEY_B64 = process.env.RETENTION_SA_KEY || "";

let cachedAuth: GoogleAuth | null = null;

/** Get an OIDC token for Cloud Run authentication. */
async function getOidcToken(): Promise<string | null> {
  if (!RETENTION_SA_KEY_B64 || !RETENTION_API_URL) return null;
  try {
    if (!cachedAuth) {
      const keyJson = JSON.parse(
        Buffer.from(RETENTION_SA_KEY_B64, "base64").toString("utf-8")
      );
      cachedAuth = new GoogleAuth({
        credentials: keyJson,
      });
    }
    const client = await cachedAuth.getIdTokenClient(RETENTION_API_URL);
    const hdrs = await client.getRequestHeaders();
    return hdrs.Authorization?.replace("Bearer ", "") || null;
  } catch {
    return null;
  }
}

async function getHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": RETENTION_API_KEY,
  };
  const oidc = await getOidcToken();
  if (oidc) h["Authorization"] = `Bearer ${oidc}`;
  return h;
}

export async function trackEvent(
  providerUserId: string,
  eventType: string,
  properties?: Record<string, unknown>
) {
  if (!RETENTION_API_URL) return;
  try {
    await fetch(`${RETENTION_API_URL}/api/v1/event`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({
        provider_user_id: providerUserId,
        event_type: eventType,
        properties,
      }),
    });
  } catch {
    // Fire-and-forget — don't break user flow
  }
}

export async function requestDecision(
  providerUserId: string,
  decisionPoint: string,
  coachingContext?: Record<string, unknown>
) {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(`${RETENTION_API_URL}/api/v1/decide`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({
        provider_user_id: providerUserId,
        decision_point: decisionPoint,
        coaching_context: coachingContext,
      }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function reportReward(
  decisionId: string,
  providerUserId: string,
  rewardType: string,
  rewardValue: number
) {
  if (!RETENTION_API_URL) return;
  try {
    await fetch(`${RETENTION_API_URL}/api/v1/reward`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({
        decision_id: decisionId,
        provider_user_id: providerUserId,
        reward_type: rewardType,
        reward_value: rewardValue,
      }),
    });
  } catch {
    // Fire-and-forget
  }
}

export async function fetchMetrics() {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(`${RETENTION_API_URL}/api/v1/metrics`, {
      headers: await getHeaders(),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function fetchConfig() {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(`${RETENTION_API_URL}/api/v1/config`, {
      headers: await getHeaders(),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function updateConfig(
  version: string,
  configJson: Record<string, unknown>,
  publishedBy: string,
  notes: string = ""
) {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(`${RETENTION_API_URL}/api/v1/config`, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify({
        version,
        config_json: configJson,
        published_by: publishedBy,
        notes,
      }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function fetchPosteriors(userId: string) {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(
      `${RETENTION_API_URL}/api/v1/posteriors/${encodeURIComponent(userId)}`,
      { headers: await getHeaders() }
    );
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function fetchSegments() {
  if (!RETENTION_API_URL) return null;
  try {
    const resp = await fetch(`${RETENTION_API_URL}/api/v1/segments`, {
      headers: await getHeaders(),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}
