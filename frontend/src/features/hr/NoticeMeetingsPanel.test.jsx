// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import apiClient from "../../api/client";
import { NoticeMeetingsPanel } from "./NoticeMeetingsPanel";
import { meetingPrintHtml } from "./meetingPrint";

vi.mock("../../api/client", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
beforeEach(() => {
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith("/notices") ? { branches: [{ branch_id: "BR1", branch_name: "Main" }], notices: [] } : [] }));
  apiClient.post.mockResolvedValue({ data: {} });
  apiClient.put.mockResolvedValue({ data: {} });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("new meeting opens validated form and saves the selected branch", async () => {
  render(<NoticeMeetingsPanel companyId="2" canEdit />);
  await screen.findAllByRole("option", { name: "Main" });
  fireEvent.click(screen.getByRole("button", { name: "New Minutes of Meeting" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Minutes of Meeting" }));
  expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getAllByLabelText("Branch Name *")[1], { target: { value: "BR1" } });
  for (const [label, value] of [["Year *", "2026"], ["Meeting Date *", "2026-01-18"], ["Meeting Time *", "11:00"], ["Presiding Officer Name *", "Officer"], ["Venue / Mode of Meeting *", "Office"], ["Members Present (Attendees) *", "Member One"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Save Minutes of Meeting" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  expect(JSON.parse(apiClient.post.mock.calls[0][1].get("payload")).branch_id).toBe("BR1");
  expect(await screen.findByText("Minutes of Meeting saved.")).toBeTruthy();
});

test("notice uses selected company endpoint", async () => {
  render(<NoticeMeetingsPanel companyId="2" canEdit />);
  await screen.findAllByRole("option", { name: "Main" });
  fireEvent.change(screen.getByLabelText("Branch Name *"), { target: { value: "BR1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Status" }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith("/hr/compliance/companies/2/notices", { branch_id: "BR1", status: "Completed", notes: "" }));
});

test("read-only users cannot create or update records", async () => {
  render(<NoticeMeetingsPanel companyId="2" canEdit={false} />);
  await screen.findByRole("option", { name: "Main" });
  expect(screen.queryByRole("button", { name: "New Minutes of Meeting" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save Status" })).toBeNull();
});

test("view shows details below the table and edit loads existing inputs", async () => {
  const row = { id: 1, branch_id: "BR1", branch_name: "Main", year: 2026, quarter: 1, meeting_date: "2026-01-18", meeting_time: "11:00:00", presiding_officer: "Officer", venue: "Office", attendees: "Member", agenda1: "Existing discussion" };
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith("/notices") ? { branches: [row], notices: [] } : url.endsWith("/meetings/1") ? row : [row] }));
  render(<NoticeMeetingsPanel companyId="2" canEdit />);
  fireEvent.click(await screen.findByRole("button", { name: "View" }));
  expect(await screen.findByText("Existing discussion")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit", exact: true }));
  await waitFor(() => expect(screen.getByLabelText("Presiding Officer Name *").value).toBe("Officer"));
  fireEvent.change(screen.getByLabelText("Venue / Mode of Meeting *"), { target: { value: "Virtual" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Minutes of Meeting" }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
  expect(apiClient.put.mock.calls[0][0]).toBe("/hr/compliance/companies/2/meetings/1");
  expect(JSON.parse(apiClient.put.mock.calls[0][1].get("payload")).venue).toBe("Virtual");
});

test("print template escapes user content and contains print controls", () => {
  const html = meetingPrintHtml({ company_name: "<script>alert(1)</script>", attendees: "One, Two", agenda1: "A & B" });
  expect(html).not.toContain("<script>");
  expect(html).toContain("A &amp; B");
  expect(html).toContain("window.print()");
  expect(html).toContain("Signature of Presiding Officer");
});
