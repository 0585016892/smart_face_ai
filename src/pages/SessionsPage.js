import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Pagination,
  Row,
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
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

import dayjs from "dayjs";
import {
  getRecognitionSessions,
  getRecognitionSessionDetail,
} from "../api/recognitionHistoryApi";

import "./css/SessionsPage.css";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PAGE_SIZE = 10;

const STATUS_CONFIG = {
  active: { label: "Đang hoạt động", color: "processing" },
  completed: { label: "Đã kết thúc", color: "success" },
  closed: { label: "Đã đóng", color: "default" },
  finished: { label: "Đã hoàn tất", color: "success" },
  exited: { label: "Đã rời khỏi", color: "success" },
};

const firstValue = (...values) =>
  values.find((value) => value !== null && value !== undefined && value !== "");

const getPersonName = (record) =>
  firstValue(
    record?.full_name,
    record?.person_name,
    record?.person?.full_name,
    record?.recognized_name,
    "Chưa xác định",
  );

const getPersonCode = (record) =>
  firstValue(
    record?.person_code,
    record?.person?.person_code,
    record?.code,
    "--",
  );

const getCameraName = (record) =>
  firstValue(
    record?.camera_name,
    record?.camera?.camera_name,
    record?.camera?.name,
    record?.camera_id ? `Camera #${record.camera_id}` : null,
    "--",
  );

const getStartTime = (record) =>
  firstValue(
    record?.started_at,
    record?.entry_at,
    record?.start_time,
    record?.first_seen_at,
    record?.created_at,
  );

const getEndTime = (record) =>
  firstValue(
    record?.ended_at,
    record?.exit_at,
    record?.end_time,
    record?.last_seen_at,
  );

const getSessionStatus = (record) => {
  const raw = String(
    firstValue(record?.status, record?.session_status, "") || "",
  ).toLowerCase();

  if (raw) {
    return (
      STATUS_CONFIG[raw] || {
        label: raw,
        color: "default",
      }
    );
  }

  return getEndTime(record) ? STATUS_CONFIG.completed : STATUS_CONFIG.active;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "--";
};

