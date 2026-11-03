import { describe, expect, it } from "vitest";

import {
  customerEmailFromRecord,
  customerEmailSeenLabel,
  customerEmailSourceLabel,
  customerEmailStats,
  customerEmailsFromRecords,
  filterCustomerEmails,
  isValidEmail,
  normalizeEmail,
  sortCustomerEmails,
  type CustomerEmail,
} from "@/lib/customer-emails";

const row = (patch: Partial<CustomerEmail> = {}): CustomerEmail => ({
  id: "c-1",
  email: "nour@example.com",
  marketingOptIn: true,
  source: "signin_modal",
  signInCount: 0,
  firstSeenAt: "2026-11-01T09:00:00.000Z",
  lastSeenAt: "2026-11-01T09:00:00.000Z",
  userId: null,
  notes: null,
  ...patch,
});

describe("email validation", () => {
  it("normalises case and surrounding space", () => {
    expect(normalizeEmail("  Nour.Salem@Example.COM ")).toBe("nour.salem@example.com");
  });

  it("accepts real addresses and rejects near misses", () => {
    expect(isValidEmail("nour@example.com")).toBe(true);
    expect(isValidEmail(" NOUR@EXAMPLE.CO.UK ")).toBe(true);
    expect(isValidEmail("nour@example")).toBe(false);
    expect(isValidEmail("nour.example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("customerEmailFromRecord", () => {
  it("maps a complete customers row", () => {
    expect(
      customerEmailFromRecord({
        id: "c-1",
        email: "nour@example.com",
        marketing_opt_in: true,
        source: "signin_modal",
        sign_in_count: 3,
        first_seen_at: "2026-11-01T09:00:00.000Z",
        last_seen_at: "2026-11-04T18:30:00.000Z",
        user_id: "8f14",
        notes: "Wants a King set",
      }),
    ).toEqual({
      id: "c-1",
      email: "nour@example.com",
      marketingOptIn: true,
      source: "signin_modal",
      signInCount: 3,
      firstSeenAt: "2026-11-01T09:00:00.000Z",
      lastSeenAt: "2026-11-04T18:30:00.000Z",
      userId: "8f14",
      notes: "Wants a King set",
    });
  });

  it("defaults an unread last_seen_at to the first sighting", () => {
    expect(
      customerEmailFromRecord({
        id: "c-2",
        email: "hala@example.com",
        first_seen_at: "2026-11-02T09:00:00.000Z",
      }),
    ).toEqual({
      id: "c-2",
      email: "hala@example.com",
      marketingOptIn: false,
      source: "signin_modal",
      signInCount: 0,
      firstSeenAt: "2026-11-02T09:00:00.000Z",
      lastSeenAt: "2026-11-02T09:00:00.000Z",
      userId: null,
      notes: null,
    });
  });

  it("drops rows that cannot identify an address", () => {
    expect(customerEmailFromRecord(null)).toBeNull();
    expect(
      customerEmailFromRecord({ email: "a@b.co", first_seen_at: "2026-11-01T09:00:00Z" }),
    ).toBeNull();
    expect(
      customerEmailFromRecord({ id: "c-1", first_seen_at: "2026-11-01T09:00:00Z" }),
    ).toBeNull();
    expect(customerEmailFromRecord({ id: "c-1", email: "a@b.co" })).toBeNull();
    expect(customerEmailsFromRecords([row(), "nonsense", {}])).toHaveLength(1);
    expect(customerEmailsFromRecords(undefined)).toEqual([]);
  });
});

describe("register helpers", () => {
  it("sorts by most recent activity", () => {
    const sorted = sortCustomerEmails([
      row({ id: "old", lastSeenAt: "2026-10-01T09:00:00.000Z" }),
      row({ id: "new", lastSeenAt: "2026-11-05T09:00:00.000Z" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("searches email, source and link state", () => {
    const rows = [
      row({ id: "a", email: "nour@example.com", userId: "u1" }),
      row({ id: "b", email: "hala@example.com", source: "footer" }),
    ];
    expect(filterCustomerEmails(rows, "HALA").map((item) => item.id)).toEqual(["b"]);
    expect(filterCustomerEmails(rows, "footer").map((item) => item.id)).toEqual(["b"]);
    expect(filterCustomerEmails(rows, "account").map((item) => item.id)).toEqual(["a"]);
    expect(filterCustomerEmails(rows, "   ")).toHaveLength(2);
  });

  it("counts marketing consent and linked accounts", () => {
    const rows = [
      row({ id: "a", marketingOptIn: true, userId: "u1" }),
      row({ id: "b", marketingOptIn: false }),
      row({ id: "c", marketingOptIn: true }),
    ];
    expect(customerEmailStats(rows)).toEqual({ total: 3, marketing: 2, linked: 1 });
  });

  it("labels known sources in both languages", () => {
    expect(customerEmailSourceLabel("signin_modal", "en")).toBe("Sign-in modal");
    expect(customerEmailSourceLabel("signin_modal", "ar")).toBe("نافذة تسجيل الدخول");
    expect(customerEmailSourceLabel("imported_csv", "en")).toBe("imported_csv");
  });

  it("formats the last-seen date and survives a broken value", () => {
    expect(customerEmailSeenLabel("2026-11-01T09:00:00.000Z", "en")).toBe("01 Nov 2026");
    expect(customerEmailSeenLabel("not-a-date", "en")).toBe("");
  });
});
