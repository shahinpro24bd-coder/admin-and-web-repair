import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { followUpDue, invoiceTotal, isOverdue, monthlyIncome, nextInvoiceNo, omr, todayIso } from "@/lib/clinic";
import type { ContactInfo } from "@/lib/admin-store";
import { btnAccent, btnDanger, btnOutline, btnSmall, Card, heading, input, Pill } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Field = {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select" | "time";
  options?: string[];
  required?: boolean;
  wide?: boolean;
};

export function useTable(table: string, order = "created_at") {
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await db.from(table).select("*").order(order, { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  }, [table, order]);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, load };
}

function CrudTable({
  title,
  table,
  fields,
  columns,
  rowTone,
  extra,
  defaults = {},
  rows,
  load,
}: {
  title: string;
  table: string;
  fields: Field[];
  columns: { label: string; render: (r: Row) => ReactNode }[];
  rowTone?: (r: Row) => string | undefined;
  extra?: (r: Row) => ReactNode;
  defaults?: Row;
  rows: Row[];
  load: () => void;
}) {
  const [edit, setEdit] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    for (const f of fields)
      if (f.required && !String(edit?.[f.key] ?? "").trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    const payload: Row = {};
    for (const f of fields) {
      const v = edit![f.key];
      const empty = v === "" || v === undefined || v === null;
      // New records skip empty fields so the database defaults (e.g. amount 0, VAT 5%) apply.
      if (empty && !edit!.id) continue;
      if (f.type === "number" && !empty && !Number.isFinite(Number(v))) {
        toast.error(`${f.label} must be a number`);
        return;
      }
      payload[f.key] = empty ? null : f.type === "number" ? Number(v) : v;
    }
    const res = edit!.id
      ? await db.from(table).update(payload).eq("id", edit!.id)
      : await db.from(table).insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Saved");
    setEdit(null);
    load();
  };
  const del = async (id: string) => {
    if (!window.confirm("Delete this record?")) return;
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className={`${heading} mr-auto text-2xl`}>
          {title} <span className="text-base text-muted-foreground">({rows.length})</span>
        </h2>
        <input
          className="w-56 border border-input bg-background px-3 py-1.5 text-sm"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className={btnAccent} onClick={() => setEdit({ ...defaults })}>
          <Plus className="size-4" /> Add new
        </button>
      </div>

      {edit && (
        <div className="mb-5 border border-border bg-admin-canvas p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <label
                key={f.key}
                className={`text-xs font-medium text-muted-foreground ${f.wide || f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}`}
              >
                {f.label}
                {f.required ? " *" : ""}
                {f.type === "textarea" ? (
                  <textarea
                    className={input}
                    rows={2}
                    value={edit[f.key] ?? ""}
                    onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                  />
                ) : f.type === "select" ? (
                  <select
                    className={input}
                    value={edit[f.key] ?? ""}
                    onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                  >
                    <option value="">—</option>
                    {f.options!.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={input}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={edit[f.key] ?? ""}
                    onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnAccent} onClick={save}>
              Save
            </button>
            <button type="button" className={btnOutline} onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.label} className="py-2 pr-3 font-semibold">
                  {c.label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="py-4 text-muted-foreground">
                  No records yet.
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={`border-b border-border align-top ${rowTone?.(r) ?? ""}`}>
                {columns.map((c) => (
                  <td key={c.label} className="py-2 pr-3">
                    {c.render(r)}
                  </td>
                ))}
                <td className="whitespace-nowrap py-2 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    {extra?.(r)}
                    <button type="button" className={btnSmall} onClick={() => setEdit({ ...r })} aria-label="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button type="button" className={btnDanger} onClick={() => del(r.id)} aria-label="Delete">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const sub = (v: ReactNode) => <small className="block text-muted-foreground">{v}</small>;
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export function Patients() {
  const t = useTable("patients");
  return (
    <CrudTable
      title="Patients"
      table="patients"
      {...t}
      fields={[
        { key: "name", label: "Full name", required: true },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "date_of_birth", label: "Date of birth", type: "date" },
        { key: "gender", label: "Gender", type: "select", options: ["Female", "Male"] },
        { key: "address", label: "Address" },
        { key: "notes", label: "Medical notes / allergies", type: "textarea" },
      ]}
      columns={[
        { label: "Name", render: (r) => <strong>{r.name}</strong> },
        { label: "Phone", render: (r) => r.phone && <a className="text-admin-accent" href={`tel:${r.phone}`}>{r.phone}</a> },
        { label: "Email", render: (r) => r.email },
        { label: "Date of birth", render: (r) => r.date_of_birth },
        { label: "Notes", render: (r) => <span className="line-clamp-2 max-w-xs">{r.notes}</span> },
      ]}
    />
  );
}

export function TreatmentPlans({ treatments }: { treatments: string[] }) {
  const t = useTable("treatment_plans", "next_visit");
  const today = todayIso();
  const soon = inDays(7);
  return (
    <CrudTable
      title="Treatment Plans"
      table="treatment_plans"
      {...t}
      defaults={{ status: "active", start_date: today, visits_planned: 2, visits_done: 0 }}
      fields={[
        { key: "patient_name", label: "Patient", required: true },
        { key: "treatment", label: "Treatment", type: "select", options: treatments },
        { key: "status", label: "Status", type: "select", options: ["active", "completed", "cancelled"] },
        { key: "start_date", label: "Start date", type: "date" },
        { key: "end_date", label: "Expected finish", type: "date" },
        { key: "next_visit", label: "Next visit", type: "date" },
        { key: "visits_planned", label: "Visits planned", type: "number" },
        { key: "visits_done", label: "Visits done", type: "number" },
        { key: "amount", label: "Plan price (OMR)", type: "number" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      rowTone={(r) => (r.status === "active" && r.next_visit && r.next_visit <= soon ? "bg-admin-warn/10" : undefined)}
      columns={[
        { label: "Patient", render: (r) => <strong>{r.patient_name}</strong> },
        { label: "Treatment", render: (r) => r.treatment },
        { label: "Period", render: (r) => `${r.start_date ?? "?"} → ${r.end_date ?? "?"}` },
        {
          label: "Progress",
          render: (r) => `${r.visits_done ?? 0} / ${r.visits_planned ?? "?"} visits`,
        },
        {
          label: "Next visit",
          render: (r) => (
            <>
              {r.next_visit}
              {r.status === "active" && r.next_visit && r.next_visit < today && sub(<span className="text-destructive">Missed</span>)}
              {r.status === "active" && r.next_visit && r.next_visit >= today && r.next_visit <= soon && sub("This week")}
            </>
          ),
        },
        { label: "Price", render: (r) => (r.amount != null ? omr(Number(r.amount)) : "") },
        {
          label: "Status",
          render: (r) => <Pill tone={({ active: "green", completed: "blue", cancelled: "gray" } as Record<string, string>)[r.status]}>{r.status}</Pill>,
        },
      ]}
    />
  );
}

export function Appointments({ treatments }: { treatments: string[] }) {
  const t = useTable("appointments", "scheduled_date");
  const today = todayIso();
  return (
    <CrudTable
      title="Appointments"
      table="appointments"
      {...t}
      defaults={{ status: "scheduled", priority: "normal", scheduled_date: today, dentist: "Dr. Lama Ghassan" }}
      fields={[
        { key: "title", label: "Visit", required: true },
        { key: "patient_name", label: "Patient" },
        { key: "phone", label: "Phone" },
        { key: "treatment", label: "Treatment", type: "select", options: treatments },
        { key: "dentist", label: "Dentist" },
        { key: "scheduled_date", label: "Date", type: "date" },
        { key: "scheduled_time", label: "Time", type: "time" },
        { key: "priority", label: "Priority", type: "select", options: ["low", "normal", "urgent"] },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: ["scheduled", "confirmed", "in progress", "completed", "no-show", "cancelled"],
        },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      rowTone={(r) =>
        r.priority === "urgent" && !["completed", "cancelled"].includes(r.status)
          ? "bg-destructive/5"
          : r.scheduled_date === today
            ? "bg-admin-accent-soft"
            : undefined
      }
      columns={[
        {
          label: "Date",
          render: (r) => (
            <>
              {r.scheduled_date}
              {sub(r.scheduled_time)}
              {r.scheduled_date === today && sub(<strong>Today</strong>)}
            </>
          ),
        },
        { label: "Visit", render: (r) => <><strong>{r.title}</strong>{sub(r.treatment)}</> },
        {
          label: "Patient",
          render: (r) => (
            <>
              {r.patient_name}
              {r.phone && sub(<a className="text-admin-accent" href={`tel:${r.phone}`}>{r.phone}</a>)}
            </>
          ),
        },
        { label: "Dentist", render: (r) => r.dentist || <span className="text-destructive">Unassigned</span> },
        {
          label: "Priority",
          render: (r) => <Pill tone={({ urgent: "red", normal: "blue", low: "gray" } as Record<string, string>)[r.priority]}>{r.priority}</Pill>,
        },
        {
          label: "Status",
          render: (r) => (
            <Pill
              tone={
                ({ scheduled: "blue", confirmed: "blue", "in progress": "amber", completed: "green", "no-show": "red", cancelled: "gray" } as Record<string, string>)[r.status]
              }
            >
              {r.status}
            </Pill>
          ),
        },
      ]}
    />
  );
}

export function Invoices({ contact }: { contact: ContactInfo }) {
  const t = useTable("invoices", "issue_date");
  const next = nextInvoiceNo(t.rows.map((r) => r.invoice_no));
  const today = todayIso();
  const markPaid = async (r: Row) => {
    const { error } = await db.from("invoices").update({ status: "paid", paid_date: today }).eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${r.invoice_no} marked paid`);
      t.load();
    }
  };
  return (
    <CrudTable
      title="Invoices"
      table="invoices"
      {...t}
      defaults={{ invoice_no: next, status: "unpaid", vat_percent: 5, issue_date: today, due_date: inDays(14) }}
      fields={[
        { key: "invoice_no", label: "Invoice no.", required: true },
        { key: "patient_name", label: "Patient", required: true },
        { key: "amount", label: "Amount before VAT (OMR)", type: "number", required: true },
        { key: "vat_percent", label: "VAT %", type: "number", required: true },
        { key: "issue_date", label: "Issue date", type: "date", required: true },
        { key: "due_date", label: "Due date", type: "date" },
        { key: "status", label: "Status", type: "select", options: ["unpaid", "paid", "cancelled"] },
        { key: "paid_date", label: "Paid date", type: "date" },
        { key: "description", label: "Treatment / description", type: "textarea" },
      ]}
      rowTone={(r) => (isOverdue(r) ? "bg-destructive/5" : undefined)}
      extra={(r) => (
        <>
          <button type="button" className={btnSmall} onClick={() => printInvoice(r, contact)} aria-label="Print">
            <Printer className="size-3.5" />
          </button>
          {r.status === "unpaid" && (
            <button type="button" className={btnSmall} onClick={() => markPaid(r)}>
              Mark paid
            </button>
          )}
        </>
      )}
      columns={[
        { label: "No.", render: (r) => <strong>{r.invoice_no}</strong> },
        { label: "Patient", render: (r) => <>{r.patient_name}{sub(r.description)}</> },
        { label: "Issued", render: (r) => r.issue_date },
        {
          label: "Due",
          render: (r) => <>{r.due_date}{isOverdue(r) && sub(<span className="text-destructive">Overdue</span>)}</>,
        },
        { label: "Total (incl. VAT)", render: (r) => omr(invoiceTotal(r)) },
        {
          label: "Status",
          render: (r) => <Pill tone={({ paid: "green", unpaid: "amber", cancelled: "gray" } as Record<string, string>)[r.status]}>{r.status}</Pill>,
        },
      ]}
    />
  );
}

function printInvoice(r: Row, c: ContactInfo) {
  const w = window.open("", "_blank");
  if (!w) return;
  const amt = Number(r.amount) || 0;
  const total = invoiceTotal(r);
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  w.document.write(`<html><head><title>${esc(r.invoice_no)}</title><style>
  body{font-family:Georgia,serif;padding:48px;color:#1d2a2a;max-width:820px;margin:auto}
  h1{margin:0;font-weight:500}.muted{color:#667}table{width:100%;border-collapse:collapse;margin-top:28px}
  td,th{border-bottom:1px solid #d8dcdc;padding:10px;text-align:left}.r{text-align:right}.tot th{border-top:2px solid #1d2a2a}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #17605c;padding-bottom:16px}
  </style></head><body>
  <div class="head"><div><h1>${esc(c.doctor)}</h1><div class="muted">${esc(c.title)}</div>
  <div class="muted" style="margin-top:8px;max-width:360px">${esc(c.address)}<br>Tel: ${esc(c.phone)}${c.email ? ` · ${esc(c.email)}` : ""}</div></div>
  <div class="r"><h2 style="margin:0">INVOICE</h2><div>${esc(r.invoice_no)}</div></div></div>
  <p><b>Patient:</b> ${esc(r.patient_name)}<br><b>Date:</b> ${esc(r.issue_date)} &nbsp; <b>Due:</b> ${esc(r.due_date)}</p>
  <table><tr><th>Treatment</th><th class="r">Amount (OMR)</th></tr>
  <tr><td>${esc(r.description)}</td><td class="r">${amt.toFixed(3)}</td></tr>
  <tr><td class="r">VAT ${esc(r.vat_percent)}%</td><td class="r">${(total - amt).toFixed(3)}</td></tr>
  <tr class="tot"><th class="r">Total</th><th class="r">${total.toFixed(3)}</th></tr></table>
  <p>Status: <b>${esc(r.status).toUpperCase()}</b>${r.paid_date ? ` · paid ${esc(r.paid_date)}` : ""}</p>
  <script>window.print()</script></body></html>`);
  w.document.close();
}

export function Reports() {
  const inv = useTable("invoices", "issue_date").rows;
  const appts = useTable("appointments", "scheduled_date").rows;
  const plans = useTable("treatment_plans").rows;
  const reqs = useTable("appointment_requests").rows;
  const today = todayIso();
  const months = useMemo(() => Object.entries(monthlyIncome(inv)).sort().reverse().slice(0, 12), [inv]);
  const paid = inv.filter((i) => i.status === "paid").reduce((s, i) => s + invoiceTotal(i), 0);
  const due = inv.filter((i) => i.status === "unpaid").reduce((s, i) => s + invoiceTotal(i), 0);
  const max = Math.max(1, ...months.map(([, v]) => v));
  const cards: [string, string][] = [
    ["Income received", omr(paid)],
    ["Outstanding", omr(due)],
    ["Overdue invoices", String(inv.filter((i) => isOverdue(i)).length)],
    ["Active treatment plans", String(plans.filter((p) => p.status === "active").length)],
    [
      "Upcoming appointments",
      String(appts.filter((a) => a.scheduled_date >= today && ["scheduled", "confirmed"].includes(a.status)).length),
    ],
    ["Appointments completed", String(appts.filter((a) => a.status === "completed").length)],
    ["Website requests", String(reqs.length)],
    ["Requests booked", String(reqs.filter((r) => r.status === "booked" || r.status === "completed").length)],
  ];
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([l, v]) => (
          <Card key={l}>
            <div className="text-2xl font-semibold">{v}</div>
            <div className="text-sm text-muted-foreground">{l}</div>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className={`${heading} mb-3 text-2xl`}>Monthly income (paid invoices)</h2>
        {months.length === 0 && <p className="text-sm text-muted-foreground">No paid invoices yet.</p>}
        {months.map(([m, v]) => (
          <div key={m} className="mb-2 flex items-center gap-3 text-sm">
            <span className="w-20">{m}</span>
            <div className="h-5 flex-1 bg-admin-canvas">
              <div className="h-full bg-admin-accent" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <strong className="w-36 text-right">{omr(v)}</strong>
          </div>
        ))}
      </Card>
    </div>
  );
}

export type RequestRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferred_date: string | null;
  treatment: string | null;
  message: string | null;
  page: string | null;
  status: string;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
};

export const REQUEST_STATUSES = ["new", "contacted", "booked", "completed", "cancelled"];

export function Requests({ requests, reload }: { requests: RequestRow[]; reload: () => void }) {
  const update = async (id: string, patch: Partial<RequestRow>, msg = "Updated") => {
    const { error } = await db.from("appointment_requests").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(msg);
      reload();
    }
  };
  const del = async (id: string) => {
    if (!window.confirm("Delete this request?")) return;
    const { error } = await db.from("appointment_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  };
  const savePatient = async (r: RequestRow) => {
    const { error } = await db.from("patients").insert({
      name: r.name,
      phone: r.phone,
      email: r.email,
      notes: r.message ? `From website request: ${r.message}` : "From website request",
    });
    if (error) toast.error(error.message);
    else toast.success("Added to patients");
  };
  const book = async (r: RequestRow) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.preferred_date ?? "") ? r.preferred_date : todayIso();
    const { error } = await db.from("appointments").insert({
      title: "Consultation",
      patient_name: r.name,
      phone: r.phone,
      scheduled_date: date,
      status: "scheduled",
      priority: "normal",
      dentist: "Dr. Lama Ghassan",
      notes: r.message,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await update(r.id, { status: "booked" }, "Appointment created — see Appointments");
  };

  return (
    <Card>
      <h2 className={`${heading} text-2xl`}>Appointment requests</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Every request sent from the website's appointment form. Patients are still sent to WhatsApp as before.
      </p>
      {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
      <div className="grid gap-3">
        {requests.map((r) => (
          <div
            key={r.id}
            className={`border border-border p-4 ${r.status === "new" ? "border-l-4 border-l-admin-accent" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">
                {r.name} {r.status === "new" && <Pill tone="blue">New</Pill>}{" "}
                {followUpDue(r) && <Pill tone="red">Follow-up due</Pill>}
              </h3>
              <small className="text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GB")}</small>
            </div>
            <p className="mt-1 text-sm">
              <a className="text-admin-accent" href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                {r.phone}
              </a>
              {r.email && <> · <a className="text-admin-accent" href={`mailto:${r.email}`}>{r.email}</a></>}
              {r.preferred_date && <> · Preferred date: <strong>{r.preferred_date}</strong></>}
              {r.page && <span className="text-muted-foreground"> · from {r.page}</span>}
            </p>
            {r.message && <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-64 flex-1 text-xs text-muted-foreground">
                Internal notes
                <textarea
                  className={input}
                  rows={1}
                  defaultValue={r.notes ?? ""}
                  onBlur={(e) => e.target.value !== (r.notes ?? "") && update(r.id, { notes: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Follow-up
                <input
                  type="date"
                  className={input}
                  defaultValue={r.follow_up_date ?? ""}
                  onChange={(e) => update(r.id, { follow_up_date: e.target.value || null })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Status
                <select className={input} value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}>
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnSmall} onClick={() => book(r)}>
                <CalendarPlus className="size-3.5" /> Book appointment
              </button>
              <button type="button" className={btnSmall} onClick={() => savePatient(r)}>
                <UserPlus className="size-3.5" /> Save as patient
              </button>
              <button type="button" className={btnDanger} onClick={() => del(r.id)}>
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
