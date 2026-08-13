# POSH Platform Folder Structure

This document explains the frontend and backend folder structure and what the important files do.

## Project Root

```text
posh-platform/
  backend/
  frontend/
  infra/
  .env
  .env.example
  .env.prod
  docker-compose.yml
  docker-compose.prod.yml
  posh_schema.sql
  README.md
```

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI backend application, database models, APIs, services, tests, migrations. |
| `frontend/` | React/Vite frontend application. |
| `infra/` | Infrastructure-related configuration if needed. |
| `.env` | Local environment variables and secrets. Do not commit real secrets. |
| `.env.example` | Example environment variables for local setup. |
| `.env.prod` | Production-style environment template. |
| `docker-compose.yml` | Local Docker stack: MySQL, Redis, MinIO, MailHog, backend, worker, frontend. |
| `docker-compose.prod.yml` | Production Docker Compose setup. |
| `posh_schema.sql` | SQL schema/reference dump. |
| `README.md` | Main project notes. |

## Frontend Structure

Frontend root:

```text
frontend/
  public/
  src/
  Dockerfile
  docker-entrypoint.sh
  eslint.config.js
  index.html
  nginx.conf
  nginx.prod.conf.template
  package.json
  package-lock.json
  vite.config.js
```

| File/Folder | Purpose |
| --- | --- |
| `public/` | Static public assets and runtime config. |
| `src/` | Main React source code. |
| `Dockerfile` | Builds frontend container. |
| `docker-entrypoint.sh` | Runtime container entrypoint. |
| `eslint.config.js` | Frontend lint rules. |
| `index.html` | Vite HTML entry file. |
| `nginx.conf` | Nginx config for frontend container. |
| `nginx.prod.conf.template` | Production Nginx config template. |
| `package.json` | Frontend scripts and dependencies. |
| `package-lock.json` | Locked npm dependency versions. |
| `vite.config.js` | Vite build/dev configuration. |

## Frontend `public/`

```text
frontend/public/
  config.js
  favicon.svg
  icons.svg
```

| File | Purpose |
| --- | --- |
| `config.js` | Runtime frontend configuration such as API URL if used. |
| `favicon.svg` | Browser tab icon. |
| `icons.svg` | Shared static icon asset. |

## Frontend `src/`

```text
frontend/src/
  api/
  assets/
  components/
  features/
  hooks/
  i18n/
  routes/
  store/
  styles/
  utils/
  App.jsx
  App.css
  index.css
  main.jsx
```

| File/Folder | Purpose |
| --- | --- |
| `api/` | Axios client and API helper functions. |
| `assets/` | Frontend images/SVGs. |
| `components/` | Shared UI/layout components. |
| `features/` | Page-level feature modules grouped by user/domain. |
| `hooks/` | Shared React hooks. |
| `i18n/` | Internationalization setup if used. |
| `routes/` | Route guards and access-control wrappers. |
| `store/` | Zustand/global state stores. |
| `styles/` | Shared style objects/helpers. |
| `utils/` | Shared utility functions. |
| `App.jsx` | Main route definitions. |
| `App.css` | App-level CSS. |
| `index.css` | Global CSS/theme variables. |
| `main.jsx` | React app bootstrap entry. |

## Frontend `src/api/`

```text
frontend/src/api/
  auth.js
  client.js
  errors.js
```

| File | Purpose |
| --- | --- |
| `auth.js` | Auth API helpers. |
| `client.js` | Axios instance, base URL, auth token handling. |
| `errors.js` | Converts backend/API errors into display messages. |

## Frontend `src/components/`

```text
frontend/src/components/
  LoadingOverlay.jsx
  PortalShell.jsx
  SessionTimeout.jsx
```

| File | Purpose |
| --- | --- |
| `LoadingOverlay.jsx` | Reusable loading overlay. |
| `PortalShell.jsx` | Main portal layout, burger menu, notifications, search, concern overlay, role-based menu rendering. |
| `SessionTimeout.jsx` | Handles session expiry/timeout behavior. |

## Frontend `src/routes/`

```text
frontend/src/routes/
  ProtectedRoute.jsx
  RoleRoute.jsx
```

| File | Purpose |
| --- | --- |
| `ProtectedRoute.jsx` | Requires a logged-in user before route access. |
| `RoleRoute.jsx` | Enforces allowed roles, permissions, and role-access matrix. |

