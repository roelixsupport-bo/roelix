import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReviewsPanel } from "@/components/admin/reviews-panel";
import { fetchAllReviews, fetchProductReviews, submitProductReview } from "@/lib/reviews";

const LOCAL_KEY = "roelix_reviews";

function storedStatus(id: string): string | undefined {
  const rows = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Array<{
    id: string;
    status: string;
  }>;
  return rows.find((row) => row.id === id)?.status;
}

function renderPanel() {
  return render(
    <ReviewsPanel isArabic={false} productName={() => "Cloud Hotel Microfiber Pillow"} />,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("admin review moderation", () => {
  it("queues a new storefront review and publishes it on approval", async () => {
    const submitted = await submitProductReview({
      productId: "cloud-pillow",
      authorName: "Hana",
      rating: 5,
      body: "Perfect loft for side sleepers.",
    });

    // Nothing is public while it waits.
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(0);

    renderPanel();

    const approve = await screen.findByRole("button", {
      name: "Approve and publish this review",
    });
    expect(screen.getAllByText("Awaiting approval").length).toBeGreaterThan(0);

    fireEvent.click(approve);

    await waitFor(() => expect(storedStatus(submitted.id)).toBe("published"), { timeout: 15000 });
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(1);
  }, 25000);

  it("deletes a review for good", async () => {
    await submitProductReview({
      productId: "cloud-pillow",
      authorName: "Hana",
      rating: 4,
      body: "Holds its shape after a wash.",
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Delete review" }));

    await waitFor(async () => expect(await fetchAllReviews()).toHaveLength(0), { timeout: 15000 });
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(0);
  }, 25000);

  it("separates pending from published rows in the statistics", async () => {
    await submitProductReview({
      productId: "cloud-pillow",
      authorName: "Hana",
      rating: 5,
      body: "Perfect loft for side sleepers.",
    });

    renderPanel();

    // The queue opens on pending, so the review is visible without switching tabs.
    expect(await screen.findByText("Perfect loft for side sleepers.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve and publish this review" })).toBeEnabled();
  });
});
