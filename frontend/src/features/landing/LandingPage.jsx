import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PolicyIcon from "@mui/icons-material/Policy";
import ShieldIcon from "@mui/icons-material/Shield";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { Link } from "react-router-dom";
import heroImage from "../../assets/hero.png";

const services = [
  {
    icon: <PolicyIcon />,
    title: "POSH Compliance",
    text: "Structured workflows for policies, training, assessments, certificates, and audit-ready reporting.",
    path: "/services/posh-compliance",
  },
];

const values = [
  "Confidential handling of workplace concerns",
  "Clear compliance evidence for leadership and audits",
  "Accessible training journeys for every employee",
  "Measured progress across companies, departments, and roles",
];

export function LandingPage() {
  return (
    <div className="landing-page">
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

      <main>
        <section className="landing-hero">
          <div className="landing-hero-bg" aria-hidden="true">
            <img src={heroImage} alt="" />
          </div>
          <div className="landing-hero-content">
            <p className="landing-eyebrow">Workplace safety and compliance services</p>
            <h1>POSH Training Platform</h1>
            <p className="landing-hero-copy">
              A role-based compliance platform for prevention of sexual harassment
              training, employee certification, reporting, and governance.
            </p>
            <div className="landing-hero-actions">
              <Link to="/login" className="landing-primary-btn landing-primary-btn-lg">
                POSH Login <ArrowForwardIcon fontSize="small" />
              </Link>
              <Link to="/signup" className="landing-secondary-btn">
                Create Account
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section landing-services" id="services">
          <div>
            <p className="landing-eyebrow">Our services</p>
            <h2>Compliance work that stays organized</h2>
          </div>
          <div className="landing-service-grid">
            {services.map((service) => {
              const CardTag = service.path ? Link : "article";
              return (
                <CardTag
                  className={`landing-service-card ${service.path ? "landing-service-card-link" : ""}`}
                  key={service.title}
                  {...(service.path ? { to: service.path } : {})}
                >
                  <div className="landing-service-icon">{service.icon}</div>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  {service.path && (
                    <span className="landing-card-cta">
                      View service <ArrowForwardIcon fontSize="small" />
                    </span>
                  )}
                </CardTag>
              );
            })}
          </div>
        </section>

        <section className="landing-split-section">
          <div className="landing-statement landing-statement-vision">
            <ShieldIcon />
            <p className="landing-eyebrow">Vision</p>
            <h2>Safer workplaces with accountable compliance.</h2>
            <p>
              We aim to help organizations build respectful, informed, and
              legally prepared workplaces where every employee understands their
              rights, responsibilities, and support channels.
            </p>
          </div>
          <div className="landing-statement landing-statement-mission">
            <VerifiedUserIcon />
            <p className="landing-eyebrow">Mission</p>
            <h2>Make POSH operations clear, trackable, and trusted.</h2>
            <p>
              Our mission is to simplify training delivery, certification,
              reporting, and role-based administration so clients can manage POSH
              compliance with confidence.
            </p>
          </div>
        </section>

        <section className="landing-section landing-clients">
          <div className="landing-clients-copy">
            <p className="landing-eyebrow">For clients</p>
            <h2>Built for leadership, HR teams, and employees.</h2>
            <p>
              The platform keeps sensitive workflows controlled by role while
              giving every stakeholder the information they need to complete
              their part of the compliance process.
            </p>
          </div>
          <div className="landing-value-list">
            {values.map((value) => (
              <div key={value} className="landing-value-item">
                <VerifiedUserIcon fontSize="small" />
                <span>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
