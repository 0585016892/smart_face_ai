import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from "antd";
import { Camera, RefreshCw, Webcam } from "lucide-react";
import { createCamera } from "../../api/cameraApi";

export default function RegisterWebcamModal({ open, onCancel, onSuccess }) {
  const [form] = Form.useForm();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState("");

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setPreviewReady(false);
  }, []);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    setError("");

    try {
      // Xin quyền camera để trình duyệt trả về tên thiết bị.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      permissionStream.getTracks().forEach((track) => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();

      const cameras = allDevices.filter(
        (device) => device.kind === "videoinput",
      );

      setDevices(cameras);

      if (!cameras.length) {
        setError("Không tìm thấy webcam trên thiết bị này.");
        return;
      }

      setSelectedDevice((current) => {
        if (current && cameras.some((item) => item.deviceId === current)) {
          return current;
        }

        return cameras[0].deviceId;
      });
    } catch (err) {
      console.error("LOAD WEBCAM ERROR:", err);
      setError(
        "Không thể truy cập webcam. Hãy cấp quyền Camera cho trình duyệt.",
      );
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const startPreview = useCallback(
    async (deviceId) => {
      stopPreview();

      if (!deviceId) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setPreviewReady(true);
        }
      } catch (err) {
        console.error("WEBCAM PREVIEW ERROR:", err);
        setError("Không thể khởi động webcam đã chọn.");
        stopPreview();
      }
    },
    [stopPreview],
  );

  useEffect(() => {
    if (!open) {
      stopPreview();
      return;
    }

    form.resetFields();
    setError("");
    setDevices([]);
    setSelectedDevice("");

    loadDevices();

    return () => stopPreview();
  }, [open, form, loadDevices, stopPreview]);

  useEffect(() => {
    if (open && selectedDevice) {
      startPreview(selectedDevice);
    }
  }, [open, selectedDevice, startPreview]);

  const handleSubmit = async (values) => {
    if (!selectedDevice) {
      message.warning("Vui lòng chọn webcam.");
      return;
    }

    setSaving(true);

    try {
      const device = devices.find((item) => item.deviceId === selectedDevice);

      const payload = {
        camera_code: values.camera_code.trim(),
        camera_name: values.camera_name.trim(),
        manufacturer: "Laptop",
        model: device?.label || "Built-in Webcam",
        location: values.location || "",
        description: values.description || "Webcam đăng ký từ trình duyệt",
        protocol: "other",
        status: "inactive",
        is_enabled: 1,
        connection_config: {
          source: "browser_webcam",
          device_id: selectedDevice,
          device_label: device?.label || "Webcam laptop",
          capture_mode: "continuous",
          capture_interval_ms: 2500,
        },
      };

      const response = await createCamera(payload);

      const body = response?.data ?? response;

      if (body?.success === false) {
        throw new Error(body.message || "Không thể đăng ký webcam.");
      }

      message.success("Đăng ký webcam thành công!");

      stopPreview();

      if (onSuccess) {
        await onSuccess(body.data ?? body);
      }

      onCancel?.();
    } catch (err) {
      console.error("REGISTER WEBCAM ERROR:", err);

      message.error(
        err.response?.data?.message ||
          err.message ||
          "Đăng ký webcam thất bại.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Webcam size={20} />
          Đăng ký webcam laptop
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={680}
      destroyOnHidden
      centered
    >
      <Alert
        type="info"
        showIcon
        message="Webcam hoạt động trực tiếp trên trình duyệt"
        description="Máy tính cần cấp quyền truy cập camera. Webcam không cần địa chỉ RTSP hay ONVIF."
        style={{ marginBottom: 20 }}
      />

      <div
        style={{
          background: "#0F172A",
          borderRadius: 12,
          overflow: "hidden",
          aspectRatio: "16 / 9",
          position: "relative",
          marginBottom: 16,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: previewReady ? "block" : "none",
          }}
        />

        {!previewReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {loadingDevices ? (
              <Spin />
            ) : (
              <>
                <Camera size={36} />
                <span>Đang chờ webcam...</span>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          camera_code: `WEBCAM-${Date.now().toString().slice(-6)}`,
          camera_name: "Webcam laptop",
        }}
      >
        <Form.Item
          label="Mã camera"
          name="camera_code"
          rules={[{ required: true, message: "Nhập mã camera." }]}
        >
          <Input placeholder="VD: WEBCAM-001" />
        </Form.Item>

        <Form.Item
          label="Tên camera"
          name="camera_name"
          rules={[{ required: true, message: "Nhập tên camera." }]}
        >
          <Input placeholder="Webcam laptop" />
        </Form.Item>

        <Form.Item label="Thiết bị webcam" required>
          <Space.Compact style={{ width: "100%" }}>
            <Select
              value={selectedDevice || undefined}
              onChange={setSelectedDevice}
              loading={loadingDevices}
              placeholder="Chọn webcam"
              style={{ flex: 1 }}
              options={devices.map((device, index) => ({
                value: device.deviceId,
                label: device.label || `Webcam ${index + 1}`,
              }))}
            />

            <Button
              icon={<RefreshCw size={16} />}
              onClick={loadDevices}
              loading={loadingDevices}
            />
          </Space.Compact>
        </Form.Item>

        <Form.Item label="Vị trí" name="location">
          <Input placeholder="VD: Phòng bảo vệ" />
        </Form.Item>

        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={2} placeholder="Mô tả thêm về webcam..." />
        </Form.Item>

        <Space style={{ marginBottom: 20 }}>
          <Tag color="blue">Browser Webcam</Tag>
          <Tag color="green">Quét liên tục</Tag>
          <Tag color="default">2,5 giây/lần</Tag>
        </Space>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onCancel}>Hủy</Button>

          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!selectedDevice || !previewReady}
          >
            Đăng ký webcam
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
