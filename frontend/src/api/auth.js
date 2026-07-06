import apiClient from "./client";

// SignupData: { first_name, last_name, email, password, confirm_password, mobile }
// LoginData:  { email, password }

export const authApi = {
  signup: (data) => apiClient.post("/auth/signup", data),

  verifyOtp: (email, otp) =>
    apiClient.post("/auth/verify-otp", {
      email,
      otp,
    }),

  login: ({ email, password }) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    return apiClient.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  },

  entraStart: () => apiClient.get("/auth/sso/entra/start"),

  logout: () => apiClient.post("/auth/logout"),

  forgotPassword: (email) =>
    apiClient.post("/auth/forgot-password", {
      email,
    }),

  resetPassword: (token, new_password, confirm_password) =>
    apiClient.post("/auth/reset-password", {
      token,
      new_password,
      confirm_password,
    }),
};
