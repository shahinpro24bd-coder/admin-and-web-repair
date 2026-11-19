/** Admin logins use a username; Cloud auth needs an email, so plain usernames map to this private domain. */
export const ADMIN_EMAIL_DOMAIN = "drlama-admin.app";

export const usernameToEmail = (u: string) =>
  u.includes("@") ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;

export const emailToUsername = (email: string) =>
  email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`) ? email.slice(0, -(ADMIN_EMAIL_DOMAIN.length + 1)) : email;

/** Turns Cloud auth error messages into plain sentences for the clinic staff. */
export function friendlyAuthError(message: string) {
  if (/weak|easy to guess|pwned/i.test(message))
    return "This password is too common and easy to guess. Please choose a stronger one (mix words, numbers and symbols).";
  if (/invalid login credentials/i.test(message)) return "Wrong username or password.";
  if (/current password/i.test(message)) return "Current password is wrong.";
  if (/same.*password|different from the old/i.test(message)) return "The new password must be different from the current one.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  return message;
}
