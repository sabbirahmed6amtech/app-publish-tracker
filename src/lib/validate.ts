/**
 * Field rules for the client intake form, shared by the form (instant
 * feedback) and the server action (the real gate).
 *
 * Empty is fine everywhere (the client can save part and come back); a filled
 * field has to be the right kind of thing.
 */

export type Rule = (value: string) => string | null;

export const isEmail: Rule = (v) =>
  /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) ? null : "Enter a valid email, like name@company.com.";
export const isPhone: Rule = (v) => {
  const digits = v.replace(/\D/g, "").length;
  return /^\+?[\d\s().-]+$/.test(v) && digits >= 7 && digits <= 15
    ? null
    : "Enter a valid phone number, like +1 555 010 0199.";
};
export const isUrl: Rule = (v) => {
  try {
    const u = new URL(v);
    if (/^https?:$/.test(u.protocol) && u.hostname.includes(".")) return null;
  } catch {}
  return "Enter a full link that starts with https://";
};
export const isName: Rule = (v) =>
  /^[\p{L}][\p{L}\s.'’-]*$/u.test(v) ? null : "Use letters only.";
export const isEmailOrPhone: Rule = (v) =>
  isEmail(v) === null || isPhone(v) === null ? null : "Enter an email address or a phone number.";
export const max =
  (n: number): Rule =>
  (v) =>
    v.length > n ? `Keep it under ${n} characters.` : null;

export function check(value: string, ...rules: Rule[]): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  for (const rule of rules) {
    const problem = rule(v);
    if (problem) return problem;
  }
  return null;
}