## Frontend `src/store/`

```text
frontend/src/store/
  authStore.js
```

| File | Purpose |
| --- | --- |
| `authStore.js` | Zustand auth store for token, current user, login/logout state. |

## Frontend `src/utils/`

```text
frontend/src/utils/
  accessControl.js
```

| File | Purpose |
| --- | --- |
| `accessControl.js` | Helper functions for checking frontend permissions/access. |

## Frontend Features

```text
frontend/src/features/
  admin/
  auth/
  certificates/
  dashboard/
  employee/
  hr/
  landing/
  policy/
```

| Folder | Purpose |
| --- | --- |
| `admin/` | Super Admin, Company Admin, Client/Mgmt admin screens. |
| `auth/` | Login, signup, OTP, password reset, SSO callback, unauthorized screen. |
| `certificates/` | Public certificate verification page. |
| `dashboard/` | Common stats/home dashboard. |
| `employee/` | Employee course, assessment, certificate, history screens. |
| `hr/` | HR assignment, compliance, bulk upload, reports. |
| `landing/` | Public landing and POSH service pages. |
| `policy/` | POSH policy page. |

## Frontend `features/admin/`

```text
frontend/src/features/admin/
  AdminAnalyticsPage.jsx
  AdminAuditLogPage.jsx
  AdminConcernsPage.jsx
  AdminConfigPage.jsx
  AdminDashboard.jsx
  AdminReportsPage.jsx
  AdminSettingsPage.jsx
  AssignedWorkOrdersPage.jsx
  CertificateTemplatePage.jsx
  CompanyListPage.jsx
  CompanyRegistrationPage.jsx
  CreateAdminPage.jsx
  EmployeeMasterPage.jsx
  MastersPage.jsx
  PoshOfficeMasterPage.jsx
  RoleAccessMatrixPage.jsx
  UserListPage.jsx
  VideoListPage.jsx
```

| File | Purpose |
| --- | --- |
| `AdminAnalyticsPage.jsx` | Admin/Super Admin analytics. |
| `AdminAuditLogPage.jsx` | Audit-log table view. |
| `AdminConcernsPage.jsx` | Concerns received, review, close workflow. |
| `AdminConfigPage.jsx` | Older/admin configuration screen. |
| `AdminDashboard.jsx` | Admin dashboard page. |
| `AdminReportsPage.jsx` | Admin report page. |
| `AdminSettingsPage.jsx` | Admin settings page. |
| `AssignedWorkOrdersPage.jsx` | Assigned work orders view. |
| `CertificateTemplatePage.jsx` | Upload/delete/configure certificate templates. |
| `CompanyListPage.jsx` | Create Company & Work Order, assign services, submit for approval, approve/delete. |
| `CompanyRegistrationPage.jsx` | Register approved client companies and create Client/Mgmt login. |
| `CreateAdminPage.jsx` | Super Admin creates Company Admin. |
| `EmployeeMasterPage.jsx` | POSH employee master records used in company registration contacts. |
| `MastersPage.jsx` | Country/state/city/scope/deliverables master setup. |
| `PoshOfficeMasterPage.jsx` | POSH office master list. |
| `RoleAccessMatrixPage.jsx` | Role/module access matrix. |
| `UserListPage.jsx` | Hierarchy user creation/listing: Admin -> Client/Mgmt, Client/Mgmt -> HR, HR -> Employee. |
| `VideoListPage.jsx` | Video upload/publish/manage screen. |

## Frontend `features/auth/`

```text
frontend/src/features/auth/
  ChangePasswordPage.jsx
  EntraCallbackPage.jsx
  ForgotPasswordPage.jsx
  LoginPage.jsx
  OTPPage.jsx
  OwnerAdminSetupPage.jsx
  ResetPasswordPage.jsx
  SignupPage.jsx
  UnauthorizedPage.jsx
```

| File | Purpose |
| --- | --- |
| `ChangePasswordPage.jsx` | Logged-in password change. |
| `EntraCallbackPage.jsx` | Microsoft Entra SSO callback. |
| `ForgotPasswordPage.jsx` | Forgot password form. |
| `LoginPage.jsx` | Login UI and error display. |
| `OTPPage.jsx` | OTP verification UI. |
| `OwnerAdminSetupPage.jsx` | Owner/admin setup screen. |
| `ResetPasswordPage.jsx` | Reset password using token. |
| `SignupPage.jsx` | Signup page file kept but hidden from main flow. |
| `UnauthorizedPage.jsx` | Access denied screen. |

