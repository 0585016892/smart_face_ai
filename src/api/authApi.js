import http, { getApiData } from "./http";

const authApi = {
  async login(credentials) {
    const response = await http.post("/auth/login", credentials);
    return getApiData(response);
  },

  async getMe() {
    const response = await http.get("/auth/me");
    return getApiData(response);
  },
};

export default authApi;
