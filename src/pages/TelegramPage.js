import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Modal,
  Row,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import {
  Send,
  Link2,
  Unlink,
  RefreshCw,
  Copy,
  ExternalLink,
  Bell,
  BellRing,
  ShieldCheck,
  UserRound,
  UserX,
  CheckCircle2,
  Clock3,
  Info,
  MessageCircle,
} from "lucide-react";

import {
  getTelegramLinkStatus,
  createTelegramLinkCode,
  updateTelegramPreferences,
  unlinkTelegram,
} from "../api/telegramApi";

import "./css/TelegramPage.css";

const { Title, Text, Paragraph } = Typography;

const DEFAULT_BOT_USERNAME = "SmartFaceAlertBot";

const TelegramPage = () => {
  const [messageApi, contextHolder] = message.useMessage();

  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [telegram, setTelegram] = useState(null);
  const [linkCode, setLinkCode] = useState(null);

  const [preferences, setPreferences] = useState({
    notify_known: true,
    notify_unknown: true,
    is_active: true,
  });

  const isLinked = Boolean(telegram?.telegram_id);

  const botUsername = useMemo(() => {
    const username = linkCode?.bot_username || DEFAULT_BOT_USERNAME;
    return String(username).replace(/^@/, "");
  }, [linkCode]);

  const botUrl = `https://t.me/${botUsername}`;

  const deepLink = useMemo(() => {
    if (!linkCode?.code) return botUrl;

    return `${botUrl}?start=${encodeURIComponent(linkCode.code)}`;
  }, [botUrl, linkCode]);

  const loadTelegramStatus = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getTelegramLinkStatus();

      // Backend trả data: null nếu chưa liên kết.
      const data = result?.data ?? result;

      if (data?.linked === false || !data) {
        setTelegram(null);
        setPreferences({
          notify_known: true,
          notify_unknown: true,
          is_active: true,
        });
        return;
      }

      const account = data?.linked === true ? data : data;

      if (!account?.telegram_id) {
        setTelegram(null);
        return;
      }

      setTelegram(account);

      setPreferences({
        notify_known: account.notify_known ?? true,
        notify_unknown: account.notify_unknown ?? true,
        is_active: account.is_active ?? true,
      });
    } catch (error) {
      console.error("LOAD TELEGRAM STATUS ERROR:", error);
      messageApi.error(
        error?.response?.data?.message || "Không thể tải trạng thái Telegram",
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadTelegramStatus();
  }, [loadTelegramStatus]);

  const handleCreateLinkCode = async () => {
    try {
      setLinking(true);

      const result = await createTelegramLinkCode();
      const data = result?.data ?? result;

      if (!data?.code) {
        throw new Error("Backend không trả về mã liên kết");
      }

      setLinkCode(data);
      messageApi.success("Đã tạo mã liên kết Telegram");
    } catch (error) {
      console.error("CREATE TELEGRAM LINK CODE ERROR:", error);
      messageApi.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể tạo mã liên kết",
      );
    } finally {
      setLinking(false);
    }
  };

  const handleCopy = async (value, successText) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      messageApi.success(successText);
    } catch (error) {
      console.error("COPY TELEGRAM ERROR:", error);
      messageApi.error("Không thể sao chép. Hãy thử lại.");
    }
  };

  const handleOpenBot = () => {
    window.open(deepLink, "_blank", "noopener,noreferrer");
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);

      await updateTelegramPreferences({
        notify_known: preferences.notify_known,
        notify_unknown: preferences.notify_unknown,
        is_active: preferences.is_active,
      });

      messageApi.success("Đã cập nhật cài đặt thông báo");
      await loadTelegramStatus();
    } catch (error) {
      console.error("UPDATE TELEGRAM PREFERENCES ERROR:", error);
      messageApi.error(
        error?.response?.data?.message ||
          "Không thể cập nhật cài đặt thông báo",
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleUnlink = () => {
    Modal.confirm({
      title: "Huỷ liên kết Telegram?",
      content:
        "Hệ thống sẽ ngừng gửi thông báo đến tài khoản Telegram này. M có thể liên kết lại bất cứ lúc nào.",
      okText: "Huỷ liên kết",
      cancelText: "Giữ liên kết",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          setUnlinking(true);

          await unlinkTelegram();

          setTelegram(null);
          setLinkCode(null);
          setPreferences({
            notify_known: true,
            notify_unknown: true,
            is_active: true,
          });

          messageApi.success("Đã huỷ liên kết Telegram");
        } catch (error) {
          console.error("UNLINK TELEGRAM ERROR:", error);
          messageApi.error(
            error?.response?.data?.message || "Không thể huỷ liên kết Telegram",
          );
          throw error;
        } finally {
          setUnlinking(false);
        }
      },
    });
  };

  const formatDate = (value) => {
    if (!value) return "Chưa có thông tin";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Chưa có thông tin";

    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="telegram-page">
        {contextHolder}
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div className="telegram-page">
      {contextHolder}

      {/* HEADER */}
      <div className="telegram-header">
        <div className="telegram-header-content">
          <div className="telegram-header-icon">
            <Send size={27} />
          </div>

          <div>
            <div className="telegram-eyebrow">SMART FACE SECURITY</div>

            <Title level={2} className="telegram-title">
              Kết nối Telegram
            </Title>

            <Paragraph className="telegram-subtitle">
              Nhận cảnh báo nhận diện khuôn mặt trực tiếp qua Telegram, mọi lúc
              mọi nơi.
            </Paragraph>
          </div>
        </div>

        <Button
          icon={<RefreshCw size={16} />}
          onClick={loadTelegramStatus}
          className="telegram-refresh-btn"
        >
          Làm mới
        </Button>
      </div>

      {/* STATUS */}
      <Card className="telegram-status-card" bordered={false}>
        <div className="telegram-status-content">
          <div className="telegram-status-left">
            <div
              className={`telegram-status-icon ${
                isLinked ? "is-linked" : "is-unlinked"
              }`}
            >
              {isLinked ? <CheckCircle2 size={25} /> : <Link2 size={25} />}
            </div>

            <div>
              <Text className="telegram-status-label">TRẠNG THÁI KẾT NỐI</Text>

              <div className="telegram-status-heading">
                <Title level={4}>
                  {isLinked ? "Đã liên kết Telegram" : "Chưa liên kết"}
                </Title>

                <Tag color={isLinked ? "success" : "default"}>
                  {isLinked ? "Đang hoạt động" : "Chưa kết nối"}
                </Tag>
              </div>

              <Text type="secondary">
                {isLinked
                  ? "Tài khoản Telegram đã sẵn sàng nhận thông báo từ hệ thống."
                  : "Liên kết tài khoản Telegram để nhận cảnh báo nhận diện."}
              </Text>
            </div>
          </div>

          {isLinked && (
            <Button
              danger
              icon={<Unlink size={16} />}
              loading={unlinking}
              onClick={handleUnlink}
            >
              Huỷ liên kết
            </Button>
          )}
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        {/* LEFT */}
        <Col xs={24} lg={14}>
          {!isLinked ? (
            <Card
              className="telegram-main-card"
              bordered={false}
              title={
                <Space>
                  <Link2 size={19} />
                  <span>Liên kết tài khoản</span>
                </Space>
              }
            >
              <div className="telegram-connect-illustration">
                <div className="telegram-connect-circle">
                  <Send size={42} />
                </div>
                <div className="telegram-connect-dot dot-one" />
                <div className="telegram-connect-dot dot-two" />
              </div>

              <div className="telegram-connect-intro">
                <Title level={4}>Kết nối với Telegram Bot</Title>
                <Paragraph type="secondary">
                  Chỉ mất khoảng một phút để liên kết. Sau khi hoàn tất, hệ
                  thống sẽ gửi cảnh báo trực tiếp đến cuộc trò chuyện Telegram
                  của m.
                </Paragraph>
              </div>

              {!linkCode ? (
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<Link2 size={18} />}
                  loading={linking}
                  onClick={handleCreateLinkCode}
                  className="telegram-primary-btn"
                >
                  Tạo mã liên kết
                </Button>
              ) : (
                <div className="telegram-link-instructions">
                  <Alert
                    type="info"
                    showIcon
                    icon={<Info size={17} />}
                    message="Mã liên kết chỉ sử dụng được một lần và có thời hạn 10 phút."
                  />

                  <div className="telegram-code-box">
                    <Text type="secondary">MÃ LIÊN KẾT CỦA M</Text>

                    <div className="telegram-code-value">{linkCode.code}</div>

                    <Button
                      icon={<Copy size={15} />}
                      onClick={() =>
                        handleCopy(linkCode.code, "Đã sao chép mã liên kết")
                      }
                    >
                      Sao chép mã
                    </Button>
                  </div>

                  <div className="telegram-command-box">
                    <div>
                      <Text type="secondary">LỆNH GỬI CHO BOT</Text>
                      <div className="telegram-command">
                        {linkCode.start_command || `/start ${linkCode.code}`}
                      </div>
                    </div>

                    <Button
                      type="text"
                      icon={<Copy size={16} />}
                      onClick={() =>
                        handleCopy(
                          linkCode.start_command || `/start ${linkCode.code}`,
                          "Đã sao chép lệnh",
                        )
                      }
                    />
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<ExternalLink size={17} />}
                    onClick={handleOpenBot}
                    className="telegram-primary-btn"
                  >
                    Mở Telegram Bot
                  </Button>

                  <Button
                    block
                    type="link"
                    onClick={handleCreateLinkCode}
                    loading={linking}
                  >
                    Tạo mã mới
                  </Button>

                  <div className="telegram-step-list">
                    <div className="telegram-step">
                      <span>1</span>
                      <div>
                        <Text strong>Mở Telegram Bot</Text>
                        <Text type="secondary">
                          Nhấn nút mở Telegram phía trên.
                        </Text>
                      </div>
                    </div>

                    <div className="telegram-step">
                      <span>2</span>
                      <div>
                        <Text strong>Gửi lệnh liên kết</Text>
                        <Text type="secondary">
                          Nhấn Start hoặc gửi lệnh /start kèm mã liên kết.
                        </Text>
                      </div>
                    </div>

                    <div className="telegram-step">
                      <span>3</span>
                      <div>
                        <Text strong>Hoàn tất kết nối</Text>
                        <Text type="secondary">
                          Quay lại đây và nhấn Làm mới để kiểm tra.
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <>
              <Card
                className="telegram-main-card"
                bordered={false}
                title={
                  <Space>
                    <UserRound size={19} />
                    <span>Thông tin tài khoản</span>
                  </Space>
                }
              >
                <div className="telegram-account">
                  <Avatar
                    size={68}
                    className="telegram-account-avatar"
                    icon={<Send size={30} />}
                  />

                  <div className="telegram-account-info">
                    <Title level={4}>
                      {telegram.first_name || "Tài khoản Telegram"}
                    </Title>

                    <Text type="secondary">
                      {telegram.username
                        ? `@${String(telegram.username).replace(/^@/, "")}`
                        : `Telegram ID: ${telegram.telegram_id}`}
                    </Text>

                    <div className="telegram-account-tags">
                      <Tag color="success" icon={<CheckCircle2 size={12} />}>
                        Đã xác thực
                      </Tag>
                      <Tag color="blue">Telegram</Tag>
                    </div>
                  </div>
                </div>

                <Divider />

                <div className="telegram-info-row">
                  <span>Telegram ID</span>
                  <Text strong>{telegram.telegram_id || "—"}</Text>
                </div>

                <div className="telegram-info-row">
                  <span>Tên tài khoản</span>
                  <Text strong>
                    {telegram.first_name || telegram.username || "—"}
                  </Text>
                </div>

                <div className="telegram-info-row">
                  <span>Ngày liên kết</span>
                  <Text strong>{formatDate(telegram.linked_at)}</Text>
                </div>

                <div className="telegram-account-note">
                  <ShieldCheck size={18} />
                  <span>
                    Tài khoản Telegram này đã được xác thực với hệ thống Smart
                    Face Security.
                  </span>
                </div>
              </Card>

              <Card
                className="telegram-main-card telegram-preferences-card"
                bordered={false}
                title={
                  <Space>
                    <Bell size={19} />
                    <span>Cài đặt thông báo</span>
                  </Space>
                }
                extra={
                  <Tag color={preferences.is_active ? "success" : "default"}>
                    {preferences.is_active ? "Đang bật" : "Đang tắt"}
                  </Tag>
                }
              >
                <div className="telegram-preference-item">
                  <div className="telegram-preference-icon known">
                    <UserRound size={20} />
                  </div>

                  <div className="telegram-preference-content">
                    <Text strong>Người đã đăng ký</Text>
                    <Text type="secondary">
                      Nhận thông báo khi hệ thống nhận diện người đã có trong dữ
                      liệu.
                    </Text>
                  </div>

                  <Switch
                    checked={preferences.notify_known}
                    onChange={(value) =>
                      handlePreferenceChange("notify_known", value)
                    }
                    disabled={!preferences.is_active}
                  />
                </div>

                <Divider />

                <div className="telegram-preference-item">
                  <div className="telegram-preference-icon unknown">
                    <UserX size={20} />
                  </div>

                  <div className="telegram-preference-content">
                    <Text strong>Người chưa xác định</Text>
                    <Text type="secondary">
                      Nhận cảnh báo khi phát hiện khuôn mặt chưa có trong dữ
                      liệu hệ thống.
                    </Text>
                  </div>

                  <Switch
                    checked={preferences.notify_unknown}
                    onChange={(value) =>
                      handlePreferenceChange("notify_unknown", value)
                    }
                    disabled={!preferences.is_active}
                  />
                </div>

                <Divider />

                <div className="telegram-preference-item">
                  <div className="telegram-preference-icon active">
                    <BellRing size={20} />
                  </div>

                  <div className="telegram-preference-content">
                    <Text strong>Kích hoạt thông báo Telegram</Text>
                    <Text type="secondary">
                      Tắt tùy chọn này để tạm dừng toàn bộ thông báo.
                    </Text>
                  </div>

                  <Switch
                    checked={preferences.is_active}
                    onChange={(value) =>
                      handlePreferenceChange("is_active", value)
                    }
                  />
                </div>

                <Button
                  type="primary"
                  block
                  size="large"
                  loading={savingPreferences}
                  onClick={handleSavePreferences}
                  className="telegram-save-btn"
                >
                  Lưu cài đặt
                </Button>
              </Card>
            </>
          )}
        </Col>

        {/* RIGHT */}
        <Col xs={24} lg={10}>
          <Card
            className="telegram-side-card"
            bordered={false}
            title={
              <Space>
                <Info size={18} />
                <span>Telegram hoạt động như thế nào?</span>
              </Space>
            }
          >
            <div className="telegram-feature">
              <div className="telegram-feature-icon">
                <BellRing size={19} />
              </div>
              <div>
                <Text strong>Cảnh báo tức thì</Text>
                <Paragraph type="secondary">
                  Nhận thông báo ngay khi camera phát hiện và nhận diện khuôn
                  mặt.
                </Paragraph>
              </div>
            </div>

            <div className="telegram-feature">
              <div className="telegram-feature-icon">
                <UserRound size={19} />
              </div>
              <div>
                <Text strong>Thông tin người được nhận diện</Text>
                <Paragraph type="secondary">
                  Xem tên, mã định danh và kết quả nhận diện trong thông báo.
                </Paragraph>
              </div>
            </div>

            <div className="telegram-feature">
              <div className="telegram-feature-icon">
                <MessageCircle size={19} />
              </div>
              <div>
                <Text strong>Hình ảnh sự kiện</Text>
                <Paragraph type="secondary">
                  Thông báo có thể kèm hình ảnh chụp tại thời điểm nhận diện nếu
                  hệ thống lưu được ảnh sự kiện.
                </Paragraph>
              </div>
            </div>
          </Card>

          <Card className="telegram-help-card" bordered={false}>
            <div className="telegram-help-icon">
              <Clock3 size={21} />
            </div>

            <Title level={5}>Lưu ý khi liên kết</Title>

            <ul>
              <li>Mỗi mã liên kết chỉ sử dụng được một lần.</li>
              <li>Mã liên kết có thời hạn 10 phút.</li>
              <li>
                Cần nhấn Start hoặc gửi lệnh liên kết trong cuộc trò chuyện
                riêng với Bot.
              </li>
              <li>Không chia sẻ mã liên kết cho người khác.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TelegramPage;
