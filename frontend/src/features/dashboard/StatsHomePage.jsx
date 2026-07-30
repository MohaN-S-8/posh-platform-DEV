import ShieldIcon from "@mui/icons-material/Shield";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const roleContent = {
  1: {
    title: "Super Admin Home",
    subtitle: "Platform-wide PoSH programme, companies, users, compliance, and concerns.",
    scope: "All companies",
    checklist: ["Companies configured", "Admin users assigned", "Certificate templates active", "Audit reports available"],
  },
  2: {
    title: "Admin Home",
    subtitle: "Company-level PoSH operations, training governance, certificates, and received concerns.",
    scope: "Your company",
    checklist: ["Client / Management users created", "Training videos published", "Certificates configured", "Concerns reviewed"],
  },
  5: {
    title: "Client / Management Home",
    subtitle: "Management view for HR / IC setup and company user readiness.",
    scope: "Your company",
    checklist: ["HR / IC users ready", "Employee data monitored", "Training assignment tracked", "Compliance reviewed"],
  },
  3: {
    title: "HR / IC Home",
    subtitle: "Employee records, training assignment, IC readiness, and reports.",
    scope: "Your company",
    checklist: ["Employees uploaded", "Training assigned", "Pending users followed up", "Reports downloaded"],
  },
  4: {
    title: "Employee Home",
    subtitle: "Your PoSH training, assessment, certificates, and confidential concern access.",
    scope: "My training",
    checklist: ["Training started", "Video watched", "Assessment completed", "Certificate downloaded"],
  },
};

function metricSet(user, data) {
  if (user?.role_id === 1) {
    return [
      { label: "Active Companies", value: data?.total_companies ?? 0, trend: "Platform live data" },
      { label: "Active Users", value: data?.total_users ?? 0, trend: "Across all companies" },
      { label: "Certificates", value: data?.total_certificates_issued ?? 0, trend: "Issued certificates" },
      { label: "Completions", value: data?.total_course_completions ?? 0, trend: "Training completions" },
    ];
  }
  if (user?.role_id === 2) {
    return [
      { label: "Employees", value: data?.total_employees ?? 0, trend: "Company users" },
      { label: "Completed", value: data?.completed_training ?? 0, trend: "Training completed" },
      { label: "Compliance", value: `${data?.compliance_rate ?? 0}%`, trend: "Current rate" },
      { label: "Certificates", value: data?.certificates_issued ?? 0, trend: "Issued certificates" },
    ];
  }
  if (user?.role_id === 3 || user?.role_id === 5) {
    return [
      { label: "Employees", value: data?.total_employees ?? 0, trend: "Company records" },
      { label: "Departments", value: data?.department_breakdown?.length ?? 0, trend: "Active groups" },
      { label: "Active Records", value: data?.total_employees ?? 0, trend: "Employee master" },
      { label: "Pending Follow-Up", value: data?.pending_followup ?? 0, trend: "Needs action" },
    ];
  }
  return [
    { label: "Assigned Courses", value: data?.total_courses ?? 0, trend: "My courses" },
    { label: "Completed", value: data?.completed ?? 0, trend: "Training done" },
    { label: "Pending", value: (data?.in_progress ?? 0) + (data?.not_started ?? 0), trend: "Still open" },
    { label: "Certificates", value: data?.certificates ?? 0, trend: `${data?.completion_rate ?? 0}% complete` },
  ];
}

function loadEndpoint(user) {
  if (user?.role_id === 1) return "/analytics/overview";
  if (user?.role_id === 2) return `/analytics/company/${user?.company_id}`;
  if (user?.role_id === 3 || user?.role_id === 5) return "/hr/employees/summary";
  return "/employee/summary";
}

export function StatsHomePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const content = roleContent[user?.role_id] || roleContent[4];

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, profileRes] = await Promise.all([
          apiClient.get(loadEndpoint(user)),
          apiClient.get("/auth/me"),
        ]);
        if (active) {
          setData(summaryRes.data);
          setProfile(profileRes.data);
        }
      } catch (err) {
        if (active) setError(apiErrorMessage(err, "Home metrics are unavailable."));
      } finally {
        if (active) setLoading(false);
      }
    };
    loadHome();
    return () => {
      active = false;
    };
  }, [user]);

  const metrics = useMemo(() => metricSet(user, data), [data, user]);
  const displayName = profile?.full_name || profile?.first_name || "there";
  const companyName = profile?.company_name || "Your company";

  return (
    <PortalShell title={content.title} subtitle={content.subtitle}>
      {error && (
        <div className="portal-card portal-home-error">
          {error}
        </div>
      )}

      {user?.role_id !== 1 && (
        <section className="portal-home-hero">
          <div>
            <div className="portal-home-eyebrow">Welcome back</div>
            <h2>{displayName}</h2>
            <p>
              {companyName} is happy to see your ownership and responsibility in taking
              the time to learn about the Prevention of Sexual Harassment (PoSH) policy.
            </p>
            <p>
              Every module you complete and every question you ask helps us build a
              workplace where everyone feels safe, respected and heard. Thank you for
              being part of that effort.
            </p>
          </div>
          <div className="portal-home-shield">
            <ShieldIcon />
            <span>POSH</span>
          </div>
        </section>
      )}

      <section className="portal-grid-4 portal-home-kpis">
        {metrics.map((metric) => (
          <div className="portal-card" key={metric.label}>
            <div className="portal-kpi-value">{loading ? "-" : metric.value}</div>
            <div className="portal-kpi-label">{metric.label}</div>
            <div className="portal-kpi-trend">{metric.trend}</div>
          </div>
        ))}
      </section>

      <LoadingOverlay
        show={loading}
        title="Loading home"
        message="Preparing your role-based PoSH home page."
      />
    </PortalShell>
  );
}

export default StatsHomePage;
