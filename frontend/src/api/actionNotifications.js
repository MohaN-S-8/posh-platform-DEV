import { apiErrorMessage } from "./errors";
import { useToastStore } from "../store/toastStore";

function actionMessages(config) {
  const method = (config.method || "get").toLowerCase();
  const url = config.url || "";
  if (config.notify === false || /\/auth\/(refresh|me|logout)(?:\?|$)/.test(url)
    || /\/videos\/[^/]+\/progress/.test(url) || /\/notifications\/.+\/read/.test(url)) return null;
  if (method === "get") return config.responseType === "blob" ? ["Preparing file...", "File is ready."] : null;
  if (!["post", "put", "patch", "delete"].includes(method)) return null;
  if (method === "delete") return ["Deleting...", "Deleted successfully."];
  if (/bulk-upload|upload|policy-document|\/asset|\/qualities/.test(url) || config.data instanceof FormData) return ["Uploading...", "Upload completed."];
  if (/\/approve(?:\?|$)/.test(url)) return ["Approving...", "Approved successfully."];
  if (/\/publish(?:\?|$)/.test(url)) return ["Publishing...", "Published successfully."];
  if (/password/.test(url)) return ["Processing password request...", "Password request completed."];
  if (/\/submit(?:\?|$)/.test(url)) return ["Submitting...", "Submitted successfully."];
  if (/\/assign(?:\?|$)/.test(url)) return ["Assigning...", "Assigned successfully."];
  if (/\/auth\//.test(url)) return ["Processing...", "Request completed."];
  return ["Saving...", "Saved successfully."];
}

export function startActionNotification(config) {
  if (config._actionToastId) return;
  const messages = actionMessages(config);
  if (!messages) return;
  config._actionToastId = useToastStore.getState().add(messages[0], "info", true);
  config._actionSuccessMessage = messages[1];
}

export function finishActionNotification(response) {
  const id = response.config?._actionToastId;
  if (!id) return response;
  const data = response.data;
  const partial = Number(data?.error_count || data?.email_summary?.failed || 0) > 0;
  const serverMessage = typeof data?.message === "string" ? data.message
    : typeof data?.detail === "string" ? data.detail : null;
  const message = partial
    ? `${serverMessage || "Request completed"} Some items failed. Review the details on this page.`
    : serverMessage || response.config._actionSuccessMessage;
  useToastStore.getState().finish(id, message, partial ? "warning" : "success");
  return response;
}

export async function failActionNotification(error) {
  const id = error.config?._actionToastId;
  if (id) {
    if (error.code === "ERR_CANCELED") {
      useToastStore.getState().dismiss(id);
    } else {
      let readable = error;
      if (error.response?.data instanceof Blob) {
        try { readable = { response: { data: JSON.parse(await error.response.data.text()) } }; } catch { /* Use the fallback for non-JSON downloads. */ }
      }
      const fallback = error.response ? "Action failed. Please try again." : "Unable to reach the server. Please check your connection.";
      useToastStore.getState().finish(id, apiErrorMessage(readable, fallback), "error");
    }
  }
  throw error;
}
