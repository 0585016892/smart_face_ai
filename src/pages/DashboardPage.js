import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Statistic,
  Tag,
  Typography,
} from "antd";

import {
  Activity,
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Users,
  Video,
  ArrowUpRight,
  ScanFace,
  Radio,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
} from "recharts";

import dayjs from "dayjs";
import "dayjs/locale/vi";

import { getDashboardData } from "../api/dashboardApi";
import "./css/DashboardPage.css";

const { Title, Text } = Typography;

const numberFormat = new Intl.NumberFormat("vi-VN");
const EMPTY_ARRAY = [];

const formatNumber = (value) => numberFormat.format(Number(value ?? 0));

const formatDate = (value) => {
  if (!value) return "--";

  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM") : String(value);
};

const formatDateTime = (value) => {
  if (!value) return "--";

  const date = dayjs(value);
  return date.isValid() ? date.format("HH:mm:ss DD/MM/YYYY") : "--";
};

const formatConfidence = (value) => {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "--";

  return `${(number <= 1 ? number * 100 : number).toFixed(1)}%`;
};

const statusConfig = {
  known: {
    label: "Đã nhận diện",
    color: "success",
    className: "known",
  },
  unknown: {
    label: "Người lạ",
    color: "error",
    className: "unknown",
  },
  uncertain: {
    label: "Chưa chắc chắn",
    color: "warning",
    className: "uncertain",
  },
};

const directionConfig = {
  entry: {
    label: "Vào",
    color: "blue",
  },
  exit: {
    label: "Ra",
    color: "purple",
  },
  unknown: {
    label: "Không rõ",
    color: "default",
  },
};

