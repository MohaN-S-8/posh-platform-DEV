import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import BadgeIcon from "@mui/icons-material/Badge";
import PolicyIcon from "@mui/icons-material/Policy";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { Link } from "react-router-dom";

const servicePoints = [
  {
    icon: <PolicyIcon />,
    title: "Policy Workflows",
    text: "Keep POSH policy, user roles, and company-level compliance activity structured in one place.",
  },
  {
    icon: <AssignmentTurnedInIcon />,
    title: "Training & Assessment",
    text: "Assign courses, require video completion, capture assessment results, and manage reattempt rules.",
  },
  {
    icon: <BadgeIcon />,
    title: "Certificates",
    text: "Issue audit-ready certificates with templates, verification numbers, and employee download access.",
  },
  {
    icon: <VerifiedUserIcon />,
    title: "Reports & Evidence",
    text: "Track completion, reminders, history, and role-wise activity for management and audit reviews.",
  },
];

export function PoshServicePage() {
  return (
    <div className="landing-page service-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="POSH platform home">
          <span className="landing-brand-mark">P</span>
          <span>
            <strong>POSH</strong>
            <small>Training Platform</small>
          </span>
        </Link>
        <nav className="landing-nav-actions" aria-label="Account access">
          <Link to="/login" className="landing-link-btn">
            Login
          </Link>
          <Link to="/signup" className="landing-primary-btn">
            Signup <ArrowForwardIcon fontSize="small" />
          </Link>
        </nav>
      </header>

      <main className="service-main">
        <section className="service-hero">
          <Link to="/" className="service-back-link">
            <ArrowBackIcon fontSize="small" /> Back to Home
          </Link>
          <p className="landing-eyebrow">POSH service</p>
          <h1>POSH Compliance</h1>
          <p>
            Structured workflows for policies, training, assessments,
            certificates, and audit-ready reporting. This service helps clients
            manage workplace compliance with clear role ownership and reliable
            evidence.
          </p>
          <div className="landing-hero-actions">
            <Link to="/login" className="landing-primary-btn landing-primary-btn-lg">
              POSH Login <ArrowForwardIcon fontSize="small" />
            </Link>
            <Link to="/signup" className="landing-secondary-btn">
              Signup
            </Link>
          </div>
        </section>

        <section className="service-detail-grid">
          {servicePoints.map((point) => (
            <article className="landing-service-card" key={point.title}>
              <div className="landing-service-icon">{point.icon}</div>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
