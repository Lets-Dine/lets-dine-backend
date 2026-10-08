/** Collapses the aliases of one mailbox (`a.b+x@gmail.com` -> `ab@gmail.com`) so they count as one person. */
export function emailKey(email: string): string {
  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  const local = rawLocal.split("+")[0];
  return `${domain === "gmail.com" ? local.replace(/\./g, "") : local}@${domain}`;
}
