import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail, emailToUsername, friendlyAuthError } from "@/lib/admin-auth";

const Credentials = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters.")
    .max(60)
    .regex(/^[a-zA-Z0-9._@-]+$/, "Use only letters, numbers, dots, dashes or an email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

async function countAdmins() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function createAdmin(username: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (error || !data.user) return { ok: false as const, error: friendlyAuthError(error?.message ?? "Could not create the account.") };
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: data.user.id, role: "admin" });
  if (roleError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return { ok: false as const, error: roleError.message };
  }
  return { ok: true as const };
}

/** True while the clinic has no admin account yet, so the login page shows first-time setup. */
export const getAdminSetupState = createServerFn({ method: "GET" }).handler(async () => {
  return { needsSetup: (await countAdmins()) === 0 };
});

/** First-time setup: creates the very first admin. Refused once any admin exists. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Credentials.parse(input))
  .handler(async ({ data }) => {
    if ((await countAdmins()) > 0) return { ok: false as const, error: "An admin account already exists. Please sign in." };
    return createAdmin(data.username, data.password);
  });

async function assertAdmin(supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only admins can do this.");
}

/** Lists every admin login (for the Account tab). */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = new Set((roles ?? []).map((r) => r.user_id));
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    return data.users
      .filter((u) => ids.has(u.id))
      .map((u) => ({
        id: u.id,
        username: emailToUsername(u.email ?? ""),
        lastSignIn: u.last_sign_in_at ?? null,
        isYou: u.id === context.userId,
      }));
  });

/** Adds another admin login (e.g. a receptionist). Only admins can call it. */
export const addAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Credentials.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return createAdmin(data.username, data.password);
  });

/** Removes another admin login. You cannot remove yourself. */
export const removeAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) return { ok: false as const, error: "You cannot remove your own account." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
