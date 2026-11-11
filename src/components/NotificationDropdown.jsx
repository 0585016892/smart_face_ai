import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Modal,
  Popconfirm,
  Popover,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import {
  Bell,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Trash2,
  UserRound,
  UserRoundSearch,
  XCircle,
  Camera,
  Clock3,
  Send,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import notificationApi from "../api/notificationApi";
import "./NotificationDropdown.css";

const { Text, Paragraph } = Typography;

const POLL_INTERVAL = 300000;

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Chuyển nội dung Telegram HTML thành text an toàn để hiển thị.
 * Không sử dụng dangerouslySetInnerHTML.
 */
function formatNotificationMessage(value = "") {
  if (!value) return "";

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/?(b|strong|i|em|u|s|code|pre|blockquote)>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTypeInfo(type) {
  switch (type) {
    case "known":
      return {
        label: "Người quen",
        color: "success",
        className: "known",
        icon: <UserRound size={15} />,
      };

    case "unknown":
      return {
        label: "Người lạ",
        color: "warning",
        className: "unknown",
        icon: <UserRoundSearch size={15} />,
      };

    default:
      return {
        label: "Hệ thống",
        color: "default",
        className: "system",
        icon: <Bell size={15} />,
      };
  }
}

function getStatusInfo(status) {
  if (status === "success") {
    return {
      label: "Gửi thành công",
      color: "success",
      className: "success",
      icon: <CheckCircle2 size={13} />,
    };
  }

  return {
    label: "Gửi thất bại",
    color: "error",
    className: "failed",
    icon: <XCircle size={13} />,
  };
}

function getSnapshotUrl(path) {
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) return path;

  const baseURL = process.env.REACT_APP_API_URL || "";
  const normalizedBase = baseURL.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  const normalizedPath = String(path).replace(/\\/g, "/").replace(/^\/+/, "");

  return normalizedBase
    ? `${normalizedBase}/${normalizedPath}`
    : `/${normalizedPath}`;
}

function NotificationItem({ item, onDetail, onDelete, canDelete }) {
  const typeInfo = getTypeInfo(item.notification_type);
  const statusInfo = getStatusInfo(item.status);

  const content = formatNotificationMessage(
    item.message || item.error_message || "Không có nội dung",
  );

  return (
    <div className={`notification-item ${typeInfo.className}`}>
      <div className={`notification-item-icon ${typeInfo.className}`}>
        {typeInfo.icon}
      </div>

      <div className="notification-item-content">
        <div className="notification-item-heading">
          <Text strong className="notification-item-title">
            {item.title || typeInfo.label}
          </Text>

          <Tooltip title={formatDate(item.created_at)}>
            <span className="notification-item-time">
              <Clock3 size={12} />
              {formatDate(item.created_at)}
            </span>
          </Tooltip>
        </div>

        <Paragraph
          className="notification-item-message"
          ellipsis={{ rows: 3, expandable: false }}
        >
          {content}
        </Paragraph>

        <div className="notification-item-tags">
          <Tag color={typeInfo.color} icon={typeInfo.icon}>
            {typeInfo.label}
          </Tag>

          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.label}
          </Tag>

          {item.send_type && (
            <Tag color="blue">
              {item.send_type === "photo" ? "Ảnh" : "Tin nhắn"}
            </Tag>
          )}
        </div>

        <div className="notification-item-actions">
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={14} />}
            onClick={() => onDetail(item.id)}
          >
            Chi tiết
          </Button>

          {canDelete && (
            <Popconfirm
              title="Xóa thông báo này?"
              description="Dữ liệu lịch sử thông báo sẽ bị xóa."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(item.id)}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<Trash2 size={14} />}
                aria-label="Xóa thông báo"
              />
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ icon, label, children }) {
  return (
    <div className="notification-detail-field">
      <div className="notification-detail-field-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="notification-detail-field-value">{children || "--"}</div>
    </div>
  );
}

