/** Money and status rules shared by the admin's invoices, reports and lists. */
export type InvoiceLike = {
  amount: number | string | null;
  vat_percent: number | string | null;
  status: string;
  issue_date: string;
  paid_date?: string | null;
  due_date?: string | null;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Invoice total including VAT, rounded to baisa (3 decimals, Omani Rial). */
export const invoiceTotal = (i: InvoiceLike) => {
  const amt = Number(i.amount) || 0;
  const vat = Number(i.vat_percent) || 0;
  return round3(amt * (1 + vat / 100));
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Unpaid (not paid, not cancelled) and past its due date. */
export const isOverdue = (i: InvoiceLike, today = todayIso()) =>
  i.status === "unpaid" && !!i.due_date && i.due_date < today;

/** Paid income grouped by YYYY-MM (paid date, falling back to issue date). */
export function monthlyIncome(list: InvoiceLike[]) {
  const out: Record<string, number> = {};
  for (const i of list) {
    if (i.status !== "paid") continue;
    const m = (i.paid_date || i.issue_date).slice(0, 7);
    out[m] = round3((out[m] ?? 0) + invoiceTotal(i));
  }
  return out;
}

export const omr = (n: number) =>
  `OMR ${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

/** A request's follow-up is due when its date is today or earlier and it is not closed. */
export const followUpDue = (r: { follow_up_date?: string | null; status: string }, today = todayIso()) =>
  !!r.follow_up_date && !["completed", "cancelled"].includes(r.status) && r.follow_up_date <= today;

/** Next free invoice number for the year, e.g. INV-2026-0007. */
export function nextInvoiceNo(existing: string[], year = new Date().getFullYear()) {
  const prefix = `INV-${year}-`;
  const max = existing
    .filter((n) => n?.startsWith(prefix))
    .reduce((m, n) => Math.max(m, Number(n.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
