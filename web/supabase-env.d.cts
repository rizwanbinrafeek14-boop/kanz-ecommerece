export function keyKind(key: string | null | undefined): "public" | "secret" | "unknown";
export function resolveSupabaseEnv(env?: Record<string, string | undefined>): { url: string | null; anonKey: string | null; serviceKey: string | null; notes: string[] };
