import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from "antd";

import {
  Activity,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Users,
  UserSearch,
  WifiOff,
  Radio,
  Video,
} from "lucide-react";

import {
  getCameras,
  getCameraLiveStatus,
  getCameraLiveSnapshot,
} from "../api/cameraApi";

import "./css/LiveMonitoringPage.css";

const { Title, Text } = Typography;

const STATUS_POLL_INTERVAL = 2000;
const SNAPSHOT_POLL_INTERVAL = 600;

const EMPTY_ARRAY = [];

const getArray = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.data?.items)) return result.data.items;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.rows)) return result.rows;
  return EMPTY_ARRAY;
};

const getCameraId = (camera) => camera?.id ?? camera?.camera_id;

const getCameraName = (camera) =>
  camera?.name ||
  camera?.camera_name ||
  camera?.label ||
  `Camera ${getCameraId(camera)}`;

const getPersonName = (track) => {
  const person = track?.person;

  if (!person) return null;

  return (
    person.full_name ||
    person.name ||
    person.person_name ||
    person.display_name ||
    null
  );
};

const getTrackLabel = (track) => {
  const name = getPersonName(track);

  if (track.status === "known" && name) return name;
  if (track.status === "known") return "Người quen";
  if (track.status === "uncertain") return "Chưa xác định";

  return "Người lạ";
};

const formatTime = (value) => {
  if (!value) return "--:--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--:--:--";

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const base64ToBlob = (base64) => {
  const binary = window.atob(base64);
  const chunks = [];
  const chunkSize = 512 * 1024;

  for (let offset = 0; offset < binary.length; offset += chunkSize) {
    const slice = binary.slice(offset, offset + chunkSize);
    const bytes = new Uint8Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }

    chunks.push(bytes);
  }

  return new Blob(chunks, { type: "image/jpeg" });
};

const getBoxStyle = (box, imageWidth, imageHeight) => {
  if (!box || !imageWidth || !imageHeight) return null;

  const leftValue = Number(box.left);
  const topValue = Number(box.top);
  const rightValue = Number(box.right);
  const bottomValue = Number(box.bottom);

  if (
    !Number.isFinite(leftValue) ||
    !Number.isFinite(topValue) ||
    !Number.isFinite(rightValue) ||
    !Number.isFinite(bottomValue)
  ) {
    return null;
  }

  const toPercentX = (value) =>
    Math.max(
      0,
      Math.min(100, value <= 1 ? value * 100 : (value / imageWidth) * 100),
    );

  const toPercentY = (value) =>
    Math.max(
      0,
      Math.min(100, value <= 1 ? value * 100 : (value / imageHeight) * 100),
    );

  const left = toPercentX(leftValue);
  const top = toPercentY(topValue);
  const right = toPercentX(rightValue);
  const bottom = toPercentY(bottomValue);

  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) return null;

  return {
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
};

// ======================================================
// TRACK LABEL
// ======================================================

function LiveBox({ track, imageWidth, imageHeight }) {
  const boxStyle = getBoxStyle(track.box, imageWidth, imageHeight);

  if (!boxStyle) return null;

  const label = getTrackLabel(track);
  const isKnown = track.status === "known";
  const isUncertain = track.status === "uncertain";

  const color = isKnown ? "#16A36A" : isUncertain ? "#D99A2B" : "#EF5350";

  const similarity =
    track.similarity !== null && track.similarity !== undefined
      ? ` · ${(Number(track.similarity) * 100).toFixed(1)}%`
      : "";

  return (
    <div
      className="lm-detection-box"
      style={{
        ...boxStyle,
        "--detection-color": color,
      }}
    >
      <div className="lm-detection-label" title={`${label}${similarity}`}>
        <span className="lm-detection-indicator" />
        <span className="lm-detection-name">
          {label}
          {similarity}
        </span>
      </div>

      <div className="lm-detection-id">{track.tracking_id}</div>
    </div>
  );
}

// ======================================================
// CAMERA FRAME
// ======================================================

