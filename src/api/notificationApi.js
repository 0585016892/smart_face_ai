import http from "./http";

const handleResponse = (response) => {
  const result = response.data;

  if (result?.success === false) {
    throw new Error(result.message || "Có lỗi xảy ra");
  }

  return result?.data ?? result;
};

const notificationApi = {
  getList: async (params = {}) => {
    const response = await http.get("/notifications", {
      params,
    });

    return handleResponse(response);
  },

  getStats: async (params = {}) => {
    const response = await http.get("/notifications/stats", {
      params,
    });

    return handleResponse(response);
  },

  getDetail: async (id) => {
    const response = await http.get(`/notifications/${id}`);

    return handleResponse(response);
  },

  remove: async (id) => {
    const response = await http.delete(`/notifications/${id}`);

    return handleResponse(response);
  },
};

export default notificationApi;
