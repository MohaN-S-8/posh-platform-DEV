// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BranchMasterTab } from "./BranchMasterTab";
import apiClient from "../../api/client";

vi.mock("../../api/client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(cleanup);
const companies = [
  { company_id: 2, company_name: "Alpha", branches: [], employees: [{ employee_id: "A1", name: "Alpha Member" }], presiding_officers: [{ name: "Alpha Officer" }] },
  { company_id: 3, company_name: "Beta", branches: [], employees: [{ employee_id: "B1", name: "Beta Member" }], presiding_officers: [{ name: "Beta Officer" }] },
];

test("changing company resets IC selections and updates the automatic officer", async () => {
  apiClient.get.mockImplementation((url) => Promise.resolve({ data: url === "/admin-config/branches" ? companies : [] }));
  render(<BranchMasterTab readOnly={false} />);
  await screen.findByRole("option", { name: "Alpha" });
  const company = screen.getByLabelText("Company Name *");
  fireEvent.change(company, { target: { value: "2" } });
  expect(screen.getByLabelText("Presiding Officer (auto)").value).toBe("Alpha Officer");
  const member = screen.getByLabelText("IC Member 1 - Employee ID");
  fireEvent.mouseDown(member);
  fireEvent.click(await screen.findByRole("option", { name: "A1 - Alpha Member" }));
  expect(screen.getAllByLabelText("Employee Name")[0].value).toBe("Alpha Member");
  fireEvent.change(company, { target: { value: "3" } });
  expect(screen.getByLabelText("Presiding Officer (auto)").value).toBe("Beta Officer");
  expect(screen.getAllByLabelText("Employee Name")[0].value).toBe("");
  fireEvent.mouseDown(member);
  expect(await screen.findByRole("option", { name: "B1 - Beta Member" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "A1 - Alpha Member" })).toBeNull();
});

test("read-only Masters users see saved branches without modification controls", async () => {
  apiClient.get.mockResolvedValue({ data: [{ ...companies[0], branches: [{ branch_name: "Head Office", branch_id: "BR1" }] }] });
  render(<BranchMasterTab readOnly />);
  expect(await screen.findByText("Head Office")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save Branch" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
});
