import http from "./http";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};

export const getUsers = async (params = {}) => {
  const response = await http.get("/users", { params });
  const result = response?.data ?? {};

  return {
    items: Array.isArray(result.data) ? result.data : [],
    pagination: result.pagination || {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      total: 0,
      totalPages: 0,
    },
  };
};

export const getUserDetail = async (id) => {
  const response = await http.get(`/users/${id}`);
  return unwrap(response);
};

export const createUser = async (data) => {
  const response = await http.post("/users", data);
  return unwrap(response);
};

export const updateUser = async (id, data) => {
  const response = await http.patch(`/users/${id}`, data);
  return unwrap(response);
};

export const updateUserStatus = async (id, status) => {
  const response = await http.patch(`/users/${id}/status`, { status });
  return unwrap(response);
};

export const resetUserPassword = async (id, password) => {
  const response = await http.patch(`/users/${id}/password`, { password });
  return unwrap(response);
};
