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
  // Contacts may have comma-separated emails — split and check each
  const allEmails: string[] = [];
  for (const c of contacts) {
    if (!c.email) continue;
    for (const addr of c.email.split(",").map((e) => e.trim()).filter(Boolean)) {
      allEmails.push(addr);
    }
  }

  const { data: identities } = allEmails.length > 0
    ? await rumiApp
        .from("user_identities")
        .select("email,user_id,provider_user_id,linked_at")
        .in("email", allEmails)
    : { data: [] as { email: string; user_id: string; provider_user_id: string; linked_at: string }[] };

  const emailToIdentity = new Map(
    (identities || []).map((i) => [i.email.toLowerCase(), i])
  );

  // Step 2: For contacts without email match, try access_code fallback
  const hasEmailMatch = (email: string | null) => {
    if (!email) return false;
    return email.split(",").some((e) => emailToIdentity.has(e.trim().toLowerCase()));
  };
  const unmatchedWithCode = contacts.filter(
    (c) =>
      !hasEmailMatch(c.email) &&
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

  // Step 3: Collect all matched users (need provider_user_id for session lookup)
  const providerIdSet = new Set<string>();
  const contactToUser = new Map<
    string,
    { userId: string; providerUserId: string | null; signedUpAt: string }
  >();

  for (const contact of contacts) {
    // Check all comma-separated emails for a match
    let emailMatch: (typeof identities extends (infer T)[] | null ? T : never) | null = null;
    if (contact.email) {
      for (const addr of contact.email.split(",").map((e) => e.trim()).filter(Boolean)) {
        const found = emailToIdentity.get(addr.toLowerCase());
        if (found) { emailMatch = found; break; }
      }
    }
    if (emailMatch) {
      contactToUser.set(contact.id, {
        userId: emailMatch.user_id,
        providerUserId: emailMatch.provider_user_id,
        signedUpAt: emailMatch.linked_at,
      });
      if (emailMatch.provider_user_id) {
        providerIdSet.add(emailMatch.provider_user_id);
      }
    } else if (contact.access_code && codeToUserId.has(contact.access_code)) {
      const match = codeToUserId.get(contact.access_code)!;
      contactToUser.set(contact.id, {
        userId: match.userId,
        providerUserId: null, // resolved in Step 3b
        signedUpAt: match.createdAt,
      });
    }
  }

  // Step 3b: Resolve provider_user_id for code-matched users
  const codeMatchedUserIds = [...contactToUser.values()]
    .filter((v) => !v.providerUserId)
    .map((v) => v.userId);

  if (codeMatchedUserIds.length > 0) {
    const { data: codeIdentities } = await rumiApp
      .from("user_identities")
      .select("user_id,provider_user_id")
      .in("user_id", codeMatchedUserIds);

    if (codeIdentities) {
      const userIdToProvider = new Map(
        codeIdentities.map((i) => [i.user_id, i.provider_user_id])
      );
      for (const entry of contactToUser.values()) {
        if (!entry.providerUserId && userIdToProvider.has(entry.userId)) {
          entry.providerUserId = userIdToProvider.get(entry.userId)!;
          providerIdSet.add(entry.providerUserId!);
        }
      }
    }
  }

  // Step 4: Batch session lookup by provider_user_id (session_summaries key)
  const providerUserIds = [...providerIdSet];
  let sessionsByProvider = new Map<
    string,
    { total: number; minutes: number; first: string; last: string }
  >();

  if (providerUserIds.length > 0) {
    const { data: sessions } = await rumiApp
      .from("session_summaries")
      .select("provider_user_id,duration_minutes,session_started_at")
      .in("provider_user_id", providerUserIds);

    if (sessions) {
      for (const s of sessions) {
        const existing = sessionsByProvider.get(s.provider_user_id);
        const startedAt = s.session_started_at;
        const minutes = s.duration_minutes || 0;
        if (!existing) {
          sessionsByProvider.set(s.provider_user_id, {
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
    const match = contactToUser.get(contact.id);
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

    const sessionData = match.providerUserId
      ? sessionsByProvider.get(match.providerUserId)
      : undefined;
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

/**
 * Discover users who signed up organically (not via CRM invite) and add them.
 *
 *   user_identities (Rumi_App)
 *       │
 *       ├─ filter out test users (@testuser.rumi.ai)
 *       ├─ compare against crm_contacts emails
 *       │
 *       └─ new users ──> auth.admin.getUserById (name)
 *                    ──> session_summaries (sessions)
 *                    ──> INSERT crm_contacts (source='organic')
 */
export async function discoverOrganicSignups(): Promise<number> {
  const rumiApp = createRumiAppClient();
  const retentionLayer = createRetentionLayerClient();

  // 1. Get all real user identities (exclude test users)
  const { data: allIdentities } = await rumiApp
    .from("user_identities")
    .select("email,user_id,provider_user_id,linked_at")
    .not("email", "like", "%@testuser.rumi.ai");

  if (!allIdentities || allIdentities.length === 0) return 0;

  // 2. Get all existing CRM contact emails (split comma-separated)
  const { data: existingContacts } = await retentionLayer
    .from("crm_contacts")
    .select("email");

  const existingEmails = new Set<string>();
  for (const c of existingContacts || []) {
    if (c.email) {
      for (const addr of c.email.split(",").map((e: string) => e.trim())) {
        if (addr) existingEmails.add(addr.toLowerCase());
      }
    }
  }

  // 3. Find users not in CRM
  const newUsers = allIdentities.filter(
    (i) => i.email && !existingEmails.has(i.email.toLowerCase())
  );

  if (newUsers.length === 0) return 0;

  // 4. Batch session lookup for all new users
  const providerIds = newUsers.map((u) => u.provider_user_id);
  const { data: sessions } = await rumiApp
    .from("session_summaries")
    .select("provider_user_id,duration_minutes,session_started_at")
    .in("provider_user_id", providerIds);

  const sessionsByProvider = new Map<
    string,
    { total: number; minutes: number; first: string; last: string }
  >();
  if (sessions) {
    for (const s of sessions) {
      const existing = sessionsByProvider.get(s.provider_user_id);
      const startedAt = s.session_started_at;
      const minutes = s.duration_minutes || 0;
      if (!existing) {
        sessionsByProvider.set(s.provider_user_id, {
          total: 1, minutes, first: startedAt, last: startedAt,
        });
      } else {
        existing.total++;
        existing.minutes += minutes;
        if (startedAt < existing.first) existing.first = startedAt;
        if (startedAt > existing.last) existing.last = startedAt;
      }
    }
  }

  // 5. Get names and create CRM contacts
  let created = 0;
  for (const user of newUsers) {
    let name = user.email.split("@")[0];
    try {
      const { data: authData } = await rumiApp.auth.admin.getUserById(user.user_id);
      const meta = authData?.user?.user_metadata;
      if (meta?.name) name = meta.name;
      else if (meta?.full_name) name = meta.full_name;
    } catch {
      // fallback to email prefix
    }

    const sd = sessionsByProvider.get(user.provider_user_id);
    const { error } = await retentionLayer
      .from("crm_contacts")
      .insert({
        name,
        email: user.email,
        source: "organic",
        signed_up_at: user.linked_at,
        first_session_at: sd?.first || null,
        total_sessions: sd?.total || 0,
        total_minutes: sd?.minutes || 0,
        last_session_at: sd?.last || null,
      });

    if (!error) created++;
  }

  return created;
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
