// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import apiClient from "../../api/client";
import { RoleAccessMatrixPage } from "./RoleAccessMatrixPage";

// eslint-disable-next-line react/prop-types
vi.mock("../../components/PortalShell", () => ({ PortalShell: ({ children }) => <div>{children}</div> }));
vi.mock("../../api/client", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("changing Co-Partner permissions does not change Super Admin", async () => {
  const primary = { id: 6, role_label: "Super Admin", access_item: "POSH Compliance", is_allowed: false };
  const record = { id: 7, role_label: "Co-Partner", access_item: "POSH Compliance", is_allowed: false };
  apiClient.get.mockImplementation(async () => ({ data: { role_access: [primary, record] } }));
  apiClient.put.mockImplementation(async (_url, data) => { record.is_allowed = data.is_allowed; return { data: record }; });
  render(<RoleAccessMatrixPage />);
  const partner = await screen.findByRole("checkbox", { name: "Co-Partner: POSH Compliance" });
  expect(partner.checked).toBe(false);
  fireEvent.click(partner);
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith("/admin-config/role-access/7", expect.objectContaining({ role_label: "Co-Partner", is_allowed: true })));
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Co-Partner: POSH Compliance" }).checked).toBe(true));
  expect(screen.getByRole("checkbox", { name: "Super Admin: POSH Compliance" }).checked).toBe(false);
  expect(screen.getByRole("checkbox", { name: "Co-Partner: POSH Compliance" }).checked).toBe(true);
});

test("includes configured access items beyond the default page list", async () => {
  apiClient.get.mockResolvedValue({ data: { role_access: [{ id: 9, role_label: "Admin", access_item: "Additional Report", is_allowed: true }] } });
  render(<RoleAccessMatrixPage />);
  expect((await screen.findByRole("checkbox", { name: "Admin: Additional Report" })).checked).toBe(true);
  for (const role of ["Super Admin", "Co-Partner", "Admin", "Client Admin (Mgmt)", "IC", "Employee"]) {
    expect(screen.getByRole("columnheader", { name: role, exact: true })).toBeTruthy();
  }
});
