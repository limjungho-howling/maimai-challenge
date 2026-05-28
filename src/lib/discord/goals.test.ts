import { describe, expect, it } from "vitest";

import { pickRandomItems } from "@/lib/discord/goals";

describe("Discord rank goals", () => {
  it("picks up to the requested number of random items", () => {
    const picked = pickRandomItems(["a", "b", "c", "d"], 3, () => 0);

    expect(picked).toEqual(["a", "b", "c"]);
  });
});
