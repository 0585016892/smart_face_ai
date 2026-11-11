import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import {
  Activity,
  Camera,
  CheckCircle2,
  CircleAlert,
  Eye,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  ScanFace,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  getCameras,
  getCameraDetail,
  createCamera,
  updateCamera,
  toggleCamera,
  deleteCamera,
} from "../api/cameraApi";

import RegisterWebcamModal from "../components/camera/RegisterWebcamModal";
import WebcamRecognitionModal from "../components/camera/WebcamRecognitionModal";

import "./css/CamerasPage.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const EMPTY_ARRAY = [];

const protocolOptions = [
  { label: "RTSP", value: "rtsp" },
  { label: "ONVIF", value: "onvif" },
  { label: "EZVIZ", value: "ezviz" },
  { label: "Upload", value: "upload" },
  { label: "Khác", value: "other" },
];

const statusOptions = [
  { label: "Đang hoạt động", value: "active" },
  { label: "Không hoạt động", value: "inactive" },
  { label: "Lỗi kết nối", value: "error" },
];

const statusConfig = {
  active: {
    label: "Đang hoạt động",
    icon: <Wifi size={13} />,
    className: "is-active",
  },
  inactive: {
    label: "Không hoạt động",
    icon: <WifiOff size={13} />,
    className: "is-inactive",
  },
  error: {
    label: "Lỗi kết nối",
    icon: <CircleAlert size={13} />,
    className: "is-error",
  },
};

const protocolLabel = (protocol) =>
  protocolOptions.find((item) => item.value === protocol)?.label ||
  protocol ||
  "Chưa xác định";

const formatDate = (value) => {
  if (!value) return "Chưa ghi nhận";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Chưa ghi nhận";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const isBrowserWebcam = (camera) => {
  let config = camera?.connection_config;

  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      config = null;
    }
  }

  return config?.source === "browser_webcam";
};

const getCameraType = (camera) =>
  isBrowserWebcam(camera) ? "Webcam laptop" : "Camera IP";

const splitRtspUrls = (value = "") => {
  const text = Array.isArray(value) ? value.join("\n") : String(value);

  return (
    text
      .match(/rtsp:\/\/[\s\S]*?(?=rtsp:\/\/|$)/gi)
      ?.map((item) => item.trim().replace(/[,;\s]+$/, ""))
      .filter(Boolean) || []
  );
};

const getRtspHost = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return "Không xác định IP";
  }
};

const parseConnectionConfig = (value) => {
  if (!value?.trim()) return null;

  let config;

  try {
    config = JSON.parse(value);
  } catch {
    throw new Error("Cấu hình kết nối phải là JSON hợp lệ");
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Cấu hình kết nối phải là một object JSON");
  }

  return config;
};

/* =========================================================
   STATUS
========================================================= */

const CameraStatus = ({ status }) => {
  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <span className={`camera-status ${config.className}`}>
      <span className="camera-status-dot" />
      {config.icon}
      {config.label}
    </span>
  );
};

/* =========================================================
   PAGE
========================================================= */

