// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import apiClient from "../api/client";
import { PortalNameSettings } from "./PortalNameSettings";
import { useBrandingStore } from "../store/brandingStore";

vi.mock("../api/client", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock("../store/authStore", () => ({ useAuthStore: (selector) => selector({ user: { user_id: 1 } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("saves the name and updates shared branding", async () => {
  apiClient.get.mockResolvedValue({ data: { can_edit: true } });
  apiClient.put.mockResolvedValue({ data: { portal_name: "New Name" } });
  render(<PortalNameSettings />);
  fireEvent.change(await screen.findByLabelText("Portal / Default Company Name"), { target: { value: "New Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Name" }));
  await screen.findByText("Portal and default company name updated.");
  expect(useBrandingStore.getState().portalName).toBe("New Name");
  expect(document.title).toBe("New Name");
});

test("hides the setting from non-primary accounts", async () => {
  apiClient.get.mockResolvedValue({ data: { can_edit: false } });
  render(<PortalNameSettings />);
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/branding/access"));
  expect(screen.queryByRole("button", { name: "Save Name" })).toBeNull();
});
