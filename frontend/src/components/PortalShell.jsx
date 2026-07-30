import CloseIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FolderIcon from "@mui/icons-material/Folder";
import BusinessIcon from "@mui/icons-material/Business";
import DescriptionIcon from "@mui/icons-material/Description";
import BadgeIcon from "@mui/icons-material/Badge";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LockIcon from "@mui/icons-material/Lock";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PolicyIcon from "@mui/icons-material/Policy";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SearchIcon from "@mui/icons-material/Search";
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { apiErrorMessage } from "../api/errors";
import { useAuthStore } from "../store/authStore";
import { canAccess } from "../utils/accessControl";

const roleLabels = {
  1: "Super Admin",
  2: "Company Admin",
  5: "Client Admin (Mgmt)",
  3: "HR",
  4: "Employee",
};

const defaultAllowed = {
  "Super Admin": new Set([
    "Home",
    "Create Admin",
    "Masters (State/City/Scope)",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
    "PoSH Office Master",
    "Role & Access Matrix",
  ]),
  "Company Admin": new Set([
    "Home",
    "PoSH Policy",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Analytics & Reports",
  ]),
  "Client Admin (Mgmt)": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Analytics & Reports",
    "Employee Master - PoSH",
  ]),
  HR: new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Complaints",
    "Employee Master - PoSH",
  ]),
  Employee: new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Complaints",
  ]),
};

const accessItemAliases = {
  "Home Page": "Home",
  "Assessment & Certificates": "Assessment & Certificate",
  "Raise POSH Complaints": "POSH Complaints",
};

const normalizeAccessItem = (accessItem) => accessItemAliases[accessItem] || accessItem;

const moduleCatalog = [
  {
    accessItem: "Home",
    label: "Dashboard",
    to: () => "/dashboard",
    icon: <DashboardIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "PoSH Policy",
    label: "PoSH Policy",
    to: () => "/posh-policy",
    icon: <PolicyIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "POSH Awareness Training",
    label: "POSH Awareness Training",
    to: (roleId) => {
      if (roleId === 4) return "/employee/courses";
      if (roleId === 3) return "/hr/assign";
      if (roleId === 1) return "/super-admin/videos";
      if (roleId === 2) return "/admin/videos";
      return "/admin/videos";
    },
    icon: <PlayCircleIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "IC Training",
    label: "IC Training",
    to: (roleId) => {
      if (roleId === 1) return "/super-admin/videos";
      if (roleId === 3) return "/hr/assign";
      return "/admin/videos";
    },
    icon: <PlayCircleIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Advance Training",
    label: "Advance Training",
    to: (roleId) => (roleId === 1 ? "/super-admin/videos" : "/admin/videos"),
    icon: <PlayCircleIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Assessment & Certificate",
    label: "Assessment & Certificates",
    to: (roleId) => {
      if (roleId === 1) return "/super-admin/certificates";
      return roleId === 4 ? "/employee/certificates" : "/admin/certificates";
    },
    icon: <AssessmentIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "POSH Compliance",
    label: "POSH Compliance",
    to: (roleId) => (roleId === 1 ? "/super-admin/compliance" : "/hr/compliance"),
    icon: <AssessmentIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "POSH Complaints",
    label: "Concerns Received",
    to: (roleId) => (roleId === 1 ? "/super-admin/concerns" : "/admin/concerns"),
    icon: <ReportProblemIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "POSH Audit",
    label: "POSH Audit",
    to: (roleId) => (roleId === 1 ? "/super-admin/audit-logs" : "/admin/audit-logs"),
    icon: <DescriptionIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Analytics & Reports",
    label: "Analytics & Reports",
    to: (roleId) => {
      if (roleId === 1) return "/super-admin/analytics";
      return roleId === 3 ? "/hr/reports" : "/admin/analytics";
    },
    icon: <AssessmentIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Create Admin",
    label: "Create Admin",
    to: () => "/super-admin/create-admin",
    icon: <PersonAddIcon fontSize="small" />,
    allowedRoles: [1],
  },
  {
    accessItem: "Masters (State/City/Scope)",
    label: "Masters (State/City/Scope)",
    to: () => "/super-admin/masters",
    icon: <FolderIcon fontSize="small" />,
    allowedRoles: [1],
  },
  {
    accessItem: "Create Company & Work Order",
    label: "Create Company & Work Order",
    to: (roleId) => (roleId === 1 ? "/super-admin/companies" : "/admin/companies"),
    icon: <BusinessIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Company Registration - PoSH",
    label: "Company Registration - PoSH",
    to: (roleId) => (roleId === 1 ? "/super-admin/company-registration" : "/admin/company-registration"),
    icon: <DescriptionIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "Employee Master - PoSH",
    label: "Employee Master - PoSH",
    to: (roleId) => {
      if (roleId === 3) return "/hr/users";
      if (roleId === 5) return "/admin/users";
      if (roleId === 2) return "/admin/users";
      return "/super-admin/employee-master";
    },
    icon: <BadgeIcon fontSize="small" />,
    allowedRoles: [1, 2, 3, 4, 5],
  },
  {
    accessItem: "PoSH Office Master",
    label: "PoSH Office Master",
    to: () => "/super-admin/posh-office-master",
    icon: <AccountBalanceIcon fontSize="small" />,
    allowedRoles: [1],
  },
  {
    accessItem: "Role & Access Matrix",
    label: "Role & Access Matrix",
    to: () => "/super-admin/role-access",
    icon: <LockIcon fontSize="small" />,
    allowedRoles: [1],
  },
];

