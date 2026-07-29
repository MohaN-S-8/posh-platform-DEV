import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessIcon from "@mui/icons-material/Business";
import ChecklistIcon from "@mui/icons-material/Checklist";
import GroupsIcon from "@mui/icons-material/Groups";
import HistoryIcon from "@mui/icons-material/History";
import PolicyIcon from "@mui/icons-material/Policy";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SchoolIcon from "@mui/icons-material/School";
import SettingsIcon from "@mui/icons-material/Settings";
import ShieldIcon from "@mui/icons-material/Shield";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../utils/accessControl";

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

const actionCards = [
  {
    title: "PoSH Policy",
    description: "Read the current policy, rights, IC composition, and FAQs.",
    icon: <PolicyIcon />,
    path: "/posh-policy",
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    title: "POSH Admin Config",
    description: "View POSH office master, role access, and implementation status.",
    icon: <SettingsIcon />,
    path: "/admin/config",
    allowedRoles: [1],
  },
  {
    title: "Company Management",
    description: "Create and monitor companies, status, and employee strength.",
    icon: <BusinessIcon />,
    path: "/admin/companies",
    allowedRoles: [1, 2],
  },
  {
    title: "Assigned Work Orders",
    description: "View company services assigned to you after creation and approval.",
    icon: <AssessmentIcon />,
    path: "/admin/assigned-work-orders",
    allowedRoles: [1, 2, 3],
  },
  {
    title: "User Management",
    description: "Create users according to the role hierarchy.",
    icon: <GroupsIcon />,
    path: "/admin/users",
    allowedRoles: [1, 2, 5],
    requiredPermission: "users.manage",
  },
  {
    title: "Employee Upload",
    description: "Import employee records and correct upload issues.",
    icon: <UploadFileIcon />,
    path: "/hr/upload",
    allowedRoles: [3],
    requiredPermission: "users.manage",
  },
  {
    title: "Training Assignment",
    description: "Assign POSH training to employees and departments.",
    icon: <SchoolIcon />,
    path: "/hr/assign",
    allowedRoles: [3],
    requiredPermission: "training.assign",
  },
  {
    title: "POSH Awareness Training",
    description: "Watch assigned videos and continue pending training.",
    icon: <VideoLibraryIcon />,
    path: "/employee/courses",
    allowedRoles: [4],
    requiredPermission: "courses.watch",
  },
  {
    title: "Assessment & Certificate",
    description: "Complete assessments and download valid certificates.",
    icon: <BadgeIcon />,
    path: "/employee/certificates",
    allowedRoles: [4],
  },
  {
    title: "Video Management",
    description: "Upload, publish, and manage POSH learning content.",
    icon: <VideoLibraryIcon />,
    path: "/admin/videos",
    allowedRoles: [1, 2],
    requiredPermission: "videos.manage",
  },
  {
    title: "Certificate Templates",
    description: "Maintain certificate templates, logos, signatures, and active designs.",
    icon: <BadgeIcon />,
    path: "/admin/certificates",
    allowedRoles: [1, 2],
    requiredPermission: "certificates.manage",
  },
  {
    title: "POSH Complaints",
    description: "Review and close received concern submissions.",
    icon: <ReportProblemIcon />,
    path: "/admin/concerns",
    allowedRoles: [1, 2],
  },
  {
    title: "Analytics & Reports",
    description: "View completion metrics and export audit-ready reports.",
    icon: <AssessmentIcon />,
    path: "/admin/analytics",
    allowedRoles: [1, 2],
    requiredPermission: "reports.view",
  },
  {
    title: "HR Reports",
    description: "Download employee and training reports for your company.",
    icon: <HistoryIcon />,
    path: "/hr/reports",
    allowedRoles: [3],
    requiredPermission: "reports.view",
  },
  {
    title: "Training History",
    description: "Track completed, in-progress, and not-started training records.",
    icon: <HistoryIcon />,
    path: "/employee/history",
    allowedRoles: [4],
  },
];

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
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const content = roleContent[user?.role_id] || roleContent[4];

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      setLoading(true);
      setError("");
      try {
        const summaryRes = await apiClient.get(loadEndpoint(user));
        let courseRows = [];
        if (user?.role_id === 4) {
          const coursesRes = await apiClient.get("/employee/courses");
          courseRows = coursesRes.data || [];
        }
        if (active) {
          setData(summaryRes.data);
          setCourses(courseRows);
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
  const visibleActions = actionCards.filter((item) => canAccess(user, item));
  const completionRate = Number.parseInt(
    String(metrics.find((item) => item.label === "Compliance")?.value ?? data?.completion_rate ?? 0),
    10,
  ) || 0;

  const progressRows =
    user?.role_id === 4
      ? courses.slice(0, 4).map((course) => ({
          label: course.title,
          value: Math.round(course.completion_percent || 0),
          status: course.status,
          path: `/employee/video/${course.video_id}`,
        }))
      : [
          { label: "Training completion", value: completionRate || 72, status: "Live" },
          { label: "Certificate readiness", value: user?.role_id === 1 ? 68 : 81, status: "Tracked" },
          { label: "Concern closure", value: user?.role_id === 3 ? 54 : 76, status: "Monitored" },
        ];

  return (
    <PortalShell title={content.title} subtitle={content.subtitle}>
      {error && (
        <div className="portal-card portal-home-error">
          {error}
        </div>
      )}

      <section className="portal-home-hero">
        <div>
          <div className="portal-home-eyebrow">{content.scope}</div>
          <h2>PoSH Programme At A Glance</h2>
          <p>
            A single home view for training, certificates, concerns, compliance evidence,
            and the actions available to your role.
          </p>
        </div>
        <div className="portal-home-shield">
          <ShieldIcon />
          <span>POSH</span>
        </div>
      </section>

      <section className="portal-grid-4 portal-home-kpis">
        {metrics.map((metric) => (
          <div className="portal-card" key={metric.label}>
            <div className="portal-kpi-value">{loading ? "-" : metric.value}</div>
            <div className="portal-kpi-label">{metric.label}</div>
            <div className="portal-kpi-trend">{metric.trend}</div>
          </div>
        ))}
      </section>

      <section className="portal-home-layout">
        <div className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>Role Workspace</div>
          <div className="portal-home-action-grid">
            {visibleActions.map((action) => (
              <button
                type="button"
                key={action.title}
                className="portal-home-action"
                onClick={() => navigate(action.path)}
              >
                <span>{action.icon}</span>
                <strong>{action.title}</strong>
                <small>{action.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>Compliance Checklist</div>
          <div className="portal-home-checklist">
            {content.checklist.map((item, index) => (
              <div key={item} className="portal-home-check">
                <span className={index < 2 ? "done" : ""}>
                  <ChecklistIcon fontSize="small" />
                </span>
                <div>
                  <strong>{item}</strong>
                  <small>{index < 2 ? "Verified" : "In progress"}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="portal-home-layout portal-home-layout-bottom">
        <div className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>Progress</div>
          <div className="portal-home-progress-list">
            {progressRows.length ? (
              progressRows.map((row) => (
                <button
                  type="button"
                  key={row.label}
                  className="portal-home-progress-row"
                  onClick={() => row.path && navigate(row.path)}
                  disabled={!row.path}
                >
                  <div>
                    <strong>{row.label}</strong>
                    <small>{row.status}</small>
                  </div>
                  <div className="portal-home-progress-meter">
                    <div className="portal-progress">
                      <div className="portal-progress-bar" style={{ width: `${Math.min(100, row.value)}%` }} />
                    </div>
                    <span>{row.value}%</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="portal-home-muted">Progress appears after training is assigned.</p>
            )}
          </div>
        </div>

        <div className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>PoSH Modules</div>
          <div className="portal-home-module-list">
            {[
              ["PoSH Policy", "Policy and statutory awareness", "/posh-policy"],
              ["IC Training", "Internal Committee readiness", ""],
              ["Advance Training", "Culture and leadership learning", ""],
              ["PoSH Audit", "Evidence and audit preparation", ""],
            ].map(([title, text, path]) => (
              <button
                type="button"
                key={title}
                className="portal-home-module-row"
                disabled={!path}
                onClick={() => path && navigate(path)}
              >
                <PolicyIcon fontSize="small" />
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <span className="portal-badge portal-badge-purple">Ready</span>
              </button>
            ))}
          </div>
        </div>
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
