import { useEffect, useState } from "react";
import axios from "axios";
import { apiErrorMessage } from "../../api/errors";
import "./constitution.css";

export function ConstitutionApprovalPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [letter, setLetter] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;
    axios.post("/api/v1/hr/compliance/approval/review", { token }).then(({ data }) => { if (active) setLetter(data); })
      .catch((err) => { if (active) setError(apiErrorMessage(err, "Unable to open approval link.")); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const action = async (approve) => {
    setBusy(true); setError("");
    try {
      const res = await axios.post(`/api/v1/hr/compliance/approval/${approve ? "approve" : "file"}`, { token }, approve ? {} : { responseType: "blob" });
      if (approve) { setComplete(true); setPreview(""); }
      else setPreview(URL.createObjectURL(res.data));
    } catch (err) { setError(apiErrorMessage(err, "Unable to complete this action. The link may have expired.")); }
    finally { setBusy(false); }
  };
  return <main style={{ maxWidth: 960, margin: "32px auto", padding: 20 }}>
    <h1>IC Constitution Approval</h1>
    {error && <p role="alert">{error}</p>}
    {complete ? <p role="status">Approved. This letter is completed and locked.</p> : letter && <>
      <h2>{letter.title || "Management Approval Letter"}</h2><p>Approver: {letter.approver_name}</p>
      <button disabled={busy} onClick={() => action(false)}>View Letter</button>{" "}
      <button disabled={busy || !preview} onClick={() => { if (window.confirm("Approve this IC constitution letter? This cannot be undone.")) action(true); }}>Approve Letter</button>
      {preview && <iframe title="Letter for approval" src={preview} style={{ width: "100%", height: "70vh", marginTop: 20, border: "1px solid #ddd" }} />}
    </>}
  </main>;
}
