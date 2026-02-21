import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the component
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) => {
        return ({ children, ...props }: any) => {
          const {
            initial,
            animate,
            exit,
            transition,
            whileHover,
            whileTap,
            variants,
            layout,
            layoutId,
            ...htmlProps
          } = props;
          const Tag = typeof tag === "string" ? tag : "div";
          return <Tag {...htmlProps}>{children}</Tag>;
        };
      },
    },
  ),
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({ start: vi.fn() }),
  useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
}));

import PrivacyScore from "@/components/PrivacyScore";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrivacyScore", () => {
  it("renders full score = 100 with Excellent label", () => {
    render(
      <PrivacyScore anonSet={20} batches={10} btcLinked={5} commitments={20} />,
    );

    // Score value
    expect(screen.getByText("100")).toBeInTheDocument();

    // Label
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("renders mid-range score correctly", () => {
    // anonPts  = min(10/20, 1) * 40 = 0.5 * 40 = 20
    // batchPts = min(5/10, 1) * 20  = 0.5 * 20 = 10
    // btcPts   = min(2/5, 1) * 15   = 0.4 * 15 = 6
    // usagePts = min(5/20, 1) * 15 + 10 = 0.25*15 + 10 = 3.75 + 10 = 13.75
    // rawTotal = 20 + 10 + 6 + 13.75 = 49.75
    // total    = min(round(49.75), 100) = 50
    render(
      <PrivacyScore anonSet={10} batches={5} btcLinked={2} commitments={5} />,
    );

    expect(screen.getByText("50")).toBeInTheDocument();

    // 50 >= 30 && 50 < 60 => "Moderate"
    expect(screen.getByText("Moderate")).toBeInTheDocument();
  });

  it("renders zero state with score 0 and Building label", () => {
    const { container } = render(
      <PrivacyScore anonSet={0} batches={0} btcLinked={0} commitments={0} />,
    );

    // The main score is inside the span with font-bold class (the large center number)
    const scoreSpan = container.querySelector(
      "span.text-xl",
    );
    expect(scoreSpan).not.toBeNull();
    expect(scoreSpan!.textContent).toBe("0");

    expect(screen.getByText("Building")).toBeInTheDocument();
  });

  it("renders all 4 breakdown items", () => {
    render(
      <PrivacyScore anonSet={5} batches={3} btcLinked={1} commitments={2} />,
    );

    expect(screen.getByText("Anonymity")).toBeInTheDocument();
    expect(screen.getByText("Batches")).toBeInTheDocument();
    expect(screen.getByText("BTC Link")).toBeInTheDocument();
    expect(screen.getByText("Usage")).toBeInTheDocument();
  });

  it("renders the Privacy Score heading", () => {
    render(
      <PrivacyScore anonSet={0} batches={0} btcLinked={0} commitments={0} />,
    );

    expect(screen.getByText("Privacy Score")).toBeInTheDocument();
  });

  it("clamps the score to 100 even with extremely large inputs", () => {
    render(
      <PrivacyScore anonSet={1000} batches={1000} btcLinked={1000} commitments={1000} />,
    );

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });
});
