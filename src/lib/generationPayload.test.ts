import { describe, expect, it } from "vitest";
import { normalizeGenerationPayload } from "./generationPayload";

describe("generation payload", () => {
  it("always uses the mountain name for the hiking notice place", () => {
    const payload = normalizeGenerationPayload({
      mode: "submission",
      project: {
        mountainName: " 燕岳 ",
        noticePlace: "長野県安曇野市 燕岳",
      },
    });

    expect(payload).toEqual({
      mode: "submission",
      project: {
        mountainName: " 燕岳 ",
        noticePlace: "燕岳",
      },
    });
  });

  it("leaves unrelated payloads unchanged", () => {
    const payload = { mode: "submission" };
    expect(normalizeGenerationPayload(payload)).toBe(payload);
  });
});
