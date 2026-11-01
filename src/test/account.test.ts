import { describe, expect, it } from "vitest";

import {
  accountStatus,
  authErrorKey,
  authErrorMessage,
  displayNameFor,
  filterProfiles,
  groupByJoinMonth,
  initialsFor,
  joinDateLabel,
  joinMonthLabel,
  profileFromRecord,
  profilesFromRecords,
  validateAuthForm,
  type CustomerProfile,
} from "@/lib/account";

const profile = (patch: Partial<CustomerProfile> = {}): CustomerProfile => ({
  id: "8f14",
  email: "nour@example.com",
  fullName: "Nour Salem",
  role: "customer",
  marketingOptIn: false,
  createdAt: "2026-10-30T10:00:00.000Z",
  confirmedAt: "2026-10-30T10:05:00.000Z",
  lastSeenAt: null,
  ...patch,
});

describe("profileFromRecord", () => {
  it("maps a complete profiles row", () => {
    expect(
      profileFromRecord({
        id: "8f14",
        email: "nour@example.com",
        full_name: "  Nour Salem ",
        role: "customer",
        marketing_opt_in: true,
        created_at: "2026-10-30T10:00:00.000Z",
        email_confirmed_at: "2026-10-30T10:05:00.000Z",
        last_sign_in_at: "2026-10-31T08:00:00.000Z",
      }),
    ).toEqual({
      id: "8f14",
      email: "nour@example.com",
      fullName: "Nour Salem",
      role: "customer",
      marketingOptIn: true,
      createdAt: "2026-10-30T10:00:00.000Z",
      confirmedAt: "2026-10-30T10:05:00.000Z",
      lastSeenAt: "2026-10-31T08:00:00.000Z",
    });
  });

  it("rejects a row that cannot identify anyone", () => {
    expect(profileFromRecord(null)).toBeNull();
    expect(profileFromRecord({ email: "a@b.co", created_at: "2026-10-30T10:00:00.000Z" })).toBeNull();
    expect(profileFromRecord({ id: "x", created_at: "2026-10-30T10:00:00.000Z" })).toBeNull();
    expect(profileFromRecord({ id: "x", email: "a@b.co" })).toBeNull();
  });

  it("folds an unknown role to customer, never to staff", () => {
    expect(
      profileFromRecord({
        id: "x",
        email: "a@b.co",
        role: "owner",
        created_at: "2026-10-30T10:00:00.000Z",
      })?.role,
    ).toBe("customer");
  });

  it("drops unusable rows when reading a list", () => {
    const rows = profilesFromRecords([
      { id: "a", email: "a@b.co", created_at: "2026-10-30T10:00:00.000Z" },
      { id: "b" },
      "nonsense",
    ]);
    expect(rows).toHaveLength(1);
    expect(profilesFromRecords(undefined)).toEqual([]);
  });
});

describe("identity", () => {
  it("takes the first two initials of a name", () => {
    expect(initialsFor({ fullName: "Nour Salem" })).toBe("NS");
    expect(initialsFor({ fullName: "Nour" })).toBe("N");
    expect(initialsFor({ fullName: "  نور سالم " })).toBe("نس");
  });

  it("falls back to the email local part", () => {
    expect(initialsFor({ email: "nour.salem@example.com" })).toBe("NO");
    expect(initialsFor({})).toBe("RO");
  });

  it("prefers the full name, then the email", () => {
    expect(displayNameFor(profile())).toBe("Nour Salem");
    expect(displayNameFor(profile({ fullName: "" }))).toBe("nour@example.com");
    expect(displayNameFor(null, "guest@example.com")).toBe("guest@example.com");
  });
});

describe("accountStatus", () => {
  it("reads the role first, then confirmation", () => {
    expect(accountStatus(profile())).toBe("active");
    expect(accountStatus(profile({ confirmedAt: null }))).toBe("unconfirmed");
    expect(accountStatus(profile({ role: "staff" }))).toBe("staff");
    expect(accountStatus(profile({ role: "admin" }))).toBe("admin");
  });
});

