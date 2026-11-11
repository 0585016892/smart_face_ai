import http from "./http";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};

export const getTelegramLinkStatus = async () => {
  const response = await http.get("/telegram/link-status");
  return unwrap(response);
};

export const createTelegramLinkCode = async () => {
  const response = await http.post("/telegram/link-code");
  return unwrap(response);
};

export const updateTelegramPreferences = async (preferences) => {
  const response = await http.patch("/telegram/preferences", preferences);
  return unwrap(response);
};

export const unlinkTelegram = async () => {
  const response = await http.delete("/telegram/unlink");
  return unwrap(response);
};
