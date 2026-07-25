import { describe, expect, it } from "vitest";
import { requiresDecimalCarry } from "./operations";

describe("requiresDecimalCarry", () => {
  it("detects carrying in the ones column", () => {
    expect(requiresDecimalCarry([8, 7])).toBe(true);
    expect(requiresDecimalCarry([18, 17, 15])).toBe(true);
  });

  it("detects carrying in a later column", () => {
    expect(requiresDecimalCarry([60, 50])).toBe(true);
  });

  it("rejects sums that do not require carrying", () => {
    expect(requiresDecimalCarry([12, 23])).toBe(false);
    expect(requiresDecimalCarry([7])).toBe(false);
  });
});
