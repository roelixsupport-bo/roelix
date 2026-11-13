import { afterEach, describe, expect, it, vi } from "vitest";

const { from, storageFrom, upload } = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from,
    storage: { from: storageFrom },
  },
}));

import { fetchActivePaymentSettings, uploadPaymentReceipt } from "@/lib/manual-payments";

describe("manual payment data access", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only fetches active payment settings from Supabase", async () => {
    const rows = [
      {
        id: 2,
        method_key: "instapay",
        method_name: "إنستاباي",
        account_info: "roelix@instapay",
        is_active: true,
        icon_url: null,
      },
    ];
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    from.mockReturnValue(query);

    await expect(fetchActivePaymentSettings()).resolves.toEqual(rows);

    expect(from).toHaveBeenCalledWith("payment_settings");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("uploads validated receipts to the private payment receipt bucket", async () => {
    upload.mockResolvedValue({ error: null });
    storageFrom.mockReturnValue({ upload });
    const file = new File(["receipt"], "receipt.png", { type: "image/png" });

    const path = await uploadPaymentReceipt(file);

    expect(storageFrom).toHaveBeenCalledWith("payment-receipts");
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/i);
    expect(upload).toHaveBeenCalledWith(
      path,
      file,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
  });
});
