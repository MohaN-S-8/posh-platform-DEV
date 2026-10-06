// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ValidatedForm } from "./ValidatedForm";

afterEach(cleanup);

test("shows all required fields together beside submit and blocks submission", () => {
  const submit = vi.fn();
  render(<ValidatedForm onSubmit={submit}>
    <label>Company<input required /></label>
    <label>Role<select required defaultValue=""><option value="">Select Role</option><option>Employee</option></select></label>
    <label>Email<input required type="email" /></label>
    <button type="submit">Save</button>
  </ValidatedForm>);
  fireEvent.click(screen.getByText("Save"));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").querySelectorAll("li")).toHaveLength(3);
  fireEvent.click(screen.getByText("Company is required."));
  expect(document.activeElement).toBe(screen.getByLabelText("Company"));
  expect(screen.getByText("Save").compareDocumentPosition(screen.getByRole("alert")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("validates email, lengths and whitespace and clears corrected errors", async () => {
  render(<ValidatedForm><label>Name<input required defaultValue="   " /></label><label>Email<input type="email" defaultValue="bad" /></label><label>Password<input minLength={8} defaultValue="abc" /></label><button>Save</button></ValidatedForm>);
  fireEvent.click(screen.getByText("Save"));
  expect(screen.getByRole("alert").querySelectorAll("li")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mohan" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mohan@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassword" } });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("ignores disabled fields and permits valid submissions", () => {
  const submit = vi.fn();
  render(<ValidatedForm onSubmit={submit}><input required disabled /><input required defaultValue="Valid" /><button>Save</button></ValidatedForm>);
  fireEvent.click(screen.getByText("Save"));
  expect(submit).toHaveBeenCalledOnce();
});

test("shows backend failures beside submit", async () => {
  render(<ValidatedForm onSubmit={async () => { throw { response: { data: { detail: "Branch ID already exists." } } }; }}><button>Save</button></ValidatedForm>);
  fireEvent.click(screen.getByText("Save"));
  expect(await screen.findByText("Branch ID already exists.")).toBeTruthy();
});

test("includes schema and custom validation messages", () => {
  render(<ValidatedForm validate={() => ["Passwords must match."]} fieldErrors={{ email: { message: "Email is required." } }}><button>Save</button></ValidatedForm>);
  fireEvent.click(screen.getByText("Save"));
  expect(screen.getByText("Passwords must match.")).toBeTruthy();
  expect(screen.getByText("Email is required.")).toBeTruthy();
});
