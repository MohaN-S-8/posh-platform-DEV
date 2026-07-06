import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionTimeout } from "./components/SessionTimeout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";

// Auth screens
import { LoginPage } from "./features/auth/LoginPage";
import { SignupPage } from "./features/auth/SignupPage";
import { OTPPage } from "./features/auth/OTPPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { UnauthorizedPage } from "./features/auth/UnauthorizedPage";
import { ChangePasswordPage } from "./features/auth/ChangePasswordPage";
import { EntraCallbackPage } from "./features/auth/EntraCallbackPage";
import { OwnerAdminSetupPage } from "./features/auth/OwnerAdminSetupPage";

// Admin portal
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { CompanyListPage } from "./features/admin/CompanyListPage";
import { UserListPage } from "./features/admin/UserListPage";
import { VideoListPage } from "./features/admin/VideoListPage";
import { AdminAuditLogPage } from "./features/admin/AdminAuditLogPage";
import { AdminAnalyticsPage } from "./features/admin/AdminAnalyticsPage";
import { AdminReportsPage } from "./features/admin/AdminReportsPage";
import { AdminSettingsPage } from "./features/admin/AdminSettingsPage";
import { CertificateTemplatePage } from "./features/admin/CertificateTemplatePage";
import { CertificateVerifyPage } from "./features/certificates/CertificateVerifyPage";

// HR portal
import { HRDashboard } from "./features/hr/HRDashboard";
import { BulkUploadPage } from "./features/hr/BulkUploadPage";
import { TrainingAssignPage } from "./features/hr/TrainingAssignPage";
import { CompliancePage } from "./features/hr/CompliancePage";
import { HRReportsPage } from "./features/hr/HRReportsPage";

// Employee portal
import { EmployeeDashboard } from "./features/employee/EmployeeDashboard";
import { CoursesPage } from "./features/employee/CoursesPage";
import { VideoPlayerPage } from "./features/employee/VideoPlayerPage";
import { AssessmentPage } from "./features/employee/AssessmentPage";
import { CertificatesPage } from "./features/employee/CertificatesPage";
import { TrainingHistoryPage } from "./features/employee/TrainingHistoryPage";

function App() {
  return (
    <BrowserRouter>
      <SessionTimeout />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<OTPPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sso/entra/callback" element={<EntraCallbackPage />} />
        <Route
          path="/certificates/verify/:certificateNumber"
          element={<CertificateVerifyPage />}
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/admin-setup"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]}>
                <OwnerAdminSetupPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/company-owner-setup"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]}>
                <OwnerAdminSetupPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/owner-setup"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]}>
                <OwnerAdminSetupPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Admin / management portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <AdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]}>
                <CompanyListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <UserListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/videos"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <VideoListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <CertificateTemplatePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <AdminAuditLogPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <AdminAnalyticsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <AdminReportsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2]}>
                <AdminSettingsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* HR / IC portal */}
        <Route
          path="/hr"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <HRDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/upload"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <BulkUploadPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/users"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <UserListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/assign"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <TrainingAssignPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/videos"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <VideoListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/compliance"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <CompliancePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/reports"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <HRReportsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Employee portal — all authenticated users */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <EmployeeDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/courses"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <CoursesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/video/:videoId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <VideoPlayerPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/assessment/:videoId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <AssessmentPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <CertificatesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/history"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[4]}>
                <TrainingHistoryPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
