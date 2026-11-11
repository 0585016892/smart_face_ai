import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
} from "antd";

import {
  Settings,
  Monitor,
  ScanFace,
  HardDrive,
  Save,
  RefreshCw,
  Clock,
  ShieldCheck,
  Image,
  Upload,
  Info,
  CheckCircle2,
  RotateCcw,
  Globe,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";

import { getSystemSettings, updateSystemSettings } from "../api/settingsApi";

import "./css/SettingsPage.css";

const DEFAULT_SETTINGS = {
  system_name: "Smart Face Security",
  timezone: "Asia/Ho_Chi_Minh",
  recognition_threshold: 0.65,
  session_timeout_minutes: 15,
  snapshot_retention_days: 30,
  max_upload_size_mb: 10,
};

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { value: "UTC", label: "UTC (UTC+0)" },
  { value: "America/New_York", label: "New York" },
  { value: "Europe/London", label: "London" },
];

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

const normalizeSettings = (rows = []) => {
  const result = { ...DEFAULT_SETTINGS };

  rows.forEach((item) => {
    if (!SETTING_KEYS.includes(item.key)) return;

    const key = item.key;

    if (
      [
        "recognition_threshold",
        "session_timeout_minutes",
        "snapshot_retention_days",
        "max_upload_size_mb",
      ].includes(key)
    ) {
      const number = Number(item.value);
      if (Number.isFinite(number)) result[key] = number;
    } else if (item.value !== null && item.value !== undefined) {
      result[key] = item.value;
    }
  });

  return result;
};

