import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";

import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Radio,
  RefreshCw,
  Activity,
} from "lucide-react";

import { recognizeWebcamFrame } from "../api/recognitionApi";
import { getCameras } from "../api/cameraApi";
import "./css/RecognitionPage.css";

const { Title, Text } = Typography;

const SCAN_INTERVAL = 1200;

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const formatPercent = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(100, Math.round(number * 100)));
};

const formatDateTime = (value) => {
  if (!value) return "Vừa xong";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Vừa xong";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getStatusConfig = (status) => {
  switch (status) {
    case "known":
      return {
        label: "Đã nhận diện",
        className: "known",
        icon: <CheckCircle2 size={20} />,
        description: "Đã tìm thấy hồ sơ phù hợp trong hệ thống.",
      };

    case "uncertain":
      return {
        label: "Cần xác minh",
        className: "uncertain",
        icon: <ShieldAlert size={20} />,
        description: "Kết quả chưa đủ chắc chắn, cần kiểm tra lại.",
      };

    default:
      return {
        label: "Không xác định",
        className: "unknown",
        icon: <CircleHelp size={20} />,
        description: "Không tìm thấy hồ sơ phù hợp.",
      };
  }
};
const normalizeCameras = (response) => {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.cameras)
      ? response.cameras
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.cameras)
          ? response.data.cameras
          : [];

  return list
    .filter((camera) => {
      return (
        camera.is_enabled !== false &&
        camera.is_enabled !== 0 &&
        camera.is_enabled !== "0"
      );
    })
    .map((camera) => {
      const id = camera.id ?? camera.camera_id;

      return {
        value: String(id),
        label:
          camera.camera_name ||
          camera.name ||
          camera.camera_code ||
          `Camera ${id}`,
        location: camera.location || camera.address || "",
      };
    })
    .filter((camera) => camera.value !== "undefined");
};
const RecognitionPage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Các ref này giúp vòng quét không bị tạo request trùng nhau.
  const scanningRef = useRef(false);
  const requestingRef = useRef(false);
  const mountedRef = useRef(true);

  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState([]);
  const [camerasLoading, setCamerasLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [scanCount, setScanCount] = useState(0);
  const [lastScanAt, setLastScanAt] = useState(null);

  const clearScanTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopContinuousScan = useCallback(() => {
    scanningRef.current = false;
    clearScanTimer();

    if (mountedRef.current) {
      setScanning(false);
      setRecognizing(false);
    }
  }, [clearScanTimer]);
  const loadCameras = useCallback(async () => {
    try {
      setCamerasLoading(true);

      const response = await getCameras();
      const cameraList = normalizeCameras(response);

      setCameras(cameraList);

      // Tự chọn camera đầu tiên nếu chưa chọn.
      setCameraId((currentId) => {
        const stillExists = cameraList.some(
          (camera) => camera.value === currentId,
        );

        if (stillExists) return currentId;

        return cameraList[0]?.value || "";
      });
    } catch (error) {
      console.error("LOAD CAMERAS ERROR:", error);
      message.error(
        error.response?.data?.message ||
          error.message ||
          "Không thể tải danh sách camera.",
      );
    } finally {
      setCamerasLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);
  const releaseCamera = useCallback(() => {
    stopContinuousScan();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (mountedRef.current) {
      setCameraActive(false);
    }
  }, [stopContinuousScan]);

  // Gắn webcam vào thẻ video sau khi React render.
  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    video.play().catch((error) => {
      console.error("VIDEO PLAY ERROR:", error);
      message.error("Không thể phát hình ảnh từ camera.");
    });
  }, [cameraActive]);

  const handleStartCamera = async () => {
    if (cameraLoading || cameraActive) return;

    try {
      setCameraLoading(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Trình duyệt không hỗ trợ camera hoặc trang chưa chạy trên HTTPS.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setCameraActive(true);
      setResult(null);
      setErrorMessage("");
      setScanCount(0);
      setLastScanAt(null);

      message.success("Camera đã sẵn sàng.");
    } catch (error) {
      console.error("START CAMERA ERROR:", error);

      if (error.name === "NotAllowedError") {
        message.error("Chưa được cấp quyền sử dụng camera.");
      } else if (error.name === "NotFoundError") {
        message.error("Không tìm thấy camera trên thiết bị.");
      } else if (error.name === "NotReadableError") {
        message.error("Camera đang được ứng dụng khác sử dụng.");
      } else {
        message.error(error.message || "Không thể khởi động camera.");
      }
    } finally {
      if (mountedRef.current) {
        setCameraLoading(false);
      }
    }
  };

  // Chuyển một khung hình video thành File để gửi API hiện tại.
  const getCurrentFrame = useCallback(() => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        reject(new Error("Camera chưa sẵn sàng."));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Không thể xử lý hình ảnh camera."));
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Không thể lấy khung hình từ camera."));
            return;
          }

          const file = new File([blob], `live-recognition-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });

          resolve(file);
        },
        "image/jpeg",
        0.85,
      );
    });
  }, []);

  // Một lượt nhận diện.
  const recognizeOneFrame = useCallback(async () => {
    if (requestingRef.current || !scanningRef.current) return;

    requestingRef.current = true;

    if (mountedRef.current) {
      setRecognizing(true);
    }

    try {
      const frameFile = await getCurrentFrame();

      if (!scanningRef.current) return;

      const data = await recognizeWebcamFrame(frameFile, cameraId || null);

      if (!mountedRef.current) return;

      setResult(data);
      setErrorMessage("");
      setScanCount((count) => count + 1);
      setLastScanAt(new Date());
    } catch (error) {
      console.error("CONTINUOUS RECOGNITION ERROR:", error);
      console.error("RECOGNITION RESPONSE:", error.response?.data);

      if (mountedRef.current) {
        const serverMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Không thể thực hiện nhận diện.";

        setErrorMessage(serverMessage);
      }
    } finally {
      requestingRef.current = false;

      if (mountedRef.current) {
        setRecognizing(false);
      }

      // Chỉ tiếp tục lượt tiếp theo khi chế độ quét vẫn đang bật.
      if (scanningRef.current && mountedRef.current) {
        timerRef.current = setTimeout(() => {
          recognizeOneFrame();
        }, SCAN_INTERVAL);
      }
    }
  }, [cameraId, getCurrentFrame]);

  const handleStartScanning = () => {
    if (!cameraActive) {
      message.warning("Vui lòng bật camera trước.");
      return;
    }

    if (scanningRef.current) return;

    scanningRef.current = true;

    setScanning(true);
    setResult(null);
    setErrorMessage("");
    setScanCount(0);
    setLastScanAt(null);

    message.success("Đã bắt đầu quét khuôn mặt liên tục.");

    recognizeOneFrame();
  };

  const handleStopScanning = () => {
    stopContinuousScan();
    message.info("Đã tạm dừng quét khuôn mặt.");
  };

  const handleReset = () => {
    stopContinuousScan();
    setResult(null);
    setErrorMessage("");
    setScanCount(0);
    setLastScanAt(null);
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      scanningRef.current = false;

      clearScanTimer();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [clearScanTimer]);

  const statusConfig = result ? getStatusConfig(result.status) : null;

  const person = result?.person;

  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];

  const history = result?.history;

  return (
    <div className="recognition-page">
      {/* HEADER */}
      <div className="recognition-header">
        <div className="recognition-header-main">
          <div className="recognition-eyebrow">
            <ScanFace size={15} />
            SMART FACE SECURITY
          </div>

          <Title level={2} className="recognition-title">
            Nhận diện khuôn mặt
          </Title>

          <Text className="recognition-subtitle">
            Giám sát và nhận diện khuôn mặt trực tiếp bằng camera.
          </Text>
        </div>

        <div className="recognition-header-status">
          <span className={`status-dot ${cameraActive ? "active" : ""}`} />
          {cameraActive ? "Camera đã kết nối" : "Camera chưa kết nối"}
        </div>
      </div>

      {/* THÔNG SỐ */}
      <Row gutter={[12, 12]} className="recognition-stats">
        <Col xs={12} sm={8}>
          <div className="recognition-stat-card">
            <div className="recognition-stat-icon blue">
              <Camera size={19} />
            </div>
            <div>
              <Text type="secondary">Camera</Text>
              <div className="recognition-stat-value">
                {cameraActive ? "Đang hoạt động" : "Chưa bật"}
              </div>
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8}>
          <div className="recognition-stat-card">
            <div className="recognition-stat-icon green">
              <Activity size={19} />
            </div>
            <div>
              <Text type="secondary">Số lượt quét</Text>
              <div className="recognition-stat-value">{scanCount}</div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={8}>
          <div className="recognition-stat-card">
            <div className="recognition-stat-icon gold">
              <Clock3 size={19} />
            </div>
            <div>
              <Text type="secondary">Lần quét gần nhất</Text>
              <div className="recognition-stat-value">
                {lastScanAt
                  ? lastScanAt.toLocaleTimeString("vi-VN")
                  : "--:--:--"}
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* CAMERA + KẾT QUẢ */}
      <Row gutter={[18, 18]} align="stretch">
        <Col xs={24} xl={15}>
          <Card className="recognition-panel camera-panel">
            <div className="recognition-panel-heading">
              <div>
                <Title level={4}>Camera trực tiếp</Title>
                <Text type="secondary">
                  Hình ảnh webcam được xử lý tự động theo từng khung hình.
                </Text>
              </div>

              <Tag color={scanning ? "success" : "default"}>
                {scanning ? (
                  <span className="live-tag">
                    <span className="live-pulse" />
                    LIVE SCANNING
                  </span>
                ) : (
                  "LIVE CAMERA"
                )}
              </Tag>
            </div>

            {/* VIDEO */}
            <div
              className={`recognition-camera-stage ${
                cameraActive ? "camera-is-active" : ""
              }`}
            >
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    className="recognition-video"
                    autoPlay
                    muted
                    playsInline
                  />

                  <div className="camera-overlay">
                    <div className="face-frame">
                      <span className="corner top-left" />
                      <span className="corner top-right" />
                      <span className="corner bottom-left" />
                      <span className="corner bottom-right" />
                    </div>
                  </div>

                  <div className="camera-stage-top">
                    <span className="camera-live-label">
                      <span className="live-pulse" />
                      CAMERA LIVE
                    </span>

                    <span className="camera-resolution">
                      {videoRef.current?.videoWidth || 1280} ×{" "}
                      {videoRef.current?.videoHeight || 720}
                    </span>
                  </div>

                  {scanning && <div className="camera-scanning-line" />}

                  <div className="camera-stage-bottom">
                    <span>
                      <Radio size={14} />
                      {scanning ? "Đang phân tích hình ảnh" : "Đang chờ quét"}
                    </span>

                    <span>{scanCount} lượt xử lý</span>
                  </div>
                </>
              ) : (
                <div className="camera-placeholder">
                  <div className="camera-placeholder-icon">
                    <CameraOff size={38} />
                  </div>

                  <Title level={4}>Camera chưa được bật</Title>

                  <Text type="secondary">
                    Bật webcam để bắt đầu giám sát và nhận diện khuôn mặt.
                  </Text>

                  <Button
                    type="primary"
                    icon={<Camera size={17} />}
                    loading={cameraLoading}
                    onClick={handleStartCamera}
                    size="large"
                  >
                    Kết nối camera
                  </Button>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="recognition-hidden-canvas" />

            {/* CAMERA CONTROLS */}
            <div className="recognition-control-area">
              <div className="recognition-control-top">
                <div className="recognition-control-description">
                  <div
                    className={`recognition-control-indicator ${
                      scanning ? "is-scanning" : ""
                    }`}
                  />

                  <div>
                    <Text strong>
                      {scanning
                        ? "Hệ thống đang quét liên tục"
                        : "Chế độ quét tự động"}
                    </Text>

                    <Text type="secondary">
                      {scanning
                        ? "Đang gửi từng khung hình lên hệ thống nhận diện."
                        : "Bật quét để nhận diện tự động, không cần chụp ảnh."}
                    </Text>
                  </div>
                </div>

                <Tag color={scanning ? "success" : "default"}>
                  {scanning ? "ĐANG QUÉT" : "TẠM DỪNG"}
                </Tag>
              </div>

              <div className="recognition-control-buttons">
                {!cameraActive ? (
                  <Button
                    type="primary"
                    size="large"
                    icon={<Camera size={17} />}
                    loading={cameraLoading}
                    onClick={handleStartCamera}
                    block
                  >
                    Bật camera
                  </Button>
                ) : (
                  <>
                    {!scanning ? (
                      <Button
                        type="primary"
                        size="large"
                        icon={<ScanFace size={18} />}
                        onClick={handleStartScanning}
                        className="recognition-start-button"
                      >
                        Bắt đầu quét liên tục
                      </Button>
                    ) : (
                      <Button
                        danger
                        size="large"
                        icon={<CameraOff size={18} />}
                        onClick={handleStopScanning}
                      >
                        Dừng quét
                      </Button>
                    )}

                    <Button
                      size="large"
                      icon={<RefreshCw size={16} />}
                      onClick={handleReset}
                    >
                      Làm mới
                    </Button>

                    <Button
                      size="large"
                      danger
                      ghost
                      icon={<CameraOff size={16} />}
                      onClick={releaseCamera}
                    >
                      Tắt camera
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Divider />

            {/* CAMERA ID */}
            <div className="recognition-camera-id">
              <div className="recognition-camera-select-heading">
                <div>
                  <Text strong>Chọn camera hệ thống</Text>
                  <Text type="secondary">
                    Camera được lấy tự động từ danh sách quản lý.
                  </Text>
                </div>

                <Button
                  type="text"
                  size="small"
                  icon={<RefreshCw size={15} />}
                  loading={camerasLoading}
                  disabled={scanning}
                  onClick={loadCameras}
                >
                  Làm mới
                </Button>
              </div>

              <Select
                showSearch
                optionFilterProp="label"
                value={cameraId || undefined}
                onChange={setCameraId}
                loading={camerasLoading}
                disabled={scanning || camerasLoading}
                placeholder="Chọn camera để nhận diện..."
                size="large"
                style={{ width: "100%" }}
                options={cameras.map((camera) => ({
                  value: camera.value,
                  label: camera.location
                    ? `${camera.label} - ${camera.location}`
                    : camera.label,
                }))}
                notFoundContent={
                  camerasLoading
                    ? "Đang tải camera..."
                    : "Chưa có camera khả dụng"
                }
              />

              {!camerasLoading && cameras.length === 0 && (
                <Text type="danger">
                  Chưa có camera nào được kích hoạt. Hãy thêm hoặc bật camera
                  trong trang Quản lý camera.
                </Text>
              )}

              {cameras.length > 0 && (
                <Text type="secondary">
                  Đang có {cameras.length} camera khả dụng.
                </Text>
              )}
            </div>
          </Card>
        </Col>

        {/* RESULT */}
        <Col xs={24} xl={9}>
          <Card className="recognition-panel recognition-result-panel">
            <div className="recognition-panel-heading">
              <div>
                <Title level={4}>Kết quả nhận diện</Title>
                <Text type="secondary">Kết quả mới nhất từ camera.</Text>
              </div>

              <div className="recognition-result-heading-icon">
                <ShieldCheck size={21} />
              </div>
            </div>

            {recognizing && !result ? (
              <div className="recognition-result-waiting">
                <Spin size="large" />
                <Title level={5}>Đang phân tích khuôn mặt</Title>
                <Text type="secondary">
                  AI đang xử lý khung hình đầu tiên...
                </Text>
              </div>
            ) : errorMessage && !result ? (
              <div className="recognition-result-error">
                <ShieldAlert size={34} />
                <Title level={5}>Có lỗi khi nhận diện</Title>
                <Text type="secondary">{errorMessage}</Text>
              </div>
            ) : result ? (
              <div className="recognition-result-content">
                <div
                  className={`recognition-status-banner ${statusConfig.className}`}
                >
                  <div className="recognition-status-icon">
                    {statusConfig.icon}
                  </div>

                  <div>
                    <Text strong>{statusConfig.label}</Text>
                    <div className="recognition-status-description">
                      {result.message || statusConfig.description}
                    </div>
                  </div>
                </div>

                {person ? (
                  <div className="recognition-person">
                    <Avatar size={64} className="recognition-person-avatar">
                      {getInitials(person.full_name)}
                    </Avatar>

                    <div className="recognition-person-info">
                      <Text type="secondary">HỒ SƠ ĐƯỢC ĐỐI CHIẾU</Text>

                      <Title level={4}>{person.full_name}</Title>

                      <Space wrap size={6}>
                        {person.person_code && (
                          <Tag color="blue">{person.person_code}</Tag>
                        )}

                        {person.category && <Tag>{person.category}</Tag>}
                      </Space>
                    </div>
                  </div>
                ) : (
                  <div className="recognition-no-person">
                    <Avatar size={58} icon={<UserRound size={26} />} />

                    <div>
                      <Text strong>Chưa xác định được danh tính</Text>
                      <div>
                        <Text type="secondary">
                          Không có hồ sơ nào đạt ngưỡng nhận diện.
                        </Text>
                      </div>
                    </div>
                  </div>
                )}

                <div className="recognition-similarity">
                  <div className="recognition-similarity-heading">
                    <Text strong>Độ tương đồng tốt nhất</Text>
                    <Title level={3}>{formatPercent(result.similarity)}%</Title>
                  </div>

                  <Progress
                    percent={formatPercent(result.similarity)}
                    showInfo={false}
                    strokeColor={
                      result.status === "known"
                        ? "#23865b"
                        : result.status === "uncertain"
                          ? "#d99a24"
                          : "#d35454"
                    }
                    trailColor="#edf0f4"
                    strokeWidth={10}
                  />

                  <Text type="secondary">
                    Điểm so sánh giữa khuôn mặt hiện tại và dữ liệu trong hệ
                    thống.
                  </Text>
                </div>

                {candidates.length > 0 && (
                  <div className="recognition-candidates">
                    <div className="recognition-section-heading">
                      <Text strong>Ứng viên tương đồng</Text>
                      <Tag>{candidates.length} kết quả</Tag>
                    </div>

                    <div className="recognition-candidate-list">
                      {candidates.map((candidate, index) => (
                        <div
                          className="recognition-candidate"
                          key={`${candidate.person_id}-${index}`}
                        >
                          <Avatar className="recognition-candidate-avatar">
                            {getInitials(candidate.full_name)}
                          </Avatar>

                          <div className="recognition-candidate-info">
                            <Text strong>{candidate.full_name}</Text>
                            <Text type="secondary">
                              {candidate.person_code ||
                                `ID: ${candidate.person_id}`}
                            </Text>
                          </div>

                          <div className="recognition-candidate-score">
                            {formatPercent(candidate.similarity)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {history && (
                  <div className="recognition-history-info">
                    <Clock3 size={15} />
                    <Text type="secondary">
                      Sự kiện
                      {history.id ? ` #${history.id}` : ""}
                      {history.created_at
                        ? ` · ${formatDateTime(history.created_at)}`
                        : ""}
                    </Text>
                  </div>
                )}

                {errorMessage && (
                  <div className="recognition-inline-error">
                    <ShieldAlert size={15} />
                    <Text>{errorMessage}</Text>
                  </div>
                )}
              </div>
            ) : (
              <div className="recognition-result-empty">
                <div className="recognition-result-empty-icon">
                  <ScanFace size={42} />
                </div>

                <Title level={5}>Đang chờ nhận diện</Title>

                <Text type="secondary">
                  Kết quả mới nhất sẽ hiển thị tại đây khi camera bắt đầu quét.
                </Text>

                <div className="recognition-empty-steps">
                  <div>
                    <span>01</span>
                    <Text>Kết nối camera</Text>
                  </div>

                  <div>
                    <span>02</span>
                    <Text>Bắt đầu quét liên tục</Text>
                  </div>

                  <div>
                    <span>03</span>
                    <Text>AI đối chiếu khuôn mặt</Text>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* HƯỚNG DẪN TRẠNG THÁI */}
      <div className="recognition-guide">
        <div className="recognition-guide-item">
          <div className="guide-icon guide-success">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <Text strong>Đã nhận diện</Text>
            <Text type="secondary">Tìm thấy hồ sơ phù hợp.</Text>
          </div>
        </div>

        <div className="recognition-guide-item">
          <div className="guide-icon guide-warning">
            <ShieldAlert size={19} />
          </div>
          <div>
            <Text strong>Cần xác minh</Text>
            <Text type="secondary">Điểm tương đồng chưa đủ chắc chắn.</Text>
          </div>
        </div>

        <div className="recognition-guide-item">
          <div className="guide-icon guide-danger">
            <CircleHelp size={19} />
          </div>
          <div>
            <Text strong>Không xác định</Text>
            <Text type="secondary">Không tìm thấy hồ sơ phù hợp.</Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecognitionPage;
