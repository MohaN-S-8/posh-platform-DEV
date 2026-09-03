import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionTimeout } from "./components/SessionTimeout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";

// Auth screens
import { LoginPage } from "./features/auth/LoginPage";
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
import { AdminConcernsPage } from "./features/admin/AdminConcernsPage";
import { AdminConfigPage } from "./features/admin/AdminConfigPage";
import { AdminReportsPage } from "./features/admin/AdminReportsPage";
import { AssignedWorkOrdersPage } from "./features/admin/AssignedWorkOrdersPage";
import { CreateAdminPage } from "./features/admin/CreateAdminPage";
import { EmployeeMasterPage } from "./features/admin/EmployeeMasterPage";
import { MastersPage } from "./features/admin/MastersPage";
import { PoshOfficeMasterPage } from "./features/admin/PoshOfficeMasterPage";
import { RoleAccessMatrixPage } from "./features/admin/RoleAccessMatrixPage";
import { CertificateTemplatePage } from "./features/admin/CertificateTemplatePage";
import { CertificateVerifyPage } from "./features/certificates/CertificateVerifyPage";
import { LandingPage } from "./features/landing/LandingPage";
import { PoshServicePage } from "./features/landing/PoshServicePage";
import { PoshPolicyPage } from "./features/policy/PoshPolicyPage";

// IC portal
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
import { EmployeeConcernsPage } from "./features/employee/EmployeeConcernsPage";
import { TrainingHistoryPage } from "./features/employee/TrainingHistoryPage";

// Home Stats Page
import { StatsHomePage } from "./features/dashboard/StatsHomePage";

function App() {
  return (
    <BrowserRouter>
      <SessionTimeout />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/services/posh-compliance" element={<PoshServicePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/verify-otp" element={<OTPPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sso/entra/callback" element={<EntraCallbackPage />} />
        <Route
          path="/certificates/verify/:certificateNumber"
          element={<CertificateVerifyPage />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3, 4, 5]} accessItem="Home">
                <StatsHomePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/posh-policy"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 3, 4, 5]}
                accessItem="PoSH Policy"
              >
                <PoshPolicyPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
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
              <RoleRoute allowedRoles={[1, 2, 5]}>
                <AdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[2]} accessItem="Company Setup">
                <CompanyListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/companies"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Company Setup">
                <CompanyListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/company-registration"
          element={<Navigate to="/admin/companies" replace />}
        />
        <Route
          path="/super-admin/company-registration"
          element={<Navigate to="/super-admin/companies" replace />}
        />
        <Route
          path="/admin/employee-master"
          element={<Navigate to="/admin/users" replace />}
        />
        <Route
          path="/super-admin/employee-master"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Employee Master">
                <EmployeeMasterPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/posh-office-master"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Masters">
                <PoshOfficeMasterPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/role-access"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Role & Access Matrix">
                <RoleAccessMatrixPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 5]}
                requiredPermission="users.manage"
                accessItem="Employee Master"
              >
                <UserListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/videos"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 5]}
                requiredPermission="videos.upload"
                accessItem="POSH Awareness Training"
              >
                <VideoListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/videos"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="videos.manage"
                accessItem="POSH Awareness Training"
              >
                <VideoListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 5]}
                requiredPermission="certificates.manage"
                accessItem="Assessment & Certificate"
              >
                <CertificateTemplatePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="certificates.manage"
                accessItem="Assessment & Certificate"
              >
                <CertificateTemplatePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={<Navigate to="/super-admin/audit-logs" replace />}
        />
        <Route
          path="/super-admin/audit-logs"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="reports.view"
                accessItem="Audit"
              >
                <AdminAuditLogPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 3, 5]}
                requiredPermission="reports.view"
                accessItem="Analytics & Reports"
              >
                <AdminAnalyticsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/analytics"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="reports.view"
                accessItem="Analytics & Reports"
              >
                <AdminAnalyticsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]}>
                <AdminConfigPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/create-admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Create Admin">
                <CreateAdminPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/masters"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="Masters">
                <MastersPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/assigned-work-orders"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1, 2, 3]}>
                <AssignedWorkOrdersPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/concerns"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 3, 5]}
                accessItem="POSH Complaints"
              >
                <AdminConcernsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/concerns"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[1]} accessItem="POSH Complaints">
                <AdminConcernsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 5]}
                requiredPermission="reports.view"
                accessItem="Analytics & Reports"
              >
                <AdminReportsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        {/* IC portal */}
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
              <RoleRoute
                allowedRoles={[1, 2]}
                requiredPermission="users.manage"
              >
                <BulkUploadPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/assign"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="training.assign"
                accessItem="POSH Awareness Training"
              >
                <TrainingAssignPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/videos"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2]}
                requiredPermission="videos.manage"
              >
                <VideoListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/compliance"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[2, 5]}
                requiredPermission="reports.view"
                accessItem="POSH Compliance"
              >
                <CompliancePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/compliance"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[3]}
                requiredPermission="reports.view"
                accessItem="POSH Compliance"
              >
                <CompliancePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/compliance"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1]}
                requiredPermission="reports.view"
                accessItem="POSH Compliance"
              >
                <CompliancePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/reports"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[1, 2, 3]}
                requiredPermission="reports.view"
                accessItem="Analytics & Reports"
              >
                <HRReportsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Employee learner portal — Employee and IC self-training */}
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
              <RoleRoute
                allowedRoles={[4]}
                accessItem="POSH Awareness Training"
              >
                <CoursesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ic/training"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[3]}
                accessItem="POSH Awareness Training"
              >
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
          path="/ic/video/:videoId"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[3]}
                accessItem="POSH Awareness Training"
              >
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
          path="/ic/assessment/:videoId"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[3]}
                accessItem="POSH Awareness Training"
              >
                <AssessmentPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[4]}
                accessItem="Assessment & Certificate"
              >
                <CertificatesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ic/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute
                allowedRoles={[3]}
                accessItem="Assessment & Certificate"
              >
                <CertificatesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/concerns"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[3, 4]} accessItem="POSH Complaints">
                <EmployeeConcernsPage />
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
        <Route
          path="/ic/history"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={[3]}>
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
