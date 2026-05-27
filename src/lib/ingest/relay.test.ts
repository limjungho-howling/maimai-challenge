import { describe, expect, it } from "vitest";

import { isAllowedRelayOrigin } from "@/lib/ingest/relay";

describe("relay origin guard", () => {
  it("allows only the official maimaiDX International origin", () => {
    expect(isAllowedRelayOrigin("https://maimaidx-eng.com")).toBe(true);
    expect(isAllowedRelayOrigin("https://maimaidx-eng.com.evil.example")).toBe(
      false,
    );
    expect(isAllowedRelayOrigin("http://maimaidx-eng.com")).toBe(false);
  });
});
