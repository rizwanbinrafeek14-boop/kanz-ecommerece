/** Shared validation for admin-entered web addresses: https only, public host, no embedded credentials. Throws a readable Error. */
export function httpsUrl(raw: string, what = "Web address"): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error(`${what} is not a valid web address. Start it with https://`); }
  if (u.protocol !== "https:") throw new Error(`${what} must start with https:// (http:// and other schemes are not allowed).`);
  if (u.username || u.password) throw new Error(`${what} must not contain a username or password.`);
  const h = u.hostname;
  if (!h.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === "localhost" || h.endsWith(".local") || h.startsWith("[")) throw new Error(`${what} must be a public website address.`);
  if (u.toString().length > 500) throw new Error(`${what} is too long.`);
  return u.toString();
}
