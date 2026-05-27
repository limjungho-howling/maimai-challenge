import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookmarkletButton } from "@/components/bookmarklet-button";

describe("BookmarkletButton", () => {
  it("sets the javascript bookmarklet href after render to avoid React blocking it", async () => {
    render(<BookmarkletButton appOrigin="https://example.com" />);

    const link = screen.getByRole("link", { name: /maimai 갱신/i });
    await waitFor(() => {
      expect(link).toHaveAttribute("href", expect.stringMatching(/^javascript:/));
    });
    expect(link.getAttribute("href")).not.toContain("React has blocked");
    expect(link.getAttribute("href")).toContain("bookmarklet.js");
  });
});
