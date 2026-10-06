// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import apiClient from "../../api/client";
import { ConstitutionPanel } from "./ConstitutionPanel";

const auth = vi.hoisted(() => ({ role_id: 5 }));
vi.mock("../../store/authStore", () => ({ useAuthStore: () => ({ user: auth }) }));
vi.mock("../../api/client", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
beforeEach(() => {
  auth.role_id = 5;
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith("/companies") ? [{ company_id: 2, company_name: "Acme" }] : { members: [{ id: 1, name: "Advisor", email: "advisor@example.com", designation: "External" }], letters: [] } }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("loads both sections for the selected company", async () => {
  render(<ConstitutionPanel />);
  await screen.findByText("IC Constitution Status");
  expect(screen.getByText("External Member Status")).toBeTruthy();
  expect(await screen.findByRole("option", { name: "Advisor (advisor@example.com)" })).toBeTruthy();
  expect(apiClient.get).toHaveBeenCalledWith("/hr/compliance/companies/2/constitution");
});

test("shows all required member validation next to submit", async () => {
  render(<ConstitutionPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Save External Member" }));
  expect(await screen.findByText("Please correct the following before submitting:")).toBeTruthy();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test("saves an external member through the company endpoint", async () => {
  apiClient.post.mockResolvedValue({ data: {} });
  render(<ConstitutionPanel />);
  fireEvent.change(await screen.findByLabelText("Name *"), { target: { value: "New Advisor" } });
  fireEvent.change(screen.getByLabelText("Designation *"), { target: { value: "Consultant" } });
  fireEvent.change(screen.getByLabelText("Email ID *"), { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save External Member" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/hr/compliance/companies/2/members", expect.objectContaining({ name: "New Advisor" })));
});

test("IC has a read-only view", async () => {
  auth.role_id = 3;
  render(<ConstitutionPanel />);
  await screen.findByText("IC Constitution Status");
  expect(screen.queryByRole("button", { name: "Submit for Approval" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save External Member" })).toBeNull();
});