function navForRole(roleId, enabledAccessItems) {
  return moduleCatalog
    .filter(
      (item) =>
        item.allowedRoles.includes(roleId) &&
        enabledAccessItems.has(item.accessItem),
    )
    .map((item) => ({
      label: item.label,
      to: item.to(roleId),
      icon: item.icon,
      allowedRoles: [roleId],
    }))
    .filter((item) => item.to);
}

export function PortalShell({ title, subtitle, children }) {
  const navigate = useNavigate();
  const { clearAuth, user } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 860,
  );
  const [activePanel, setActivePanel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState("");
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [roleAccess, setRoleAccess] = useState([]);
  const [concern, setConcern] = useState({
    category: "Workplace concern",
    message: "",
  });
  const [concernMessage, setConcernMessage] = useState("");
  const [concernError, setConcernError] = useState("");
  const roleLabel = roleLabels[user?.role_id];
  const enabledAccessItems = useMemo(() => {
    const enabled = new Set(defaultAllowed[roleLabel] || ["Home"]);
    roleAccess.forEach((record) => {
      const accessItem = normalizeAccessItem(record.access_item);
      if (record.is_allowed) {
        enabled.add(accessItem);
      } else {
        enabled.delete(accessItem);
      }
    });
    enabled.add("Home");
    return enabled;
  }, [roleAccess, roleLabel]);
  const items = navForRole(user?.role_id, enabledAccessItems).filter((item) =>
    canAccess(user, item),
  );
  const canReportConcern = false;
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const initials =
    roleLabels[user?.role_id]
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2) || "PP";

  const logout = async () => {
    await clearAuth();
    navigate("/login");
  };

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const syncSidebar = () => setIsMenuOpen(window.innerWidth > 860);
    window.addEventListener("resize", syncSidebar);
    return () => window.removeEventListener("resize", syncSidebar);
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await apiClient.get("/notifications/my");
        setNotifications(res.data || []);
      } catch {
        setNotifications([]);
      }
    };
    loadNotifications();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadRoleAccess = async () => {
      if (!user?.role_id) return;
      try {
        const res = await apiClient.get("/admin-config/my-role-access");
        if (isMounted) setRoleAccess(res.data || []);
      } catch {
        if (isMounted) setRoleAccess([]);
      }
    };
    loadRoleAccess();
    return () => {
      isMounted = false;
    };
  }, [user?.role_id]);

  const openPanel = (panel) => {
    setActivePanel((current) => (current === panel ? "" : panel));
    setConcernMessage("");
    setConcernError("");
  };

  const openNotifications = async () => {
    openPanel("notifications");
    setLoadingNotifications(true);
    setNotificationError("");
    try {
      const res = await apiClient.get("/notifications/my");
      setNotifications(res.data || []);
    } catch {
      setNotificationError("Unable to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markNotificationRead = async (notification) => {
    if (notification.is_read) return;
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item,
      ),
    );
    try {
      await apiClient.patch(`/notifications/${notification.id}/read`);
    } catch {
      setNotificationError("Unable to update notification status.");
    }
  };

  const submitConcern = async (event) => {
    event.preventDefault();
    setConcernMessage("");
    setConcernError("");
    try {
      await apiClient.post("/concerns/", concern);
      setConcernMessage("Concern submitted successfully. Your administrator can review it.");
      setConcern({ category: "Workplace concern", message: "" });
    } catch (err) {
      setConcernError(apiErrorMessage(err, "Unable to submit concern. Please try again."));
    }
  };

  return (
    <div className={`portal-app ${isMenuOpen ? "menu-open" : ""}`}>
      {/* Mobile / drawer overlay backdrop */}
      {isMenuOpen && (
        <div
          className="portal-backdrop"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <aside className={`portal-sidebar ${isMenuOpen ? "open" : ""}`}>
        <div className="portal-logo">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span /> PoSH Portal
          </div>
          <button
            type="button"
            className="portal-sidebar-close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
        <nav className="portal-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className="portal-nav-item"
              onClick={closeMenu}
            >
              <span className="portal-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="portal-sidebar-foot">
          POSH Platform
          <br />
          Logged in as {roleLabels[user?.role_id] || "User"}
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              type="button"
              className="portal-burger-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Toggle Side Burger Menu"
              title="Menu"
            >
              {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <div>
              <h1>{title}</h1>
              {subtitle && <div className="portal-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="portal-topbar-actions">
            <button
              type="button"
              className="portal-icon-btn"
              title="Search"
              aria-label="Search"
              onClick={() => openPanel("search")}
            >
              <SearchIcon fontSize="small" />
            </button>
            <button
              type="button"
              className={`portal-icon-btn ${
                unreadCount > 0 ? "portal-icon-btn-alert" : ""
              }`}
              title="Notifications"
              aria-label="Notifications"
              onClick={openNotifications}
            >
              <NotificationsIcon fontSize="small" />
              {unreadCount > 0 && (
                <span className="portal-notification-count">{unreadCount}</span>
              )}
            </button>
            <button
              type="button"
              className="portal-outline-btn"
              onClick={() => {
                closeMenu();
                navigate("/change-password");
              }}
            >
              Change Password
            </button>
            <button type="button" className="portal-danger-btn" onClick={logout}>
              <LogoutIcon fontSize="small" /> Logout
            </button>
            <div className="portal-avatar">{initials}</div>
            <div className="portal-brand">
              <div className="portal-brand-mark">P</div>
              <div>
                <div className="portal-brand-name">POSH</div>
                <div className="portal-brand-tag">PORTAL</div>
              </div>
            </div>
          </div>
        </header>

        {activePanel === "search" && (
          <section className="portal-action-panel" aria-label="Search navigation">
            <div className="portal-action-panel-head">
              <strong>Search</strong>
              <button type="button" onClick={() => setActivePanel("")}>
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search pages"
              className="portal-action-input"
            />
            <div className="portal-search-results">
              {filteredItems.length === 0 ? (
                <div className="portal-empty-state">No matching pages.</div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    className="portal-search-result"
                    onClick={() => {
                      setActivePanel("");
                      setSearchQuery("");
                      closeMenu();
                      navigate(item.to);
                    }}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {activePanel === "notifications" && (
          <section className="portal-action-panel portal-notification-panel" aria-label="Notifications">
            <div className="portal-action-panel-head">
              <strong>Notifications</strong>
              <button type="button" onClick={() => setActivePanel("")}>
                <CloseIcon fontSize="small" />
              </button>
            </div>
            {loadingNotifications ? (
              <div className="portal-empty-state">Loading notifications...</div>
            ) : notificationError ? (
              <div className="portal-panel-error">{notificationError}</div>
            ) : notifications.length === 0 ? (
              <div className="portal-empty-state">No notifications yet.</div>
            ) : (
              <div className="portal-notification-list">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={`portal-notification-item ${
                      notification.is_read ? "" : "unread"
                    }`}
                    onClick={() => markNotificationRead(notification)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    {notification.created_date && (
                      <small>
                        {new Date(notification.created_date).toLocaleString()}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {canReportConcern && activePanel === "concern" && (
          <div className="portal-modal-backdrop">
            <form className="portal-modal" onSubmit={submitConcern}>
              <div className="portal-action-panel-head">
                <strong>Report a Concern</strong>
                <button type="button" onClick={() => setActivePanel("")}>
                  <CloseIcon fontSize="small" />
                </button>
              </div>
              {concernMessage && (
                <div className="portal-panel-success">{concernMessage}</div>
              )}
              {concernError && (
                <div className="portal-panel-error">{concernError}</div>
              )}
              <label>
                Category
                <select
                  value={concern.category}
                  onChange={(event) =>
                    setConcern({ ...concern, category: event.target.value })
                  }
                  className="portal-action-input"
                >
                  <option>Workplace concern</option>
                  <option>Training issue</option>
                  <option>Certificate issue</option>
                  <option>Technical support</option>
                </select>
              </label>
              <label>
                Details
                <textarea
                  required
                  rows={5}
                  value={concern.message}
                  onChange={(event) =>
                    setConcern({ ...concern, message: event.target.value })
                  }
                  className="portal-action-input"
                  placeholder="Describe the concern"
                />
              </label>
              <div className="portal-modal-actions">
                <button
                  type="button"
                  className="portal-outline-btn"
                  onClick={() => setActivePanel("")}
                >
                  Cancel
                </button>
                <button type="submit" className="portal-primary-btn">
                  Submit
                </button>
              </div>
            </form>
          </div>
        )}
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

PortalShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
};

PortalShell.defaultProps = {
  subtitle: "",
};
