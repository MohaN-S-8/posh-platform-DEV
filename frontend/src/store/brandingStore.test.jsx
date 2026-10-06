// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import apiClient from "../api/client";

vi.mock("../api/client", () => ({ default: { get: vi.fn(), put: vi.fn() } }));

let useBrandingStore;
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  document.title = "Portal";
  ({ useBrandingStore } = await import("./brandingStore"));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test.each([undefined, null, {}, "<html>SPA fallback</html>", { portal_name: null }, { portal_name: 42 }, { portal_name: "   " }])(
  "invalid branding response preserves the last valid name: %j", async (data) => {
    useBrandingStore.setState({ portalName: "Known Portal" });
    apiClient.get.mockResolvedValue({ data });
    await useBrandingStore.getState().load();
    expect(useBrandingStore.getState().portalName).toBe("Known Portal");
    expect(localStorage.getItem("portal-name")).toBeNull();
    expect(document.title).toBe("Portal");
  },
);

test.each(["undefined", "null", "   "])("invalid cached name uses the default: %s", async (cached) => {
  localStorage.setItem("portal-name", cached);
  vi.resetModules();
  const { useBrandingStore: store } = await import("./brandingStore");
  expect(store.getState().portalName).toBe("Portal");
});

test("valid branding updates the name, cache and document title", async () => {
  apiClient.get.mockResolvedValue({ data: { portal_name: "  New Portal  " } });
  await useBrandingStore.getState().load();
  expect(useBrandingStore.getState().portalName).toBe("New Portal");
  expect(localStorage.getItem("portal-name")).toBe("New Portal");
  expect(document.title).toBe("New Portal");
});

test("invalid save response reports an error without corrupting branding", async () => {
  apiClient.put.mockResolvedValue({ data: {} });
  await expect(useBrandingStore.getState().save("New Portal")).rejects.toThrow("invalid portal name");
  expect(useBrandingStore.getState().portalName).toBe("Portal");
});

test("brand remains renderable when the branding endpoint returns HTML", async () => {
  apiClient.get.mockResolvedValue({ data: "<!doctype html>" });
  const { PortalBrand } = await import("../components/PortalBrand");
  await useBrandingStore.getState().load();
  render(<PortalBrand />);
  expect(screen.getByText("Portal")).toBeTruthy();
});