describe("validateAuthForm", () => {
  it("requires an email and a password of 8 characters", () => {
    expect(validateAuthForm("signin", { email: "", password: "" })).toEqual({
      email: "emailRequired",
      password: "passwordShort",
    });
    expect(validateAuthForm("signin", { email: "nope", password: "12345678" })).toEqual({
      email: "emailInvalid",
    });
  });

  it("does not ask for a name when signing in", () => {
    expect(
      validateAuthForm("signin", { email: "nour@example.com", password: "12345678" }),
    ).toEqual({});
  });

  it("requires a name and a matching confirmation when registering", () => {
    expect(
      validateAuthForm("register", {
        fullName: " ",
        email: "nour@example.com",
        password: "12345678",
        confirmPassword: "1234567",
      }),
    ).toEqual({ fullName: "nameRequired", confirmPassword: "passwordMismatch" });
  });

  it("passes a complete registration", () => {
    expect(
      validateAuthForm("register", {
        fullName: "Nour Salem",
        email: "nour@example.com",
        password: "12345678",
        confirmPassword: "12345678",
      }),
    ).toEqual({});
  });
});

describe("auth errors", () => {
  it("recognises the failures a customer can act on", () => {
    expect(authErrorKey({ code: "invalid_credentials" })).toBe("invalidCredentials");
    expect(authErrorKey({ code: "email_not_confirmed" })).toBe("emailNotConfirmed");
    expect(authErrorKey({ code: "user_already_exists" })).toBe("alreadyExists");
    expect(authErrorKey({ code: "weak_password" })).toBe("weakPassword");
    expect(authErrorKey({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
  });

  it("falls back to the raw Supabase message", () => {
    expect(authErrorKey({ code: "unexpected_failure" })).toBeNull();
    expect(authErrorMessage({ message: "Database error saving new user" })).toBe(
      "Database error saving new user",
    );
  });

  it("words known failures in both languages", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(
      "That email and password do not match an account.",
    );
    expect(authErrorMessage({ code: "email_not_confirmed" }, "ar")).toBe(
      "أكّد بريدك الإلكتروني قبل تسجيل الدخول.",
    );
  });
});

describe("register dates", () => {
  it("labels a month and a day", () => {
    expect(joinMonthLabel("2026-10-30T10:00:00.000Z", "en")).toBe("October 2026");
    expect(joinDateLabel("2026-10-30T10:00:00.000Z", "en")).toBe("30 Oct 2026");
    expect(joinMonthLabel("not-a-date", "en")).toBe("");
  });

  it("groups by join month, newest month first and newest row first", () => {
    const groups = groupByJoinMonth(
      [
        profile({ id: "old", createdAt: "2026-08-02T10:00:00.000Z" }),
        profile({ id: "new", createdAt: "2026-10-01T10:00:00.000Z" }),
        profile({ id: "newer", createdAt: "2026-10-20T10:00:00.000Z" }),
        profile({ id: "broken", createdAt: "not-a-date" }),
      ],
      "en",
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-10", "2026-08", "unknown"]);
    expect(groups[0]?.label).toBe("October 2026");
    expect(groups[0]?.profiles.map((row) => row.id)).toEqual(["newer", "new"]);
    expect(groups[2]?.label).toBe("");
  });
});

describe("filterProfiles", () => {
  const rows = [
    profile({ id: "c1", email: "nour@example.com", fullName: "Nour Salem" }),
    profile({ id: "c2", email: "hala@example.com", fullName: "Hala Fathy", confirmedAt: null }),
    profile({ id: "t1", email: "roelix.support@gmail.com", role: "admin", fullName: "ROELIX" }),
  ];

  it("splits customers from the team", () => {
    expect(filterProfiles(rows, "customers", "").map((row) => row.id)).toEqual(["c1", "c2"]);
    expect(filterProfiles(rows, "team", "").map((row) => row.id)).toEqual(["t1"]);
    expect(filterProfiles(rows, "all", "")).toHaveLength(3);
  });

  it("searches email and name, case-insensitively", () => {
    expect(filterProfiles(rows, "all", "HALA").map((row) => row.id)).toEqual(["c2"]);
    expect(filterProfiles(rows, "all", "salem").map((row) => row.id)).toEqual(["c1"]);
    expect(filterProfiles(rows, "all", "   ")).toHaveLength(3);
  });
});
