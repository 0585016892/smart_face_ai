import http from "./http";

// =====================================================
// CẤU HÌNH
// =====================================================

const BASE_URL = "/recognition-history";
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_DELETE_IDS = 500;

// =====================================================
// 1. RESPONSE HELPERS
// =====================================================

/**
 * Lấy dữ liệu thực tế từ Axios response.
 */
const unwrap = (response) => {
  return response?.data ?? response;
};

/**
 * Kiểm tra response API có báo lỗi hay không.
 */
const ensureSuccess = (response) => {
  const result = unwrap(response);

  if (result?.success === false) {
    throw new Error(result.message || "Yêu cầu API thất bại");
  }

  return result;
};

/**
 * Chuẩn hóa response danh sách.
 *
 * Backend:
 * {
 *   success: true,
 *   message: "...",
 *   data: [],
 *   pagination: {}
 * }
 */
const normalizeListResponse = (response, params = {}) => {
  const result = ensureSuccess(response);

  return {
    items: Array.isArray(result?.data) ? result.data : [],
    pagination: {
      page:
        Number(result?.pagination?.page) || Number(params.page) || DEFAULT_PAGE,
      limit:
        Number(result?.pagination?.limit) ||
        Number(params.limit) ||
        DEFAULT_LIMIT,
      total: Number(result?.pagination?.total) || 0,
      total_pages: Number(result?.pagination?.total_pages) || 0,
    },
    message: result?.message || "",
  };
};

/**
 * Chuẩn hóa response chi tiết.
 */
const normalizeDetailResponse = (response) => {
  const result = ensureSuccess(response);
  return result?.data ?? null;
};

// =====================================================
// 2. VALIDATION HELPERS
// =====================================================

/**
 * Kiểm tra ID hợp lệ.
 */
const validateId = (id) => {
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new Error("ID không hợp lệ");
  }

  return id;
};

/**
 * Chuẩn hóa danh sách ID trước khi xóa.
 */
const normalizeIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Vui lòng chọn ít nhất một bản ghi cần xóa");
  }

  const normalized = [
    ...new Set(
      ids
        .map((id) => {
          const value = Number(id);

          return Number.isSafeInteger(value) && value > 0 ? value : null;
        })
        .filter(Boolean),
    ),
  ];

  if (normalized.length === 0) {
    throw new Error("Danh sách ID không hợp lệ");
  }

  if (normalized.length > MAX_DELETE_IDS) {
    throw new Error(`Chỉ được xóa tối đa ${MAX_DELETE_IDS} bản ghi mỗi lần`);
  }

  if (normalized.length !== new Set(ids.map(String)).size) {
    // Các ID không hợp lệ đã được loại bỏ ở bước chuẩn hóa.
    // Không chặn thao tác nếu danh sách còn ID hợp lệ.
  }

  return normalized;
};

/**
 * Chuẩn hóa query params.
 */
const normalizeParams = (params = {}) => {
  const result = { ...params };

  if (result.page !== undefined) {
    result.page = Math.max(1, Number(result.page) || DEFAULT_PAGE);
  }

  if (result.limit !== undefined) {
    result.limit = Math.min(
      100,
      Math.max(1, Number(result.limit) || DEFAULT_LIMIT),
    );
  }

  Object.keys(result).forEach((key) => {
    if (
      result[key] === undefined ||
      result[key] === null ||
      result[key] === ""
    ) {
      delete result[key];
    }
  });

  return result;
};

/**
 * Xử lý response xóa nhiều bản ghi.
 */
const normalizeDeleteResponse = (response) => {
  const result = ensureSuccess(response);

  return {
    ...result,
    deleted_count: Number(
      result?.deleted_count ??
        result?.deletedCount ??
        result?.data?.deleted_count ??
        0,
    ),
  };
};

// =====================================================
// 3. LỊCH SỬ SỰ KIỆN NHẬN DIỆN
// =====================================================

/**
 * Lấy danh sách sự kiện nhận diện.
 *
 * GET /recognition-history/events
 *
 * Params:
 * - page
 * - limit
 * - keyword
 * - status: known | unknown | uncertain
 * - direction: entry | exit | unknown
 * - camera_id
 * - person_id
 * - from
 * - to
 */
export const getRecognitionEvents = async (params = {}) => {
  const query = normalizeParams(params);

  const response = await http.get(`${BASE_URL}/events`, {
    params: query,
  });

  return normalizeListResponse(response, query);
};

