import apiClient from "./client";

// Shape reference (JS has no interfaces, so keep this as a comment):
// SignupData: { first_name, last_name, email, password, confirm_password, mobile }
// LoginData:  { email, password }

export const authApi = {
  signup: (data) => apiClient.post("/auth/signup", data),

  verifyOtp: (email, otp) => apiClient.post("/auth/verify-otp", { email, otp }),

  login: (data) => apiClient.post("/auth/login", data),

  entraStart: () => apiClient.get("/auth/sso/entra/start"),

  logout: () => apiClient.post("/auth/logout"),

  forgotPassword: (email) => apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (token, new_password, confirm_password) =>
    apiClient.post("/auth/reset-password", {
      token,
      new_password,
      confirm_password,
    }),
};
