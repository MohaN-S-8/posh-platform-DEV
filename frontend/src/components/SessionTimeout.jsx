import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

export function SessionTimeout() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const expireSession = async () => {
      await clearAuth();
      navigate("/login", { replace: true });
    };

    const resetTimer = () => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(expireSession, SESSION_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true }),
    );

    return () => {
      window.clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer),
      );
    };
  }, [clearAuth, isAuthenticated, navigate]);

  return null;
}