const formatDate = (value) => {
  if (!value) return "Chưa có dữ liệu";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Không xác định";

  return date.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [messageApi, contextHolder] = message.useMessage();

  const hasChanges = useMemo(
    () => SETTING_KEYS.some((key) => settings[key] !== originalSettings[key]),
    [settings, originalSettings],
  );

  const loadSettings = useCallback(
    async (showMessage = false) => {
      try {
        setLoading(true);

        const result = await getSystemSettings();
        const rows = Array.isArray(result?.settings) ? result.settings : [];

        const nextSettings = normalizeSettings(rows);

        setSettings(nextSettings);
        setOriginalSettings(nextSettings);

        const updatedDates = rows
          .map((item) => item.updated_at)
          .filter(Boolean)
          .map((value) => new Date(value))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

        setLastUpdated(
          updatedDates.length ? updatedDates[updatedDates.length - 1] : null,
        );

        if (showMessage) {
          messageApi.success("Đã tải lại cấu hình hệ thống");
        }
      } catch (error) {
        console.error("LOAD SYSTEM SETTINGS ERROR:", error);

        messageApi.error(
          error?.response?.data?.message || "Không thể tải cấu hình hệ thống",
        );
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateField = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setSettings({ ...originalSettings });
    messageApi.info("Đã hủy các thay đổi chưa lưu");
  };

  const validateSettings = () => {
    if (!String(settings.system_name || "").trim()) {
      messageApi.warning("Vui lòng nhập tên hệ thống");
      return false;
    }

    const threshold = Number(settings.recognition_threshold);
    const timeout = Number(settings.session_timeout_minutes);
    const retention = Number(settings.snapshot_retention_days);
    const uploadSize = Number(settings.max_upload_size_mb);

    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      messageApi.warning("Ngưỡng nhận diện phải nằm trong khoảng 0 đến 1");
      return false;
    }

    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1440) {
      messageApi.warning("Thời gian đóng phiên phải từ 1 đến 1440 phút");
      return false;
    }

    if (!Number.isInteger(retention) || retention < 1 || retention > 3650) {
      messageApi.warning("Thời gian lưu ảnh phải từ 1 đến 3650 ngày");
      return false;
    }

    if (!Number.isInteger(uploadSize) || uploadSize < 1 || uploadSize > 100) {
      messageApi.warning("Dung lượng upload phải từ 1 đến 100 MB");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    try {
      setSaving(true);

      const payload = {
        system_name: String(settings.system_name).trim(),
        timezone: settings.timezone,
        recognition_threshold: Number(settings.recognition_threshold),
        session_timeout_minutes: Number(settings.session_timeout_minutes),
        snapshot_retention_days: Number(settings.snapshot_retention_days),
        max_upload_size_mb: Number(settings.max_upload_size_mb),
      };

      await updateSystemSettings(payload);

      setOriginalSettings({ ...payload });
      setSettings({ ...payload });

      messageApi.success("Đã lưu cấu hình hệ thống thành công");

      await loadSettings();
    } catch (error) {
      console.error("SAVE SYSTEM SETTINGS ERROR:", error);

      messageApi.error(
        error?.response?.data?.message || "Không thể lưu cấu hình hệ thống",
      );
    } finally {
      setSaving(false);
    }
  };

  const threshold = Number(settings.recognition_threshold || 0);

  if (loading) {
    return (
      <div className="settings-page">
        {contextHolder}
        <div className="settings-loading">
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 5 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {contextHolder}

      {/* PAGE HEADER */}
      <div className="settings-page-header">
        <div className="settings-heading">
          <div className="settings-heading-icon">
            <Settings size={23} />
          </div>

          <div className="settings-heading-content">
            <div className="settings-breadcrumb">
              QUẢN TRỊ HỆ THỐNG <span>/</span> CÀI ĐẶT
            </div>

            <h1>Cài đặt hệ thống</h1>

            <p>Quản lý cấu hình vận hành, nhận diện và lưu trữ dữ liệu.</p>
          </div>
        </div>

        <div className="settings-header-actions">
          <Tooltip title="Tải lại cấu hình từ máy chủ">
            <Button
              icon={<RefreshCw size={15} />}
              onClick={() => loadSettings(true)}
              disabled={saving}
            >
              Làm mới
            </Button>
          </Tooltip>

          <Button
            type="primary"
            icon={<Save size={15} />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
            className="settings-primary-button"
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="settings-status-bar">
        <div className="settings-status-left">
          <div className="settings-status-icon">
            <SlidersHorizontal size={17} />
          </div>

          <div>
            <strong>Cấu hình hệ thống</strong>
            <span>
              {hasChanges
                ? "Bạn đang có thay đổi chưa được lưu"
                : "Các thông số đang được đồng bộ"}
            </span>
          </div>
        </div>

        <div className="settings-status-right">
          {hasChanges ? (
            <Tag color="warning">Chưa lưu thay đổi</Tag>
          ) : (
            <Tag color="success" icon={<CheckCircle2 size={12} />}>
              Đã đồng bộ
            </Tag>
          )}
        </div>
      </div>

      {/* GENERAL SETTINGS */}
      <Card className="settings-section-card" bordered={false}>
        <div className="settings-section-header">
          <div className="settings-section-icon general">
            <Monitor size={19} />
          </div>

          <div className="settings-section-title">
            <h2>Cấu hình chung</h2>
            <p>Thông tin cơ bản và thiết lập khu vực hệ thống.</p>
          </div>

          <Tag>01 / GENERAL</Tag>
        </div>

        <Divider />

        <Row gutter={[20, 20]}>
          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>Tên hệ thống</label>

              <Input
                size="large"
                value={settings.system_name}
                maxLength={100}
                showCount
                placeholder="Nhập tên hệ thống"
                onChange={(e) => updateField("system_name", e.target.value)}
              />

              <span className="settings-field-hint">
                Tên hiển thị trên giao diện quản trị.
              </span>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>
                <Globe size={15} />
                Múi giờ hệ thống
              </label>

              <Select
                size="large"
                className="settings-full-width"
                value={settings.timezone}
                options={TIMEZONE_OPTIONS}
                showSearch
                optionFilterProp="label"
                onChange={(value) => updateField("timezone", value)}
              />

              <span className="settings-field-hint">
                Múi giờ sử dụng khi hiển thị ngày giờ trong hệ thống.
              </span>
            </div>
          </Col>
        </Row>
      </Card>

      {/* RECOGNITION SETTINGS */}
      <Card className="settings-section-card" bordered={false}>
        <div className="settings-section-header">
          <div className="settings-section-icon recognition">
            <ScanFace size={19} />
          </div>

          <div className="settings-section-title">
            <h2>Nhận diện khuôn mặt</h2>
            <p>Điều chỉnh độ tin cậy và thời gian xử lý phiên nhận diện.</p>
          </div>

          <Tag color="purple">02 / RECOGNITION</Tag>
        </div>

        <Divider />

        <Row gutter={[20, 22]}>
          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>Ngưỡng tin cậy nhận diện</label>

              <InputNumber
                size="large"
                className="settings-full-width"
                min={0}
                max={1}
                step={0.01}
                precision={2}
                value={settings.recognition_threshold}
                onChange={(value) =>
                  updateField("recognition_threshold", value)
                }
              />

              <div className="settings-range-info">
                <span>0.00 – 1.00</span>
                <strong>{threshold.toFixed(2)}</strong>
              </div>

              <div className="settings-threshold-track">
                <div
                  className="settings-threshold-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, threshold * 100))}%`,
                  }}
                />
              </div>

              <span className="settings-field-hint">
                Giá trị càng cao, điều kiện xác nhận khuôn mặt càng nghiêm ngặt.
              </span>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>
                <Clock size={15} />
                Thời gian đóng phiên
              </label>

              <InputNumber
                size="large"
                className="settings-full-width"
                min={1}
                max={1440}
                precision={0}
                value={settings.session_timeout_minutes}
                addonAfter="phút"
                onChange={(value) =>
                  updateField("session_timeout_minutes", value)
                }
              />

              <span className="settings-field-hint">
                Thời gian chờ trước khi đóng phiên khi không còn phát hiện khuôn
                mặt.
              </span>
            </div>
          </Col>
        </Row>

        <div className="settings-info-panel">
          <Info size={17} />
          <div>
            <strong>Lưu ý khi thay đổi ngưỡng nhận diện</strong>
            <span>
              Nên kiểm tra kết quả thực tế sau khi điều chỉnh để cân bằng giữa
              độ chính xác và khả năng nhận diện.
            </span>
          </div>
        </div>
      </Card>

      {/* STORAGE SETTINGS */}
      <Card className="settings-section-card" bordered={false}>
        <div className="settings-section-header">
          <div className="settings-section-icon storage">
            <HardDrive size={19} />
          </div>

          <div className="settings-section-title">
            <h2>Lưu trữ dữ liệu</h2>
            <p>Quản lý thời gian lưu ảnh và giới hạn dung lượng tải lên.</p>
          </div>

          <Tag color="green">03 / STORAGE</Tag>
        </div>

        <Divider />

        <Row gutter={[20, 20]}>
          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>
                <Image size={15} />
                Thời gian lưu ảnh nhận diện
              </label>

              <InputNumber
                size="large"
                className="settings-full-width"
                min={1}
                max={3650}
                precision={0}
                value={settings.snapshot_retention_days}
                addonAfter="ngày"
                onChange={(value) =>
                  updateField("snapshot_retention_days", value)
                }
              />

              <span className="settings-field-hint">
                Số ngày lưu trữ ảnh chụp từ các sự kiện nhận diện.
              </span>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div className="settings-field">
              <label>
                <Upload size={15} />
                Dung lượng upload tối đa
              </label>

              <InputNumber
                size="large"
                className="settings-full-width"
                min={1}
                max={100}
                precision={0}
                value={settings.max_upload_size_mb}
                addonAfter="MB"
                onChange={(value) => updateField("max_upload_size_mb", value)}
              />

              <span className="settings-field-hint">
                Dung lượng tối đa cho mỗi tệp được tải lên hệ thống.
              </span>
            </div>
          </Col>
        </Row>
      </Card>

      {/* SECURITY INFORMATION */}
      <Card className="settings-security-card" bordered={false}>
        <div className="settings-security-icon">
          <ShieldCheck size={22} />
        </div>

        <div className="settings-security-content">
          <h3>Cấu hình được bảo vệ</h3>
          <p>
            Các thông số hệ thống chỉ dành cho tài khoản quản trị viên có quyền
            truy cập.
          </p>

          <div className="settings-updated">
            <Clock size={13} />
            Cập nhật gần nhất: {formatDate(lastUpdated)}
          </div>
        </div>

        <div className="settings-security-badge">
          <LockKeyhole size={15} />
          <span>Được bảo vệ</span>
        </div>
      </Card>

      {/* BOTTOM ACTION */}
      <div className="settings-bottom-bar">
        <div className="settings-bottom-info">
          <span className={hasChanges ? "is-pending" : "is-synced"} />
          {hasChanges
            ? "Bạn có thay đổi chưa được lưu"
            : "Cấu hình đã được đồng bộ"}
        </div>

        <Space>
          <Button
            icon={<RotateCcw size={14} />}
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            Hủy thay đổi
          </Button>

          <Button
            type="primary"
            icon={<Save size={15} />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
            className="settings-primary-button"
          >
            Lưu cấu hình
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default SettingsPage;