function StatCard({ title, value, icon: Icon, color, description, type }) {
  return (
    <Card bordered={false} className={`sf-dashboard-stat ${type || ""}`}>
      <div className="sf-stat-top">
        <div className="sf-stat-icon" style={{ "--stat-color": color }}>
          <Icon size={22} strokeWidth={1.9} />
        </div>

        <span className="sf-stat-label">{title}</span>
      </div>

      <div className="sf-stat-value">
        <Statistic
          value={Number(value ?? 0)}
          formatter={(number) => formatNumber(number)}
          valueStyle={{
            color: "#142f49",
            fontSize: 31,
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        />
      </div>

      <div className="sf-stat-bottom">
        <span className="sf-stat-description">{description}</span>
        <ArrowUpRight size={15} />
      </div>
    </Card>
  );
}

function MiniStat({ title, value, icon: Icon, color, description }) {
  return (
    <Card bordered={false} className="sf-mini-stat">
      <div className="sf-mini-stat-icon" style={{ "--mini-color": color }}>
        <Icon size={19} />
      </div>

      <div className="sf-mini-stat-content">
        <Text className="sf-mini-stat-title">{title}</Text>
        <div className="sf-mini-stat-value">{formatNumber(value)}</div>
        <span className="sf-mini-stat-description">{description}</span>
      </div>
    </Card>
  );
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const result = await getDashboardData({
        events: {
          page: 1,
          limit: 8,
        },
      });

      setDashboard(result);
    } catch (err) {
      console.error("DASHBOARD API ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tải dữ liệu Dashboard",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const overview = dashboard?.overview || {};
  const events = overview.events || {};
  const sessions = overview.sessions || {};
  const notifications = overview.notifications || {};

  const daily = dashboard?.daily || EMPTY_ARRAY;
  const cameras = dashboard?.cameras || EMPTY_ARRAY;
  const recentEvents = dashboard?.events || EMPTY_ARRAY;

  const chartData = useMemo(
    () =>
      daily.map((item) => ({
        ...item,
        dateLabel: formatDate(item.date),
      })),
    [daily],
  );

  const maxCameraEvents = useMemo(
    () =>
      Math.max(1, ...cameras.map((camera) => Number(camera.total_events || 0))),
    [cameras],
  );

  if (loading && !dashboard) {
    return (
      <div className="sf-dashboard-page">
        <div className="sf-dashboard-heading">
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>

        <Row gutter={[16, 16]}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Col xs={24} sm={12} xl={6} key={index}>
              <Card bordered={false} className="sf-dashboard-stat">
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
          <Col xs={24} xl={16}>
            <Card bordered={false}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card bordered={false}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="sf-dashboard-page">
      {/* PAGE HEADER */}
      <div className="sf-dashboard-heading">
        <div className="sf-dashboard-heading-main">
          <div className="sf-dashboard-eyebrow">
            <span className="sf-dashboard-eyebrow-dot" />
            AI SECURITY CENTER
          </div>

          <Title level={3} className="sf-dashboard-title">
            Tổng quan hệ thống
          </Title>

          <Text className="sf-dashboard-subtitle">
            Theo dõi hoạt động giám sát và nhận diện khuôn mặt theo thời gian
            thực.
          </Text>

          <div className="sf-dashboard-date">
            <Clock3 size={14} />
            {dayjs().locale("vi").format("dddd, DD/MM/YYYY")}
          </div>
        </div>

        <div className="sf-dashboard-heading-actions">
          <div className="sf-dashboard-live">
            <span />
            AI MONITORING
          </div>

          <Button
            icon={<RefreshCw size={15} />}
            onClick={() => fetchDashboard(true)}
            loading={refreshing}
            className="sf-dashboard-refresh"
          >
            Làm mới dữ liệu
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải dữ liệu Dashboard"
          description={error}
          action={
            <Button size="small" danger onClick={() => fetchDashboard()}>
              Thử lại
            </Button>
          }
          className="sf-dashboard-error"
        />
      )}

      {/* MAIN STATISTICS */}
      <section className="sf-dashboard-section">
        <div className="sf-section-heading">
          <div>
            <div className="sf-section-title">
              <Activity size={17} />
              Thống kê hôm nay
            </div>
            <Text className="sf-section-description">
              Tổng hợp các sự kiện nhận diện trong ngày
            </Text>
          </div>

          <Tag color="processing" className="sf-section-tag">
            HÔM NAY
          </Tag>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Tổng lượt nhận diện"
              value={events.total}
              icon={ScanFace}
              color="#258fd0"
              description="Tổng sự kiện nhận diện"
              type="stat-total"
            />
          </Col>

          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Đã nhận diện"
              value={events.known}
              icon={CheckCircle2}
              color="#16a477"
              description="Nhận diện thành công"
              type="stat-known"
            />
          </Col>

          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Người lạ"
              value={events.unknown}
              icon={ShieldAlert}
              color="#e05252"
              description="Chưa có hồ sơ nhận diện"
              type="stat-unknown"
            />
          </Col>

          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Chưa chắc chắn"
              value={events.uncertain}
              icon={UserRound}
              color="#d7952e"
              description="Cần kiểm tra thêm"
              type="stat-uncertain"
            />
          </Col>
        </Row>
      </section>

      {/* SECONDARY STATISTICS */}
      <section className="sf-dashboard-secondary">
        <Row gutter={[14, 14]}>
          <Col xs={12} sm={12} xl={6}>
            <MiniStat
              title="Người duy nhất"
              value={events.unique_people}
              icon={Users}
              color="#278fce"
              description="Đối tượng đã ghi nhận"
            />
          </Col>

          <Col xs={12} sm={12} xl={6}>
            <MiniStat
              title="Phiên đang mở"
              value={sessions.open}
              icon={Video}
              color="#16a477"
              description="Phiên giám sát hiện tại"
            />
          </Col>

          <Col xs={12} sm={12} xl={6}>
            <MiniStat
              title="Thông báo đã gửi"
              value={notifications.sent}
              icon={Bell}
              color="#d7952e"
              description="Thông báo hệ thống"
            />
          </Col>

          <Col xs={12} sm={12} xl={6}>
            <MiniStat
              title="Phiên đã đóng"
              value={sessions.closed}
              icon={Clock3}
              color="#8968cf"
              description="Phiên đã kết thúc"
            />
          </Col>
        </Row>
      </section>

      {/* CHART AND CAMERAS */}
      <Row gutter={[16, 16]} className="sf-dashboard-main-grid">
        <Col xs={24} xl={16}>
          <Card
            bordered={false}
            className="sf-dashboard-panel sf-chart-panel"
            title={
              <div className="sf-panel-heading">
                <div className="sf-panel-icon">
                  <Activity size={18} />
                </div>
                <div>
                  <div className="sf-panel-title">Biểu đồ nhận diện</div>
                  <div className="sf-panel-subtitle">
                    Thống kê lượt nhận diện trong 7 ngày gần nhất
                  </div>
                </div>
              </div>
            }
          >
            {chartData.length > 0 ? (
              <div className="sf-dashboard-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 12,
                      right: 12,
                      left: -18,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="sfKnownGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#16a477"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="95%"
                          stopColor="#16a477"
                          stopOpacity={0}
                        />
                      </linearGradient>

                      <linearGradient
                        id="sfUnknownGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#e05252"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="95%"
                          stopColor="#e05252"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#e9eff5"
                    />

                    <XAxis
                      dataKey="dateLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#8193a6", fontSize: 11 }}
                      dy={10}
                    />

                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#8193a6", fontSize: 11 }}
                    />

                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e7edf3",
                        boxShadow: "0 10px 30px rgba(20, 47, 73, 0.1)",
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [formatNumber(value), name]}
                    />

                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{
                        fontSize: 11,
                        paddingBottom: 16,
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="known"
                      name="Đã nhận diện"
                      stroke="#16a477"
                      fill="url(#sfKnownGradient)"
                      strokeWidth={2.5}
                      activeDot={{ r: 5 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="unknown"
                      name="Người lạ"
                      stroke="#e05252"
                      fill="url(#sfUnknownGradient)"
                      strokeWidth={2.5}
                      activeDot={{ r: 5 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="uncertain"
                      name="Chưa chắc chắn"
                      stroke="#d7952e"
                      fill="transparent"
                      strokeWidth={2}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có dữ liệu thống kê trong khoảng thời gian này"
              />
            )}
          </Card>
        </Col>

        {/* CAMERA ACTIVITY */}
        <Col xs={24} xl={8}>
          <Card
            bordered={false}
            className="sf-dashboard-panel sf-camera-panel"
            title={
              <div className="sf-panel-heading">
                <div className="sf-panel-icon">
                  <Camera size={18} />
                </div>
                <div>
                  <div className="sf-panel-title">Hoạt động theo camera</div>
                  <div className="sf-panel-subtitle">
                    Số sự kiện ghi nhận trong ngày
                  </div>
                </div>
              </div>
            }
          >
            {cameras.length > 0 ? (
              <div className="sf-camera-list">
                {cameras.map((camera, index) => {
                  const total = Number(camera.total_events || 0);
                  const percent = Math.round((total / maxCameraEvents) * 100);

                  return (
                    <div
                      className="sf-camera-item"
                      key={camera.camera_id || index}
                    >
                      <div className="sf-camera-item-top">
                        <div className="sf-camera-info">
                          <div className="sf-camera-icon">
                            <Camera size={17} />
                          </div>

                          <div className="sf-camera-name">
                            <strong>
                              {camera.camera_name || "Camera không xác định"}
                            </strong>
                            <span>
                              {camera.camera_code ||
                                camera.location ||
                                "Chưa có thông tin"}
                            </span>
                          </div>
                        </div>

                        <div className="sf-camera-total">
                          <strong>{formatNumber(total)}</strong>
                          <span>lượt</span>
                        </div>
                      </div>

                      <Progress
                        percent={percent}
                        showInfo={false}
                        strokeColor={{
                          "0%": "#258fd0",
                          "100%": "#55c5ed",
                        }}
                        trailColor="#edf2f7"
                        size="small"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có sự kiện từ camera"
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* RECENT EVENTS */}
      <Card
        bordered={false}
        className="sf-dashboard-panel sf-events-panel"
        title={
          <div className="sf-panel-heading">
            <div className="sf-panel-icon">
              <Radio size={18} />
            </div>
            <div>
              <div className="sf-panel-title">Hoạt động nhận diện gần đây</div>
              <div className="sf-panel-subtitle">
                Các sự kiện mới nhất từ hệ thống
              </div>
            </div>
          </div>
        }
        extra={
          <Tag color="processing" className="sf-events-count">
            {recentEvents.length} sự kiện
          </Tag>
        }
      >
        {recentEvents.length > 0 ? (
          <div className="sf-event-list">
            {recentEvents.map((event) => {
              const status =
                statusConfig[event.recognition_status] ||
                statusConfig.uncertain;

              const direction =
                directionConfig[event.direction] || directionConfig.unknown;

              return (
                <div className="sf-event-item" key={event.id}>
                  <div className={`sf-event-avatar ${status.className}`}>
                    {event.recognition_status === "known" ? (
                      <UserRound size={19} />
                    ) : (
                      <ShieldAlert size={19} />
                    )}
                  </div>

                  <div className="sf-event-main">
                    <div className="sf-event-name-row">
                      <strong>
                        {event.full_name ||
                          (event.recognition_status === "unknown"
                            ? "Người lạ"
                            : "Chưa xác định")}
                      </strong>

                      <Tag color={status.color}>{status.label}</Tag>
                    </div>

                    <div className="sf-event-meta">
                      <span>
                        <Camera size={13} />
                        {event.camera_name || "Không rõ camera"}
                      </span>

                      {event.person_code && (
                        <span>
                          <UserRound size={13} />
                          {event.person_code}
                        </span>
                      )}

                      <span>
                        <Activity size={13} />
                        {formatConfidence(event.confidence)}
                      </span>
                    </div>
                  </div>

                  <div className="sf-event-right">
                    <Tag color={direction.color}>{direction.label}</Tag>

                    <span className="sf-event-time">
                      {formatDateTime(event.event_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có hoạt động nhận diện"
          />
        )}
      </Card>

      <div className="sf-dashboard-footer">
        <span className="sf-footer-pulse" />
        Dữ liệu được tải trực tiếp từ hệ thống nhận diện
      </div>
    </div>
  );
}

export default DashboardPage;
