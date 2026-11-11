import http from "./http";

/**
 * Lấy dữ liệu response từ Axios.
 * Backend trả về { success, message, data, pagination? }
 */
const requestData = async (request) => {
  const response = await request;
  const result = response.data;

  if (result?.success === false) {
    throw new Error(result.message || "Không thể tải dữ liệu");
  }

  return result;
};

/**
 * GET /api/recognition/stats/overview
 * Thống kê tổng quan
 */
export const getDashboardOverview = (params = {}) => {
  return requestData(http.get("/recognition/stats/overview", { params }));
};

/**
 * GET /api/recognition-history/stats/daily
 * Thống kê theo ngày
 */
export const getDashboardDailyStats = (params = {}) => {
  return requestData(http.get("/recognition/stats/daily", { params }));
};

/**
 * GET /api/recognition-history/stats/cameras
 * Thống kê theo camera
 */
export const getDashboardCameraStats = (params = {}) => {
  return requestData(http.get("/recognition/stats/cameras", { params }));
};

/**
 * GET /api/recognition-history/events
 * Lấy các sự kiện nhận diện gần đây
 */
export const getDashboardRecentEvents = (params = {}) => {
  return requestData(http.get("/recognition-history/events", { params }));
};

/**
 * Tải toàn bộ dữ liệu Dashboard
 */
export const getDashboardData = async (params = {}) => {
  const [overview, daily, cameras, events] = await Promise.all([
    getDashboardOverview(params.overview || {}),
    getDashboardDailyStats(params.daily || {}),
    getDashboardCameraStats(params.cameras || {}),
    getDashboardRecentEvents(params.events || {}),
  ]);

  return {
    overview: overview.data,
    daily: daily.data,
    cameras: cameras.data,
    events: events.data,
    pagination: events.pagination,
  };
};
