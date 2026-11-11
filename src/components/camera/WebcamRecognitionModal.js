import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";

import {
  Camera,
  CircleAlert,
  CircleCheck,
  ScanFace,
  ShieldCheck,
  UserRound,
  Webcam,
  XCircle,
} from "lucide-react";

import http from "../../api/http";

const { Text, Title } = Typography;

const SCAN_INTERVAL = 2500;

const STATUS_CONFIG = {
  known: {
    label: "Đã nhận diện",
    color: "success",
    icon: <CircleCheck size={20} />,
  },
  unknown: {
    label: "Không xác định",
    color: "error",
    icon: <XCircle size={20} />,
  },
  uncertain: {
    label: "Chưa chắc chắn",
    color: "warning",
    icon: <CircleAlert size={20} />,
  },
};

export default function WebcamRecognitionModal({ open, camera, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);

  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [recognizedCount, setRecognizedCount] = useState(0);

  const cameraId = camera?.id || camera?.camera_id;

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    busyRef.current = false;
    setScanning(false);
  }, []);

  const recognizeCurrentFrame = useCallback(async () => {
    if (busyRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return;
    }

    busyRef.current = true;

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      });

      if (!blob) {
        throw new Error("Không thể chụp ảnh từ webcam.");
      }

      const formData = new FormData();

      // Backend dùng multer.single("image").
      formData.append("image", blob, "webcam-frame.jpg");
      formData.append("camera_id", String(cameraId));

      const response = await http.post("/recognition/test", formData);

      const body = response.data;

      if (body?.success === false) {
        throw new Error(body.message || "Nhận diện thất bại.");
      }

      const recognition = body?.data ?? body;

      if (mountedRef.current) {
        setResult(recognition);
        setLastScan(new Date());
        setScanCount((count) => count + 1);

        if (recognition.status === "known") {
          setRecognizedCount((count) => count + 1);
        }

        setError("");
      }
    } catch (err) {
      const status = err.response?.status;
      const apiMessage =
        err.response?.data?.message ||
        err.message ||
        "Không thể nhận diện khuôn mặt.";

      // 422 thường là không thấy mặt hoặc ảnh không đủ rõ.
      if (status === 422) {
        if (mountedRef.current) {
          setError(apiMessage);
          setLastScan(new Date());
          setScanCount((count) => count + 1);
        }
      } else if (mountedRef.current) {
        setError(apiMessage);
      }
    } finally {
      busyRef.current = false;
    }
  }, [cameraId]);

  const startStream = useCallback(async () => {
    if (!camera) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Trình duyệt không hỗ trợ webcam hoặc trang chưa chạy trên HTTPS/localhost.",
      );
      return;
    }

    setStarting(true);
    setError("");
    setResult(null);
    setScanCount(0);
    setRecognizedCount(0);

    try {
      let config = camera.connection_config || {};

      if (typeof config === "string") {
        try {
          config = JSON.parse(config);
        } catch {
          config = {};
        }
      }

      const deviceId = config.device_id;

      const constraints = {
        audio: false,
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Không tìm thấy vùng hiển thị webcam.");
      }

      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      if (!mountedRef.current) return;

      setScanning(true);

      // Chụp và nhận diện ngay khung hình đầu tiên.
      recognizeCurrentFrame();

      // Sau đó tiếp tục quét định kỳ.
      timerRef.current = setInterval(recognizeCurrentFrame, SCAN_INTERVAL);
    } catch (err) {
      console.error("START WEBCAM ERROR:", err);

      if (mountedRef.current) {
        setError(
          err.name === "NotAllowedError"
            ? "Bạn chưa cấp quyền sử dụng webcam."
            : err.name === "NotFoundError"
              ? "Không tìm thấy webcam."
              : err.message || "Không thể khởi động webcam.",
        );
      }

      stopStream();
    } finally {
      if (mountedRef.current) {
        setStarting(false);
      }
    }
  }, [camera, recognizeCurrentFrame, stopStream]);

  useEffect(() => {
    mountedRef.current = true;

    if (open && camera) {
      startStream();
    } else {
      stopStream();
    }

    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [open, camera, startStream, stopStream]);

  const handleClose = () => {
    stopStream();
    onClose?.();
  };

  const person = result?.person;
  const status = result?.status;
  const statusConfig = STATUS_CONFIG[status];

  const similarity = Math.round(Number(result?.similarity || 0) * 100);

  return (
    <Modal
      title={
        <Space>
          <ScanFace size={20} />
          Nhận diện khuôn mặt
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      centered
      destroyOnHidden
    >
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <div
            style={{
              background: "#0F172A",
              borderRadius: 14,
              overflow: "hidden",
              aspectRatio: "16 / 9",
              position: "relative",
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
                transform: "scaleX(-1)",
              }}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 12,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Badge
                status={scanning ? "processing" : "default"}
                text={
                  <span style={{ color: "#fff" }}>
                    {scanning ? "Đang quét liên tục" : "Đã dừng"}
                  </span>
                }
              />

              <Tag color="blue">{SCAN_INTERVAL / 1000}s / lần</Tag>
            </div>

            {starting && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15,23,42,.65)",
                }}
              >
                <Spin
                  size="large"
                  tip={<span style={{ color: "#fff" }}>Đang mở webcam...</span>}
                />
              </div>
            )}
          </div>

          <Space
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <Space>
              <Webcam size={18} />
              <Text strong>
                {camera?.camera_name || camera?.name || "Webcam"}
              </Text>
            </Space>

            <Space>
              <Button
                icon={<RefreshCwIcon />}
                onClick={() => {
                  stopStream();
                  startStream();
                }}
                disabled={starting}
              >
                Khởi động lại
              </Button>

              <Button danger icon={<XCircle size={16} />} onClick={handleClose}>
                Đóng
              </Button>
            </Space>
          </Space>

          {error && (
            <Alert
              type="warning"
              showIcon
              message={error}
              style={{ marginTop: 14 }}
            />
          )}

          <Divider />

          <Row gutter={12}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Lượt quét"
                  value={scanCount}
                  prefix={<Camera size={17} />}
                />
              </Card>
            </Col>

            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Lượt nhận diện"
                  value={recognizedCount}
                  prefix={<ShieldCheck size={17} />}
                />
              </Card>
            </Col>
          </Row>

          <Text type="secondary" style={{ display: "block", marginTop: 10 }}>
            {lastScan
              ? `Lần quét gần nhất: ${lastScan.toLocaleTimeString("vi-VN")}`
              : "Đang chờ khung hình đầu tiên..."}
          </Text>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Kết quả nhận diện" bordered style={{ height: "100%" }}>
            {!result ? (
              <div
                style={{
                  minHeight: 220,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94A3B8",
                  gap: 12,
                }}
              >
                <ScanFace size={42} />
                <Text type="secondary" style={{ textAlign: "center" }}>
                  Đưa khuôn mặt vào giữa camera để hệ thống nhận diện.
                </Text>
              </div>
            ) : (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    {statusConfig?.icon || <UserRound size={30} />}
                  </div>

                  <Tag
                    color={statusConfig?.color || "default"}
                    style={{ fontSize: 13, padding: "5px 12px" }}
                  >
                    {statusConfig?.label || status || "Chưa xác định"}
                  </Tag>
                </div>

                {person ? (
                  <div style={{ textAlign: "center" }}>
                    <Avatar
                      size={68}
                      icon={<UserRound size={30} />}
                      style={{
                        background: "#DBEAFE",
                        color: "#1D4ED8",
                      }}
                    />

                    <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
                      {person.full_name}
                    </Title>

                    <Text type="secondary">
                      {person.person_code || "Chưa có mã"}
                    </Text>

                    {person.category && (
                      <div style={{ marginTop: 8 }}>
                        <Tag color="blue">{person.category}</Tag>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert
                    type={status === "uncertain" ? "warning" : "error"}
                    showIcon
                    message="Chưa xác định được danh tính"
                    description={result.message}
                  />
                )}

                <Divider style={{ margin: "4px 0" }} />

                <div>
                  <Text type="secondary">Độ tương đồng</Text>

                  <Progress
                    percent={similarity}
                    status={
                      status === "known"
                        ? "success"
                        : status === "uncertain"
                          ? "normal"
                          : "exception"
                    }
                    strokeWidth={10}
                  />
                </div>

                <Text type="secondary" style={{ fontSize: 12 }}>
                  {result.message}
                </Text>

                {result.history && (
                  <Alert
                    type="success"
                    showIcon
                    message="Đã ghi nhận sự kiện"
                    description={
                      result.history.event_code
                        ? `Mã sự kiện: ${result.history.event_code}`
                        : "Backend đã xử lý lưu lịch sử nhận diện."
                    }
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
}

function RefreshCwIcon() {
  return <Camera size={16} />;
}