## Frontend `features/hr/`

```text
frontend/src/features/hr/
  BulkUploadPage.jsx
  CompliancePage.jsx
  HRDashboard.jsx
  HRReportsPage.jsx
  TrainingAssignPage.jsx
```

| File | Purpose |
| --- | --- |
| `BulkUploadPage.jsx` | Bulk employee upload. |
| `CompliancePage.jsx` | Compliance tracking. |
| `HRDashboard.jsx` | HR dashboard. |
| `HRReportsPage.jsx` | HR reports. |
| `TrainingAssignPage.jsx` | Assign training to employee, department, or whole company. |

## Frontend `features/employee/`

```text
frontend/src/features/employee/
  AssessmentPage.jsx
  CertificatesPage.jsx
  CoursesPage.jsx
  EmployeeDashboard.jsx
  TrainingHistoryPage.jsx
  VideoPlayerPage.jsx
```

| File | Purpose |
| --- | --- |
| `AssessmentPage.jsx` | Employee assessment page. |
| `CertificatesPage.jsx` | Employee certificate list/download. |
| `CoursesPage.jsx` | Assigned courses list. |
| `EmployeeDashboard.jsx` | Employee dashboard. |
| `TrainingHistoryPage.jsx` | Training history. |
| `VideoPlayerPage.jsx` | Training video player and progress tracking. |

## Frontend Other Feature Folders

| File | Purpose |
| --- | --- |
| `features/certificates/CertificateVerifyPage.jsx` | Public certificate verification. |
| `features/dashboard/StatsHomePage.jsx` | Common home/dashboard stats page. |
| `features/landing/LandingPage.jsx` | Public landing page. |
| `features/landing/PoshServicePage.jsx` | POSH service detail page. |
| `features/policy/PoshPolicyPage.jsx` | POSH policy view/edit/upload. |

## Backend Structure

Backend root:

```text
backend/
  alembic/
  app/
  tests/
  Dockerfile
  alembic.ini
  pyproject.toml
  requirements.txt
```

| File/Folder | Purpose |
| --- | --- |
| `alembic/` | Database migrations. |
| `app/` | Main FastAPI source code. |
| `tests/` | Backend pytest tests. |
| `Dockerfile` | Backend container image build. |
| `alembic.ini` | Alembic migration config. |
| `pyproject.toml` | Python tooling config. |
| `requirements.txt` | Backend Python dependencies. |

## Backend `app/`

```text
backend/app/
  api/
  core/
  db/
  models/
  repositories/
  schemas/
  services/
  workers/
  main.py
  __init__.py
```

| File/Folder | Purpose |
| --- | --- |
| `api/` | FastAPI route definitions. |
| `core/` | Configuration, security, email, storage, dependencies. |
| `db/` | Database session/base/seed helpers. |
| `models/` | SQLAlchemy database table models. |
| `repositories/` | Repository layer placeholder. |
| `schemas/` | Pydantic request/response schemas. |
| `services/` | Business logic. |
| `workers/` | Celery background worker setup. |
| `main.py` | FastAPI app startup, router includes, seed, health endpoint. |
| `__init__.py` | Python package marker. |

## Backend `api/v1/`

```text
backend/app/api/v1/
  admin.py
  admin_config.py
  analytics.py
  assessments.py
  auth.py
  certificates.py
  company.py
  concerns.py
  employee.py
  hr.py
  notifications.py
  policy.py
  users.py
  videos.py
```

| File | Purpose |
| --- | --- |
| `admin.py` | Admin utility endpoints. |
| `admin_config.py` | Master codes, POSH office, role-access matrix APIs. |
| `analytics.py` | Analytics endpoints. |
| `assessments.py` | Assessment question/result endpoints. |
| `auth.py` | Login, signup, OTP, refresh, SSO, forgot/reset password. |
| `certificates.py` | Certificate template, issue, verify, download APIs. |
| `company.py` | Company, work order, approval, employee master, client admin creation APIs. |
| `concerns.py` | Report concern and concerns received APIs. |
| `employee.py` | Employee-facing courses, history, certificate APIs. |
| `hr.py` | HR upload, employee list, training assignment, compliance APIs. |
| `notifications.py` | Notification APIs. |
| `policy.py` | POSH policy APIs. |
| `users.py` | User hierarchy management APIs. |
| `videos.py` | Video upload, publish, list, playback APIs. |