export default function NotificationDropdown({ user }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    known: 0,
    unknown: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    total_pages: 0,
  });

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  const canDelete =
    String(user?.role || user?.role_name || "").toLowerCase() === "admin";

  const fetchNotifications = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [listResult, statsResult] = await Promise.all([
          notificationApi.getList({
            page: 1,
            limit: 15,
          }),
          notificationApi.getStats(),
        ]);

        setItems(listResult?.items || []);

        setPagination(
          listResult?.pagination || {
            page: 1,
            limit: 15,
            total: 0,
            total_pages: 0,
          },
        );

        setStats({
          total: Number(statsResult?.total || 0),
          success: Number(statsResult?.success || 0),
          failed: Number(statsResult?.failed || 0),
          known: Number(statsResult?.known || 0),
          unknown: Number(statsResult?.unknown || 0),
        });
      } catch (error) {
        console.error("GET NOTIFICATIONS ERROR:", error);

        if (!silent) {
          messageApi.error(
            error?.message || "Không thể tải danh sách thông báo",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    fetchNotifications();

    const timer = setInterval(() => {
      fetchNotifications(true);
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const handleOpenChange = (visible) => {
    setOpen(visible);

    if (visible) {
      fetchNotifications();
    }
  };

  const handleDetail = async (id) => {
    try {
      setDetailLoading(true);
      setDetail(null);

      const result = await notificationApi.getDetail(id);

      setDetail(result);
    } catch (error) {
      messageApi.error(error?.message || "Không thể tải chi tiết thông báo");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationApi.remove(id);

      setItems((prev) => prev.filter((item) => item.id !== id));

      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        success: Math.max(
          0,
          prev.success -
            (items.find((item) => item.id === id)?.status === "success"
              ? 1
              : 0),
        ),
        failed: Math.max(
          0,
          prev.failed -
            (items.find((item) => item.id === id)?.status === "failed" ? 1 : 0),
        ),
      }));

      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));

      if (Number(detail?.id) === Number(id)) {
        setDetail(null);
      }

      messageApi.success("Đã xóa thông báo");
      fetchNotifications(true);
    } catch (error) {
      messageApi.error(error?.message || "Không thể xóa thông báo");
    }
  };

  const snapshotUrl = getSnapshotUrl(
    detail?.face_image_path || detail?.snapshot_path,
  );

  const content = (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <div className="notification-panel-heading">
          <div className="notification-panel-bell">
            <Bell size={18} />
          </div>

          <div>
            <div className="notification-panel-title">Thông báo</div>
            <Text type="secondary" className="notification-panel-subtitle">
              Cập nhật tự động mỗi 5 phút. Nhấn nút làm mới để tải lại ngay lập
              tức.
            </Text>
          </div>
        </div>

        <Tooltip title="Làm mới">
          <Button
            type="text"
            className="notification-refresh-button"
            icon={
              <RefreshCw
                size={17}
                className={refreshing ? "notification-spin" : ""}
              />
            }
            onClick={() => fetchNotifications()}
          />
        </Tooltip>
      </div>

      <div className="notification-statistics">
        <span>
          Tổng <strong>{stats.total}</strong>
        </span>

        <span className="notification-stat-divider" />

        <span>
          <CheckCircle2 size={13} className="stat-success-icon" />
          Thành công <strong className="success">{stats.success}</strong>
        </span>

        <span className="notification-stat-divider" />

        <span>
          <XCircle size={13} className="stat-failed-icon" />
          Thất bại <strong className="failed">{stats.failed}</strong>
        </span>
      </div>

      <div className="notification-list">
        {loading ? (
          <div className="notification-loading">
            <Spin />
            <Text type="secondary">Đang tải thông báo...</Text>
          </div>
        ) : items.length === 0 ? (
          <div className="notification-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có thông báo nào"
            />
          </div>
        ) : (
          items.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              onDetail={handleDetail}
              onDelete={handleDelete}
              canDelete={canDelete}
            />
          ))
        )}
      </div>

      <div className="notification-panel-footer">
        <span>{pagination.total} thông báo trong hệ thống</span>
        <span className="notification-live-status">
          <span />
          Đang cập nhật
        </span>
      </div>
    </div>
  );

  return (
    <>
      {contextHolder}

      <Popover
        content={content}
        trigger="click"
        placement="bottomRight"
        open={open}
        onOpenChange={handleOpenChange}
        overlayClassName="notification-popover"
        arrow={false}
      >
        <Tooltip title="Thông báo">
          <Badge
            count={stats.failed}
            overflowCount={99}
            offset={[-3, 3]}
            size="small"
          >
            <Button
              type="text"
              className="header-icon-button notification-trigger"
              icon={<Bell size={19} />}
              aria-label="Thông báo"
            />
          </Badge>
        </Tooltip>
      </Popover>

      <Modal
        title={
          <div className="notification-modal-title">
            <div className="notification-modal-title-icon">
              <Bell size={18} />
            </div>
            <span>Chi tiết thông báo</span>
          </div>
        }
        open={Boolean(detail) || detailLoading}
        onCancel={() => setDetail(null)}
        footer={[
          <Button key="close" onClick={() => setDetail(null)}>
            Đóng
          </Button>,
        ]}
        width={650}
        destroyOnClose
        centered
        className="notification-detail-modal"
      >
        {detailLoading ? (
          <div className="notification-detail-loading">
            <Spin size="large" />
            <Text type="secondary">Đang tải chi tiết...</Text>
          </div>
        ) : detail ? (
          <div className="notification-detail">
            <div className="notification-detail-heading">
              <Avatar
                size={48}
                className={`notification-detail-avatar ${detail.notification_type}`}
                icon={
                  detail.notification_type === "unknown" ? (
                    <UserRoundSearch />
                  ) : detail.notification_type === "known" ? (
                    <UserRound />
                  ) : (
                    <Bell />
                  )
                }
              />

              <div className="notification-detail-heading-info">
                <Text strong className="notification-detail-title">
                  {detail.title || "Thông báo"}
                </Text>
                <Text type="secondary" className="notification-detail-date">
                  <Clock3 size={13} />
                  {formatDate(detail.created_at)}
                </Text>
              </div>

              <Tag
                color={detail.status === "success" ? "success" : "error"}
                icon={
                  detail.status === "success" ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <XCircle size={13} />
                  )
                }
              >
                {getStatusInfo(detail.status).label}
              </Tag>
            </div>

            {snapshotUrl && (
              <div className="notification-detail-image">
                <img
                  src={snapshotUrl}
                  alt="Ảnh nhận diện"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            <div className="notification-detail-section">
              <div className="notification-detail-section-title">
                Nội dung thông báo
              </div>

              <div className="notification-detail-message">
                {formatNotificationMessage(detail.message || "--")}
              </div>
            </div>

            <div className="notification-detail-section">
              <div className="notification-detail-section-title">
                Thông tin chi tiết
              </div>

              <div className="notification-detail-grid">
                <DetailField
                  icon={<ShieldCheck size={14} />}
                  label="Loại thông báo"
                >
                  {getTypeInfo(detail.notification_type).label}
                </DetailField>

                <DetailField icon={<Send size={14} />} label="Kênh gửi">
                  {detail.channel || "--"}
                </DetailField>

                <DetailField icon={<UserRound size={14} />} label="Người nhận">
                  {detail.recipient_name || detail.recipient_chat_id || "--"}
                </DetailField>

                <DetailField icon={<Camera size={14} />} label="Camera ID">
                  {detail.camera_id || "--"}
                </DetailField>

                <DetailField
                  icon={<ExternalLink size={14} />}
                  label="Mã sự kiện"
                >
                  {detail.event_code || "--"}
                </DetailField>

                <DetailField
                  icon={<AlertCircle size={14} />}
                  label="Độ tin cậy"
                >
                  {detail.confidence != null
                    ? `${(Number(detail.confidence) * 100).toFixed(1)}%`
                    : "--"}
                </DetailField>

                <DetailField icon={<Clock3 size={14} />} label="Thời gian gửi">
                  {formatDate(detail.sent_at)}
                </DetailField>

                <DetailField icon={<Send size={14} />} label="Loại gửi">
                  {detail.send_type === "photo"
                    ? "Ảnh"
                    : detail.send_type === "message"
                      ? "Tin nhắn"
                      : "--"}
                </DetailField>
              </div>
            </div>

            {detail.error_message && (
              <div className="notification-error-message">
                <div className="notification-error-title">
                  <XCircle size={15} />
                  Lỗi gửi thông báo
                </div>
                <Paragraph>{detail.error_message}</Paragraph>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
