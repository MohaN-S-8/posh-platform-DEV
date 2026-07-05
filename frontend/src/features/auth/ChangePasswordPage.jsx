import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cfd7df",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.post("/auth/change-password", form);
      setSuccess(res.data.message || "Password changed successfully.");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        Back
      </button>
      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e7edf3",
          maxWidth: "520px",
        }}
      >
        <h1 style={{ color: "#17324d", margin: "0 0 18px", fontSize: "28px" }}>
          Change Password
        </h1>
        {error && <div style={messageStyle("#fff7f6", "#f3b4ae", "#c0392b")}>{error}</div>}
        {success && <div style={messageStyle("#e8f5ee", "#1f7a4d", "#1f7a4d")}>{success}</div>}
        <form onSubmit={submit} style={{ display: "grid", gap: "14px" }}>
          <label style={labelStyle}>
            Current Password
            <input
              required
              type="password"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            New Password
            <input
              required
              type="password"
              minLength={8}
              maxLength={15}
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Confirm Password
            <input
              required
              type="password"
              minLength={8}
              maxLength={15}
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 16px",
              background: saving ? "#93a4b7" : "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "grid",
  gap: "6px",
  color: "#17324d",
  fontWeight: 700,
  fontSize: "13px",
};

const messageStyle = (background, border, color) => ({
  background,
  border: `1px solid ${border}`,
  borderRadius: "8px",
  color,
  padding: "10px 12px",
  marginBottom: "14px",
});
