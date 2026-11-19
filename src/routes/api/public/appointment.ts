import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().max(200).optional().default(""),
  date: z.string().trim().max(60).optional().default(""),
  treatment: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(3000).optional().default(""),
  page: z.string().trim().max(200).optional().default(""),
});

// Website appointment form → admin "Appointment Requests" inbox (insert only, as a visitor).
export const Route = createFileRoute("/api/public/appointment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = Body.safeParse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        const d = parsed.data;
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { error } = await sb.from("appointment_requests").insert({
          name: d.name,
          phone: d.phone,
          email: d.email || null,
          preferred_date: d.date || null,
          treatment: d.treatment || null,
          message: d.message || null,
          page: d.page || null,
        });
        if (error) {
          console.error("appointment insert failed", error.message);
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
