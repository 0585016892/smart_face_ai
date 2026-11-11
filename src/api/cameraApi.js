import http from "./http";

const handleResponse = (response) => {
  const result = response.data;

  if (result?.success === false) {
    throw new Error(result.message || "Có lỗi xảy ra");
  }

  return result;
};

// =========================
// QUẢN LÝ CAMERA
// =========================

export const getCameras = async (params = {}) => {
  const response = await http.get("/cameras", { params });
  return handleResponse(response);
};

export const getCameraDetail = async (id) => {
  const response = await http.get(`/cameras/${id}`);
  return handleResponse(response);
};

export const createCamera = async (data) => {
  const response = await http.post("/cameras", data);
  return handleResponse(response);
};

export const updateCamera = async (id, data) => {
  const response = await http.put(`/cameras/${id}`, data);
  return handleResponse(response);
};

export const toggleCamera = async (id, is_enabled) => {
  const response = await http.patch(`/cameras/${id}/enabled`, {
    is_enabled,
  });

  return handleResponse(response);
};

export const deleteCamera = async (id) => {
  const response = await http.delete(`/cameras/${id}`);
  return handleResponse(response);
};

// ===============================
// GIÁM SÁT AI TRỰC TIẾP
// ===============================

export const getCameraLiveStatus = async () => {
  const response = await http.get("/cameras/live-status");
  return handleResponse(response);
};

// Ảnh + tracks được trả về cùng một frame.
export const getCameraLiveSnapshot = async (id) => {
  const response = await http.get(`/cameras/${id}/live-snapshot`);
  return handleResponse(response);
};

// Giữ lại để tương thích với những màn hình cũ nếu còn sử dụng.
export const getCameraLiveFrame = async (id) => {
  const response = await http.get(`/cameras/${id}/live-frame`, {
    responseType: "blob",
  });

  return response.data;
};

export const getCameraLiveStreamUrl = (id) => {
  return `${http.defaults.baseURL}/cameras/${id}/live-stream`;
};
