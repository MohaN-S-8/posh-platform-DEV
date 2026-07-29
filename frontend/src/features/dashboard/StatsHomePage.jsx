import { useAuthStore } from "../../store/authStore";
import { AdminDashboard } from "../admin/AdminDashboard";
import { HRDashboard } from "../hr/HRDashboard";
import { EmployeeDashboard } from "../employee/EmployeeDashboard";

export function StatsHomePage() {
  const { user } = useAuthStore();

  if (user?.role_id === 1 || user?.role_id === 2 || user?.role_id === 5) {
    return <AdminDashboard />;
  }

  if (user?.role_id === 3) {
    return <HRDashboard />;
  }

  return <EmployeeDashboard />;
}

export default StatsHomePage;
