// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import { useToastStore } from "../store/toastStore";
import { startActionNotification, finishActionNotification, failActionNotification } from "./actionNotifications";

beforeEach(() => useToastStore.setState({ toasts: [] }));

test("a save updates its progress toast to success", () => {
  const config = { method: "post", url: "/companies/" };
  startActionNotification(config);
  expect(useToastStore.getState().toasts[0].pending).toBe(true);
  finishActionNotification({ config, data: { message: "Company saved." } });
  expect(useToastStore.getState().toasts).toHaveLength(1);
  expect(useToastStore.getState().toasts[0]).toMatchObject({ pending: false, severity: "success", message: "Company saved." });
});

test("approval failure displays the actual backend validation message", async () => {
  const config = { method: "patch", url: "/companies/4/approve" };
  startActionNotification(config);
  const error = { config, response: { status: 400, data: { detail: "Assign an admin and upload the policy PDF." } } };
  await expect(failActionNotification(error)).rejects.toBe(error);
  expect(useToastStore.getState().toasts[0]).toMatchObject({ severity: "error", pending: false, message: error.response.data.detail });
});

test("authentication retry does not create duplicate notifications", () => {
  const config = { method: "delete", url: "/users/3" };
  startActionNotification(config);
  startActionNotification({ ...config, _retry: true });
  finishActionNotification({ config, data: {} });
  finishActionNotification({ config, data: {} });
  expect(useToastStore.getState().toasts).toHaveLength(1);
  expect(useToastStore.getState().toasts[0].message).toBe("Deleted successfully.");
});

test("background requests stay quiet while downloads show progress", () => {
  for (const config of [
    { method: "get", url: "/users/" },
    { method: "post", url: "/videos/3/progress" },
    { method: "post", url: "/auth/refresh" },
    { method: "patch", url: "/notifications/3/read" },
  ]) startActionNotification(config);
  expect(useToastStore.getState().toasts).toHaveLength(0);
  startActionNotification({ method: "get", url: "/report", responseType: "blob" });
  expect(useToastStore.getState().toasts[0].message).toBe("Preparing file...");
});

test("bulk upload with rejected rows shows a warning, not full success", () => {
  const config = { method: "post", url: "/users/bulk-upload" };
  startActionNotification(config);
  finishActionNotification({ config, data: { created_count: 2, error_count: 1 } });
  expect(useToastStore.getState().toasts[0].severity).toBe("warning");
});

test("concurrent actions finish independently and canceled requests disappear", async () => {
  const first = { method: "post", url: "/users/" };
  const second = { method: "put", url: "/companies/2" };
  startActionNotification(first); startActionNotification(second);
  finishActionNotification({ config: second, data: {} });
  expect(useToastStore.getState().toasts[0].pending).toBe(true);
  expect(useToastStore.getState().toasts[1].pending).toBe(false);
  await expect(failActionNotification({ config: first, code: "ERR_CANCELED" })).rejects.toBeTruthy();
  expect(useToastStore.getState().toasts).toHaveLength(1);
});
