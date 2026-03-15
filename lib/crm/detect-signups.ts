import { createRetentionLayerClient } from "@/lib/supabase";
import { createRumiAppClient } from "@/lib/supabase/rumi-app";

/**
 * Batched signup + session detection for CRM contacts.
 *
 * Data flow:
 *   crm_contacts (Retention_Layer)
 *       │
 *       ├─ email match ──> user_identities (Rumi_App)
 *       │                      │
 *       │                      └─> session_summaries (Rumi_App)
 *       │
 *       └─ access_code fallback ──> access_code_redemptions (Retention_Layer)
 *                                       │
 *                                       └─> user_identities by user_id (Rumi_App)
 *
 * Uses batched .in_() queries: 2-4 round-trips total instead of 2N.
 */

interface CrmContact {
  id: string;
  email: string | null;
  access_code: string | null;
}

interface DetectionResult {
  contactId: string;
  signedUpAt: string | null;
  userId: string | null;
  firstSessionAt: string | null;
  totalSessions: number;
  totalMinutes: number;
  lastSessionAt: string | null;
}

export async function detectSignups(
  contacts: CrmContact[]
): Promise<DetectionResult[]> {
  if (contacts.length === 0) return [];

  const rumiApp = createRumiAppClient();
  const retentionLayer = createRetentionLayerClient();
  const results: DetectionResult[] = [];

  // Step 1: Batch email match against Rumi_App.user_identities
  const emails = contacts
    .map((c) => c.email)
    .filter((e): e is string => e !== null);

  const { data: identities } = emails.length > 0
    ? await rumiApp
        .from("user_identities")
        .select("email,user_id,created_at")
        .in("email", emails)
    : { data: [] as { email: string; user_id: string; created_at: string }[] };

  const emailToIdentity = new Map(
    (identities || []).map((i) => [i.email.toLowerCase(), i])
  );

  // Step 2: For contacts without email match, try access_code fallback
  const unmatchedWithCode = contacts.filter(
    (c) =>
      (!c.email || !emailToIdentity.has(c.email.toLowerCase())) &&
      c.access_code
  );
  const codes = unmatchedWithCode.map((c) => c.access_code!);

  let codeToUserId = new Map<string, { userId: string; createdAt: string }>();
  if (codes.length > 0) {
    const { data: codeRows } = await retentionLayer
      .from("access_codes")
      .select("id,code")
      .in("code", codes);

    if (codeRows && codeRows.length > 0) {
      const codeIds = codeRows.map((r) => r.id);
      const { data: redemptions } = await retentionLayer
        .from("access_code_redemptions")
        .select("code_id,user_id,created_at")
        .in("code_id", codeIds);

      if (redemptions) {
        const codeIdToCode = new Map(codeRows.map((r) => [r.id, r.code]));
        for (const r of redemptions) {
          const code = codeIdToCode.get(r.code_id);
          if (code) {
            codeToUserId.set(code, {
              userId: r.user_id,
              createdAt: r.created_at,
            });
          }
        }
      }
    }
  }

  // Step 3: Collect all matched user IDs for session lookup
  const userIdSet = new Set<string>();
  const contactToUserId = new Map<string, { userId: string; signedUpAt: string }>();

  for (const contact of contacts) {
    const emailMatch = contact.email
      ? emailToIdentity.get(contact.email.toLowerCase())
      : null;
    if (emailMatch) {
      contactToUserId.set(contact.id, {
        userId: emailMatch.user_id,
        signedUpAt: emailMatch.created_at,
      });
      userIdSet.add(emailMatch.user_id);
    } else if (contact.access_code && codeToUserId.has(contact.access_code)) {
      const match = codeToUserId.get(contact.access_code)!;
      contactToUserId.set(contact.id, {
        userId: match.userId,
        signedUpAt: match.createdAt,
      });
      userIdSet.add(match.userId);
    }
  }

  // Step 4: Batch session lookup for all matched users
  const userIds = [...userIdSet];
  let sessionsByUser = new Map<
    string,
    { total: number; minutes: number; first: string; last: string }
  >();

  if (userIds.length > 0) {
    const { data: sessions } = await rumiApp
      .from("session_summaries")
      .select("user_id,duration_minutes,session_started_at")
      .in("user_id", userIds);

    if (sessions) {
      for (const s of sessions) {
        const existing = sessionsByUser.get(s.user_id);
        const startedAt = s.session_started_at;
        const minutes = s.duration_minutes || 0;
        if (!existing) {
          sessionsByUser.set(s.user_id, {
            total: 1,
            minutes,
            first: startedAt,
            last: startedAt,
          });
        } else {
          existing.total++;
          existing.minutes += minutes;
          if (startedAt < existing.first) existing.first = startedAt;
          if (startedAt > existing.last) existing.last = startedAt;
        }
      }
    }
  }

  // Step 5: Build results
  for (const contact of contacts) {
    const match = contactToUserId.get(contact.id);
    if (!match) {
      results.push({
        contactId: contact.id,
        signedUpAt: null,
        userId: null,
        firstSessionAt: null,
        totalSessions: 0,
        totalMinutes: 0,
        lastSessionAt: null,
      });
      continue;
    }

    const sessionData = sessionsByUser.get(match.userId);
    results.push({
      contactId: contact.id,
      signedUpAt: match.signedUpAt,
      userId: match.userId,
      firstSessionAt: sessionData?.first || null,
      totalSessions: sessionData?.total || 0,
      totalMinutes: sessionData?.minutes || 0,
      lastSessionAt: sessionData?.last || null,
    });
  }

  return results;
}

export async function updateContactsFromDetection(
  detectionResults: DetectionResult[]
): Promise<number> {
  const retentionLayer = createRetentionLayerClient();
  let updated = 0;

  for (const result of detectionResults) {
    if (!result.signedUpAt) continue;

    const { error } = await retentionLayer
      .from("crm_contacts")
      .update({
        signed_up_at: result.signedUpAt,
        first_session_at: result.firstSessionAt,
        total_sessions: result.totalSessions,
        total_minutes: result.totalMinutes,
        last_session_at: result.lastSessionAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", result.contactId);

    if (!error) updated++;
  }

  return updated;
}
