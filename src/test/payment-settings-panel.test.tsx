import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentSettingsPanel } from "@/components/admin/payment-settings-panel";
import { fetchPaymentSettings, updatePaymentSetting } from "@/lib/manual-payments";

vi.mock("@/lib/manual-payments", () => ({
  fetchPaymentSettings: vi.fn(),
  updatePaymentSetting: vi.fn().mockResolvedValue(undefined),
}));

describe("payment settings admin panel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves account details and activates the method in Supabase", async () => {
    vi.mocked(fetchPaymentSettings).mockResolvedValue([
      {
        id: 1,
        method_key: "vodafone_cash",
        method_name: "فودافون كاش",
        account_info: "",
        is_active: false,
        icon_url: null,
      },
    ]);

    render(<PaymentSettingsPanel isArabic />);

    const accountInput = await screen.findByRole("textbox", {
      name: "رقم المحفظة / عنوان IPA",
    });
    fireEvent.change(accountInput, { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيانات" }));

    await waitFor(() =>
      expect(updatePaymentSetting).toHaveBeenCalledWith(1, { account_info: "01012345678" }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "تفعيل طريقة الدفع" }));
    await waitFor(() =>
      expect(updatePaymentSetting).toHaveBeenLastCalledWith(1, {
        account_info: "01012345678",
        is_active: true,
      }),
    );
    expect(screen.getByRole("switch", { name: "إيقاف طريقة الدفع" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
