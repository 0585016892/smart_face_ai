import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Avatar,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  DoorClosed,
  DoorOpen,
  Eye,
  Filter,
  Fingerprint,
  Image as ImageIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import dayjs from "dayjs";
import "dayjs/locale/vi";

import {
  getRecognitionEvents,
  getRecognitionEventDetail,
  getRecognitionEventSnapshot,
  getRecognitionSessions,
  getRecognitionSessionDetail,
  deleteBulkRecognitionEvents,
  deleteBulkRecognitionSessions,
  revokeRecognitionSnapshotUrl,
} from "../api/recognitionHistoryApi";

import "./css/HistoryPage.css";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = ["50", "100"];

const EVENT_STATUS = {
  known: {
    label: "Đã nhận diện",
    color: "success",
    icon: <CheckCircle2 size={13} />,
  },
  unknown: {
    label: "Người lạ",
    color: "error",
    icon: <ShieldAlert size={13} />,
  },
  uncertain: {
    label: "Chưa chắc chắn",
    color: "warning",
    icon: <AlertCircle size={13} />,
  },
};

const SESSION_STATUS = {
  open: { label: "Đang hoạt động", color: "processing" },
  active: { label: "Đang hoạt động", color: "processing" },
  closed: { label: "Đã đóng", color: "default" },
  completed: { label: "Đã kết thúc", color: "success" },
};

const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "--";
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === "") return "--";

  const number = Number(value);
  if (!Number.isFinite(number)) return "--";

  return `${(number <= 1 ? number * 100 : number).toFixed(1)}%`;
};

const getStatus = (status) => {
  const key = String(status || "").toLowerCase();

  return (
    EVENT_STATUS[key] || {
      label: status || "Không xác định",
      color: "default",
      icon: <AlertCircle size={13} />,
    }
  );
};

const getSessionStatus = (status) => {
  const key = String(status || "").toLowerCase();

  return (
    SESSION_STATUS[key] || {
      label: status || "Không xác định",
      color: "default",
    }
  );
};

const getPersonName = (record) => {
  if (
    record?.recognition_status === "unknown" ||
    record?.person_name === "Người lạ"
  ) {
    return "Người lạ";
  }

  return (
    record?.full_name ||
    record?.person_name ||
    record?.person?.full_name ||
    record?.recognized_name ||
    "Chưa xác định"
  );
};

const getPersonCode = (record) =>
  record?.person_code || record?.person?.person_code || record?.code || "--";

const getCameraName = (record) =>
  record?.camera_name ||
  record?.camera?.camera_name ||
  record?.camera?.name ||
  (record?.camera_id ? `Camera #${record.camera_id}` : "--");

const getEventTime = (record) => record?.event_at || record?.created_at;

const getSessionStart = (record) =>
  record?.check_in_at ||
  record?.started_at ||
  record?.entry_at ||
  record?.start_time;

const getSessionEnd = (record) =>
  record?.check_out_at ||
  record?.ended_at ||
  record?.exit_at ||
  record?.end_time;

const getSessionState = (record) =>
  record?.session_status || record?.status || "unknown";

const getConfidenceColor = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "#64748b";

  const percent = number <= 1 ? number * 100 : number;

  if (percent >= 80) return "#15966A";
  if (percent >= 50) return "#D28B22";

  return "#DC4444";
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function DetailField({ label, value }) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "--"
      : String(value);

  return (
    <div className="history-detail-field">
      <Text className="history-detail-label">{label}</Text>
      <Text className="history-detail-value">{displayValue}</Text>
    </div>
  );
}

function StatusTag({ status }) {
  const item = getStatus(status);

  return (
    <Tag color={item.color} className="history-status-tag">
      <span className="history-tag-content">
        {item.icon}
        {item.label}
      </span>
    </Tag>
  );
}

function SessionStatusTag({ status }) {
  const item = getSessionStatus(status);

  return (
    <Tag color={item.color} className="history-status-tag">
      {item.label}
    </Tag>
  );
}

/**
 * Một thanh thống kê duy nhất, không tách thành nhiều card.
 */
