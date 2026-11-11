import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Descriptions,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
} from "antd";

import {
  Activity,
  Check,
  Eye,
  ImagePlus,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

import {
  getPersons,
  getPersonDetail,
  getPersonStatistics,
  createPerson,
  updatePerson,
  deletePerson,
  getPersonFaces,
  createPersonFaces,
  deletePersonFace,
} from "../api/personApi";

import "./css/PersonsPage.css";

const { TextArea } = Input;

const PAGE_SIZE = 10;
const MAX_FACE_FILES = 10;
const MAX_FILE_SIZE = 5;

const CATEGORY_OPTIONS = [
  { label: "Nhân viên", value: "employee" },
  { label: "Khách hàng", value: "customer" },
  { label: "Khách", value: "visitor" },
  { label: "Khác", value: "other" },
];

const STATUS_OPTIONS = [
  { label: "Đang hoạt động", value: "active" },
  { label: "Ngừng hoạt động", value: "inactive" },
];

/* =====================================================
   HELPERS
===================================================== */

const unwrap = (response) => {
  if (!response) return {};

  if (
    response.data !== undefined &&
    (response.config || response.headers || response.status)
  ) {
    return response.data;
  }

  return response;
};

const getErrorMessage = (error, fallback = "Đã xảy ra lỗi.") =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.data?.message ||
  error?.message ||
  fallback;

const getApiOrigin = () => {
  const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:12005/api";

  return apiUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
};

/**
 * Hỗ trợ:
 * faces/person_1/image.png
 * /faces/person_1/image.png
 * http://localhost:12005/faces/...
 */
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";

  const value = String(imagePath).trim();

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("//")) {
    return `${window.location.protocol}${value}`;
  }

  return `${getApiOrigin()}/${value.replace(/^\/+/, "")}`;
};

const getPersonId = (person) =>
  person?.id ??
  person?.person_id ??
  person?.person?.id ??
  person?.data?.id ??
  person?.data?.person?.id ??
  null;

const getFaceId = (face) => {
  if (typeof face === "string" || typeof face === "number") {
    return face;
  }

  return (
    face?.id ??
    face?.face_id ??
    face?.profile_id ??
    face?.face_profile_id ??
    face?.image_id ??
    null
  );
};

const getFaceImageRaw = (face) => {
  if (typeof face === "string") return face;

  return (
    face?.image_path ||
    face?.image_url ||
    face?.face_image ||
    face?.photo_url ||
    face?.file_path ||
    face?.file_url ||
    face?.path ||
    face?.url ||
    face?.image ||
    ""
  );
};

const getFaceImage = (face) => getImageUrl(getFaceImageRaw(face));

const getPersonAvatar = (person) =>
  getImageUrl(
    person?.avatar_url ||
      person?.avatar_path ||
      person?.avatar ||
      person?.photo_url,
  );

const getPersonList = (response) => {
  const data = unwrap(response);

  if (Array.isArray(data)) {
    return { items: data, pagination: {} };
  }

  const items =
    data?.items ||
    data?.data?.items ||
    data?.persons ||
    data?.data?.persons ||
    [];

  return {
    items: Array.isArray(items) ? items : [],
    pagination: data?.pagination || data?.data?.pagination || {},
  };
};

const getFaceList = (response) => {
  const data = unwrap(response);

  const findArray = (value, depth = 0) => {
    if (!value || depth > 6) return [];

    if (Array.isArray(value)) return value;

    if (typeof value !== "object") return [];

    const keys = [
      "profiles",
      "faces",
      "face_profiles",
      "face_images",
      "images",
      "items",
      "records",
      "results",
      "list",
    ];

    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }

    for (const key of ["data", "result", "payload", "person", "response"]) {
      if (value[key] && typeof value[key] === "object") {
        const result = findArray(value[key], depth + 1);
        if (result.length || Array.isArray(value[key])) return result;
      }
    }

    return [];
  };

  return findArray(data);
};

