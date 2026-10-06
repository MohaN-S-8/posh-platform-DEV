// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MasterCityInput } from "./MasterCityInput";
import apiClient from "../api/client";

vi.mock("../api/client", () => ({ default: { get: vi.fn() } }));
afterEach(cleanup);

const rows = [
  { id: 1, category: "State Code", name: "Tamil Nadu", code: "TN", is_active: true },
  { id: 2, category: "Country Code", name: "India", code: "IN", is_active: true },
  { id: 3, category: "City Code", name: "Chennai", code: "CHE", is_active: true, description: '{"state":"TN","country":"IN"}' },
  { id: 4, category: "City Code", name: "Bengaluru", code: "BLR", is_active: true, description: '{"state":"KA","country":"IN"}' },
  { id: 5, category: "City Code", name: "Inactive City", code: "OLD", is_active: false, description: '{"state":"TN","country":"IN"}' },
];

test("searches active master cities using state/country names and saves the selected city", async () => {
  apiClient.get.mockResolvedValue({ data: rows });
  const onChange = vi.fn();
  render(<MasterCityInput state="Tamil Nadu" country="India" onChange={onChange} />);
  const input = screen.getByRole("combobox");
  fireEvent.mouseDown(input);
  expect(await screen.findByRole("option", { name: "Chennai" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Bengaluru" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Inactive City" })).toBeNull();
  fireEvent.change(input, { target: { value: "Chen" } });
  fireEvent.click(screen.getByRole("option", { name: "Chennai" }));
  expect(onChange).toHaveBeenCalledWith("Chennai");
});

test("displays existing city codes as names and rejects arbitrary typed entries", async () => {
  apiClient.get.mockResolvedValue({ data: rows });
  const onChange = vi.fn();
  render(<MasterCityInput value="CHE" onChange={onChange} />);
  const input = screen.getByRole("combobox");
  await waitFor(() => expect(input.value).toBe("Chennai"));
  fireEvent.change(input, { target: { value: "Unlisted town" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  expect(onChange).not.toHaveBeenCalled();
});

test("company city selection fills master state and country despite existing address filters", async () => {
  apiClient.get.mockResolvedValue({ data: rows });
  const onChange = vi.fn();
  render(<MasterCityInput autoMap state="KA" country="IN" onChange={onChange} />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Chennai" }));
  expect(onChange).toHaveBeenCalledWith("Chennai", { state: "TN", country: "IN" });
});

test("existing saved cities fill missing geography when masters load", async () => {
  apiClient.get.mockResolvedValue({ data: rows });
  const onChange = vi.fn();
  render(<MasterCityInput autoMap value="CHE" onChange={onChange} />);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("CHE", { state: "TN", country: "IN" }));
});

test("legacy cities without metadata remain visible", async () => {
  apiClient.get.mockResolvedValue({ data: [...rows,
    { id: 6, category: "City Code", name: "Legacy City", code: "LEG", is_active: true, description: "Default city code" },
  ] });
  render(<MasterCityInput state="TN" country="IN" onChange={vi.fn()} />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  expect(await screen.findByRole("option", { name: "Legacy City" })).toBeTruthy();
});