## Backend `core/`

```text
backend/app/core/
  config.py
  dependencies.py
  email.py
  security.py
  storage.py
```

| File | Purpose |
| --- | --- |
| `config.py` | Reads environment variables into settings. |
| `dependencies.py` | Auth/current-user/role/permission dependencies. |
| `email.py` | SMTP email sending for OTP, reset, welcome, certificates, approval emails. |
| `security.py` | Password hashing and JWT helpers. |
| `storage.py` | File/object storage helper. |

## Backend `db/`

```text
backend/app/db/
  base.py
  seed.py
  session.py
```

| File | Purpose |
| --- | --- |
| `base.py` | SQLAlchemy base import/metadata setup. |
| `seed.py` | Seed helper logic. |
| `session.py` | Async database engine and session factory. |

## Backend `models/`

```text
backend/app/models/
  analytics.py
  auth.py
  certificate.py
  company.py
  concern.py
  hr.py
  language.py
  notification.py
  policy.py
  role.py
  training.py
  user.py
  video.py
```

| File | Purpose |
| --- | --- |
| `analytics.py` | Analytics summary model. |
| `auth.py` | OTP, refresh token, login attempt, lockout models. |
| `certificate.py` | Certificate and certificate template models. |
| `company.py` | Company master model. |
| `concern.py` | Concern/complaint model. |
| `hr.py` | HR upload/batch models. |
| `language.py` | Language model. |
| `notification.py` | Notification model. |
| `policy.py` | POSH policy model. |
| `role.py` | Role/permission models. |
| `training.py` | Course assignment and training history models. |
| `user.py` | User master model. |
| `video.py` | Video/category/quality/language models. |

## Backend `schemas/`

```text
backend/app/schemas/
  admin_config.py
  assessment.py
  auth.py
  certificate.py
  company.py
  concern.py
  employee.py
  hr.py
  policy.py
  user.py
  video.py
```

| File | Purpose |
| --- | --- |
| `admin_config.py` | Request/response schemas for masters and role access. |
| `assessment.py` | Assessment schemas. |
| `auth.py` | Login/signup/password/SSO schemas. |
| `certificate.py` | Certificate/template schemas. |
| `company.py` | Company, registration, employee-master schemas. |
| `concern.py` | Concern schemas. |
| `employee.py` | Employee-facing schemas. |
| `hr.py` | HR upload/training assignment schemas. |
| `policy.py` | POSH policy schemas. |
| `user.py` | User create/update/response/password schemas. |
| `video.py` | Video schemas. |

## Backend `services/`

```text
backend/app/services/
  assessment_service.py
  audit_service.py
  auth_service.py
  certificate_service.py
  company_service.py
  employee_service.py
  hr_service.py
  notification_service.py
  user_service.py
  video_service.py
```

| File | Purpose |
| --- | --- |
| `assessment_service.py` | Assessment scoring, attempt handling, certificate trigger logic. |
| `audit_service.py` | Writes audit logs. |
| `auth_service.py` | Login, signup, OTP, lockout, refresh, forgot/reset password logic. |
| `certificate_service.py` | Certificate template handling and PDF generation. |
| `company_service.py` | Company/work-order/registration/employee-master business logic. |
| `employee_service.py` | Employee-facing course/history/certificate logic. |
| `hr_service.py` | Bulk upload, employee list, training assignment, compliance/report logic. |
| `notification_service.py` | Notification creation and listing. |
| `user_service.py` | User CRUD, password generation/reset, hierarchy listing support. |
| `video_service.py` | Video upload, list, publish, language/quality support. |

## Backend `workers/`

```text
backend/app/workers/
  celery_app.py
```

| File | Purpose |
| --- | --- |
| `celery_app.py` | Celery app configuration for background jobs. |

## Backend `alembic/`

```text
backend/alembic/
  env.py
  script.py.mako
  versions/
```