const getCategoryLabel = (value) =>
  CATEGORY_OPTIONS.find((item) => item.value === value)?.label ||
  value ||
  "Chưa phân loại";

const validateImageFile = (file) => {
  if (!file) return false;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    message.error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
    return false;
  }

  if (file.size > MAX_FILE_SIZE * 1024 * 1024) {
    message.error(`Mỗi ảnh không được vượt quá ${MAX_FILE_SIZE}MB.`);
    return false;
  }

  return true;
};

/* =====================================================
   FACE IMAGE
===================================================== */

const FaceImage = ({ face, index = 0 }) => {
  const imageUrl = getFaceImage(face);

  const [loading, setLoading] = useState(Boolean(imageUrl));
  const [error, setError] = useState(!imageUrl);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(Boolean(imageUrl));
    setError(!imageUrl);
  }, [imageUrl]);

  if (!imageUrl || error) {
    return (
      <div className="face-image-placeholder">
        <ScanFace size={25} />
        <span>{imageUrl ? "Không tải được ảnh" : "Không có ảnh"}</span>

        {imageUrl && (
          <button
            type="button"
            onClick={() => {
              setError(false);
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="face-image-wrap">
      {loading && (
        <div className="face-image-loading">
          <Spin size="small" />
        </div>
      )}

      <Image
        key={`${imageUrl}-${retry}`}
        src={imageUrl}
        alt={`Ảnh khuôn mặt ${index + 1}`}
        preview
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
          console.error("FACE IMAGE ERROR:", imageUrl);
        }}
      />
    </div>
  );
};

/* =====================================================
   PERSON AVATAR
===================================================== */

const PersonAvatar = ({ person, size = 44 }) => (
  <Avatar
    size={size}
    src={getPersonAvatar(person) || undefined}
    icon={<UserRound size={size * 0.48} />}
    className="person-avatar"
  >
    {!getPersonAvatar(person) && person?.full_name?.charAt(0)?.toUpperCase()}
  </Avatar>
);

/* =====================================================
   MAIN PAGE
===================================================== */

const PersonsPage = () => {
  const [form] = Form.useForm();

  const [persons, setPersons] = useState([]);
  const [statistics, setStatistics] = useState({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [currentPerson, setCurrentPerson] = useState(null);

  const [faceProfiles, setFaceProfiles] = useState([]);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceDeletingId, setFaceDeletingId] = useState(null);

  const [pendingFaceFiles, setPendingFaceFiles] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [mobileView, setMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth <= 768,
  );

  const isCreate = modalMode === "create";
  const isDetail = modalMode === "detail";

  const canManage = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("sfs_user") || "{}");
      return ["admin", "operator"].includes(user?.role);
    } catch {
      return false;
    }
  }, []);

  /* ---------------- LOAD DATA ---------------- */

  const loadPersons = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getPersons({
        page,
        limit: PAGE_SIZE,
        search: searchText.trim() || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      });

      const result = getPersonList(response);

      setPersons(result.items);

      const pagination = result.pagination || {};

      setTotal(
        Number(
          pagination.total ??
            pagination.totalItems ??
            pagination.total_items ??
            result.items.length,
        ),
      );
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể tải danh sách."));
    } finally {
      setLoading(false);
    }
  }, [page, searchText, categoryFilter, statusFilter]);

  const loadStatistics = useCallback(async () => {
    try {
      const response = await getPersonStatistics();
      const data = unwrap(response);

      setStatistics(
        data?.statistics || data?.data?.statistics || data?.data || data || {},
      );
    } catch (error) {
      console.error("Load statistics error:", error);
    }
  }, []);

  const loadFaceProfiles = useCallback(async (personId) => {
    if (!personId) {
      setFaceProfiles([]);
      return;
    }

    setFaceLoading(true);

    try {
      const response = await getPersonFaces(personId);
      const faces = getFaceList(response);

      console.log("[PersonsPage] Face API:", response);
      console.log("[PersonsPage] Face list:", faces);

      setFaceProfiles(faces);
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể tải ảnh khuôn mặt."));
      setFaceProfiles([]);
    } finally {
      setFaceLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPersons(), loadStatistics()]);
  }, [loadPersons, loadStatistics]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const handleResize = () => setMobileView(window.innerWidth <= 768);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  /* ---------------- MODAL ---------------- */

  const resetModal = () => {
    form.resetFields();

    setCurrentPerson(null);
    setFaceProfiles([]);
    setPendingFaceFiles([]);
    setAvatarFile(null);

    setAvatarPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return "";
    });
  };

  const closeModal = () => {
    if (saving || faceUploading) return;

    setModalOpen(false);
    resetModal();
  };

  const openCreateModal = () => {
    resetModal();

    setModalMode("create");
    setModalOpen(true);

    form.setFieldsValue({
      full_name: "",
      phone: "",
      email: "",
      category: "employee",
      status: "active",
      description: "",
    });
  };

  const openPersonModal = async (person, mode = "edit") => {
    const personId = getPersonId(person);

    setModalMode(mode);
    setCurrentPerson(person);
    setModalOpen(true);

    setFaceProfiles([]);
    setPendingFaceFiles([]);
    setAvatarFile(null);

    setAvatarPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return getPersonAvatar(person);
    });

    form.setFieldsValue({
      full_name: person?.full_name || "",
      phone: person?.phone || "",
      email: person?.email || "",
      category: person?.category || "employee",
      status: person?.status || "active",
      description: person?.description || "",
    });

    if (!personId) {
      message.error("Không tìm thấy mã hồ sơ.");
      return;
    }

    const detailTask = getPersonDetail(personId)
      .then((response) => {
        const data = unwrap(response);

        const detail =
          data?.person || data?.data?.person || data?.data || data || {};

        const latest = { ...person, ...detail };

        setCurrentPerson(latest);

        form.setFieldsValue({
          full_name: latest.full_name || "",
          phone: latest.phone || "",
          email: latest.email || "",
          category: latest.category || "employee",
          status: latest.status || "active",
          description: latest.description || "",
        });

        setAvatarPreview(getPersonAvatar(latest));
      })
      .catch((error) => {
        console.error("Load person detail error:", error);
      });

    const faceTask =
      mode === "detail" ? loadFaceProfiles(personId) : Promise.resolve();

    await Promise.all([detailTask, faceTask]);
  };

  /* ---------------- AVATAR ---------------- */

  const handleAvatarChange = (file) => {
    if (!validateImageFile(file)) return;

    setAvatarFile(file);

    setAvatarPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };

  /* ---------------- FACE FILES ---------------- */

  const handlePendingFacesChange = ({ fileList }) => {
    const valid = fileList
      .filter((item) => {
        const file = item?.originFileObj || item;
        return file && validateImageFile(file);
      })
      .slice(0, MAX_FACE_FILES);

    if (fileList.length > MAX_FACE_FILES) {
      message.warning(`Chỉ được chọn tối đa ${MAX_FACE_FILES} ảnh.`);
    }

    setPendingFaceFiles(valid);
  };

  const uploadFaceFiles = async (personId, files) => {
    const rawFiles = (files || [])
      .map((item) => item?.originFileObj || item)
      .filter(Boolean);

    if (personId && rawFiles.length) {
      await createPersonFaces(personId, rawFiles);
    }
  };

  /* ---------------- SAVE PERSON ---------------- */

  const handleSubmit = async (values) => {
    if (!canManage) {
      message.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        full_name: values.full_name?.trim(),
        phone: values.phone?.trim() || "",
        email: values.email?.trim() || "",
        description: values.description?.trim() || "",
        category: values.category,
        status: values.status,
      };

      if (avatarFile) payload.avatar = avatarFile;

      let personId = getPersonId(currentPerson);

      if (isCreate) {
        const response = await createPerson(payload);
        const result = unwrap(response);

        personId = getPersonId(result);

        if (!personId) {
          message.warning(
            "Đã tạo hồ sơ nhưng chưa lấy được ID. Bạn có thể bổ sung ảnh sau.",
          );

          setModalOpen(false);
          resetModal();
          await refreshAll();
          return;
        }

        if (pendingFaceFiles.length) {
          try {
            await uploadFaceFiles(personId, pendingFaceFiles);
            message.success("Tạo hồ sơ và đăng ký ảnh thành công.");
          } catch (error) {
            message.warning(
              `Đã tạo hồ sơ nhưng tải ảnh thất bại: ${getErrorMessage(error)}`,
            );
          }
        } else {
          message.success("Thêm người dùng thành công.");
        }
      } else {
        if (!personId) {
          message.error("Không tìm thấy mã hồ sơ.");
          return;
        }

        await updatePerson(personId, payload);
        message.success("Cập nhật hồ sơ thành công.");
      }

      setModalOpen(false);
      resetModal();
      await refreshAll();
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể lưu hồ sơ."));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- ADD FACE ---------------- */

  const handleAddFaces = async () => {
    const personId = getPersonId(currentPerson);

    if (!personId || !pendingFaceFiles.length) {
      message.warning("Vui lòng chọn ảnh khuôn mặt.");
      return;
    }

    setFaceUploading(true);

    try {
      await uploadFaceFiles(personId, pendingFaceFiles);

      message.success("Đã bổ sung ảnh khuôn mặt.");
      setPendingFaceFiles([]);

      await Promise.all([
        loadFaceProfiles(personId),
        loadPersons(),
        loadStatistics(),
      ]);
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể tải ảnh lên."));
    } finally {
      setFaceUploading(false);
    }
  };

  /* ---------------- DELETE FACE ---------------- */

  const handleDeleteFace = async (face) => {
    const personId = getPersonId(currentPerson);
    const faceId = getFaceId(face);

    if (!personId || !faceId) {
      message.error("Không tìm thấy ID ảnh.");
      return;
    }

    setFaceDeletingId(faceId);

    try {
      await deletePersonFace(personId, faceId);

      setFaceProfiles((current) =>
        current.filter((item) => String(getFaceId(item)) !== String(faceId)),
      );

      message.success("Đã xóa ảnh khuôn mặt.");

      await Promise.all([loadPersons(), loadStatistics()]);
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể xóa ảnh."));
    } finally {
      setFaceDeletingId(null);
    }
  };

  /* ---------------- DELETE PERSON ---------------- */

  const handleDeletePerson = async (person) => {
    const personId = getPersonId(person);
    if (!personId) return;

    setDeletingId(personId);

    try {
      await deletePerson(personId);
      message.success("Đã xóa hồ sơ.");

      if (
        modalOpen &&
        String(getPersonId(currentPerson)) === String(personId)
      ) {
        setModalOpen(false);
        resetModal();
      }

      await refreshAll();
    } catch (error) {
      message.error(getErrorMessage(error, "Không thể xóa hồ sơ."));
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------------- STATUS ---------------- */

  const renderStatus = (status) => (
    <Tag
      className={`person-status ${status === "active" ? "active" : "inactive"}`}
    >
      <span />
      {status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}
    </Tag>
  );

  /* ---------------- FACE SECTION ---------------- */

  const renderFaceSection = () => (
    <section className="person-faces">
      <div className="person-subheading">
        <div>
          <h3>
            <ScanFace size={18} />
            Ảnh khuôn mặt
            <span className="person-count">{faceProfiles.length}</span>
          </h3>
          <p>Quản lý dữ liệu ảnh dùng cho nhận diện khuôn mặt.</p>
        </div>

        <Button
          icon={<RefreshCw size={15} />}
          onClick={() => loadFaceProfiles(getPersonId(currentPerson))}
          loading={faceLoading}
        >
          Tải lại
        </Button>
      </div>

      {faceLoading ? (
        <div className="person-loading">
          <Spin />
          <span>Đang tải ảnh...</span>
        </div>
      ) : faceProfiles.length ? (
        <div className="person-face-grid">
          {faceProfiles.map((face, index) => {
            const faceId = getFaceId(face);

            return (
              <div
                className="person-face"
                key={faceId || face?.image_path || index}
              >
                <div className="person-face-photo">
                  <FaceImage face={face} index={index} />
                </div>

                <div className="person-face-bottom">
                  <span>Ảnh {index + 1}</span>

                  {canManage && faceId && (
                    <Popconfirm
                      title="Xóa ảnh khuôn mặt?"
                      description="Ảnh này sẽ bị xóa khỏi hồ sơ."
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDeleteFace(face)}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        loading={faceDeletingId === faceId}
                        icon={<Trash2 size={15} />}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có ảnh khuôn mặt"
        />
      )}

      {canManage && (
        <div className="person-face-upload">
          <Divider />

          <div className="person-subheading upload-heading">
            <div>
              <h3>
                <ImagePlus size={17} />
                Bổ sung ảnh
              </h3>
              <p>JPG, PNG, WEBP · Tối đa 10 ảnh · 5MB/ảnh.</p>
            </div>
          </div>

          <Upload
            accept="image/jpeg,image/png,image/webp"
            multiple
            listType="picture"
            fileList={pendingFaceFiles}
            beforeUpload={(file) =>
              validateImageFile(file) ? false : Upload.LIST_IGNORE
            }
            onChange={handlePendingFacesChange}
            onRemove={() => true}
            maxCount={MAX_FACE_FILES}
          >
            <Button icon={<UploadCloud size={16} />}>
              Chọn ảnh từ thiết bị
            </Button>
          </Upload>

          {pendingFaceFiles.length > 0 && (
            <div className="person-upload-submit">
              <span>Đã chọn {pendingFaceFiles.length} ảnh</span>
              <Button
                type="primary"
                icon={<UploadCloud size={16} />}
                loading={faceUploading}
                onClick={handleAddFaces}
              >
                Tải ảnh lên
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );

  /* ---------------- TABLE ---------------- */

  const columns = [
    {
      title: "NGƯỜI DÙNG",
      key: "person",
      width: 240,
      render: (_, record) => (
        <div className="person-cell">
          <PersonAvatar person={record} />
          <div>
            <strong>{record.full_name || "Chưa có tên"}</strong>
            <span>{record.person_code || `ID: ${getPersonId(record)}`}</span>
          </div>
        </div>
      ),
    },
    {
      title: "LIÊN HỆ",
      key: "contact",
      width: 190,
      render: (_, record) => (
        <div className="person-contact">
          {record.phone && (
            <span>
              <Phone size={13} />
              {record.phone}
            </span>
          )}
          {record.email && (
            <span>
              <Mail size={13} />
              {record.email}
            </span>
          )}
          {!record.phone && !record.email && (
            <span className="muted">Chưa cập nhật</span>
          )}
        </div>
      ),
    },
    {
      title: "PHÂN LOẠI",
      dataIndex: "category",
      width: 120,
      render: (value) => (
        <Tag className="person-category">{getCategoryLabel(value)}</Tag>
      ),
    },
    {
      title: "ẢNH",
      dataIndex: "face_count",
      width: 90,
      align: "center",
      render: (value, record) => (
        <span className="person-number">
          <ScanFace size={15} />
          {Number(value ?? record.face_images_count ?? record.total_faces ?? 0)}
        </span>
      ),
    },
    {
      title: "NHẬN DIỆN",
      dataIndex: "recognition_count",
      width: 110,
      align: "center",
      render: (value) => (
        <span className="person-number">
          <Activity size={15} />
          {Number(value || 0)}
        </span>
      ),
    },
    {
      title: "TRẠNG THÁI",
      dataIndex: "status",
      width: 145,
      render: renderStatus,
    },
    {
      title: "",
      key: "actions",
      width: 125,
      fixed: "right",
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              icon={<Eye size={17} />}
              onClick={() => openPersonModal(record, "detail")}
            />
          </Tooltip>

          {canManage && (
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<Pencil size={16} />}
                onClick={() => openPersonModal(record, "edit")}
              />
            </Tooltip>
          )}

          {canManage && (
            <Popconfirm
              title="Xóa hồ sơ này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeletePerson(record)}
            >
              <Tooltip title="Xóa">
                <Button
                  type="text"
                  danger
                  loading={deletingId === getPersonId(record)}
                  icon={<Trash2 size={16} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  /* ---------------- STATISTICS ---------------- */

  const totalPersons =
    statistics.total_persons ??
    statistics.totalPersons ??
    statistics.total ??
    total;

  const activePersons =
    statistics.active_persons ??
    statistics.activePersons ??
    statistics.active ??
    0;

  const totalFaces =
    statistics.total_faces ??
    statistics.totalFaces ??
    statistics.face_count ??
    0;

  const totalRecognitions =
    statistics.total_recognitions ??
    statistics.totalRecognitions ??
    statistics.recognition_count ??
    0;

  /* ---------------- MOBILE ITEM ---------------- */

  const renderMobileItem = (person) => (
    <div className="person-mobile-item" key={getPersonId(person)}>
      <div className="person-mobile-main">
        <PersonAvatar person={person} size={46} />

        <div className="person-mobile-info">
          <strong>{person.full_name || "Chưa có tên"}</strong>
          <span>{person.person_code || `ID: ${getPersonId(person)}`}</span>
          {renderStatus(person.status)}
        </div>
      </div>

      <div className="person-mobile-details">
        <span>
          <ScanFace size={14} />
          {Number(person.face_count || 0)} ảnh
        </span>
        <span>
          <Activity size={14} />
          {Number(person.recognition_count || 0)} lượt
        </span>
        <Tag className="person-category">
          {getCategoryLabel(person.category)}
        </Tag>
      </div>

      <div className="person-mobile-actions">
        <Button
          onClick={() => openPersonModal(person, "detail")}
          icon={<Eye size={15} />}
        >
          Chi tiết
        </Button>

        {canManage && (
          <Button
            onClick={() => openPersonModal(person, "edit")}
            icon={<Pencil size={15} />}
          >
            Sửa
          </Button>
        )}

        {canManage && (
          <Popconfirm
            title="Xóa hồ sơ này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeletePerson(person)}
          >
            <Button danger icon={<Trash2 size={15} />}>
              Xóa
            </Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="persons-page">
      {/* HEADER */}

      <header className="persons-header">
        <div>
          <div className="persons-eyebrow">
            <ScanFace size={15} />
            FACE RECOGNITION
          </div>

          <h1>Quản lý người dùng</h1>
          <p>Quản lý hồ sơ và dữ liệu nhận diện khuôn mặt.</p>
        </div>

        <div className="persons-header-actions">
          <Button
            icon={<RefreshCw size={16} />}
            onClick={refreshAll}
            loading={loading}
          >
            Làm mới
          </Button>

          {canManage && (
            <Button
              type="primary"
              icon={<Plus size={17} />}
              onClick={openCreateModal}
            >
              Thêm người dùng
            </Button>
          )}
        </div>
      </header>

      {/* STATISTICS */}

      <div className="persons-stats">
        <div>
          <span className="stat-label">Tổng người dùng</span>
          <strong>{Number(totalPersons || 0).toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span className="stat-label">Đang hoạt động</span>
          <strong>{Number(activePersons || 0).toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span className="stat-label">Ảnh khuôn mặt</span>
          <strong>{Number(totalFaces || 0).toLocaleString("vi-VN")}</strong>
        </div>
        <div>
          <span className="stat-label">Lượt nhận diện</span>
          <strong>
            {Number(totalRecognitions || 0).toLocaleString("vi-VN")}
          </strong>
        </div>
      </div>

      {/* TOOLBAR */}

      <section className="persons-content">
        <div className="persons-content-heading">
          <div>
            <h2>Danh sách hồ sơ</h2>
            <span>{total} hồ sơ trong hệ thống</span>
          </div>
        </div>

        <div className="persons-toolbar">
          <Input
            allowClear
            prefix={<Search size={16} />}
            placeholder="Tìm tên, mã, số điện thoại, email..."
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPage(1);
            }}
          />

          <Select
            allowClear
            placeholder="Phân loại"
            value={categoryFilter}
            options={CATEGORY_OPTIONS}
            onChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          />

          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />

          <Button
            onClick={() => {
              setSearchText("");
              setCategoryFilter(undefined);
              setStatusFilter(undefined);
              setPage(1);
            }}
          >
            Xóa lọc
          </Button>
        </div>

        {mobileView ? (
          <div className="persons-mobile-list">
            {loading ? (
              <div className="person-loading">
                <Spin />
              </div>
            ) : persons.length ? (
              persons.map(renderMobileItem)
            ) : (
              <Empty description="Không tìm thấy hồ sơ." />
            )}
          </div>
        ) : (
          <Table
            rowKey={(record) => getPersonId(record)}
            columns={columns}
            dataSource={persons}
            loading={loading}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              showTotal: (value) => `${value} hồ sơ`,
              onChange: setPage,
            }}
            scroll={{ x: 1000 }}
            className="persons-table"
            locale={{
              emptyText: <Empty description="Chưa có dữ liệu người dùng." />,
            }}
          />
        )}
      </section>

      {/* MODAL */}

      <Modal
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        centered
        width={isDetail ? 820 : 680}
        destroyOnHidden
        closable={false}
        maskClosable={!saving && !faceUploading}
        className="person-modal"
        title={null}
      >
        <div className="person-modal-header">
          <div className="person-modal-title-icon">
            {isCreate ? (
              <Plus size={20} />
            ) : isDetail ? (
              <Eye size={20} />
            ) : (
              <Pencil size={20} />
            )}
          </div>

          <div className="person-modal-title">
            <h2>
              {isCreate
                ? "Thêm người dùng"
                : isDetail
                  ? "Chi tiết người dùng"
                  : "Chỉnh sửa hồ sơ"}
            </h2>
            <p>
              {isCreate
                ? "Nhập thông tin và đăng ký ảnh khuôn mặt."
                : isDetail
                  ? "Thông tin hồ sơ và dữ liệu ảnh nhận diện."
                  : "Cập nhật thông tin người dùng."}
            </p>
          </div>

          <Button
            type="text"
            icon={<X size={19} />}
            onClick={closeModal}
            className="person-close-button"
          />
        </div>

        <div className="person-modal-body">
          {isDetail ? (
            <>
              <div className="person-detail-top">
                <PersonAvatar person={currentPerson} size={68} />

                <div>
                  <h3>{currentPerson?.full_name || "Chưa có tên"}</h3>
                  <span>
                    {currentPerson?.person_code ||
                      `ID: ${getPersonId(currentPerson) || "—"}`}
                  </span>

                  <Space wrap>
                    <Tag className="person-category">
                      {getCategoryLabel(currentPerson?.category)}
                    </Tag>
                    {renderStatus(currentPerson?.status)}
                  </Space>
                </div>
              </div>

              <Descriptions
                size="small"
                column={{ xs: 1, sm: 2 }}
                className="person-descriptions"
              >
                <Descriptions.Item label="Họ và tên">
                  {currentPerson?.full_name || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Mã hồ sơ">
                  {currentPerson?.person_code ||
                    getPersonId(currentPerson) ||
                    "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {currentPerson?.phone || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {currentPerson?.email || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">
                  {currentPerson?.created_at
                    ? new Date(currentPerson.created_at).toLocaleString("vi-VN")
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Lượt nhận diện">
                  {Number(currentPerson?.recognition_count || 0)}
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả" span={2}>
                  {currentPerson?.description || "Chưa có mô tả"}
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              {renderFaceSection()}

              <div className="person-modal-footer">
                <Button onClick={closeModal}>Đóng</Button>
                {canManage && (
                  <Button
                    type="primary"
                    icon={<Pencil size={15} />}
                    onClick={() => openPersonModal(currentPerson, "edit")}
                  >
                    Chỉnh sửa
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              className="person-form"
            >
              <div className="person-avatar-editor">
                <div className="person-avatar-preview">
                  {avatarPreview ? (
                    <Image src={avatarPreview} alt="Ảnh đại diện" preview />
                  ) : (
                    <UserRound size={30} />
                  )}
                </div>

                <div>
                  <strong>Ảnh đại diện</strong>
                  <span>
                    Ảnh đại diện không thay thế ảnh khuôn mặt nhận diện.
                  </span>

                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleAvatarChange(file);
                      return false;
                    }}
                  >
                    <Button size="small" icon={<ImagePlus size={14} />}>
                      {avatarPreview ? "Đổi ảnh" : "Chọn ảnh"}
                    </Button>
                  </Upload>
                </div>
              </div>

              <div className="person-form-grid">
                <Form.Item
                  label="Họ và tên"
                  name="full_name"
                  rules={[
                    { required: true, message: "Vui lòng nhập họ và tên." },
                    { max: 150, message: "Tên tối đa 150 ký tự." },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<UserRound size={16} />}
                    placeholder="Nhập họ và tên"
                    maxLength={150}
                  />
                </Form.Item>

                <Form.Item label="Số điện thoại" name="phone">
                  <Input
                    size="large"
                    prefix={<Phone size={16} />}
                    placeholder="Nhập số điện thoại"
                  />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: "email", message: "Email không hợp lệ." }]}
                >
                  <Input
                    size="large"
                    prefix={<Mail size={16} />}
                    placeholder="example@email.com"
                  />
                </Form.Item>

                <Form.Item
                  label="Phân loại"
                  name="category"
                  rules={[
                    { required: true, message: "Vui lòng chọn phân loại." },
                  ]}
                >
                  <Select
                    size="large"
                    options={CATEGORY_OPTIONS}
                    placeholder="Chọn phân loại"
                  />
                </Form.Item>

                <Form.Item
                  label="Trạng thái"
                  name="status"
                  rules={[
                    { required: true, message: "Vui lòng chọn trạng thái." },
                  ]}
                >
                  <Select
                    size="large"
                    options={STATUS_OPTIONS}
                    placeholder="Chọn trạng thái"
                  />
                </Form.Item>
              </div>

              <Form.Item label="Mô tả" name="description">
                <TextArea
                  rows={3}
                  maxLength={1000}
                  showCount
                  placeholder="Thông tin bổ sung..."
                />
              </Form.Item>

              {isCreate && (
                <>
                  <Divider />

                  <div className="person-form-section-title">
                    <ScanFace size={18} />
                    Ảnh khuôn mặt
                    <span className="person-count">
                      {pendingFaceFiles.length}/{MAX_FACE_FILES}
                    </span>
                  </div>

                  <Alert
                    type="info"
                    showIcon
                    message="Ảnh sẽ được đăng ký sau khi tạo hồ sơ thành công."
                    className="person-face-alert"
                  />

                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    listType="picture"
                    fileList={pendingFaceFiles}
                    beforeUpload={(file) =>
                      validateImageFile(file) ? false : Upload.LIST_IGNORE
                    }
                    onChange={handlePendingFacesChange}
                    onRemove={() => true}
                    maxCount={MAX_FACE_FILES}
                  >
                    <Button icon={<UploadCloud size={16} />}>
                      Chọn ảnh khuôn mặt
                    </Button>
                  </Upload>

                  <p className="person-upload-hint">
                    JPG, PNG, WEBP · Tối đa 10 ảnh · 5MB/ảnh
                  </p>
                </>
              )}

              <div className="person-modal-footer">
                <Button onClick={closeModal} disabled={saving}>
                  Hủy
                </Button>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  icon={<Check size={16} />}
                >
                  {isCreate ? "Tạo hồ sơ" : "Lưu thay đổi"}
                </Button>
              </div>
            </Form>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PersonsPage;
