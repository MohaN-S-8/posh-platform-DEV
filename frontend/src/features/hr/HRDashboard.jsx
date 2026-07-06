import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { useAuthStore } from "../../store/authStore";

const shellStyle = {
  padding: "32px",
  background: "#f6f8fb",
  minHeight: "100vh",
};

const cardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
};

const labelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
};

const valueStyle = {
  color: "#17324d",
  fontSize: "30px",
  fontWeight: 800,
  marginTop: "8px",
};

export function HRDashboard() {
  const navigate = useNavigate();
  const { clearAuth, user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const logout = async () => {
    await clearAuth();
    navigate("/login");
  };

  const sendReminders = async () => {
    setReminding(true);
    setError("");
    setMessage("");
    try {
      const res = await apiClient.post("/hr/notifications/send-reminders");
      setMessage(res.data?.message || "Training reminders created.");
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create training reminders.");
    } finally {
      setReminding(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/hr/compliance/dashboard");
        if (active) setData(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load HR dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { label: "Employees", value: data?.total_employees ?? 0 },
      {
        label: "Courses Assigned",
        value:
          (data?.completed ?? 0) + (data?.in_progress ?? 0) + (data?.not_started ?? 0),
      },
      { label: "Completed", value: data?.completed ?? 0 },
      { label: "Pending", value: (data?.in_progress ?? 0) + (data?.not_started ?? 0) },
      { label: "Compliance Rate", value: `${data?.compliance_rate ?? 0}%` },
    ],
    [data],
  );

  const canManageTraining = user?.role_id === 4;
  const canManageUsers = user?.role_id === 3 || user?.role_id === 4;

  const modules = [
    ...(canManageTraining
      ? [
          {
            title: "Employee Upload",
            description: "Import employee records with Excel or CSV validation.",
            path: "/hr/upload",
            icon: <CloudUploadIcon />,
            status: "Available",
          },
          {
            title: "Training Assignment",
            description: "Assign videos to one employee, a department, or the company.",
            path: "/hr/assign",
            icon: <PlaylistAddCheckIcon />,
            status: "Available",
          },
        ]
      : []),
    {
      title: "Video Management",
      description: "Upload, edit, publish, and archive POSH training videos.",
      path: "/admin/videos",
      icon: <PlaylistAddCheckIcon />,
      status: "Available",
    },
    {
      title: "Compliance Tracking",
      description: "Monitor completion, pending employees, and overdue training.",
      path: "/hr/compliance",
      icon: <AssessmentIcon />,
      status: "Available",
    },
    {
      title: "Reports",
      description: "Download employee, department, and certificate reports.",
      path: "/hr/reports",
      icon: <DownloadIcon />,
      status: "Available",
    },
    ...(canManageUsers
      ? [
          {
            title: user?.role_id === 3 ? "HR / IC Management" : "Employee Management",
            description:
              user?.role_id === 3
                ? "Create, activate, deactivate, and reset HR / IC users."
                : "Create, activate, deactivate, and reset employee users.",
            path: "/admin/users",
            icon: <GroupsIcon />,
            status: "Available",
          },
        ]
      : []),
    {
      title: "Certificate Downloads",
      description: "Certificate reports are available; per-certificate downloads are employee-side.",
      path: "/hr/reports",
      icon: <BadgeIcon />,
      status: "Partial",
    },
  ];

  return (
    <div style={shellStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            HR Portal
          </h1>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Manage employee training, assignments, compliance, reports, and certificates.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/change-password")}
            style={{
              padding: "10px 16px",
              background: "#eef4f8",
              color: "#17324d",
              border: "1px solid #cdd9e2",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              padding: "10px 16px",
              background: "#c0392b",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
            }}
          >
            <LogoutIcon fontSize="small" />
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            borderColor: "#f3b4ae",
            background: "#fff7f6",
            color: "#c0392b",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            ...cardStyle,
            borderColor: "#b7dfc2",
            background: "#f1fbf4",
            color: "#1f7a4d",
            marginBottom: "20px",
          }}
        >
          {message}
        </div>
      )}

      <section style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "16px",
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} style={cardStyle}>
              <div style={labelStyle}>{stat.label}</div>
              <div style={valueStyle}>{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px",
          alignItems: "start",
          marginBottom: "28px",
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ color: "#17324d", margin: "0 0 16px", fontSize: "20px" }}>
            Department Compliance
          </h2>
          {data?.department_breakdown?.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {data.department_breakdown.slice(0, 6).map((dept) => (
                <div key={dept.department}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "6px",
                      color: "#17324d",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    <span>{dept.department}</span>
                    <span>{dept.compliance_rate}%</span>
                  </div>
                  <div
                    style={{
                      height: "9px",
                      background: "#edf2f7",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, dept.compliance_rate)}%`,
                        background: dept.compliance_rate >= 80 ? "#1f7a4d" : "#c77918",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#64748b", margin: 0 }}>
              Department compliance appears after employees are uploaded and training starts.
            </p>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ color: "#17324d", margin: "0 0 16px", fontSize: "20px" }}>
            Alerts
          </h2>
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Overdue employees:{" "}
              <strong style={{ color: "#c0392b" }}>
                {data?.overdue_employees?.length ?? 0}
              </strong>
            </div>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              Pending training:{" "}
              <strong style={{ color: "#17324d" }}>
                {(data?.in_progress ?? 0) + (data?.not_started ?? 0)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => navigate("/hr/compliance")}
              style={{
                marginTop: "8px",
                padding: "9px 12px",
                background: "#17324d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Review Compliance
            </button>
            <button
              type="button"
              onClick={sendReminders}
              disabled={reminding}
              style={{
                padding: "9px 12px",
                background: reminding ? "#93a4b7" : "#1f7a4d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: reminding ? "not-allowed" : "pointer",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <NotificationsActiveIcon fontSize="small" />
              {reminding ? "Creating reminders..." : "Send Reminders"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {modules.map((module) => {
            const enabled = Boolean(module.path);
            return (
              <button
                key={module.title}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && navigate(module.path)}
                style={{
                  ...cardStyle,
                  textAlign: "left",
                  cursor: enabled ? "pointer" : "not-allowed",
                  opacity: enabled ? 1 : 0.75,
                  minHeight: "152px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <span style={{ color: "#17324d", display: "flex" }}>{module.icon}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: module.status === "Available" ? "#1f7a4d" : "#64748b",
                      background:
                        module.status === "Available" ? "#e8f5e9" : "#eef2f6",
                      borderRadius: "999px",
                      padding: "4px 9px",
                    }}
                  >
                    {module.status}
                  </span>
                </div>
                <h3 style={{ color: "#17324d", margin: "0 0 8px", fontSize: "17px" }}>
                  {module.title}
                </h3>
                <p style={{ color: "#64748b", margin: 0, fontSize: "13px", lineHeight: 1.5 }}>
                  {module.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <LoadingOverlay
        show={loading || reminding}
        title={reminding ? "Creating reminders" : "Loading HR dashboard"}
        message={
          reminding
            ? "Creating employee notifications for due and overdue training."
            : "Fetching employees, compliance, overdue training, and department status."
        }
      />
    </div>
  );
}
