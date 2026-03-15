import { createRetentionLayerClient } from "@/lib/supabase";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability

export function generateCode(length = 8): string {
  const chars: string[] = [];
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    chars.push(CHARSET[byte % CHARSET.length]);
  }
  return chars.join("");
}

/**
 * Creates an access_codes row in Retention_Layer Supabase,
 * then returns the generated code string.
 * The crm_contacts row must store this same code in its access_code column.
 */
export async function createAccessCode(
  name: string,
  email: string | null
): Promise<{ code: string; error?: string }> {
  const retentionLayer = createRetentionLayerClient();
  const code = generateCode();

  const { error } = await retentionLayer.from("access_codes").insert({
    code,
    name,
    assigned_email: email,
    is_active: true,
    used_count: 0,
    max_uses: 1,
  });

  if (error) {
    return { code: "", error: error.message };
  }

  return { code };
}
