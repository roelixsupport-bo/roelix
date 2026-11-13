import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

describe("shared button styles", () => {
  it("uses the modern rounded hover and pressed states for primary actions", () => {
    const classes = buttonVariants();

    expect(classes).toContain("rounded-xl");
    expect(classes).toContain("transition-all");
    expect(classes).toContain("hover:-translate-y-0.5");
    expect(classes).toContain("hover:shadow-md");
    expect(classes).toContain("active:scale-95");
  });

  it("keeps icon buttons circular", () => {
    expect(buttonVariants({ size: "icon" })).toContain("rounded-full");
  });
});
