import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

const http = axios.create({
  baseURL: `${(API_URL || "http://localhost:12005").replace(/\/+$/, "")}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tự động gắn JWT
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sfs_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Xử lý lỗi xác thực
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("sfs_token");
      localStorage.removeItem("sfs_user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export const getApiData = (response) => {
  const body = response?.data;

  if (body?.success === false) {
    throw new Error(body.message || "API xử lý không thành công");
  }

  return body?.data ?? body;
};

export const getApiError = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Không thể kết nối đến máy chủ"
  );
};

export default http;
