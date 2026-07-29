import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import CloseIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";
import { canAccess } from "../utils/accessControl";

const roleLabels = {
  1: "Super Admin",
  2: "Admin",
  5: "Client / Management",
  3: "HR / IC",
  4: "Employee",
};

function navForRole(roleId) {
  if (roleId === 4) {
    return [
      { label: "Home (Stats)", to: "/dashboard", icon: <DashboardIcon fontSize="small" /> },
      {
        label: "POSH Awareness Training",
        to: "/employee/courses",
        icon: <PlayCircleIcon fontSize="small" />,
        requiredPermission: "courses.watch",
      },
      { label: "Assessment & Certificate", to: "/employee/certificates", icon: <BadgeIcon fontSize="small" /> },
      { label: "Training History", to: "/employee/history", icon: <HistoryIcon fontSize="small" /> },
    ];
  }
  if (roleId === 3) {
    return [
      { label: "Home (Stats)", to: "/dashboard", icon: <DashboardIcon fontSize="small" /> },
      {
        label: "Employees",
        to: "/hr/users",
        icon: <GroupsIcon fontSize="small" />,
        requiredPermission: "users.manage",
      },
      {
        label: "Employee Upload",
        to: "/hr/upload",
        icon: <UploadFileIcon fontSize="small" />,
        requiredPermission: "users.manage",
      },
      {
        label: "Training Assignment",
        to: "/hr/assign",
        icon: <PlayCircleIcon fontSize="small" />,
        requiredPermission: "training.assign",
      },
      {
        label: "Reports",
        to: "/hr/reports",
        icon: <DownloadIcon fontSize="small" />,
        requiredPermission: "reports.view",
      },
    ];
  }
  if (roleId === 5) {
    return [
      { label: "Home (Stats)", to: "/dashboard", icon: <DashboardIcon fontSize="small" /> },
      {
        label: "Users",
        to: "/admin/users",
        icon: <GroupsIcon fontSize="small" />,
        requiredPermission: "users.manage",
      },
    ];
  }
  return [
    { label: "Home (Stats)", to: "/dashboard", icon: <DashboardIcon fontSize="small" /> },
    {
      label: "Companies",
      to: "/admin/companies",
      icon: <AdminPanelSettingsIcon fontSize="small" />,
      allowedRoles: [1],
    },
    {
      label: "Users",
      to: "/admin/users",
      icon: <GroupsIcon fontSize="small" />,
      requiredPermission: "users.manage",
    },
    {
      label: "Videos",
      to: "/admin/videos",
      icon: <PlayCircleIcon fontSize="small" />,
      requiredPermission: "videos.manage",
    },
    {
      label: "Certificates",
      to: "/admin/certificates",
      icon: <BadgeIcon fontSize="small" />,
      requiredPermission: "certificates.manage",
    },
    {
      label: "Analytics & Reports",
      to: "/admin/analytics",
      icon: <AssessmentIcon fontSize="small" />,
      requiredPermission: "reports.view",
    },
    {
      label: "Audit Logs",
      to: "/admin/audit-logs",
      icon: <HistoryIcon fontSize="small" />,
      requiredPermission: "reports.view",
    },
  ];
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
  const [concern, setConcern] = useState({
    category: "Workplace concern",
    message: "",
  });
  const [concernMessage, setConcernMessage] = useState("");
  const items = navForRole(user?.role_id).filter((item) => canAccess(user, item));
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

  const openPanel = (panel) => {
    setActivePanel((current) => (current === panel ? "" : panel));
    setConcernMessage("");
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

  const submitConcern = (event) => {
    event.preventDefault();
    setConcernMessage("Concern details are ready. Please share this with your administrator or POSH committee contact.");
    setConcern({ category: "Workplace concern", message: "" });
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
              className="portal-primary-btn"
              onClick={() => openPanel("concern")}
            >
              <ReportProblemIcon fontSize="small" /> Report a Concern
            </button>
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

        {activePanel === "concern" && (
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