function CameraFrame({
  camera,
  status,
  snapshot,
  selected,
  onSelect,
  onFullscreen,
}) {
  const tracks = snapshot?.tracks || [];

  const imageWidth = Number(snapshot?.imageWidth) || 16;
  const imageHeight = Number(snapshot?.imageHeight) || 9;

  const connected = Boolean(status?.connected);
  const running = Boolean(status?.running);
  const online = connected && running;

  const knownCount = tracks.filter((track) => track.status === "known").length;

  const unknownCount = tracks.filter((track) =>
    ["unknown", "uncertain"].includes(track.status),
  ).length;

  return (
    <Card
      className={`lm-camera-card ${selected ? "is-selected" : ""}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className="lm-camera-card-header">
        <div className="lm-camera-heading">
          <div className="lm-camera-heading-icon">
            <Camera size={18} />
          </div>

          <div className="lm-camera-heading-info">
            <Text strong ellipsis>
              {getCameraName(camera)}
            </Text>

            <Text className="lm-camera-code">
              CAMERA #{getCameraId(camera)}
            </Text>
          </div>
        </div>

        <div className={`lm-camera-status ${online ? "online" : "offline"}`}>
          <span className="lm-status-dot" />
          {online ? "Trực tuyến" : "Ngoại tuyến"}
        </div>
      </div>

      <div
        className="lm-camera-frame"
        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
        onClick={onSelect}
      >
        {snapshot?.url ? (
          <>
            <img
              src={snapshot.url}
              alt={getCameraName(camera)}
              className="lm-camera-image"
            />

            {tracks.map((track) => (
              <LiveBox
                key={track.tracking_id}
                track={track}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
              />
            ))}
          </>
        ) : (
          <div className="lm-camera-placeholder">
            {online ? (
              <div className="lm-camera-loading">
                <div className="lm-camera-loading-icon">
                  <Video size={25} />
                </div>
                <span>Đang nhận dữ liệu hình ảnh...</span>
                <Skeleton active paragraph={false} />
              </div>
            ) : (
              <>
                <WifiOff size={32} />
                <span>Camera chưa có tín hiệu</span>
              </>
            )}
          </div>
        )}

        <div className="lm-frame-top">
          <span className="lm-live-label">
            <span className="lm-live-pulse" />
            LIVE
          </span>

          <span className="lm-frame-time">
            {formatTime(snapshot?.capturedAt)}
          </span>
        </div>

        <Tooltip title="Phóng to camera">
          <Button
            className="lm-frame-fullscreen"
            type="text"
            icon={<Maximize2 size={16} />}
            onClick={(event) => {
              event.stopPropagation();
              onFullscreen();
            }}
          />
        </Tooltip>

        <div className="lm-frame-bottom">
          <span>
            <ScanFace size={13} />
            AI FACE DETECTION
          </span>
          <span>{tracks.length} đối tượng</span>
        </div>
      </div>

      <div className="lm-camera-card-footer">
        <div className="lm-camera-counter">
          <Users size={15} />
          <strong>{tracks.length}</strong>
          <span>Người</span>
        </div>

        <div className="lm-camera-counter known">
          <CheckCircle2 size={14} />
          <strong>{knownCount}</strong>
          <span>Quen</span>
        </div>

        <div className="lm-camera-counter unknown">
          <UserSearch size={14} />
          <strong>{unknownCount}</strong>
          <span>Lạ</span>
        </div>

        <button
          type="button"
          className="lm-camera-detail-link"
          onClick={onSelect}
        >
          Chi tiết
        </button>
      </div>
    </Card>
  );
}

// ======================================================
// STAT CARD
// ======================================================

function LiveStatsCard({
  onlineCount,
  cameraCount,
  totalPeople,
  knownCount,
  unknownCount,
}) {
  const stats = [
    {
      icon: Camera,
      label: "Camera trực tuyến",
      value: onlineCount,
      suffix: `/ ${cameraCount}`,
      variant: "blue",
    },
    {
      icon: Users,
      label: "Người đang xuất hiện",
      value: totalPeople,
      variant: "violet",
    },
    {
      icon: ShieldCheck,
      label: "Người quen",
      value: knownCount,
      variant: "green",
    },
    {
      icon: UserSearch,
      label: "Người chưa xác định",
      value: unknownCount,
      variant: "orange",
    },
  ];

  return (
    <Card className="lm-stats-card" bordered={false}>
      <div className="lm-stats-container">
        {stats.map((item, index) => {
          const Icon = item.icon;

          return (
            <div className={`lm-stats-item ${item.variant}`} key={item.label}>
              <div className="lm-stats-icon">
                <Icon size={19} />
              </div>

              <div className="lm-stats-content">
                <span className="lm-stats-label">{item.label}</span>

                <div className="lm-stats-value">
                  <strong>{item.value}</strong>
                  {item.suffix && (
                    <span className="lm-stats-suffix">{item.suffix}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ======================================================
// MAIN PAGE
// ======================================================

export default function LiveMonitoringPage() {
  const [cameras, setCameras] = useState(EMPTY_ARRAY);
  const [statuses, setStatuses] = useState(EMPTY_ARRAY);
  const [snapshots, setSnapshots] = useState({});

  const [selectedCameraId, setSelectedCameraId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const containerRef = useRef(null);
  const frameElementsRef = useRef({});
  const snapshotUrlsRef = useRef({});
  const snapshotBusyRef = useRef(new Set());
  const statusBusyRef = useRef(false);
  const mountedRef = useRef(true);

  // --------------------------------------------------
  // LOAD CAMERA + STATUS
  // --------------------------------------------------

  const loadData = useCallback(async (showLoading = false) => {
    if (statusBusyRef.current) return;

    statusBusyRef.current = true;

    if (showLoading) setRefreshing(true);

    try {
      const [cameraResult, statusResult] = await Promise.all([
        getCameras(),
        getCameraLiveStatus(),
      ]);

      if (!mountedRef.current) return;

      const cameraList = getArray(cameraResult);
      const statusList = getArray(statusResult);

      setCameras((previous) =>
        JSON.stringify(previous) === JSON.stringify(cameraList)
          ? previous
          : cameraList,
      );

      setStatuses((previous) =>
        JSON.stringify(previous) === JSON.stringify(statusList)
          ? previous
          : statusList,
      );

      setError("");

      setSelectedCameraId((current) => {
        const exists = cameraList.some(
          (camera) => String(getCameraId(camera)) === String(current),
        );

        if (current !== null && exists) return current;

        const first = cameraList[0] || statusList[0];

        return first ? (getCameraId(first) ?? first.camera_id) : null;
      });
    } catch (err) {
      if (!mountedRef.current) return;

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tải dữ liệu giám sát",
      );
    } finally {
      statusBusyRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    loadData();

    const timer = setInterval(() => {
      loadData(false);
    }, STATUS_POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [loadData]);

  // --------------------------------------------------
  // CAMERA / STATUS MAP
  // --------------------------------------------------

  const cameraItems = useMemo(() => {
    const map = new Map();

    cameras.forEach((camera) => {
      const id = getCameraId(camera);

      if (id === undefined || id === null) return;

      map.set(String(id), {
        ...camera,
        camera_id: id,
      });
    });

    statuses.forEach((status) => {
      const id = status.camera_id;

      if (id === undefined || id === null) return;

      const key = String(id);

      if (!map.has(key)) {
        map.set(key, {
          id,
          camera_id: id,
          name: status.camera_name || `Camera ${id}`,
        });
      }
    });

    return [...map.values()];
  }, [cameras, statuses]);

  const statusMap = useMemo(() => {
    const map = new Map();

    statuses.forEach((status) => {
      map.set(String(status.camera_id), status);
    });

    return map;
  }, [statuses]);

  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;

  // --------------------------------------------------
  // SNAPSHOT POLLING
  // --------------------------------------------------

  useEffect(() => {
    let active = true;

    const fetchOneSnapshot = async (camera) => {
      const id = getCameraId(camera);
      const key = String(id);

      const status = statusMapRef.current.get(key);

      if (!status?.running || !status?.connected) return;
      if (snapshotBusyRef.current.has(key)) return;

      snapshotBusyRef.current.add(key);

      try {
        const response = await getCameraLiveSnapshot(id);

        if (!active || !mountedRef.current) return;

        const data = response?.data;

        if (!data?.frame || !data?.frame_id) return;

        const currentSnapshot = snapshotUrlsRef.current[key];

        if (
          currentSnapshot &&
          String(currentSnapshot.frameId) === String(data.frame_id)
        ) {
          return;
        }

        const blob = base64ToBlob(data.frame);
        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = currentSnapshot?.url;

        const nextSnapshot = {
          frameId: data.frame_id,
          url: nextUrl,
          capturedAt: data.captured_at,
          processedAt: data.processed_at,
          imageWidth: Number(data.image_width) || 0,
          imageHeight: Number(data.image_height) || 0,
          personCount: Number(data.person_count) || 0,
          tracks: Array.isArray(data.tracks) ? data.tracks : [],
        };

        snapshotUrlsRef.current[key] = nextSnapshot;

        setSnapshots((previous) => ({
          ...previous,
          [key]: nextSnapshot,
        }));

        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
      } catch (err) {
        // Lần polling tiếp theo sẽ tự thử lại.
      } finally {
        snapshotBusyRef.current.delete(key);
      }
    };

    const fetchSnapshots = async () => {
      await Promise.allSettled(
        cameraItems.map((camera) => fetchOneSnapshot(camera)),
      );
    };

    fetchSnapshots();

    const timer = setInterval(fetchSnapshots, SNAPSHOT_POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cameraItems]);

  // --------------------------------------------------
  // CLEANUP OBJECT URL
  // --------------------------------------------------

  useEffect(() => {
    const snapshotUrls = snapshotUrlsRef.current;
    const snapshotBusy = snapshotBusyRef.current;

    return () => {
      Object.values(snapshotUrls).forEach((snapshot) => {
        if (snapshot?.url) {
          URL.revokeObjectURL(snapshot.url);
        }
      });

      snapshotUrlsRef.current = {};
      snapshotBusy.clear();
    };
  }, []);
  // --------------------------------------------------
  // SELECTED CAMERA
  // --------------------------------------------------

  const selectedCamera = cameraItems.find(
    (camera) => String(getCameraId(camera)) === String(selectedCameraId),
  );

  const selectedStatus = statusMap.get(String(selectedCameraId));
  const selectedSnapshot = snapshots[String(selectedCameraId)];

  // --------------------------------------------------
  // LIVE STATISTICS
  // --------------------------------------------------

  const allTracks = useMemo(
    () =>
      Object.entries(snapshots).flatMap(([cameraId, snapshot]) =>
        (snapshot.tracks || []).map((track) => ({
          ...track,
          camera_id: cameraId,
        })),
      ),
    [snapshots],
  );

  const totalPeople = allTracks.length;

  const knownCount = allTracks.filter(
    (track) => track.status === "known",
  ).length;

  const unknownCount = allTracks.filter((track) =>
    ["unknown", "uncertain"].includes(track.status),
  ).length;

  const onlineCount = statuses.filter(
    (status) => status.connected && status.running,
  ).length;

  // --------------------------------------------------
  // FULLSCREEN
  // --------------------------------------------------

  const handleFullscreen = useCallback(
    async (cameraId = null) => {
      try {
        if (cameraId !== null) {
          setSelectedCameraId(cameraId);
        }

        const key =
          cameraId !== null ? String(cameraId) : String(selectedCameraId);

        const target = frameElementsRef.current[key] || containerRef.current;

        if (!document.fullscreenElement) {
          await target?.requestFullscreen?.();
        } else {
          await document.exitFullscreen?.();
        }
      } catch (err) {
        console.error("Fullscreen error:", err);
      }
    },
    [selectedCameraId],
  );

  useEffect(() => {
    const handleChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
    };
  }, []);

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="lm-loading-page">
        <div className="lm-loading-heading">
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((item) => (
            <Col xs={12} lg={6} key={item}>
              <Card className="lm-stat-card">
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[1, 2, 3].map((item) => (
            <Col xs={24} md={12} xl={8} key={item}>
              <Card>
                <Skeleton.Image active style={{ width: "100%", height: 190 }} />
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="live-monitoring-page" ref={containerRef}>
      <div className="lm-page-inner">
        {/* PAGE HEADER */}
        <div className="lm-page-header">
          <div className="lm-page-heading">
            <div className="lm-page-icon">
              <Activity size={25} />
            </div>

            <div>
              <div className="lm-eyebrow">
                <span className="lm-eyebrow-dot" />
                SMART SECURITY CENTER
              </div>

              <Title level={2} className="lm-page-title">
                Giám sát AI trực tiếp
              </Title>

              <Text className="lm-page-description">
                Theo dõi camera, phát hiện người và nhận diện khuôn mặt theo
                thời gian thực.
              </Text>
            </div>
          </div>

          <div className="lm-header-actions">
            <div className="lm-system-status">
              <span className="lm-system-status-dot" />
              <span>Hệ thống đang giám sát</span>
            </div>

            <Button
              className="lm-refresh-button"
              icon={<RefreshCw size={15} />}
              loading={refreshing}
              onClick={() => loadData(true)}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {error && (
          <Alert
            className="lm-error-alert"
            type="error"
            showIcon
            message="Không tải được dữ liệu giám sát"
            description={error}
          />
        )}

        {/* SUMMARY */}
        {/* SUMMARY */}
        <div className="lm-summary-heading">
          <div>
            <Text className="lm-section-kicker">TỔNG QUAN HỆ THỐNG</Text>
            <Title level={4}>Trạng thái hiện tại</Title>
          </div>

          <div className="lm-summary-updated">
            <Radio size={13} />
            Cập nhật tự động mỗi 2 giây
          </div>
        </div>

        <LiveStatsCard
          onlineCount={onlineCount}
          cameraCount={cameraItems.length}
          totalPeople={totalPeople}
          knownCount={knownCount}
          unknownCount={unknownCount}
        />
        {/* CAMERA SECTION */}
        <div className="lm-section-header">
          <div>
            <div className="lm-section-title">
              <div className="lm-section-title-icon">
                <Video size={18} />
              </div>
              <Title level={4}>Hình ảnh camera</Title>
              <Tag color="success">AI DETECTION ON</Tag>
            </div>

            <Text className="lm-section-description">
              Hình ảnh và khung nhận diện được đồng bộ từ cùng một snapshot AI.
            </Text>
          </div>

          <div className="lm-camera-summary">
            <span className="lm-camera-summary-online">
              <span />
              {onlineCount} trực tuyến
            </span>
            <span className="lm-camera-summary-total">
              {cameraItems.length} camera
            </span>
          </div>
        </div>

        {cameraItems.length === 0 ? (
          <Card className="lm-empty-card">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có camera nào được cấu hình"
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]} className="lm-camera-grid">
            {cameraItems.map((camera) => {
              const id = getCameraId(camera);
              const key = String(id);

              return (
                <Col xs={24} md={12} xl={8} key={key}>
                  <div
                    className="lm-camera-fullscreen-target"
                    ref={(element) => {
                      frameElementsRef.current[key] = element;
                    }}
                  >
                    <CameraFrame
                      camera={camera}
                      status={statusMap.get(key)}
                      snapshot={snapshots[key]}
                      selected={String(selectedCameraId) === key}
                      onSelect={() => setSelectedCameraId(id)}
                      onFullscreen={() => handleFullscreen(id)}
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
        )}

        {/* DETAIL SECTION */}
        <Card className="lm-detail-panel" bordered={false}>
          <div className="lm-detail-header">
            <div className="lm-detail-heading">
              <div className="lm-detail-icon">
                <ScanFace size={20} />
              </div>

              <div>
                <Title level={4}>Chi tiết nhận diện</Title>
                <Text>
                  {selectedCamera
                    ? getCameraName(selectedCamera)
                    : "Chưa chọn camera"}
                </Text>
              </div>
            </div>

            <Select
              value={selectedCameraId}
              onChange={setSelectedCameraId}
              placeholder="Chọn camera"
              className="lm-camera-select"
              options={cameraItems.map((camera) => ({
                value: getCameraId(camera),
                label: getCameraName(camera),
              }))}
            />
          </div>

          {selectedCamera ? (
            <>
              <div className="lm-detail-meta">
                <div className="lm-detail-meta-left">
                  <Tag
                    color={
                      selectedStatus?.connected && selectedStatus?.running
                        ? "success"
                        : "error"
                    }
                  >
                    {selectedStatus?.connected && selectedStatus?.running
                      ? "Đang hoạt động"
                      : "Ngoại tuyến"}
                  </Tag>

                  <Tag color="blue">
                    {selectedSnapshot?.tracks?.length || 0} người trong khung
                    hình
                  </Tag>

                  <span className="lm-detail-time">
                    <Clock3 size={13} />
                    Frame: {formatTime(selectedSnapshot?.capturedAt)}
                  </span>
                </div>

                <Button
                  size="small"
                  className="lm-detail-fullscreen"
                  icon={
                    fullscreen ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )
                  }
                  onClick={() => handleFullscreen()}
                >
                  {fullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                </Button>
              </div>

              {(selectedSnapshot?.tracks || []).length > 0 ? (
                <div className="lm-person-list">
                  {selectedSnapshot.tracks.map((track) => {
                    const isKnown = track.status === "known";
                    const isUncertain = track.status === "uncertain";

                    return (
                      <div className="lm-person-row" key={track.tracking_id}>
                        <div className="lm-person-main">
                          <div
                            className={`lm-person-avatar ${
                              isKnown
                                ? "known"
                                : isUncertain
                                  ? "uncertain"
                                  : "unknown"
                            }`}
                          >
                            <ScanFace size={19} />
                          </div>

                          <div className="lm-person-info">
                            <Text strong ellipsis>
                              {getTrackLabel(track)}
                            </Text>
                            <Text className="lm-person-id">
                              ID: {track.tracking_id || "--"}
                            </Text>
                          </div>
                        </div>

                        <div className="lm-person-meta">
                          <Tag
                            color={
                              isKnown
                                ? "success"
                                : isUncertain
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {isKnown
                              ? "Đã nhận diện"
                              : isUncertain
                                ? "Chưa chắc chắn"
                                : "Người lạ"}
                          </Tag>

                          <Tooltip title="Lần cuối phát hiện">
                            <span className="lm-person-time">
                              <Clock3 size={12} />
                              {formatTime(track.last_seen_at)}
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="lm-detail-empty">
                  <div className="lm-detail-empty-icon">
                    <ScanFace size={25} />
                  </div>
                  <Text strong>Chưa phát hiện người</Text>
                  <Text type="secondary">
                    Camera hiện chưa ghi nhận đối tượng nào trong khung hình.
                  </Text>
                </div>
              )}
            </>
          ) : (
            <div className="lm-detail-empty">
              <Empty description="Chọn camera để xem chi tiết nhận diện" />
            </div>
          )}
        </Card>

        <div className="lm-page-footnote">
          <CircleAlert size={14} />
          <span>
            Tốc độ cập nhật hình ảnh phụ thuộc vào FPS camera, mạng nội bộ và
            hiệu năng xử lý của máy chủ.
          </span>
        </div>
      </div>
    </div>
  );
}
