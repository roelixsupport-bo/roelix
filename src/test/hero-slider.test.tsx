import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeroSlider } from "@/components/site/hero-slider";

describe("hero image slider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fades to the next image every four and a half seconds", async () => {
    const { container } = render(<HeroSlider />);
    const [firstSlide, secondSlide] = container.querySelectorAll(".hero-slide");
    expect(firstSlide).toHaveAttribute("aria-hidden", "false");
    expect(secondSlide).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      vi.advanceTimersByTime(4_500);
    });

    expect(firstSlide).toHaveAttribute("aria-hidden", "true");
    expect(secondSlide).toHaveAttribute("aria-hidden", "false");
  });

  it("lets visitors select a slide directly", () => {
    render(<HeroSlider />);

    const thirdSlideButton = screen.getByRole("button", {
      name: "Show image 3: A plush pillow crafted for a restful night's sleep",
    });
    fireEvent.click(thirdSlideButton);

    expect(thirdSlideButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "A plush pillow crafted for a restful night's sleep" }))
      .toHaveAttribute("aria-hidden", "false");
  });
});
