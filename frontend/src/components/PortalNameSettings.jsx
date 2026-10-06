import { useEffect, useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import apiClient from "../api/client";
import { apiErrorMessage } from "../api/errors";
import { useBrandingStore } from "../store/brandingStore";
import { useAuthStore } from "../store/authStore";
import { ValidatedForm } from "./ValidatedForm";

export function PortalNameSettings() {
  const user = useAuthStore((state) => state.user);
  const portalName = useBrandingStore((state) => state.portalName);
  const save = useBrandingStore((state) => state.save);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    apiClient.get("/branding/access").then(({ data }) => { if (active) setCanEdit(data.can_edit); }).catch(() => { if (active) setCanEdit(false); });
    return () => { active = false; };
  }, [user?.user_id]);
  if (!canEdit) return null;
  return <section style={{ borderTop: "1px solid var(--portal-border)", marginTop: 24, padding: "20px 0" }}>
    <h3 className="portal-section-title">Portal Settings</h3>
    <ValidatedForm error={error} onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(""); setMessage("");
      try { await save((draft ?? portalName).trim()); setDraft(null); setMessage("Portal and default company name updated."); }
      catch (err) { setError(apiErrorMessage(err)); }
      finally { setBusy(false); }
    }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>Portal / Default Company Name
        <input required minLength={2} maxLength={100} value={draft ?? portalName} onChange={(event) => setDraft(event.target.value)} style={{ padding: 10, border: "1px solid var(--portal-border)", borderRadius: 6, width: "100%", boxSizing: "border-box" }} />
      </label>
      <button className="portal-primary-btn" disabled={busy} style={{ marginTop: 12 }}><SaveIcon fontSize="small" /> Save Name</button>
    </ValidatedForm>
    {message && <p role="status">{message}</p>}
  </section>;
}
