import { expect, test } from "vitest";
import { resolveApiBaseUrl } from "./config";

test("static config uses the production build URL", () => {
  expect(resolveApiBaseUrl("/api/v1", " https://backend.example/api/v1/ "))
    .toBe("https://backend.example/api/v1");
});

test("container runtime configuration overrides the build URL", () => {
  expect(resolveApiBaseUrl("https://runtime.example/api/v1/", "https://build.example/api/v1"))
    .toBe("https://runtime.example/api/v1");
});

test.each([undefined, null, {}, "", "   "])("missing configuration falls back safely: %s", (value) => {
  expect(resolveApiBaseUrl(value, value)).toBe("/api/v1");
});
