import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useToastStore } from "../store/toastStore";

function Toast({ toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (toast.pending || paused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.severity === "error" ? 12000 : 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.pending, toast.severity, paused, dismiss]);
  return <Alert severity={toast.severity} role={toast.severity === "error" ? "alert" : "status"}
    icon={toast.pending ? <CircularProgress size={20} color="inherit" /> : undefined}
    onClose={() => dismiss(toast.id)}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    sx={{ pointerEvents: "auto", boxShadow: 3, borderRadius: "6px", overflowWrap: "anywhere", "& .MuiAlert-message": { maxHeight: "30vh", overflowY: "auto" } }}>
    {toast.message}
  </Alert>;
}
Toast.propTypes = { toast: PropTypes.shape({ id: PropTypes.number.isRequired, message: PropTypes.string.isRequired, severity: PropTypes.string.isRequired, pending: PropTypes.bool.isRequired }).isRequired };

export function ToastNotifications() {
  const toasts = useToastStore((state) => state.toasts);
  return <div aria-label="Action notifications" style={{ position: "fixed", top: 16, right: 16, width: "min(420px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", display: "grid", gap: 10, zIndex: 2000, pointerEvents: "none" }}>
    {toasts.map((toast) => <Toast key={toast.id} toast={toast} />)}
  </div>;
}