function HistoryStatsBar({ isEvents, eventStats, sessionStats }) {
  const items = isEvents
    ? [
        {
          label: "Tổng lượt nhận diện",
          value: eventStats.total,
          icon: <Fingerprint size={15} />,
          color: "blue",
        },
        {
          label: "Đã nhận diện",
          value: eventStats.known,
          icon: <CheckCircle2 size={15} />,
          color: "green",
        },
        {
          label: "Người lạ",
          value: eventStats.unknown,
          icon: <ShieldAlert size={15} />,
          color: "red",
        },
        {
          label: "Chưa chắc chắn",
          value: eventStats.uncertain,
          icon: <AlertCircle size={15} />,
          color: "orange",
        },
      ]
    : [
        {
          label: "Tổng số phiên",
          value: sessionStats.total,
          icon: <Activity size={15} />,
          color: "blue",
        },
        {
          label: "Đang hoạt động",
          value: sessionStats.open,
          icon: <DoorOpen size={15} />,
          color: "green",
        },
        {
          label: "Đã đóng",
          value: sessionStats.closed,
          icon: <DoorClosed size={15} />,
          color: "gray",
        },
      ];

  return (
    <div className="history-stats-bar">
      {items.map((item, index) => (
        <div className={`history-stat-item ${item.color}`} key={item.label}>
          <span className="history-stat-item-icon">{item.icon}</span>
          <span className="history-stat-item-label">{item.label}</span>
          <strong className="history-stat-item-value">
            {formatNumber(item.value)}
          </strong>
          {index !== items.length - 1 && (
            <span className="history-stat-divider" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  // =====================================================
  // STATE
  // =====================================================

  const [activeTab, setActiveTab] = useState("events");

  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [eventPagination, setEventPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });

  const [sessionPagination, setSessionPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");

  const [dateRange, setDateRange] = useState(null);

  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState("events");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [snapshotUrl, setSnapshotUrl] = useState("");

  const snapshotUrlRef = useRef("");
  const detailRequestRef = useRef(0);

  // Giữ page size hiện tại mà không làm callback tải dữ liệu thay đổi liên tục.
  const eventLimitRef = useRef(PAGE_SIZE);
  const sessionLimitRef = useRef(PAGE_SIZE);

  // =====================================================
  // DERIVED STATE
  // =====================================================

  const isEvents = activeTab === "events";
  const isEventDetail = detailType === "events";

  const currentPagination = isEvents ? eventPagination : sessionPagination;

  const currentRows = isEvents ? events : sessions;
  const selectedIds = isEvents ? selectedEventIds : selectedSessionIds;
  const statusFilter = isEvents ? eventStatusFilter : sessionStatusFilter;

  // =====================================================
  // SNAPSHOT HELPERS
  // =====================================================

  const clearSnapshot = useCallback(() => {
    if (snapshotUrlRef.current) {
      revokeRecognitionSnapshotUrl(snapshotUrlRef.current);
      snapshotUrlRef.current = "";
    }

    setSnapshotUrl("");
  }, []);

  useEffect(() => {
    return () => {
      if (snapshotUrlRef.current) {
        revokeRecognitionSnapshotUrl(snapshotUrlRef.current);
      }
    };
  }, []);

  // =====================================================
  // QUERY PARAMS
  // =====================================================

  const buildParams = useCallback(
    (page, type, limit = PAGE_SIZE) => {
      const params = {
        page,
        limit,
      };

      if (searchKeyword.trim()) {
        params.keyword = searchKeyword.trim();
      }

      if (type === "events" && eventStatusFilter !== "all") {
        params.status = eventStatusFilter;
      }

      if (type === "sessions" && sessionStatusFilter !== "all") {
        params.session_status = sessionStatusFilter;
      }

      if (dateRange?.[0]) {
        params.from = dateRange[0].format("YYYY-MM-DD");
      }

      if (dateRange?.[1]) {
        params.to = dateRange[1].format("YYYY-MM-DD");
      }

      return params;
    },
    [searchKeyword, eventStatusFilter, sessionStatusFilter, dateRange],
  );

  // =====================================================
  // LOAD EVENTS
  // =====================================================

  const loadEvents = useCallback(
    async (page = 1, limit = eventLimitRef.current || PAGE_SIZE) => {
      setLoading(true);

      try {
        const result = await getRecognitionEvents(
          buildParams(page, "events", limit),
        );

        const items = Array.isArray(result?.items) ? result.items : [];
        const pagination = result?.pagination || {};

        const actualLimit = Number(pagination.limit) || limit;
        eventLimitRef.current = actualLimit;

        setEvents(items);
        setEventPagination({
          page: Number(pagination.page) || page,
          limit: actualLimit,
          total: Number(pagination.total) || 0,
          total_pages: Number(pagination.total_pages) || 0,
        });
      } catch (error) {
        console.error("LOAD RECOGNITION EVENTS ERROR:", error);
        message.error(
          getErrorMessage(error, "Không thể tải lịch sử nhận diện"),
        );
      } finally {
        setLoading(false);
      }
    },
    [buildParams],
  );

  // =====================================================
  // LOAD SESSIONS
  // =====================================================

  const loadSessions = useCallback(
    async (page = 1, limit = sessionLimitRef.current || PAGE_SIZE) => {
      setLoading(true);

      try {
        const result = await getRecognitionSessions(
          buildParams(page, "sessions", limit),
        );

        const items = Array.isArray(result?.items) ? result.items : [];
        const pagination = result?.pagination || {};

        const actualLimit = Number(pagination.limit) || limit;
        sessionLimitRef.current = actualLimit;

        setSessions(items);
        setSessionPagination({
          page: Number(pagination.page) || page,
          limit: actualLimit,
          total: Number(pagination.total) || 0,
          total_pages: Number(pagination.total_pages) || 0,
        });
      } catch (error) {
        console.error("LOAD RECOGNITION SESSIONS ERROR:", error);
        message.error(
          getErrorMessage(error, "Không thể tải lịch sử phiên vào/ra"),
        );
      } finally {
        setLoading(false);
      }
    },
    [buildParams],
  );

  // =====================================================
  // RELOAD
  // =====================================================

  const reloadCurrent = useCallback(
    (page) => {
      if (activeTab === "events") {
        return loadEvents(page ?? eventPagination.page, eventPagination.limit);
      }

      return loadSessions(
        page ?? sessionPagination.page,
        sessionPagination.limit,
      );
    },
    [
      activeTab,
      loadEvents,
      loadSessions,
      eventPagination.page,
      eventPagination.limit,
      sessionPagination.page,
      sessionPagination.limit,
    ],
  );

  // Tự tải lại khi đổi tab hoặc điều kiện lọc.
  useEffect(() => {
    if (activeTab === "events") {
      loadEvents(1, eventLimitRef.current);
    } else {
      loadSessions(1, sessionLimitRef.current);
    }
  }, [activeTab, loadEvents, loadSessions]);

  // Xóa lựa chọn khi thay đổi điều kiện lọc.
  useEffect(() => {
    setSelectedEventIds([]);
    setSelectedSessionIds([]);
  }, [
    activeTab,
    searchKeyword,
    eventStatusFilter,
    sessionStatusFilter,
    dateRange,
  ]);

  // =====================================================
  // SEARCH & FILTER
  // =====================================================

  const handleSearch = () => {
    setSearchKeyword(keyword.trim());
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSearchKeyword("");
    setEventStatusFilter("all");
    setSessionStatusFilter("all");
    setDateRange(null);
  };

  const handleStatusChange = (value) => {
    if (isEvents) {
      setEventStatusFilter(value);
    } else {
      setSessionStatusFilter(value);
    }
  };

  const handlePageChange = (page, pageSize) => {
    const nextLimit = Math.min(
      100,
      Math.max(PAGE_SIZE, Number(pageSize) || PAGE_SIZE),
    );

    if (isEvents) {
      eventLimitRef.current = nextLimit;

      setEventPagination((prev) => ({
        ...prev,
        page,
        limit: nextLimit,
      }));

      loadEvents(page, nextLimit);
    } else {
      sessionLimitRef.current = nextLimit;

      setSessionPagination((prev) => ({
        ...prev,
        page,
        limit: nextLimit,
      }));

      loadSessions(page, nextLimit);
    }
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;

    setActiveTab(tab);
    setSelectedEventIds([]);
    setSelectedSessionIds([]);
  };

  // =====================================================
  // OPEN EVENT DETAIL
  // =====================================================

  const openEventDetail = useCallback(
    async (record) => {
      const requestId = ++detailRequestRef.current;

      clearSnapshot();

      setDetailType("events");
      setDetailOpen(true);
      setDetailLoading(true);
      setSnapshotLoading(true);
      setSelectedRecord(record);

      const eventId = record.id;

      const detailPromise = getRecognitionEventDetail(eventId);
      const snapshotPromise = getRecognitionEventSnapshot(eventId);

      try {
        const detail = await detailPromise;

        if (requestId !== detailRequestRef.current) return;

        setSelectedRecord(detail || record);
      } catch (error) {
        if (requestId !== detailRequestRef.current) return;

        console.error("GET EVENT DETAIL ERROR:", error);
        message.error(getErrorMessage(error, "Không thể tải chi tiết sự kiện"));
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }

      try {
        const snapshot = await snapshotPromise;

        if (requestId !== detailRequestRef.current) {
          const staleUrl =
            typeof snapshot === "string" ? snapshot : snapshot?.url;

          if (staleUrl) revokeRecognitionSnapshotUrl(staleUrl);
          return;
        }

        const url = typeof snapshot === "string" ? snapshot : snapshot?.url;

        if (url) {
          snapshotUrlRef.current = url;
          setSnapshotUrl(url);
        }
      } catch (error) {
        if (requestId === detailRequestRef.current) {
          console.warn("LOAD SNAPSHOT ERROR:", error);
        }
      } finally {
        if (requestId === detailRequestRef.current) {
          setSnapshotLoading(false);
        }
      }
    },
    [clearSnapshot],
  );
  // =====================================================
  // OPEN SESSION DETAIL
  // =====================================================

  const openSessionDetail = useCallback(
    async (record) => {
      const requestId = ++detailRequestRef.current;

      clearSnapshot();

      setDetailType("sessions");
      setDetailOpen(true);
      setDetailLoading(true);
      setSnapshotLoading(false);
      setSelectedRecord(record);

      try {
        const detail = await getRecognitionSessionDetail(record.id);

        if (requestId !== detailRequestRef.current) return;

        setSelectedRecord(detail || record);
      } catch (error) {
        if (requestId !== detailRequestRef.current) return;

        console.error("GET SESSION DETAIL ERROR:", error);
        message.error(getErrorMessage(error, "Không thể tải chi tiết phiên"));
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [clearSnapshot],
  );

  // =====================================================
  // CLOSE DETAIL
  // =====================================================

  const closeDetail = () => {
    detailRequestRef.current += 1;

    setDetailOpen(false);
    setSelectedRecord(null);
    setDetailLoading(false);
    setSnapshotLoading(false);

    clearSnapshot();
  };

  // =====================================================
  // BULK DELETE
  // =====================================================

  const handleBulkDelete = () => {
    if (!selectedIds.length) {
      message.warning("Vui lòng chọn bản ghi cần xóa");
      return;
    }

    const isEventList = activeTab === "events";
    const ids = [...selectedIds];

    Modal.confirm({
      title: "Xác nhận xóa dữ liệu",
      content: (
        <div className="history-delete-confirm">
          <div className="history-delete-confirm-icon">
            <Trash2 size={22} />
          </div>

          <div className="history-delete-confirm-content">
            <Text strong>
              Bạn đang chuẩn bị xóa {formatNumber(ids.length)} bản ghi.
            </Text>

            <Text type="secondary">
              {isEventList
                ? "Các sự kiện nhận diện đã chọn sẽ bị xóa cùng dữ liệu ảnh liên quan theo xử lý của máy chủ."
                : "Các phiên vào/ra đã chọn sẽ bị xóa khỏi lịch sử."}
            </Text>

            <Text type="danger">Thao tác này không thể hoàn tác.</Text>
          </div>
        </div>
      ),
      okText: `Xóa ${ids.length} mục`,
      cancelText: "Hủy",
      okType: "danger",
      centered: true,
      onOk: async () => {
        setDeleting(true);

        try {
          const result = isEventList
            ? await deleteBulkRecognitionEvents(ids)
            : await deleteBulkRecognitionSessions(ids);

          const deletedCount = Number(result?.deleted_count ?? ids.length);

          message.success(
            `Đã xóa thành công ${formatNumber(deletedCount)} bản ghi`,
          );

          if (isEventList) {
            setSelectedEventIds([]);
          } else {
            setSelectedSessionIds([]);
          }

          const totalAfterDelete = Math.max(
            0,
            currentPagination.total - deletedCount,
          );

          const lastPage = Math.max(
            1,
            Math.ceil(totalAfterDelete / currentPagination.limit),
          );

          const nextPage = Math.min(currentPagination.page, lastPage);

          await reloadCurrent(nextPage);
        } catch (error) {
          console.error("BULK DELETE HISTORY ERROR:", error);

          message.error(
            getErrorMessage(error, "Không thể xóa dữ liệu đã chọn"),
          );

          throw error;
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // =====================================================
  // STATISTICS
  // =====================================================

  const eventStats = useMemo(() => {
    return {
      total: eventPagination.total,
      known: events.filter((item) => item.recognition_status === "known")
        .length,
      unknown: events.filter((item) => item.recognition_status === "unknown")
        .length,
      uncertain: events.filter(
        (item) => item.recognition_status === "uncertain",
      ).length,
    };
  }, [events, eventPagination.total]);

  const sessionStats = useMemo(() => {
    return {
      total: sessionPagination.total,
      open: sessions.filter((item) =>
        ["open", "active"].includes(
          String(getSessionState(item)).toLowerCase(),
        ),
      ).length,
      closed: sessions.filter((item) =>
        ["closed", "completed"].includes(
          String(getSessionState(item)).toLowerCase(),
        ),
      ).length,
    };
  }, [sessions, sessionPagination.total]);

  // =====================================================
  // EVENT TABLE COLUMNS
  // =====================================================

  const eventColumns = useMemo(
    () => [
      {
        title: "MÃ SỰ KIỆN",
        dataIndex: "event_code",
        key: "event_code",
        width: 155,
        render: (value, record) => (
          <div className="history-event-code">
            <div className="history-event-code-icon">
              <Fingerprint size={15} />
            </div>

            <div className="history-cell-content">
              <Text strong className="history-primary-text">
                {value || `#${record.id}`}
              </Text>
              <Text className="history-sub-text">ID: {record.id}</Text>
            </div>
          </div>
        ),
      },
      {
        title: "ĐỐI TƯỢNG",
        key: "person",
        width: 205,
        render: (_, record) => (
          <div className="history-person-cell">
            <Avatar
              size={31}
              className={
                record.recognition_status === "unknown"
                  ? "history-avatar unknown"
                  : "history-avatar"
              }
              icon={<UserRound size={15} />}
            />

            <div className="history-cell-content">
              <Text strong className="history-primary-text">
                {getPersonName(record)}
              </Text>
              <Text className="history-sub-text">{getPersonCode(record)}</Text>
            </div>
          </div>
        ),
      },
      {
        title: "CAMERA",
        key: "camera",
        width: 155,
        render: (_, record) => (
          <div className="history-camera-cell">
            <Camera size={14} />
            <Text>{getCameraName(record)}</Text>
          </div>
        ),
      },
      {
        title: "KẾT QUẢ",
        dataIndex: "recognition_status",
        key: "recognition_status",
        width: 145,
        render: (value) => <StatusTag status={value} />,
      },
      {
        title: "ĐỘ TIN CẬY",
        dataIndex: "confidence",
        key: "confidence",
        width: 105,
        render: (value) => (
          <Text
            strong
            className="history-confidence"
            style={{ color: getConfidenceColor(value) }}
          >
            {formatPercent(value)}
          </Text>
        ),
      },
      {
        title: "THỜI GIAN",
        key: "event_at",
        width: 165,
        render: (_, record) => (
          <div className="history-time-cell">
            <Clock3 size={13} />
            <Text>{formatDateTime(getEventTime(record))}</Text>
          </div>
        ),
      },
      {
        title: "",
        key: "action",
        width: 55,
        fixed: "right",
        align: "center",
        render: (_, record) => (
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              className="history-view-button"
              icon={<Eye size={16} />}
              onClick={() => openEventDetail(record)}
            />
          </Tooltip>
        ),
      },
    ],
    [openEventDetail],
  );

  // =====================================================
  // SESSION TABLE COLUMNS
  // =====================================================

  const sessionColumns = useMemo(
    () => [
      {
        title: "MÃ PHIÊN",
        dataIndex: "session_code",
        key: "session_code",
        width: 155,
        render: (value, record) => (
          <div className="history-event-code">
            <div className="history-event-code-icon session">
              <Activity size={15} />
            </div>

            <div className="history-cell-content">
              <Text strong className="history-primary-text">
                {value || `#${record.id}`}
              </Text>
              <Text className="history-sub-text">ID: {record.id}</Text>
            </div>
          </div>
        ),
      },
      {
        title: "ĐỐI TƯỢNG",
        key: "person",
        width: 205,
        render: (_, record) => (
          <div className="history-person-cell">
            <Avatar
              size={31}
              className="history-avatar"
              icon={<UserRound size={15} />}
            />

            <div className="history-cell-content">
              <Text strong className="history-primary-text">
                {getPersonName(record)}
              </Text>
              <Text className="history-sub-text">{getPersonCode(record)}</Text>
            </div>
          </div>
        ),
      },
      {
        title: "CAMERA",
        key: "camera",
        width: 150,
        render: (_, record) => (
          <div className="history-camera-cell">
            <Camera size={14} />
            <Text>{getCameraName(record)}</Text>
          </div>
        ),
      },
      {
        title: "THỜI GIAN VÀO",
        key: "check_in_at",
        width: 165,
        render: (_, record) => (
          <div className="history-time-cell">
            <DoorOpen size={14} />
            <Text>{formatDateTime(getSessionStart(record))}</Text>
          </div>
        ),
      },
      {
        title: "THỜI GIAN RA",
        key: "check_out_at",
        width: 165,
        render: (_, record) => (
          <div className="history-time-cell">
            <DoorClosed size={14} />
            <Text>{formatDateTime(getSessionEnd(record))}</Text>
          </div>
        ),
      },
      {
        title: "SỐ LƯỢT",
        dataIndex: "event_count",
        key: "event_count",
        width: 85,
        align: "center",
        render: (value) => (
          <Tag className="history-count-tag">{formatNumber(value)}</Tag>
        ),
      },
      {
        title: "TRẠNG THÁI",
        key: "session_status",
        width: 135,
        render: (_, record) => (
          <SessionStatusTag status={getSessionState(record)} />
        ),
      },
      {
        title: "",
        key: "action",
        width: 55,
        fixed: "right",
        align: "center",
        render: (_, record) => (
          <Tooltip title="Xem chi tiết phiên">
            <Button
              type="text"
              size="small"
              className="history-view-button"
              icon={<Eye size={16} />}
              onClick={() => openSessionDetail(record)}
            />
          </Tooltip>
        ),
      },
    ],
    [openSessionDetail],
  );

  // =====================================================
  // ROW SELECTION
  // =====================================================

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys: selectedIds,
      onChange: (keys) => {
        if (isEvents) {
          setSelectedEventIds(keys);
        } else {
          setSelectedSessionIds(keys);
        }
      },
      preserveSelectedRowKeys: false,
      columnWidth: 42,
    }),
    [selectedIds, isEvents],
  );

  // =====================================================
  // PAGINATION
  // =====================================================

  const startRecord =
    currentPagination.total === 0
      ? 0
      : (currentPagination.page - 1) * currentPagination.limit + 1;

  const endRecord = Math.min(
    currentPagination.page * currentPagination.limit,
    currentPagination.total,
  );

  // =====================================================
  // DETAIL DATA
  // =====================================================

  const detailStatus = selectedRecord
    ? getSessionStatus(getSessionState(selectedRecord))
    : null;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="history-page">
      {/* HEADER */}
      <div className="history-page-header">
        <div className="history-heading-content">
          <div className="history-breadcrumb">
            <span>QUẢN LÝ HỆ THỐNG</span>
            <span className="history-breadcrumb-separator">/</span>
            <span>LỊCH SỬ HOẠT ĐỘNG</span>
          </div>

          <Title level={3} className="history-page-title">
            Lịch sử hoạt động
          </Title>

          <Text className="history-page-subtitle">
            Theo dõi lượt nhận diện khuôn mặt và các phiên vào / ra.
          </Text>
        </div>

        <Button
          className="history-refresh-button"
          icon={<RefreshCw size={15} />}
          onClick={() => reloadCurrent()}
          loading={loading}
        >
          Làm mới
        </Button>
      </div>

      {/* ONE-LINE STATISTICS */}
      <HistoryStatsBar
        isEvents={isEvents}
        eventStats={eventStats}
        sessionStats={sessionStats}
      />

      {/* MAIN CONTENT */}
      <Card className="history-main-card" bordered={false}>
        {/* TABS */}
        <div className="history-tabs">
          <button
            type="button"
            className={`history-tab ${isEvents ? "active" : ""}`}
            onClick={() => handleTabChange("events")}
          >
            <Fingerprint size={16} />
            <span>Lịch sử nhận diện</span>
            <span className="history-tab-count">
              {formatNumber(eventPagination.total)}
            </span>
          </button>

          <button
            type="button"
            className={`history-tab ${!isEvents ? "active" : ""}`}
            onClick={() => handleTabChange("sessions")}
          >
            <Users size={16} />
            <span>Phiên vào / ra</span>
            <span className="history-tab-count">
              {formatNumber(sessionPagination.total)}
            </span>
          </button>
        </div>

        {/* FILTER HEADER */}
        <div className="history-filter-area">
          <div className="history-filter-heading">
            <div>
              <Title level={5}>Danh sách hoạt động</Title>
              <Text className="history-filter-description">
                {isEvents
                  ? "Tra cứu sự kiện nhận diện khuôn mặt."
                  : "Theo dõi thời gian vào và ra khỏi khu vực camera."}
              </Text>
            </div>

            <div className="history-total-count">
              <Activity size={14} />
              <strong>{formatNumber(currentPagination.total)}</strong>
              <span>bản ghi</span>
            </div>
          </div>

          {/* FILTER CONTROLS */}
          <div className="history-filter-controls">
            <Input
              allowClear
              prefix={<Search size={15} />}
              placeholder={
                isEvents
                  ? "Tìm mã sự kiện, tên hoặc mã đối tượng..."
                  : "Tìm mã phiên, tên hoặc mã đối tượng..."
              }
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={handleSearch}
              className="history-search-input"
            />

            <Select
              value={statusFilter}
              onChange={handleStatusChange}
              className="history-status-select"
              options={
                isEvents
                  ? [
                      { value: "all", label: "Tất cả trạng thái" },
                      { value: "known", label: "Đã nhận diện" },
                      { value: "unknown", label: "Người lạ" },
                      { value: "uncertain", label: "Chưa chắc chắn" },
                    ]
                  : [
                      { value: "all", label: "Tất cả trạng thái" },
                      { value: "open", label: "Đang hoạt động" },
                      { value: "closed", label: "Đã đóng" },
                    ]
              }
            />

            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              className="history-date-picker"
              suffixIcon={<CalendarDays size={15} />}
              allowClear
            />

            <Button
              type="primary"
              icon={<Search size={15} />}
              onClick={handleSearch}
              className="history-search-button"
            >
              Tìm kiếm
            </Button>

            <Button
              icon={<Filter size={14} />}
              onClick={handleResetFilters}
              className="history-reset-button"
            >
              Đặt lại
            </Button>
          </div>
        </div>

        {/* SELECTION TOOLBAR */}
        <div className="history-selection-toolbar">
          <div className="history-selection-info">
            {selectedIds.length > 0 ? (
              <>
                <Tag color="blue" className="history-selected-tag">
                  {formatNumber(selectedIds.length)} đã chọn
                </Tag>

                <Text type="secondary">Đang chọn trong trang hiện tại.</Text>

                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    if (isEvents) {
                      setSelectedEventIds([]);
                    } else {
                      setSelectedSessionIds([]);
                    }
                  }}
                >
                  Bỏ chọn
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <Text type="secondary">Chọn dòng để thao tác hàng loạt.</Text>
              </>
            )}
          </div>

          <Button
            danger
            type="primary"
            size="small"
            icon={<Trash2 size={14} />}
            disabled={!selectedIds.length || deleting}
            loading={deleting}
            onClick={handleBulkDelete}
            className="history-delete-button"
          >
            Xóa đã chọn
            {selectedIds.length ? ` (${selectedIds.length})` : ""}
          </Button>
        </div>

        {/* TABLE */}
        <Spin spinning={loading}>
          <div className="history-table-wrap">
            <Table
              rowKey="id"
              rowSelection={rowSelection}
              columns={isEvents ? eventColumns : sessionColumns}
              dataSource={currentRows}
              pagination={false}
              size="small"
              scroll={{
                x: isEvents ? 1020 : 1160,
              }}
              rowClassName={() => "history-table-row"}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      isEvents
                        ? "Chưa có lịch sử nhận diện"
                        : "Chưa có phiên vào / ra"
                    }
                  />
                ),
              }}
            />
          </div>
        </Spin>

        {/* PAGINATION */}
        <div className="history-pagination">
          <Text className="history-pagination-text">
            Hiển thị <strong>{formatNumber(startRecord)}</strong>
            {" - "}
            <strong>{formatNumber(endRecord)}</strong>
            {" / "}
            <strong>{formatNumber(currentPagination.total)}</strong>
            {" bản ghi"}
          </Text>

          <Pagination
            current={currentPagination.page}
            pageSize={currentPagination.limit}
            total={currentPagination.total}
            onChange={handlePageChange}
            showSizeChanger
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showQuickJumper
            showLessItems
            hideOnSinglePage={false}
            size="small"
            showTotal={(total) => `Tổng ${formatNumber(total)} bản ghi`}
          />
        </div>
      </Card>

      {/* DETAIL DRAWER */}
      <Drawer
        title={
          <div className="history-drawer-title">
            <div className="history-drawer-title-icon">
              {isEventDetail ? (
                <Fingerprint size={18} />
              ) : (
                <Activity size={18} />
              )}
            </div>

            <div className="history-drawer-title-content">
              <Text strong>
                {isEventDetail
                  ? "Chi tiết sự kiện nhận diện"
                  : "Chi tiết phiên vào / ra"}
              </Text>

              <Text className="history-sub-text">
                {selectedRecord?.event_code ||
                  selectedRecord?.session_code ||
                  `ID: ${selectedRecord?.id || "--"}`}
              </Text>
            </div>
          </div>
        }
        open={detailOpen}
        onClose={closeDetail}
        width={620}
        destroyOnClose
        className="history-detail-drawer"
        extra={
          <Button
            type="text"
            size="small"
            icon={<X size={17} />}
            onClick={closeDetail}
          />
        }
      >
        <Spin spinning={detailLoading}>
          {selectedRecord && (
            <div className="history-detail-content">
              {/* SNAPSHOT */}
              {isEventDetail && (
                <div className="history-snapshot-box">
                  <div className="history-snapshot-header">
                    <div className="history-section-heading">
                      <ImageIcon size={16} />
                      <Text strong>Ảnh snapshot</Text>
                    </div>

                    {snapshotUrl && <Tag color="success">Đã tải ảnh</Tag>}
                  </div>

                  <div className="history-snapshot-image">
                    {snapshotLoading ? (
                      <div className="history-snapshot-loading">
                        <Spin size="small" />
                        <Text>Đang tải ảnh...</Text>
                      </div>
                    ) : snapshotUrl ? (
                      <img
                        src={snapshotUrl}
                        alt="Ảnh snapshot sự kiện nhận diện"
                      />
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có ảnh snapshot"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* GENERAL INFORMATION */}
              <div className="history-detail-section">
                <div className="history-detail-section-heading">
                  <div>
                    <Title level={5}>Thông tin chung</Title>
                    <Text>Thông tin ghi nhận từ hệ thống camera.</Text>
                  </div>
                </div>

                {isEventDetail ? (
                  <>
                    <div className="history-detail-status">
                      <StatusTag status={selectedRecord.recognition_status} />

                      <span
                        className="history-detail-confidence"
                        style={{
                          color: getConfidenceColor(selectedRecord.confidence),
                        }}
                      >
                        Độ tin cậy: {formatPercent(selectedRecord.confidence)}
                      </span>
                    </div>

                    <div className="history-detail-grid">
                      <DetailField
                        label="Mã sự kiện"
                        value={selectedRecord.event_code}
                      />
                      <DetailField
                        label="ID sự kiện"
                        value={selectedRecord.id}
                      />
                      <DetailField
                        label="Thời gian nhận diện"
                        value={formatDateTime(getEventTime(selectedRecord))}
                      />
                      <DetailField
                        label="Hướng di chuyển"
                        value={
                          selectedRecord.direction === "entry"
                            ? "Đi vào"
                            : selectedRecord.direction === "exit"
                              ? "Đi ra"
                              : selectedRecord.direction || "--"
                        }
                      />
                      <DetailField
                        label="Camera"
                        value={getCameraName(selectedRecord)}
                      />
                      <DetailField
                        label="ID camera"
                        value={selectedRecord.camera_id}
                      />
                      <DetailField
                        label="ID đối tượng"
                        value={selectedRecord.person_id}
                      />
                      <DetailField
                        label="Số khuôn mặt"
                        value={selectedRecord.face_count}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="history-detail-status">
                      <SessionStatusTag
                        status={getSessionState(selectedRecord)}
                      />

                      <Text className="history-detail-event-count">
                        {formatNumber(selectedRecord.event_count)} lượt ghi nhận
                      </Text>
                    </div>

                    <div className="history-detail-grid">
                      <DetailField
                        label="Mã phiên"
                        value={selectedRecord.session_code || selectedRecord.id}
                      />
                      <DetailField label="ID phiên" value={selectedRecord.id} />
                      <DetailField
                        label="Thời gian vào"
                        value={formatDateTime(getSessionStart(selectedRecord))}
                      />
                      <DetailField
                        label="Thời gian ra"
                        value={formatDateTime(getSessionEnd(selectedRecord))}
                      />
                      <DetailField
                        label="Camera"
                        value={getCameraName(selectedRecord)}
                      />
                      <DetailField
                        label="ID camera"
                        value={selectedRecord.camera_id}
                      />
                      <DetailField
                        label="ID đối tượng"
                        value={selectedRecord.person_id}
                      />
                      <DetailField
                        label="Số lượt nhận diện"
                        value={selectedRecord.event_count}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* PERSON INFORMATION */}
              <div className="history-detail-section">
                <div className="history-detail-section-heading">
                  <div>
                    <Title level={5}>Thông tin đối tượng</Title>
                    <Text>Thông tin cá nhân liên kết với bản ghi.</Text>
                  </div>
                </div>

                <div className="history-detail-person">
                  <Avatar
                    size={48}
                    className={
                      selectedRecord.recognition_status === "unknown"
                        ? "history-avatar unknown"
                        : "history-avatar"
                    }
                    icon={<UserRound size={21} />}
                  />

                  <div>
                    <Text strong className="history-detail-person-name">
                      {getPersonName(selectedRecord)}
                    </Text>

                    <Text className="history-sub-text">
                      {getPersonCode(selectedRecord)}
                    </Text>
                  </div>
                </div>

                <div className="history-detail-grid">
                  <DetailField
                    label="Họ và tên"
                    value={getPersonName(selectedRecord)}
                  />
                  <DetailField
                    label="Mã đối tượng"
                    value={getPersonCode(selectedRecord)}
                  />
                  <DetailField
                    label="Loại đối tượng"
                    value={
                      selectedRecord.category ||
                      selectedRecord.person_category ||
                      selectedRecord.person?.category
                    }
                  />
                  <DetailField
                    label="ID đối tượng"
                    value={selectedRecord.person_id}
                  />
                </div>
              </div>

              {/* EVENT EXTRA INFORMATION */}
              {isEventDetail && (
                <div className="history-detail-section">
                  <div className="history-detail-section-heading">
                    <div>
                      <Title level={5}>Thông tin bổ sung</Title>
                      <Text>Dữ liệu kỹ thuật của sự kiện nhận diện.</Text>
                    </div>
                  </div>

                  <div className="history-detail-grid">
                    <DetailField
                      label="Đường dẫn ảnh khuôn mặt"
                      value={selectedRecord.face_image_path}
                    />
                    <DetailField
                      label="Đường dẫn snapshot"
                      value={selectedRecord.snapshot_path}
                    />
                    <DetailField
                      label="Thông báo đã gửi"
                      value={
                        selectedRecord.notification_sent ? "Đã gửi" : "Chưa gửi"
                      }
                    />
                    <DetailField
                      label="Thời gian gửi thông báo"
                      value={formatDateTime(
                        selectedRecord.notification_sent_at,
                      )}
                    />
                    <DetailField
                      label="Ngày tạo bản ghi"
                      value={formatDateTime(selectedRecord.created_at)}
                    />
                  </div>
                </div>
              )}

              {/* SESSION EXTRA INFORMATION */}
              {!isEventDetail && (
                <div className="history-detail-section">
                  <div className="history-detail-section-heading">
                    <div>
                      <Title level={5}>Thông tin phiên</Title>
                      <Text>Thời gian và trạng thái xử lý phiên.</Text>
                    </div>
                  </div>

                  <div className="history-detail-grid">
                    <DetailField
                      label="Trạng thái phiên"
                      value={detailStatus?.label}
                    />
                    <DetailField
                      label="Thời gian tạo"
                      value={formatDateTime(selectedRecord.created_at)}
                    />
                    <DetailField
                      label="Cập nhật lần cuối"
                      value={formatDateTime(selectedRecord.updated_at)}
                    />
                    <DetailField
                      label="ID đối tượng"
                      value={selectedRecord.person_id}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Spin>
      </Drawer>
    </div>
  );
}
