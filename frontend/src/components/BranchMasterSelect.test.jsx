// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import apiClient from "../api/client";
import { branchFields } from "../utils/branchFields";
import { BranchMasterSelect } from "./BranchMasterSelect";

vi.mock("../api/client", () => ({ default: { get: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const branch = { branch_id: "BR01", branch_name: "Head Office", city: "Chennai", state: "TN", country: "IN", address1: "10 Office Street" };

describe("Branch Master user selection", () => {
  it("loads company branches and returns their autofill details", async () => {
    apiClient.get.mockResolvedValue({ data: [branch] });
    const onChange = vi.fn();
    render(<BranchMasterSelect companyId={2} onChange={onChange} />);
    await screen.findByRole("option", { name: "Head Office (BR01)" });
    expect(apiClient.get).toHaveBeenCalledWith("/users/company/2/branches");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "BR01" } });
    expect(onChange).toHaveBeenCalledWith(branch);
    expect(branchFields(branch)).toEqual({ branch_id: "BR01", branch_name: "Head Office", location_city: "Chennai" });
    expect(branchFields(branch, { userForm: true }).transfer_location).toBe("Chennai");
    expect(branchFields(branch, { transfer: true })).toEqual({ transfer_branch_id: "BR01", transfer_branch_name: "Head Office", transfer_location: "Chennai" });
  });

  it("shows the selected workplace address and preserves legacy values", async () => {
    apiClient.get.mockResolvedValue({ data: [branch] });
    const { rerender } = render(<BranchMasterSelect companyId={2} branchId="BR01" branchName="Head Office" onChange={vi.fn()} />);
    await screen.findByText("10 Office Street, Chennai, TN, IN");
    rerender(<BranchMasterSelect companyId={2} branchId="OLD" branchName="Old Branch" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox").value).toBe("OLD");
  });

  it("does not show branches from the previous company or a late response", async () => {
    let resolveOld;
    apiClient.get.mockImplementation((url) => url.includes("/2/")
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ data: [{ branch_id: "BR03", branch_name: "Other Office" }] }));
    const { rerender } = render(<BranchMasterSelect companyId={2} onChange={vi.fn()} />);
    rerender(<BranchMasterSelect companyId={3} onChange={vi.fn()} />);
    await screen.findByRole("option", { name: "Other Office (BR03)" });
    resolveOld({ data: [branch] });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Head Office (BR01)" })).toBeNull());
  });

  it("shows load failures and keeps required validation active", async () => {
    apiClient.get.mockRejectedValue(new Error("Network unavailable"));
    render(<BranchMasterSelect companyId={2} required onChange={vi.fn()} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox").checkValidity()).toBe(false);
  });
});