const CamerasPage = () => {
  const [form] = Form.useForm();

  const [cameras, setCameras] = useState(EMPTY_ARRAY);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [protocolFilter, setProtocolFilter] = useState(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const [registerWebcamOpen, setRegisterWebcamOpen] = useState(false);
  const [webcamCamera, setWebcamCamera] = useState(null);

  const selectedProtocol = Form.useWatch("protocol", form);
  const rtspInput = Form.useWatch("rtsp_urls", form) || "";

  const rtspList = useMemo(() => splitRtspUrls(rtspInput), [rtspInput]);

  const isBulkRtsp = !editingCamera && selectedProtocol === "rtsp";

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchCameras = useCallback(
    async (page = 1, pageSize = 10) => {
      setLoading(true);

      try {
        const result = await getCameras({
          page,
          limit: pageSize,
          keyword: search.trim(),
          status: statusFilter,
          protocol: protocolFilter,
        });

        const items = Array.isArray(result?.data) ? result.data : [];
        const pageData = result?.pagination || {};

        setCameras(items);

        setPagination({
          current: Number(pageData.page || page),
          pageSize: Number(pageData.limit || pageSize),
          total: Number(pageData.total || 0),
        });
      } catch (error) {
        console.error("GET CAMERAS ERROR:", error);
        message.error(error.message || "Không thể tải danh sách camera");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, protocolFilter],
  );

  useEffect(() => {
    fetchCameras(1, pagination.pageSize);
  }, [fetchCameras, pagination.pageSize]);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const statistics = useMemo(() => {
    const webcamCount = cameras.filter(isBrowserWebcam).length;

    return {
      total: pagination.total,
      active: cameras.filter((item) => item.status === "active").length,
      inactive: cameras.filter((item) => item.status === "inactive").length,
      error: cameras.filter((item) => item.status === "error").length,
      enabled: cameras.filter((item) => Boolean(item.is_enabled)).length,
      webcam: webcamCount,
      ipCamera: cameras.length - webcamCount,
    };
  }, [cameras, pagination.total]);

  /* =========================================================
     CREATE
  ========================================================= */

  const openCreateModal = () => {
    setEditingCamera(null);
    form.resetFields();

    form.setFieldsValue({
      manufacturer: "EZVIZ",
      protocol: "rtsp",
      status: "inactive",
      is_enabled: true,
      connection_config: "",
      rtsp_urls: "",
    });

    setModalOpen(true);
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const openEditModal = (camera) => {
    setEditingCamera(camera);

    let connectionConfig = camera.connection_config;

    if (typeof connectionConfig === "object" && connectionConfig) {
      connectionConfig = JSON.stringify(connectionConfig, null, 2);
    }

    form.setFieldsValue({
      camera_code: camera.camera_code,
      camera_name: camera.camera_name,
      manufacturer: camera.manufacturer,
      model: camera.model,
      location: camera.location,
      description: camera.description,
      protocol: camera.protocol,
      status: camera.status,
      is_enabled: Boolean(camera.is_enabled),
      connection_config: connectionConfig || "",
      rtsp_urls: "",
    });

    setModalOpen(true);
  };

  /* =========================================================
     SAVE
  ========================================================= */

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        camera_code: values.camera_code?.trim() || undefined,
        camera_name: values.camera_name?.trim() || undefined,
        manufacturer: values.manufacturer || "Khác",
        model: values.model || null,
        location: values.location || null,
        description: values.description || null,
        protocol: values.protocol || "rtsp",
        status: values.status || "inactive",
        is_enabled: Boolean(values.is_enabled),
        connection_config: null,
      };

      if (!editingCamera && values.protocol === "rtsp") {
        const urls = splitRtspUrls(values.rtsp_urls);

        if (!urls.length) {
          message.error("Vui lòng nhập ít nhất một đường dẫn RTSP");
          return;
        }

        payload.rtsp_urls = values.rtsp_urls.trim();
      } else {
        payload.connection_config = parseConnectionConfig(
          values.connection_config || "",
        );
      }

      setSaving(true);

      if (editingCamera) {
        await updateCamera(editingCamera.id, payload);
        message.success("Cập nhật camera thành công");
      } else {
        await createCamera(payload);

        message.success(
          payload.rtsp_urls
            ? `Đã gửi yêu cầu thêm ${splitRtspUrls(payload.rtsp_urls).length} camera`
            : "Thêm camera thành công",
        );
      }

      setModalOpen(false);
      form.resetFields();

      await fetchCameras(
        editingCamera ? pagination.current : 1,
        pagination.pageSize,
      );
    } catch (error) {
      if (error?.errorFields) return;

      console.error("SAVE CAMERA ERROR:", error);
      message.error(error.message || "Không thể lưu camera");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DETAIL
  ========================================================= */

  const handleDetail = async (camera) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedCamera(null);

    try {
      const result = await getCameraDetail(camera.id);
      setSelectedCamera(result.data);
    } catch (error) {
      console.error("CAMERA DETAIL ERROR:", error);
      message.error(error.message || "Không thể tải thông tin camera");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  /* =========================================================
     TOGGLE ENABLED
  ========================================================= */

  const handleToggle = async (camera, checked) => {
    setActionId(camera.id);

    try {
      await toggleCamera(camera.id, checked);

      message.success(checked ? "Đã kích hoạt camera" : "Đã tắt camera");

      await fetchCameras(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error("TOGGLE CAMERA ERROR:", error);
      message.error(error.message || "Không thể thay đổi trạng thái kích hoạt");
    } finally {
      setActionId(null);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async (camera) => {
    setActionId(camera.id);

    try {
      await deleteCamera(camera.id);
      message.success("Đã xóa camera");

      const nextPage =
        cameras.length === 1 && pagination.current > 1
          ? pagination.current - 1
          : pagination.current;

      await fetchCameras(nextPage, pagination.pageSize);
    } catch (error) {
      console.error("DELETE CAMERA ERROR:", error);
      message.error(error.message || "Không thể xóa camera");
    } finally {
      setActionId(null);
    }
  };

  /* =========================================================
     WEBCAM
  ========================================================= */

  const handleWebcamRegistered = async () => {
    setRegisterWebcamOpen(false);
    await fetchCameras(1, pagination.pageSize);
  };

  const openWebcamRecognition = (camera) => {
    if (!camera.is_enabled) {
      message.warning("Webcam đang bị tắt. Hãy bật webcam trước.");
      return;
    }

    setWebcamCamera(camera);
  };

  /* =========================================================
     FILTER
  ========================================================= */

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(undefined);
    setProtocolFilter(undefined);
  };

  /* =========================================================
     TABLE
  ========================================================= */

  const columns = [
    {
      title: "CAMERA",
      key: "camera",
      width: 255,
      render: (_, record) => {
        const webcam = isBrowserWebcam(record);

        return (
          <div className="camera-device-cell">
            <div className={`camera-device-icon ${webcam ? "webcam" : ""}`}>
              {webcam ? <Monitor size={18} /> : <Video size={18} />}
            </div>

            <div className="camera-device-info">
              <strong>{record.camera_name || "Camera chưa đặt tên"}</strong>
              <span>{record.camera_code || "Chưa có mã"}</span>
              <small>{webcam ? "WEBCAM LAPTOP" : "CAMERA IP"}</small>
            </div>
          </div>
        );
      },
    },
    {
      title: "VỊ TRÍ",
      dataIndex: "location",
      key: "location",
      render: (value) => (
        <span className="camera-location">
          <MapPin size={13} />
          {value || "Chưa cập nhật"}
        </span>
      ),
    },
    {
      title: "NHÀ SẢN XUẤT",
      dataIndex: "manufacturer",
      key: "manufacturer",
      render: (value, record) => (
        <div className="camera-manufacturer">
          <strong>{value || "Khác"}</strong>
          <span>{record.model || "Chưa có model"}</span>
        </div>
      ),
    },
    {
      title: "GIAO THỨC",
      dataIndex: "protocol",
      key: "protocol",
      render: (value) => (
        <Tag className="camera-protocol-tag">{protocolLabel(value)}</Tag>
      ),
    },
    {
      title: "TRẠNG THÁI KẾT NỐI",
      dataIndex: "status",
      key: "status",
      width: 165,
      render: (value) => <CameraStatus status={value} />,
    },
    {
      title: "KÍCH HOẠT",
      dataIndex: "is_enabled",
      key: "is_enabled",
      align: "center",
      width: 105,
      render: (value, record) => (
        <Switch
          size="small"
          checked={Boolean(value)}
          loading={actionId === record.id}
          disabled={actionId === record.id}
          onChange={(checked) => handleToggle(record, checked)}
        />
      ),
    },
    {
      title: "KẾT NỐI CUỐI",
      dataIndex: "last_connected_at",
      key: "last_connected_at",
      width: 135,
      render: (value, record) => (
        <span className="camera-date">
          {isBrowserWebcam(record) ? "Trình duyệt" : formatDate(value)}
        </span>
      ),
    },
    {
      title: "THAO TÁC",
      key: "actions",
      fixed: "right",
      width: 155,
      align: "center",
      render: (_, record) => {
        return (
          <Space size={1}>
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                className="camera-action"
                icon={<Eye size={16} />}
                onClick={() => handleDetail(record)}
              />
            </Tooltip>

            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                className="camera-action"
                icon={<Pencil size={16} />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>

            <Popconfirm
              title="Xóa camera này?"
              description="Thao tác này không thể hoàn tác."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title="Xóa camera">
                <Button
                  type="text"
                  danger
                  className="camera-action"
                  loading={actionId === record.id}
                  icon={<Trash2 size={16} />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="cameras-page">
      <div className="cameras-header">
        <div className="cameras-header-main">
          <div className="cameras-breadcrumb">
            <ShieldCheck size={14} />
            SMART FACE SECURITY
            <span>/</span>
            THIẾT BỊ
          </div>

          <Title level={2}>Quản lý camera</Title>

          <Text>
            Quản lý thiết bị, cấu hình kết nối và theo dõi trạng thái camera.
          </Text>
        </div>

        <div className="cameras-header-actions">
          <Button
            icon={<RefreshCw size={15} />}
            onClick={() =>
              fetchCameras(pagination.current, pagination.pageSize)
            }
            loading={loading}
          >
            Làm mới
          </Button>

          <Button
            icon={<Monitor size={15} />}
            onClick={() => setRegisterWebcamOpen(true)}
          >
            Đăng ký webcam
          </Button>

          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={openCreateModal}
          >
            Thêm camera
          </Button>
        </div>
      </div>

      {/* SUMMARY BAR - KHÔNG DÙNG NHIỀU CARD */}

      <div className="camera-summary">
        <div className="camera-summary-total">
          <Camera size={18} />
          <div>
            <strong>{statistics.total}</strong>
            <span>Tổng camera</span>
          </div>
        </div>

        <div className="camera-summary-divider" />

        <div className="camera-summary-item active">
          <span className="summary-dot" />
          <span>Hoạt động</span>
          <strong>{statistics.active}</strong>
        </div>

        <div className="camera-summary-item inactive">
          <span className="summary-dot" />
          <span>Không hoạt động</span>
          <strong>{statistics.inactive}</strong>
        </div>

        <div className="camera-summary-item error">
          <span className="summary-dot" />
          <span>Lỗi kết nối</span>
          <strong>{statistics.error}</strong>
        </div>

        <div className="camera-summary-divider" />

        <div className="camera-summary-extra">
          <Monitor size={15} />
          Webcam: <strong>{statistics.webcam}</strong>
        </div>

        <div className="camera-summary-extra">
          <Video size={15} />
          Camera IP: <strong>{statistics.ipCamera}</strong>
        </div>
      </div>

      {/* TABLE */}

      <div className="camera-content">
        <div className="camera-content-header">
          <div>
            <div className="camera-content-title">
              <Activity size={17} />
              Danh sách thiết bị
            </div>
            <div className="camera-content-subtitle">
              Hiển thị {cameras.length} thiết bị trên trang hiện tại
            </div>
          </div>

          <Tag className="camera-total-tag">{pagination.total} thiết bị</Tag>
        </div>

        <div className="camera-filters">
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="Tìm tên, mã hoặc vị trí camera..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="camera-search"
          />

          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            className="camera-filter-select"
          />

          <Select
            allowClear
            placeholder="Tất cả giao thức"
            options={protocolOptions}
            value={protocolFilter}
            onChange={setProtocolFilter}
            className="camera-filter-select"
          />

          <Button
            icon={<X size={14} />}
            onClick={clearFilters}
            className="camera-clear-filter"
          >
            Xóa lọc
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={cameras}
          loading={loading}
          scroll={{ x: 1150 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} camera`,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, pageSize) => fetchCameras(page, pageSize),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không tìm thấy camera"
              >
                <Space wrap>
                  <Button onClick={() => setRegisterWebcamOpen(true)}>
                    Đăng ký webcam
                  </Button>
                  <Button type="primary" onClick={openCreateModal}>
                    Thêm camera
                  </Button>
                </Space>
              </Empty>
            ),
          }}
        />
      </div>

      {/* CREATE / EDIT */}

      <Modal
        title={
          <div className="camera-modal-title">
            <div className="camera-modal-icon">
              <Camera size={18} />
            </div>
            <div>
              <strong>
                {editingCamera ? "Cập nhật camera" : "Thêm camera mới"}
              </strong>
              <span>
                {editingCamera
                  ? "Chỉnh sửa thông tin thiết bị"
                  : "Khai báo thiết bị vào hệ thống"}
              </span>
            </div>
          </div>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingCamera ? "Lưu thay đổi" : "Thêm camera"}
        cancelText="Hủy"
        width={720}
        centered
        destroyOnHidden
        className="camera-modal"
      >
        <Form form={form} layout="vertical" className="camera-form">
          <div className="camera-form-section">
            <div className="camera-form-heading">
              <Camera size={15} />
              Thông tin thiết bị
            </div>

            <Row gutter={[14, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="camera_code"
                  label="Mã camera"
                  rules={
                    isBulkRtsp
                      ? []
                      : [{ required: true, message: "Vui lòng nhập mã camera" }]
                  }
                >
                  <Input
                    size="large"
                    placeholder={
                      isBulkRtsp ? "Để trống để tự tạo mã" : "CAM-001"
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="camera_name"
                  label="Tên camera"
                  rules={
                    isBulkRtsp
                      ? []
                      : [
                          {
                            required: true,
                            message: "Vui lòng nhập tên camera",
                          },
                        ]
                  }
                >
                  <Input
                    size="large"
                    placeholder={
                      isBulkRtsp
                        ? "Để trống để tự đặt tên"
                        : "Camera cổng chính"
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="manufacturer" label="Nhà sản xuất">
                  <Input
                    size="large"
                    placeholder="EZVIZ, Hikvision, Dahua..."
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="model" label="Model">
                  <Input size="large" placeholder="Model thiết bị" />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item name="location" label="Vị trí lắp đặt">
                  <Input
                    size="large"
                    prefix={<MapPin size={15} />}
                    placeholder="Cổng chính, tầng 1..."
                  />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item name="description" label="Mô tả">
                  <TextArea rows={2} placeholder="Thông tin bổ sung..." />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="camera-form-section">
            <div className="camera-form-heading">
              <Radio size={15} />
              Cấu hình kết nối
            </div>

            <Row gutter={[14, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="protocol"
                  label="Giao thức"
                  rules={[
                    { required: true, message: "Vui lòng chọn giao thức" },
                  ]}
                >
                  <Select
                    size="large"
                    options={protocolOptions}
                    placeholder="Chọn giao thức"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item name="status" label="Trạng thái kết nối">
                  <Select
                    size="large"
                    options={statusOptions}
                    placeholder="Chọn trạng thái"
                  />
                </Form.Item>
              </Col>
            </Row>

            {!editingCamera && selectedProtocol === "rtsp" ? (
              <>
                <Form.Item
                  name="rtsp_urls"
                  label="Danh sách đường dẫn RTSP"
                  extra="Mỗi đường dẫn một dòng hoặc dán nhiều link liên tiếp."
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng nhập ít nhất một link RTSP",
                    },
                  ]}
                >
                  <TextArea
                    rows={5}
                    placeholder={`rtsp://admin:password@192.168.1.100:554/h264_stream
rtsp://admin:password@192.168.1.101:554/h264_stream`}
                  />
                </Form.Item>

                {rtspList.length > 0 && (
                  <div className="rtsp-preview">
                    <div className="rtsp-preview-heading">
                      <strong>Đường dẫn đã nhận diện</strong>
                      <Tag color="success">
                        <CheckCircle2 size={11} />
                        {rtspList.length} camera
                      </Tag>
                    </div>

                    {rtspList.map((url, index) => (
                      <div className="rtsp-preview-row" key={`${url}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>Camera {index + 1}</strong>
                          <small>{getRtspHost(url)}</small>
                        </div>
                        <Tag>RTSP</Tag>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Form.Item
                name="connection_config"
                label="Cấu hình kết nối (JSON)"
                extra="Nhập cấu hình JSON. Webcam laptop nên sử dụng chức năng đăng ký webcam."
              >
                <TextArea
                  rows={5}
                  placeholder={`{
  "host": "192.168.1.100",
  "port": 554,
  "username": "admin",
  "password": "your-password"
}`}
                />
              </Form.Item>
            )}
          </div>

          <div className="camera-enabled-row">
            <div>
              <strong>Kích hoạt camera</strong>
              <span>Cho phép thiết bị được sử dụng trong hệ thống</span>
            </div>

            <Form.Item name="is_enabled" valuePropName="checked" noStyle>
              <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* DETAIL */}

      <Drawer
        title={
          <div className="camera-drawer-title">
            <span>
              <Settings2 size={17} />
            </span>
            Thông tin camera
          </div>
        }
        width={500}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        className="camera-detail-drawer"
      >
        {detailLoading ? (
          <div className="camera-detail-loading">Đang tải thông tin...</div>
        ) : selectedCamera ? (
          <div className="camera-detail">
            <div className="camera-detail-header">
              <div className="camera-detail-avatar">
                {isBrowserWebcam(selectedCamera) ? (
                  <Monitor size={25} />
                ) : (
                  <Video size={25} />
                )}
              </div>

              <div className="camera-detail-name">
                <Title level={4}>{selectedCamera.camera_name}</Title>
                <Text type="secondary">{selectedCamera.camera_code}</Text>

                <div className="camera-detail-tags">
                  <Tag color="blue">
                    {protocolLabel(selectedCamera.protocol)}
                  </Tag>

                  {isBrowserWebcam(selectedCamera) && (
                    <Tag color="purple">Webcam laptop</Tag>
                  )}

                  <Tag
                    color={selectedCamera.is_enabled ? "success" : "default"}
                  >
                    {selectedCamera.is_enabled ? "Đã kích hoạt" : "Đã tắt"}
                  </Tag>
                </div>
              </div>
            </div>

            <Divider />

            <div className="camera-detail-section-title">
              Thông tin thiết bị
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Loại thiết bị">
                {getCameraType(selectedCamera)}
              </Descriptions.Item>

              <Descriptions.Item label="Nhà sản xuất">
                {selectedCamera.manufacturer || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Model">
                {selectedCamera.model || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Vị trí">
                {selectedCamera.location || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Trạng thái kết nối">
                <CameraStatus status={selectedCamera.status} />
              </Descriptions.Item>

              <Descriptions.Item label="Kết nối cuối">
                {formatDate(selectedCamera.last_connected_at)}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày tạo">
                {formatDate(selectedCamera.created_at)}
              </Descriptions.Item>

              <Descriptions.Item label="Cập nhật">
                {formatDate(selectedCamera.updated_at)}
              </Descriptions.Item>

              <Descriptions.Item label="Mô tả">
                {selectedCamera.description || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Lỗi gần nhất">
                {selectedCamera.last_error || "Không có"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div className="camera-detail-section-title">Cấu hình kết nối</div>

            <pre className="camera-config-preview">
              {JSON.stringify(selectedCamera.connection_config || {}, null, 2)}
            </pre>

            {isBrowserWebcam(selectedCamera) && (
              <Alert
                type="info"
                showIcon
                message="Webcam truy cập từ trình duyệt"
                description="Webcam chỉ hoạt động khi trình duyệt trên thiết bị hiện tại được cấp quyền truy cập camera."
                style={{ marginBottom: 10 }}
              />
            )}

            <Alert
              type="warning"
              showIcon
              message="Lưu ý bảo mật"
              description="Không chia sẻ công khai thông tin đăng nhập camera."
            />

            {isBrowserWebcam(selectedCamera) && (
              <Button
                type="primary"
                block
                icon={<ScanFace size={16} />}
                disabled={!selectedCamera.is_enabled}
                className="camera-detail-recognition"
                onClick={() => {
                  setDetailOpen(false);
                  openWebcamRecognition(selectedCamera);
                }}
              >
                Mở webcam và nhận diện
              </Button>
            )}
          </div>
        ) : (
          <Empty description="Không có dữ liệu camera" />
        )}
      </Drawer>

      <RegisterWebcamModal
        open={registerWebcamOpen}
        onCancel={() => setRegisterWebcamOpen(false)}
        onSuccess={handleWebcamRegistered}
      />

      <WebcamRecognitionModal
        open={Boolean(webcamCamera)}
        camera={webcamCamera}
        onClose={() => setWebcamCamera(null)}
      />
    </div>
  );
};

export default CamerasPage;
