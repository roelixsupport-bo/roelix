import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { VariantPicker, variantOptionClassName } from "@/components/product/variant-picker";
import type { ProductVariant, VariantSelection } from "@/lib/product-variants";

afterEach(cleanup);

const pillow = (id: string, sizeName: string, dimension: string, stock = 4): ProductVariant => ({
  id,
  sku: id.toUpperCase(),
  sizeName,
  dimension,
  price: 100,
  compareAtPrice: null,
  stock,
});

/**
 * Standard is sold in both dimensions, King only in 50 × 70 cm (and is sold out).
 * That asymmetry is what used to make the picker rewrite the other axis.
 */
const matrix: ProductVariant[] = [
  pillow("std-5070", "Standard", "50 × 70 cm", 12),
  pillow("std-7070", "Standard", "70 × 70 cm", 8),
  pillow("med-5070", "Medium", "50 × 70 cm", 3),
  pillow("king-5070", "King", "50 × 70 cm", 0),
];

function Harness({ initial }: { initial: VariantSelection }) {
  const [selection, setSelection] = useState<VariantSelection>(initial);
  return (
    <>
      <VariantPicker
        variants={matrix}
        selection={selection}
        onSelect={setSelection}
        isArabic={false}
      />
      <output data-testid="picked">{`${selection.sizeName}|${selection.dimension}`}</output>
    </>
  );
}

describe("variant picker independence", () => {
  it("keeps the chosen dimension when a size is clicked", () => {
    render(<Harness initial={{ sizeName: "Standard", dimension: "70 × 70 cm" }} />);

    // Medium is the size that still has stock, so it is the one that can be picked.
    fireEvent.click(screen.getByRole("button", { name: /^Medium/ }));

    expect(screen.getByTestId("picked").textContent).toBe("Medium|70 × 70 cm");
  });

  it("keeps the chosen size when a dimension is clicked", () => {
    render(<Harness initial={{ sizeName: "King", dimension: "50 × 70 cm" }} />);

    fireEvent.click(screen.getByRole("button", { name: "70 × 70 cm" }));

    expect(screen.getByTestId("picked").textContent).toBe("King|70 × 70 cm");
  });

  it("does not disable a dimension because of the size already chosen", () => {
    render(<Harness initial={{ sizeName: "King", dimension: "50 × 70 cm" }} />);

    // King is not made in 70 × 70 cm, yet the option stays clickable: the shopper
    // is allowed to build a pair the catalogue does not sell and be told about it.
    expect(screen.getByRole("button", { name: "70 × 70 cm" })).toBeEnabled();
  });

  it("marks the two axes independently", () => {
    render(<Harness initial={{ sizeName: "Standard", dimension: "50 × 70 cm" }} />);

    expect(screen.getByRole("button", { name: "Standard" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^King/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "50 × 70 cm" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "70 × 70 cm" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("disables an option whose own stock is zero and labels it", () => {
    render(<Harness initial={{ sizeName: "Standard", dimension: "50 × 70 cm" }} />);

    const king = screen.getByRole("button", { name: /^King/ });
    expect(king).toBeDisabled();
    expect(king.textContent).toContain("Out of stock");

    const standard = screen.getByRole("button", { name: "Standard" });
    expect(standard).toBeEnabled();
    expect(standard.textContent).not.toContain("Out of stock");
  });

  it("ignores a click on a sold-out option", () => {
    render(<Harness initial={{ sizeName: "Standard", dimension: "50 × 70 cm" }} />);

    fireEvent.click(screen.getByRole("button", { name: /^King/ }));

    expect(screen.getByTestId("picked").textContent).toBe("Standard|50 × 70 cm");
  });

  it("advertises the remaining count once stock runs low", () => {
    const scarce: ProductVariant[] = [
      pillow("std-5070", "Standard", "50 × 70 cm", 2),
      pillow("std-7070", "Standard", "70 × 70 cm", 40),
    ];
    render(
      <VariantPicker
        variants={scarce}
        selection={{ sizeName: "Standard", dimension: "50 × 70 cm" }}
        onSelect={() => {}}
        isArabic={false}
      />,
    );

    expect(screen.getByRole("button", { name: /^50 × 70 cm/ }).textContent).toContain("2 left");
    // 42 units in that size, so the size button stays quiet.
    expect(screen.getByRole("button", { name: "Standard" }).textContent).not.toContain("left");
  });
});

describe("variant option styling", () => {
  it("keeps a gold hover edge for options that can be bought", () => {
    const idle = variantOptionClassName(false, true);
    expect(idle).toContain("hover:border-gold");
    expect(idle).toContain("focus-visible:ring-gold");
    expect(idle).toContain("motion-safe:hover:-translate-y-px");
  });

  it("fills the selected option with the navy surface", () => {
    expect(variantOptionClassName(true, true)).toContain("bg-navy");
  });

  it("stops the hover lift for visitors who ask for reduced motion", () => {
    expect(variantOptionClassName(false, true)).toContain("motion-safe:");
  });
});
