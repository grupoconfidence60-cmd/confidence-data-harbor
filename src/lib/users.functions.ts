import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "gestor", "supervisor", "rh", "colaborador"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(200),
        password: z.string().min(8).max(72),
        cargo: z.string().trim().max(120).optional(),
        role: roleEnum,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
      app_metadata: { created_by_admin: "true" },
    });
    if (error || !created.user) return { ok: false as const, error: error?.message ?? "Falha ao criar" };
    await supabaseAdmin.from("profiles").update({ cargo: data.cargo ?? null, status: "ativo" }).eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true as const, id: created.user.id };
  });

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        role: roleEnum.optional(),
        status: z.enum(["ativo", "inativo", "bloqueado"]).optional(),
        cargo: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && (data.status && data.status !== "ativo" || (data.role && data.role !== "admin")))
      return { ok: false as const, error: "Você não pode remover o próprio acesso de administrador." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: "ativo" | "inativo" | "bloqueado"; cargo?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.cargo !== undefined) patch.cargo = data.cargo;
    if (Object.keys(patch).length) await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    if (data.status === "bloqueado" || data.status === "inativo") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    } else if (data.status === "ativo") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    }
    return { ok: true as const };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  });

export const touchLastAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("profiles").update({ last_access: new Date().toISOString() }).eq("id", context.userId);
    return { ok: true };
  });