/**
 * Lấy chi tiết sự kiện nhận diện.
 *
 * GET /recognition-history/events/:id
 */
export const getRecognitionEventDetail = async (id) => {
  validateId(id);

  const response = await http.get(
    `${BASE_URL}/events/${encodeURIComponent(id)}`,
  );

  return normalizeDetailResponse(response);
};

/**
 * Lấy ảnh snapshot của sự kiện.
 *
 * GET /recognition-history/events/:id/snapshot
 *
 * Trả về:
 * {
 *   blob,
 *   url,
 *   contentType
 * }
 *
 * Nhớ gọi revokeRecognitionSnapshotUrl(url)
 * khi không còn sử dụng ảnh.
 */
export const getRecognitionEventSnapshot = async (id) => {
  validateId(id);

  const response = await http.get(
    `${BASE_URL}/events/${encodeURIComponent(id)}/snapshot`,
    {
      responseType: "blob",
    },
  );

  const blob = response.data;

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Ảnh snapshot không tồn tại hoặc không hợp lệ");
  }

  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    contentType:
      response.headers?.["content-type"] || blob.type || "image/jpeg",
  };
};

/**
 * Giải phóng Object URL của snapshot.
 */
export const revokeRecognitionSnapshotUrl = (url) => {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Xóa một sự kiện nhận diện.
 *
 * Chỉ sử dụng khi backend triển khai:
 * DELETE /recognition-history/events/:id
 */
export const deleteRecognitionEvent = async (id) => {
  validateId(id);

  const response = await http.delete(
    `${BASE_URL}/events/${encodeURIComponent(id)}`,
  );

  return ensureSuccess(response);
};

/**
 * Xóa nhiều sự kiện nhận diện.
 *
 * DELETE /recognition-history/events/bulk
 *
 * Body:
 * {
 *   ids: [1, 2, 3]
 * }
 */
export const deleteBulkRecognitionEvents = async (ids = []) => {
  const normalizedIds = normalizeIds(ids);

  const response = await http.delete(`${BASE_URL}/events/bulk`, {
    data: {
      ids: normalizedIds,
    },
  });

  return normalizeDeleteResponse(response);
};

// =====================================================
// 4. LỊCH SỬ PHIÊN VÀO / RA
// =====================================================

/**
 * Lấy danh sách phiên vào / ra.
 *
 * GET /recognition-history/sessions
 *
 * Params:
 * - page
 * - limit
 * - keyword
 * - status
 * - session_status: open | closed
 * - camera_id
 * - person_id
 * - from
 * - to
 */
export const getRecognitionSessions = async (params = {}) => {
  const query = normalizeParams(params);

  const response = await http.get(`${BASE_URL}/sessions`, {
    params: query,
  });

  return normalizeListResponse(response, query);
};

/**
 * Lấy chi tiết phiên vào / ra.
 *
 * GET /recognition-history/sessions/:id
 */
export const getRecognitionSessionDetail = async (id) => {
  validateId(id);

  const response = await http.get(
    `${BASE_URL}/sessions/${encodeURIComponent(id)}`,
  );

  return normalizeDetailResponse(response);
};

/**
 * Xóa một phiên vào / ra.
 *
 * Chỉ sử dụng khi backend triển khai:
 * DELETE /recognition-history/sessions/:id
 */
export const deleteRecognitionSession = async (id) => {
  validateId(id);

  const response = await http.delete(
    `${BASE_URL}/sessions/${encodeURIComponent(id)}`,
  );

  return ensureSuccess(response);
};

/**
 * Xóa nhiều phiên vào / ra.
 *
 * DELETE /recognition-history/sessions/bulk
 *
 * Body:
 * {
 *   ids: [1, 2, 3]
 * }
 */
export const deleteBulkRecognitionSessions = async (ids = []) => {
  const normalizedIds = normalizeIds(ids);

  const response = await http.delete(`${BASE_URL}/sessions/bulk`, {
    data: {
      ids: normalizedIds,
    },
  });

  return normalizeDeleteResponse(response);
};

// =====================================================
// 5. EXPORT DEFAULT
// =====================================================

const recognitionHistoryApi = {
  getRecognitionEvents,
  getRecognitionEventDetail,
  getRecognitionEventSnapshot,
  revokeRecognitionSnapshotUrl,
  deleteRecognitionEvent,
  deleteBulkRecognitionEvents,

  getRecognitionSessions,
  getRecognitionSessionDetail,
  deleteRecognitionSession,
  deleteBulkRecognitionSessions,
};

export default recognitionHistoryApi;
