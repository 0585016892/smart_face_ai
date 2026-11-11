import http from "./http";

export const getSystemSettings = async () => {
  const response = await http.get("/system-settings");
  return response?.data?.data ?? {};
};

export const updateSystemSettings = async (settings) => {
  const response = await http.patch("/system-settings", { settings });
  return response?.data?.data ?? {};
};