| File/Folder | Purpose |
| --- | --- |
| `env.py` | Alembic runtime migration environment. |
| `script.py.mako` | Template for new migration files. |
| `versions/` | Migration scripts. |

Migration files:

| File | Purpose |
| --- | --- |
| `d04a5453da29_initial_tables_company_role_user.py` | Initial company, role, user tables. |
| `4f606a040db9_add_phase2_video_training_tables.py` | Video/training tables. |
| `050d91b6c437_add_phase3_hr_notification_tables.py` | HR/notification tables. |
| `71a229ca0ac3_add_phase4_certificate_analytics_tables.py` | Certificate/analytics tables. |
| `9b8f0c2d7a61_add_video_id_to_certificates.py` | Adds video relation to certificates. |
| `11443287d861_add_auth_tables.py` | Auth-related tables. |
| `411aca5c39c9_add_auth_tables.py` | Auth-related migration. |
| `56131bb94a6f_add_auth_tables.py` | Auth-related migration. |

## Backend `tests/`

```text
backend/tests/
  test_auth.py
  test_certificates.py
  test_health.py
  test_hr.py
  test_video.py
```

| File | Purpose |
| --- | --- |
| `test_auth.py` | Auth tests. |
| `test_certificates.py` | Certificate tests. |
| `test_health.py` | Health endpoint tests. |
| `test_hr.py` | HR workflow tests. |
| `test_video.py` | Video workflow tests. |

## Main Flow File Map

| Flow | Frontend Files | Backend Files |
| --- | --- | --- |
| Login/Auth | `features/auth/*`, `store/authStore.js`, `api/auth.js` | `api/v1/auth.py`, `services/auth_service.py`, `core/security.py`, `core/email.py` |
| RBAC/Menu | `components/PortalShell.jsx`, `routes/RoleRoute.jsx` | `api/v1/admin_config.py`, `core/dependencies.py` |
| Super Admin creates Company Admin | `features/admin/CreateAdminPage.jsx` | `api/v1/users.py`, `services/user_service.py` |
| Masters | `features/admin/MastersPage.jsx` | `api/v1/admin_config.py` |
| Company & Work Order | `features/admin/CompanyListPage.jsx` | `api/v1/company.py`, `services/company_service.py` |
| Company Registration | `features/admin/CompanyRegistrationPage.jsx` | `api/v1/company.py`, `services/company_service.py`, `api/v1/users.py` |
| Employee Master | `features/admin/EmployeeMasterPage.jsx` | `api/v1/company.py`, `services/company_service.py` |
| User Hierarchy | `features/admin/UserListPage.jsx` | `api/v1/users.py`, `services/user_service.py` |
| Videos | `features/admin/VideoListPage.jsx`, `features/employee/VideoPlayerPage.jsx` | `api/v1/videos.py`, `services/video_service.py` |
| HR Training Assignment | `features/hr/TrainingAssignPage.jsx` | `api/v1/hr.py`, `services/hr_service.py` |
| Assessments | `features/employee/AssessmentPage.jsx` | `api/v1/assessments.py`, `services/assessment_service.py` |
| Certificates | `features/admin/CertificateTemplatePage.jsx`, `features/employee/CertificatesPage.jsx`, `features/certificates/CertificateVerifyPage.jsx` | `api/v1/certificates.py`, `services/certificate_service.py` |
| Concerns | `components/PortalShell.jsx`, `features/admin/AdminConcernsPage.jsx` | `api/v1/concerns.py` |
| Notifications | `components/PortalShell.jsx` | `api/v1/notifications.py`, `services/notification_service.py` |
| POSH Policy | `features/policy/PoshPolicyPage.jsx` | `api/v1/policy.py`, `models/policy.py` |
| Analytics/Reports | `features/admin/AdminAnalyticsPage.jsx`, `features/hr/HRReportsPage.jsx` | `api/v1/analytics.py`, `services/hr_service.py` |

## Quick Commands

Frontend:

```powershell
cd C:\Users\mohan\Downloads\Project\Implementation\posh-platform\frontend
npm.cmd run lint
npm.cmd run build
```

Backend:

```powershell
cd C:\Users\mohan\Downloads\Project\Implementation\posh-platform\backend
pytest
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Full Docker stack:

```powershell
cd C:\Users\mohan\Downloads\Project\Implementation\posh-platform
docker compose up --build
```
