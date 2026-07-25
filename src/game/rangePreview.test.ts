import { describe, expect, it } from "vitest";
import { rangePreviewCenter } from "./rangePreview";

describe("range preview", () => {
  it("skips targets that are already readable from the launcher view", () => {
    expect(rangePreviewCenter([900], 1280, 1800)).toBeUndefined();
  });

  it("centres an off-screen target", () => {
    expect(rangePreviewCenter([1524], 1280, 2284)).toBe(1524);
  });

  it("frames the midpoint when a future round exposes multiple targets", () => {
    expect(rangePreviewCenter([1400, 1784], 1280, 2544)).toBe(1592);
  });

  it("clamps the preview to the camera's world bounds", () => {
    expect(rangePreviewCenter([2300], 1280, 2500)).toBe(1860);
  });
});
