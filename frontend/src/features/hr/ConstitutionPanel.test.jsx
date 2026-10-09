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

test.each(["Sent", "Failed"])("shows saved letter immediately when email delivery is %s", async (delivery_status) => {
  apiClient.post.mockResolvedValue({ data: {
    id: 42, title: "Management Approval", filename: "approval.pdf",
    approver_name: "Advisor", approver_email: "advisor@example.com",
    submitted_at: "2026-10-09T10:00:00", status: "Pending", delivery_status,
  } });
  render(<ConstitutionPanel />);
  await screen.findByRole("option", { name: "Advisor (advisor@example.com)" });
  fireEvent.change(screen.getByLabelText("Route for Approval to External Member *"), { target: { value: "1" } });
  const fileInput = screen.getByLabelText("Management Approval File (PDF, up to 10 MB) *");
  // jsdom does not update native file validity from a simulated files array.
  Object.defineProperty(fileInput, "value", { configurable: true, value: "C:\\fakepath\\approval.pdf" });
  Object.defineProperty(fileInput, "validity", { configurable: true, value: { valid: true } });
  fireEvent.change(fileInput, {
    target: { files: [new File(["%PDF-test"], "approval.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit for Approval" }));
  expect(screen.queryAllByRole("alert").map((node) => node.textContent)).toEqual([]);
  expect(await screen.findByRole("button", { name: "approval.pdf" })).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit for Approval" }).disabled).toBe(false));
  expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith("/constitution"))).toHaveLength(1);
  expect(screen.getByText(delivery_status === "Sent"
    ? "Letter submitted. Approval email sent."
    : "Letter saved, but email delivery failed. Use Resend approval email.")).toBeTruthy();
});
