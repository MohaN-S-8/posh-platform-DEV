const ROLE_DEFAULT_PERMISSIONS = {
  1: [
    "users.manage",
    "videos.upload",
    "videos.manage",
    "certificates.manage",
    "reports.view",
    "training.assign",
    "courses.watch",
  ],
  2: [
    "users.manage",
    "videos.manage",
    "certificates.manage",
    "reports.view",
    "training.assign",
  ],
  5: ["users.manage"],
  3: ["users.manage", "training.assign"],
  4: ["courses.watch"],
};

export function permissionsForUser(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions)) return user.permissions;
  return ROLE_DEFAULT_PERMISSIONS[user.role_id] || [];
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (user?.role_id === 1) return true;
  return permissionsForUser(user).includes(permission);
}

export function canAccess(user, item) {
  if (!user) return false;
  if (item.allowedRoles && !item.allowedRoles.includes(user.role_id)) return false;
  if (item.requiredPermission && !hasPermission(user, item.requiredPermission)) {
    return false;
  }
  return true;
}
