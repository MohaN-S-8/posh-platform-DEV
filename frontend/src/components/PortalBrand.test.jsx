// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LoadingOverlay } from "./LoadingOverlay";
import { useBrandingStore } from "../store/brandingStore";

afterEach(cleanup);
test("loading screen name and boxed initial follow branding changes", () => {
  useBrandingStore.setState({ portalName: "Alpha Portal" });
  render(<LoadingOverlay show />);
  expect(screen.getByRole("img", { name: "Alpha Portal" })).toBeTruthy();
  expect(document.querySelectorAll(".loading-brand-letter")).toHaveLength(11);
  expect(new Set(Array.from(document.querySelectorAll(".loading-brand-letter"), (node) => node.style.backgroundColor)).size).toBeGreaterThan(1);
  act(() => useBrandingStore.setState({ portalName: "Beta Services" }));
  expect(screen.getByRole("img", { name: "Beta Services" })).toBeTruthy();
  expect(document.querySelector(".loading-brand-letter").textContent).toBe("B");
});