const getDurationSeconds = (record) => {
  const explicit = firstValue(
    record?.duration_seconds,
    record?.duration,
    record?.duration_in_seconds,
    record?.total_seconds,
  );

  if (explicit !== undefined) {
    const value = Number(explicit);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  const start = getStartTime(record);
  const end = getEndTime(record) || new Date();

  if (!start) return null;

  const seconds = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  );

  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "--";

  const total = Math.floor(Number(seconds));
  if (!Number.isFinite(total) || total < 0) return "--";

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${remainingSeconds} giây`;

  return `${remainingSeconds} giây`;
};

const getStatusTag = (record) => {
  const status = getSessionStatus(record);

  return (
    <Tag color={status.color} className="sessions-status-tag">
      {status.label}
    </Tag>
  );
};

function SummaryCard({ title, value, description, icon, color }) {
  return (
    <Card className="sessions-stat-card" bordered={false}>
      <div className="sessions-stat-content">
        <div>
          <Text className="sessions-stat-label">{title}</Text>
          <div className="sessions-stat-value">
            {Number(value || 0).toLocaleString("vi-VN")}
          </div>
          <Text className="sessions-stat-description">{description}</Text>
        </div>

        <div
          className="sessions-stat-icon"
          style={{ color, background: `${color}14` }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="sessions-detail-item">
      <Text className="sessions-detail-label">{label}</Text>
      <Text className="sessions-detail-value">
        {value === null || value === undefined || value === ""
          ? "--"
          : String(value)}
      </Text>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const loadSessions = useCallback(
    async (page = 1) => {
      setLoading(true);

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
        };

        if (appliedKeyword) params.keyword = appliedKeyword;
        if (statusFilter !== "all") params.status = statusFilter;

        if (dateRange?.[0]) {
          params.from = dateRange[0].format("YYYY-MM-DD");
        }

        if (dateRange?.[1]) {
          params.to = dateRange[1].format("YYYY-MM-DD");
        }

        const result = await getRecognitionSessions(params);

        setSessions(result.items || []);
        setPagination({
          page: Number(result.pagination?.page) || page,
          limit: Number(result.pagination?.limit) || PAGE_SIZE,
          total: Number(result.pagination?.total) || 0,
          total_pages: Number(result.pagination?.total_pages) || 0,
        });
      } catch (error) {
        console.error("LOAD SESSIONS ERROR:", error);
        message.error(
          error?.response?.data?.message ||
            "Không thể tải danh sách phiên vào/ra",
        );
      } finally {
        setLoading(false);
      }
    },
    [appliedKeyword, statusFilter, dateRange],
  );

  useEffect(() => {
    loadSessions(1);
  }, [loadSessions]);

  const handleSearch = () => {
    setAppliedKeyword(keyword.trim());
  };

  const handleReset = () => {
    setKeyword("");
    setAppliedKeyword("");
    setStatusFilter("all");
    setDateRange(null);
  };

  const handleOpenDetail = async (record) => {
    setSelectedSession(record);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const detail = await getRecognitionSessionDetail(record.id);
      setSelectedSession(detail || record);
    } catch (error) {
      console.error("LOAD SESSION DETAIL ERROR:", error);
      message.error(
        error?.response?.data?.message || "Không thể tải chi tiết phiên",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedSession(null);
  };

  const stats = useMemo(() => {
    const active = sessions.filter(
      (item) => getSessionStatus(item).label === "Đang hoạt động",
    ).length;

    const completed = sessions.filter((item) => {
      const status = getSessionStatus(item);
      return ["success", "default"].includes(status.color);
    }).length;

    const totalDuration = sessions.reduce((sum, item) => {
      const duration = getDurationSeconds(item);
      return sum + (duration || 0);
    }, 0);

    return {
      total: pagination.total,
      active,
      completed,
      averageDuration:
        sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0,
    };
  }, [sessions, pagination.total]);

  const columns = [
    {
      title: "MÃ PHIÊN",
      key: "session",
      width: 125,
      render: (_, record) => (
        <div className="sessions-code-cell">
          <div className="sessions-code-icon">
            <Activity size={17} />
          </div>
          <div>
            <Text strong>
              {firstValue(
                record.session_code,
                record.event_code,
                `#${record.id}`,
              )}
            </Text>
            <Text className="sessions-muted-text">ID: {record.id}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "ĐỐI TƯỢNG",
      key: "person",
      render: (_, record) => (
        <div className="sessions-person-cell">
          <Avatar
            className="sessions-person-avatar"
            icon={<UserRound size={17} />}
          />
          <div className="sessions-person-info">
            <Text strong>{getPersonName(record)}</Text>
            <Text className="sessions-muted-text">{getPersonCode(record)}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "CAMERA",
      key: "camera",
      width: 150,
      render: (_, record) => (
        <div className="sessions-camera-cell">
          <Camera size={15} />
          <Text>{getCameraName(record)}</Text>
        </div>
      ),
    },
    {
      title: "THỜI GIAN VÀO",
      key: "start",
      width: 175,
      render: (_, record) => (
        <div className="sessions-time-cell">
          <LogIn size={15} />
          <Text>{formatDateTime(getStartTime(record))}</Text>
        </div>
      ),
    },
    {
      title: "THỜI GIAN RA",
      key: "end",
      width: 175,
      render: (_, record) => (
        <div className="sessions-time-cell">
          <LogOut size={15} />
          <Text>{formatDateTime(getEndTime(record))}</Text>
        </div>
      ),
    },
    {
      title: "THỜI LƯỢNG",
      key: "duration",
      width: 135,
      render: (_, record) => (
        <div className="sessions-duration-cell">
          <Timer size={15} />
          <Text>{formatDuration(getDurationSeconds(record))}</Text>
        </div>
      ),
    },
    {
      title: "TRẠNG THÁI",
      key: "status",
      width: 145,
      render: (_, record) => getStatusTag(record),
    },
    {
      title: "",
      key: "action",
      width: 65,
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="Xem chi tiết phiên">
          <Button
            type="text"
            className="sessions-view-button"
            icon={<Eye size={17} />}
            onClick={() => handleOpenDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="sessions-page">
      <div className="sessions-page-header">
        <div>
          <div className="sessions-breadcrumb">
            <span>QUẢN LÝ HỆ THỐNG</span>
            <span>/</span>
            <span>PHIÊN VÀO / RA</span>
          </div>

          <Title level={2} className="sessions-page-title">
            Quản lý phiên vào / ra
          </Title>

          <Text className="sessions-page-subtitle">
            Theo dõi thời điểm xuất hiện, rời khỏi khu vực giám sát và thời
            lượng hoạt động của từng đối tượng.
          </Text>
        </div>

        <Button
          className="sessions-refresh-button"
          icon={<RefreshCw size={16} />}
          onClick={() => loadSessions(pagination.page)}
          loading={loading}
        >
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]} className="sessions-stats-row">
        <Col xs={24} sm={12} xl={6}>
          <SummaryCard
            title="Tổng số phiên"
            value={stats.total}
            description="Tổng bản ghi theo bộ lọc"
            icon={<Activity size={23} />}
            color="#2563EB"
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <SummaryCard
            title="Đang hoạt động"
            value={stats.active}
            description="Trong dữ liệu trang hiện tại"
            icon={<Users size={23} />}
            color="#D28B22"
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <SummaryCard
            title="Đã kết thúc"
            value={stats.completed}
            description="Trong dữ liệu trang hiện tại"
            icon={<CheckCircle2 size={23} />}
            color="#15966A"
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <SummaryCard
            title="Thời lượng trung bình"
            value={formatDuration(stats.averageDuration)}
            description="Tính trên trang dữ liệu hiện tại"
            icon={<Clock3 size={23} />}
            color="#7956C8"
          />
        </Col>
      </Row>

      <Card className="sessions-main-card" bordered={false}>
        <div className="sessions-list-heading">
          <div>
            <Title level={5}>Danh sách phiên</Title>
            <Text>
              Mỗi bản ghi tương ứng với một phiên hoạt động được hệ thống ghi
              nhận.
            </Text>
          </div>

          <Tag className="sessions-total-tag">
            {pagination.total.toLocaleString("vi-VN")} phiên
          </Tag>
        </div>

        <div className="sessions-filter-row">
          <Input
            allowClear
            prefix={<Search size={16} />}
            placeholder="Tìm tên, mã đối tượng hoặc mã phiên..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={handleSearch}
            className="sessions-search-input"
          />

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="sessions-status-select"
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "active", label: "Đang hoạt động" },
              { value: "completed", label: "Đã kết thúc" },
              { value: "closed", label: "Đã đóng" },
            ]}
          />

          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="DD/MM/YYYY"
            placeholder={["Từ ngày", "Đến ngày"]}
            suffixIcon={<CalendarDays size={16} />}
            className="sessions-date-picker"
          />

          <Button
            type="primary"
            icon={<Search size={16} />}
            className="sessions-search-button"
            onClick={handleSearch}
          >
            Tìm kiếm
          </Button>

          <Button onClick={handleReset}>Đặt lại</Button>
        </div>

        <Spin spinning={loading}>
          <div className="sessions-table-wrap">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={sessions}
              pagination={false}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có dữ liệu phiên vào/ra"
                  />
                ),
              }}
            />
          </div>
        </Spin>

        <div className="sessions-pagination">
          <Text>
            Hiển thị{" "}
            {pagination.total === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1}
            {" - "}
            {Math.min(pagination.page * PAGE_SIZE, pagination.total)}
            {" / "}
            {pagination.total.toLocaleString("vi-VN")} phiên
          </Text>

          <Pagination
            current={pagination.page}
            pageSize={PAGE_SIZE}
            total={pagination.total}
            onChange={(page) => loadSessions(page)}
            showSizeChanger={false}
            showLessItems
          />
        </div>
      </Card>

      <Drawer
        title={
          <div className="sessions-drawer-title">
            <div className="sessions-drawer-icon">
              <Activity size={19} />
            </div>
            <div>
              <Text strong>Chi tiết phiên hoạt động</Text>
              <Text className="sessions-muted-text">
                {selectedSession?.session_code ||
                  selectedSession?.event_code ||
                  `ID: ${selectedSession?.id || "--"}`}
              </Text>
            </div>
          </div>
        }
        open={detailOpen}
        onClose={handleCloseDetail}
        width={570}
        destroyOnClose
        className="sessions-detail-drawer"
      >
        <Spin spinning={detailLoading}>
          {selectedSession && (
            <div className="sessions-detail-content">
              <Card className="sessions-detail-status-card" bordered={false}>
                <div className="sessions-detail-status-top">
                  <div>
                    <Text className="sessions-detail-label">
                      TRẠNG THÁI PHIÊN
                    </Text>
                    <div className="sessions-detail-status-value">
                      {getStatusTag(selectedSession)}
                    </div>
                  </div>

                  <div className="sessions-detail-status-symbol">
                    {getEndTime(selectedSession) ? (
                      <CheckCircle2 size={25} />
                    ) : (
                      <Activity size={25} />
                    )}
                  </div>
                </div>

                <div className="sessions-detail-duration">
                  <Clock3 size={17} />
                  <span>
                    {formatDuration(getDurationSeconds(selectedSession))}
                  </span>
                </div>
              </Card>

              <div className="sessions-detail-section">
                <Title level={5}>Thông tin đối tượng</Title>

                <div className="sessions-detail-person">
                  <Avatar size={50} icon={<UserRound size={22} />} />
                  <div>
                    <Text strong className="sessions-detail-person-name">
                      {getPersonName(selectedSession)}
                    </Text>
                    <Text className="sessions-muted-text">
                      {getPersonCode(selectedSession)}
                    </Text>
                  </div>
                </div>

                <div className="sessions-detail-grid">
                  <DetailItem
                    label="ID đối tượng"
                    value={
                      selectedSession.person_id || selectedSession.person?.id
                    }
                  />
                  <DetailItem
                    label="Loại đối tượng"
                    value={
                      selectedSession.category ||
                      selectedSession.person_category ||
                      selectedSession.person?.category
                    }
                  />
                </div>
              </div>

              <div className="sessions-detail-section">
                <Title level={5}>Thời gian hoạt động</Title>

                <div className="sessions-timeline">
                  <div className="sessions-timeline-item">
                    <div className="sessions-timeline-icon entry">
                      <LogIn size={17} />
                    </div>
                    <div>
                      <Text className="sessions-detail-label">
                        THỜI ĐIỂM VÀO
                      </Text>
                      <Text strong className="sessions-timeline-time">
                        {formatDateTime(getStartTime(selectedSession))}
                      </Text>
                    </div>
                  </div>

                  <div className="sessions-timeline-line" />

                  <div className="sessions-timeline-item">
                    <div className="sessions-timeline-icon exit">
                      <LogOut size={17} />
                    </div>
                    <div>
                      <Text className="sessions-detail-label">
                        THỜI ĐIỂM RA
                      </Text>
                      <Text strong className="sessions-timeline-time">
                        {formatDateTime(getEndTime(selectedSession))}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sessions-detail-section">
                <Title level={5}>Thông tin camera và phiên</Title>

                <div className="sessions-detail-grid">
                  <DetailItem
                    label="Mã phiên"
                    value={
                      selectedSession.session_code ||
                      selectedSession.event_code ||
                      selectedSession.id
                    }
                  />
                  <DetailItem label="ID phiên" value={selectedSession.id} />
                  <DetailItem
                    label="Camera"
                    value={getCameraName(selectedSession)}
                  />
                  <DetailItem
                    label="ID camera"
                    value={selectedSession.camera_id}
                  />
                  <DetailItem
                    label="Thời lượng"
                    value={formatDuration(getDurationSeconds(selectedSession))}
                  />
                  <DetailItem
                    label="Ngày tạo"
                    value={formatDateTime(selectedSession.created_at)}
                  />
                </div>
              </div>

              {selectedSession.note && (
                <div className="sessions-detail-section">
                  <Title level={5}>Ghi chú</Title>
                  <Text className="sessions-note">{selectedSession.note}</Text>
                </div>
              )}
            </div>
          )}
        </Spin>
      </Drawer>
    </div>
  );
}
