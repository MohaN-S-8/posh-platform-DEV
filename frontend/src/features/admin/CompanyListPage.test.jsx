// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyListPage } from "./CompanyListPage";

// The shell mock only renders the page content under test.
// eslint-disable-next-line react/prop-types
vi.mock("../../components/PortalShell", () => ({ PortalShell: ({ children }) => <div>{children}</div> }));
vi.mock("../../components/MasterCityInput", () => ({ MasterCityInput: () => <input aria-label="City" /> }));
vi.mock("../../store/authStore", () => ({ useAuthStore: () => ({ user: { role_id: 1 } }) }));
vi.mock("../../api/client", () => ({ default: { get: vi.fn(async (path) => ({ data: path === "/companies/master-codes/" ? [
  { id: 1, category: "Deliverables", code: "POLICY", name: "PoSH Policy", is_active: true },
  { id: 2, category: "Deliverables", code: "TRAINING", name: "Awareness Training", is_active: true },
  { id: 3, category: "Deliverables", code: "OLD", name: "Retired Deliverable", is_active: false },
] : [] })) } }));

afterEach(cleanup);

describe("Company Setup deliverables", () => {
  it("loads active masters as independently selectable checkboxes", async () => {
    render(<CompanyListPage />);
    const policy = await screen.findByRole("checkbox", { name: "PoSH Policy" });
    const training = screen.getByRole("checkbox", { name: "Awareness Training" });
    expect(policy.checked).toBe(false);
    expect(training.checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: "Retired Deliverable" })).toBeNull();
    fireEvent.click(policy);
    fireEvent.click(training);
    expect(policy.checked).toBe(true);
    expect(training.checked).toBe(true);
    fireEvent.click(training);
    expect(training.checked).toBe(false);
    expect(policy.checked).toBe(true);
  });
});
