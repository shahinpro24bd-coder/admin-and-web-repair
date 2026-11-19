import { describe, expect, it } from "vitest";
import { followUpDue, invoiceTotal, isOverdue, monthlyIncome, nextInvoiceNo, omr } from "./clinic";

describe("clinic admin rules", () => {
  it("adds VAT to the invoice amount", () => {
    expect(invoiceTotal({ amount: 200, vat_percent: 5, status: "unpaid", issue_date: "2026-01-01" })).toBe(210);
  });

  it("shows money in Omani Rial with 3 decimals", () => {
    expect(omr(1234.5)).toBe("OMR 1,234.500");
  });

  it("marks an unpaid invoice past its due date as overdue, never a paid one", () => {
    const base = { amount: 10, vat_percent: 0, issue_date: "2026-01-01", due_date: "2026-01-10" };
    expect(isOverdue({ ...base, status: "unpaid" }, "2026-01-11")).toBe(true);
    expect(isOverdue({ ...base, status: "paid" }, "2026-01-11")).toBe(false);
    expect(isOverdue({ ...base, status: "unpaid" }, "2026-01-10")).toBe(false);
  });

  it("groups only paid invoices by the month they were paid", () => {
    const out = monthlyIncome([
      { amount: 100, vat_percent: 5, status: "paid", issue_date: "2026-01-20", paid_date: "2026-02-02" },
      { amount: 50, vat_percent: 0, status: "unpaid", issue_date: "2026-02-03" },
    ]);
    expect(out).toEqual({ "2026-02": 105 });
  });

  it("flags a follow-up that is due today on an open request", () => {
    expect(followUpDue({ follow_up_date: "2026-03-01", status: "contacted" }, "2026-03-01")).toBe(true);
    expect(followUpDue({ follow_up_date: "2026-03-01", status: "completed" }, "2026-03-05")).toBe(false);
  });

  it("numbers invoices one after the highest of the year", () => {
    expect(nextInvoiceNo(["INV-2026-0003", "INV-2025-0009"], 2026)).toBe("INV-2026-0004");
  });
});
