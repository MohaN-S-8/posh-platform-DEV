// @vitest-environment jsdom
import { expect, test } from "vitest";
import { inputValidationMessage } from "./inputValidation";

test.each([["First Name", "Name123"], ["Mobile", "123abc4567"], ["Email ID", "bad@email@host"], ["Pincode", "ABC123"], ["PAN Number", "INVALID"], ["Employee ID", "EMP 1"]])("rejects invalid %s", (label, value) => {
  const control = document.createElement("input"); control.value = value;
  expect(inputValidationMessage(control, label)).not.toBe("");
});

test.each([["First Name", "Anne-Marie"], ["Last Name", "O'Connor"], ["Mobile", "9876543210"], ["Pincode", "600001"], ["Email", "john@example.com"], ["Address", "24, 2nd Cross Street"], ["Company Name", "3M India Ltd"]])("accepts valid %s", (label, value) => {
  const control = document.createElement("input"); control.value = value;
  expect(inputValidationMessage(control, label)).toBe("");
});
