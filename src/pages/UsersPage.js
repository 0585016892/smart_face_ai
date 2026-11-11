import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserCog,
  KeyRound,
  Eye,
  Pencil,
  Mail,
  Clock3,
  CircleCheck,
  CircleX,
  Save,
  RotateCcw,
  LockKeyhole,
  UnlockKeyhole,
} from "lucide-react";

import {
  getUsers,
  getUserDetail,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
} from "../api/usersApi";

import "./css/UsersPage.css";

const { Title, Text } = Typography;
const { Search: SearchInput } = Input;

const PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = ["50", "100"];

const ROLE_OPTIONS = [
  { value: "admin", label: "Quản trị viên" },
  { value: "operator", label: "Nhân viên vận hành" },
  { value: "viewer", label: "Người xem" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Đã khóa" },
];

const ROLE_CONFIG = {
  admin: {
    label: "Quản trị viên",
    color: "purple",
    icon: <ShieldCheck size={13} />,
  },
  operator: {
    label: "Nhân viên vận hành",
    color: "blue",
    icon: <UserCog size={13} />,
  },
  viewer: {
    label: "Người xem",
    color: "default",
    icon: <Eye size={13} />,
  },
};

const getInitials = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);

  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[words.length - 2][0]}${words[words.length - 1][0]}`.toUpperCase();
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

const UsersPage = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const detailRequestRef = useRef(0);

  const [users, setUsers] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedUser, setSelectedUser] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);

  // =====================================================
  // LOAD USERS
  // =====================================================

  const loadUsers = useCallback(
    async (page = pagination.page, limit = pagination.limit) => {
      try {
        setLoading(true);

        const result = await getUsers({
          page,
          limit,
          keyword: searchKeyword || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        });

        const items = Array.isArray(result?.items) ? result.items : [];
        const serverPagination = result?.pagination || {};

        setUsers(items);

        setPagination((prev) => ({
          ...prev,
          page: Number(serverPagination.page) || page,
          limit: Number(serverPagination.limit) || limit,
          total: Number(serverPagination.total) || 0,
          totalPages: Number(serverPagination.totalPages) || 0,
        }));
      } catch (error) {
        console.error("LOAD USERS ERROR:", error);

        messageApi.error(
          error?.response?.data?.message ||
            error?.message ||
            "Không thể tải danh sách tài khoản",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      pagination.page,
      pagination.limit,
      searchKeyword,
      roleFilter,
      statusFilter,
      messageApi,
    ],
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const reloadCurrentPage = () => {
    loadUsers(pagination.page, pagination.limit);
  };

  // =====================================================
  // STATISTICS - CURRENT PAGE
  // =====================================================

  const pageStats = useMemo(
    () => ({
      active: users.filter((user) => user.status === "active").length,
      inactive: users.filter((user) => user.status === "inactive").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users],
  );

  // =====================================================
  // FILTERS
  // =====================================================

  const handleSearch = (value) => {
    setSearchKeyword(String(value || "").trim());

    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSearchKeyword("");
    setRoleFilter(undefined);
    setStatusFilter(undefined);

    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const handlePageChange = (page, pageSize) => {
    const nextLimit = Number(pageSize) || PAGE_SIZE;
    const nextPage = nextLimit !== pagination.limit ? 1 : page;

    setPagination((prev) => ({
      ...prev,
      page: nextPage,
      limit: nextLimit,
    }));

    loadUsers(nextPage, nextLimit);
  };

  // =====================================================
  // CREATE / EDIT USER
  // =====================================================

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedUser(null);

    form.resetFields();
    form.setFieldsValue({
      role: "viewer",
    });

    setModalOpen(true);
  };

  const openEditModal = useCallback(
    (user) => {
      setModalMode("edit");
      setSelectedUser(user);

      form.resetFields();

      form.setFieldsValue({
        full_name: user.full_name || "",
        email: user.email || "",
        role: user.role || "viewer",
      });

      setModalOpen(true);
    },
    [form],
  );

  const closeUserModal = () => {
    if (submitting) return;

    setModalOpen(false);
    setSelectedUser(null);
    form.resetFields();
  };

  const handleSubmitUser = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      const payload = {
        full_name: values.full_name.trim(),
        email: values.email?.trim() || null,
        role: values.role,
      };

      if (modalMode === "create") {
        await createUser({
          ...payload,
          username: values.username.trim(),
          password: values.password,
        });

        messageApi.success("Tạo tài khoản thành công");
      } else {
        await updateUser(selectedUser.id, payload);

        messageApi.success("Cập nhật tài khoản thành công");
      }

      setModalOpen(false);
      setSelectedUser(null);
      form.resetFields();

      await loadUsers(
        modalMode === "create" ? 1 : pagination.page,
        pagination.limit,
      );
    } catch (error) {
      if (error?.errorFields) return;

      console.error("SAVE USER ERROR:", error);

      messageApi.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể lưu thông tin tài khoản",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // CHANGE STATUS
  // =====================================================

  const handleStatusChange = useCallback(
    (user) => {
      const isActive = user.status === "active";
      const nextStatus = isActive ? "inactive" : "active";

      Modal.confirm({
        title: isActive ? "Khóa tài khoản?" : "Mở khóa tài khoản?",
        content: isActive
          ? `Tài khoản "${user.full_name}" sẽ không thể đăng nhập vào hệ thống.`
          : `Tài khoản "${user.full_name}" sẽ được phép đăng nhập trở lại.`,
        okText: isActive ? "Khóa tài khoản" : "Mở khóa",
        cancelText: "Hủy",
        okButtonProps: {
          danger: isActive,
        },
        centered: true,
        onOk: async () => {
          try {
            setStatusLoadingId(user.id);

            await updateUserStatus(user.id, nextStatus);

            messageApi.success(
              isActive ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
            );

            await loadUsers(pagination.page, pagination.limit);
          } catch (error) {
            console.error("UPDATE USER STATUS ERROR:", error);

            messageApi.error(
              error?.response?.data?.message ||
                error?.message ||
                "Không thể cập nhật trạng thái tài khoản",
            );

            throw error;
          } finally {
            setStatusLoadingId(null);
          }
        },
      });
    },
    [messageApi, loadUsers, pagination.page, pagination.limit],
  );

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  const openPasswordModal = useCallback(
    (user) => {
      setPasswordUser(user);
      passwordForm.resetFields();
      setPasswordOpen(true);
    },
    [passwordForm],
  );

  const closePasswordModal = () => {
    if (passwordSubmitting) return;

    setPasswordOpen(false);
    setPasswordUser(null);
    passwordForm.resetFields();
  };

  const handleResetPassword = async () => {
    try {
      const values = await passwordForm.validateFields();

      if (!passwordUser?.id) return;

      setPasswordSubmitting(true);

      await resetUserPassword(passwordUser.id, values.password);

      messageApi.success("Đặt lại mật khẩu thành công");

      setPasswordOpen(false);
      setPasswordUser(null);
      passwordForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;

      console.error("RESET PASSWORD ERROR:", error);

      messageApi.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể đặt lại mật khẩu",
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // =====================================================
  // USER DETAIL
  // =====================================================

  const openDetail = useCallback(
    async (user) => {
      const requestId = ++detailRequestRef.current;

      setDetailOpen(true);
      setDetailLoading(true);
      setDetailUser(user);

      try {
        const result = await getUserDetail(user.id);

        if (requestId !== detailRequestRef.current) return;

        setDetailUser(result?.user || result);
      } catch (error) {
        if (requestId !== detailRequestRef.current) return;

        console.error("GET USER DETAIL ERROR:", error);

        messageApi.error(
          error?.response?.data?.message ||
            error?.message ||
            "Không thể tải thông tin tài khoản",
        );
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [messageApi],
  );

  const closeDetail = () => {
    detailRequestRef.current += 1;
    setDetailOpen(false);
    setDetailUser(null);
    setDetailLoading(false);
  };

  // =====================================================
  // TABLE COLUMNS
  // =====================================================

  const columns = useMemo(
    () => [
      {
        title: "TÀI KHOẢN",
        key: "user",
        width: 245,
        render: (_, record) => (
          <div className="users-person-cell">
            <Avatar className="users-avatar">
              {getInitials(record.full_name)}
            </Avatar>

            <div className="users-person-info">
              <Text strong className="users-person-name">
                {record.full_name || "Chưa có tên"}
              </Text>

              <Text type="secondary" className="users-username">
                @{record.username}
              </Text>
            </div>
          </div>
        ),
      },
      {
        title: "EMAIL",
        dataIndex: "email",
        key: "email",
        width: 220,
        render: (email) =>
          email ? (
            <div className="users-email-cell">
              <Mail size={14} />
              <span>{email}</span>
            </div>
          ) : (
            <Text type="secondary">Chưa cập nhật</Text>
          ),
      },
      {
        title: "VAI TRÒ",
        dataIndex: "role",
        key: "role",
        width: 165,
        render: (role) => {
          const config = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;

          return (
            <Tag
              color={config.color}
              className="users-role-tag"
              icon={config.icon}
            >
              {config.label}
            </Tag>
          );
        },
      },
      {
        title: "TRẠNG THÁI",
        dataIndex: "status",
        key: "status",
        width: 145,
        render: (status) => (
          <Tag
            color={status === "active" ? "success" : "error"}
            className="users-status-tag"
          >
            <span
              className={`users-status-dot ${
                status === "active" ? "active" : "inactive"
              }`}
            />
            {status === "active" ? "Hoạt động" : "Đã khóa"}
          </Tag>
        ),
      },
      {
        title: "ĐĂNG NHẬP GẦN NHẤT",
        dataIndex: "last_login",
        key: "last_login",
        width: 180,
        render: (value) => (
          <div className="users-date-cell">
            <Clock3 size={14} />
            <span>{value ? formatDate(value) : "Chưa đăng nhập"}</span>
          </div>
        ),
      },
      {
        title: "THAO TÁC",
        key: "actions",
        fixed: "right",
        width: 165,
        align: "center",
        render: (_, record) => (
          <Space size={2} className="users-actions">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                size="small"
                icon={<Eye size={16} />}
                onClick={() => openDetail(record)}
              />
            </Tooltip>

            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                size="small"
                icon={<Pencil size={16} />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>

            <Tooltip title="Đặt lại mật khẩu">
              <Button
                type="text"
                size="small"
                icon={<KeyRound size={16} />}
                onClick={() => openPasswordModal(record)}
              />
            </Tooltip>

            <Tooltip
              title={
                record.status === "active"
                  ? "Khóa tài khoản"
                  : "Mở khóa tài khoản"
              }
            >
              <Button
                type="text"
                size="small"
                danger={record.status === "active"}
                loading={statusLoadingId === record.id}
                icon={
                  record.status === "active" ? (
                    <LockKeyhole size={16} />
                  ) : (
                    <UnlockKeyhole size={16} />
                  )
                }
                onClick={() => handleStatusChange(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [
      openDetail,
      openEditModal,
      openPasswordModal,
      handleStatusChange,
      statusLoadingId,
    ],
  );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="users-page">
      {contextHolder}

      {/* HEADER */}
      <div className="users-header">
        <div className="users-header-left">
          <div className="users-header-icon">
            <Users size={23} />
          </div>

          <div>
            <div className="users-eyebrow">SMART FACE SECURITY</div>

            <Title level={3} className="users-title">
              Quản lý tài khoản
            </Title>

            <Text className="users-subtitle">
              Quản lý người dùng, phân quyền và kiểm soát truy cập.
            </Text>
          </div>
        </div>

        <Space className="users-header-actions">
          <Button
            icon={<RefreshCw size={15} />}
            onClick={reloadCurrentPage}
            loading={loading}
          >
            Làm mới
          </Button>

          <Button
            type="primary"
            icon={<UserPlus size={16} />}
            onClick={openCreateModal}
            className="users-add-btn"
          >
            Thêm tài khoản
          </Button>
        </Space>
      </div>

      {/* COMPACT SUMMARY */}
      <div className="users-summary">
        <div className="users-summary-item">
          <Users size={17} />
          <span>Tổng tài khoản</span>
          <strong>{pagination.total.toLocaleString("vi-VN")}</strong>
        </div>

        <div className="users-summary-divider" />

        <div className="users-summary-item active">
          <CircleCheck size={17} />
          <span>Hoạt động</span>
          <strong>{pageStats.active}</strong>
        </div>

        <div className="users-summary-divider" />

        <div className="users-summary-item locked">
          <CircleX size={17} />
          <span>Đã khóa</span>
          <strong>{pageStats.inactive}</strong>
        </div>

        <div className="users-summary-divider" />

        <div className="users-summary-item admin">
          <ShieldCheck size={17} />
          <span>Quản trị viên</span>
          <strong>{pageStats.admins}</strong>
        </div>

        <div className="users-summary-note">
          Số liệu trạng thái và vai trò trong trang hiện tại
        </div>
      </div>

      {/* MAIN TABLE */}
      <Card className="users-table-card" bordered={false}>
        <div className="users-table-heading">
          <div>
            <Title level={4}>Danh sách tài khoản</Title>
            <Text type="secondary">
              Danh sách người dùng được phép truy cập hệ thống.
            </Text>
          </div>

          <Tag color="blue" className="users-total-tag">
            {pagination.total.toLocaleString("vi-VN")} tài khoản
          </Tag>
        </div>

        {/* FILTERS */}
        <div className="users-filters">
          <div className="users-search">
            <SearchInput
              allowClear
              placeholder="Tìm tên, username hoặc email..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={handleSearch}
              onPressEnter={() => handleSearch(keyword)}
              enterButton={
                <span className="users-search-button">
                  <Search size={15} />
                  Tìm kiếm
                </span>
              }
            />
          </div>

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả vai trò"
            value={roleFilter}
            options={ROLE_OPTIONS}
            onChange={(value) => {
              setRoleFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="users-filter-select"
          />

          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatusFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="users-filter-select"
          />

          <Tooltip title="Xóa bộ lọc">
            <Button
              icon={<RotateCcw size={15} />}
              onClick={handleResetFilters}
              className="users-reset-btn"
            />
          </Tooltip>
        </div>

        {/* TABLE */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={false}
          scroll={{ x: 1120 }}
          size="middle"
          className="users-data-table"
          locale={{
            emptyText: (
              <div className="users-empty">
                <Users size={34} />
                <Text strong>Không tìm thấy tài khoản</Text>
                <Text type="secondary">Thử thay đổi từ khóa hoặc bộ lọc.</Text>
              </div>
            ),
          }}
        />

        {/* PAGINATION */}
        <div className="users-pagination">
          <Text type="secondary" className="users-pagination-info">
            Hiển thị{" "}
            <strong>
              {users.length ? (pagination.page - 1) * pagination.limit + 1 : 0}
              {" - "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{" "}
            trên {pagination.total.toLocaleString("vi-VN")} tài khoản
          </Text>

          <Pagination
            current={pagination.page}
            pageSize={pagination.limit}
            total={pagination.total}
            showSizeChanger
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showTotal={(total) => `${total} tài khoản`}
            onChange={handlePageChange}
            size="small"
          />
        </div>
      </Card>

      {/* CREATE / EDIT MODAL */}
      <Modal
        open={modalOpen}
        onCancel={closeUserModal}
        title={
          <div className="users-modal-title">
            <div className="users-modal-title-icon">
              {modalMode === "create" ? (
                <UserPlus size={18} />
              ) : (
                <Pencil size={17} />
              )}
            </div>

            <div>
              <div>
                {modalMode === "create"
                  ? "Tạo tài khoản mới"
                  : "Chỉnh sửa tài khoản"}
              </div>

              <Text type="secondary">
                {modalMode === "create"
                  ? "Nhập thông tin tài khoản truy cập hệ thống."
                  : `Cập nhật tài khoản ${selectedUser?.username || ""}`}
              </Text>
            </div>
          </div>
        }
        footer={[
          <Button key="cancel" onClick={closeUserModal} disabled={submitting}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            icon={<Save size={15} />}
            onClick={handleSubmitUser}
          >
            {modalMode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
          </Button>,
        ]}
        width={520}
        destroyOnHidden
        centered
        className="users-modal"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          className="users-form"
        >
          <Form.Item
            label="Họ và tên"
            name="full_name"
            rules={[
              { required: true, message: "Vui lòng nhập họ và tên" },
              { max: 150, message: "Họ tên tối đa 150 ký tự" },
            ]}
          >
            <Input
              size="large"
              prefix={<UserRound size={16} />}
              placeholder="Nhập họ và tên"
            />
          </Form.Item>

          {modalMode === "create" && (
            <Form.Item
              label="Tên đăng nhập"
              name="username"
              rules={[
                { required: true, message: "Vui lòng nhập username" },
                { min: 3, message: "Username tối thiểu 3 ký tự" },
                { max: 100, message: "Username tối đa 100 ký tự" },
                {
                  pattern: /^[a-zA-Z0-9_.-]+$/,
                  message:
                    "Chỉ dùng chữ, số, dấu chấm, gạch ngang và gạch dưới",
                },
              ]}
            >
              <Input
                size="large"
                prefix={<UserCog size={16} />}
                placeholder="Ví dụ: nguyenvana"
              />
            </Form.Item>
          )}

          <Form.Item
            label="Địa chỉ email"
            name="email"
            rules={[
              { type: "email", message: "Email không hợp lệ" },
              { max: 150, message: "Email tối đa 150 ký tự" },
            ]}
          >
            <Input
              size="large"
              prefix={<Mail size={16} />}
              placeholder="example@email.com"
            />
          </Form.Item>

          {modalMode === "create" && (
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu" },
                { min: 8, message: "Mật khẩu tối thiểu 8 ký tự" },
                { max: 128, message: "Mật khẩu tối đa 128 ký tự" },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<KeyRound size={16} />}
                placeholder="Tối thiểu 8 ký tự"
              />
            </Form.Item>
          )}

          <Form.Item
            label="Vai trò"
            name="role"
            rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
          >
            <Select
              size="large"
              options={ROLE_OPTIONS}
              placeholder="Chọn vai trò"
            />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="Thông tin phân quyền"
            description="Quản trị viên có toàn quyền quản lý hệ thống. Nhân viên vận hành thực hiện các nghiệp vụ được cấp phép. Người xem chỉ có quyền xem dữ liệu."
            className="users-form-alert"
          />
        </Form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        open={passwordOpen}
        onCancel={closePasswordModal}
        title={
          <div className="users-modal-title">
            <div className="users-modal-title-icon password">
              <KeyRound size={18} />
            </div>

            <div>
              <div>Đặt lại mật khẩu</div>
              <Text type="secondary">
                Tài khoản: {passwordUser?.username || ""}
              </Text>
            </div>
          </div>
        }
        footer={[
          <Button
            key="cancel"
            onClick={closePasswordModal}
            disabled={passwordSubmitting}
          >
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={passwordSubmitting}
            onClick={handleResetPassword}
          >
            Xác nhận đặt lại
          </Button>,
        ]}
        centered
        width={440}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Mật khẩu mới"
            name="password"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu mới" },
              { min: 8, message: "Mật khẩu tối thiểu 8 ký tự" },
              { max: 128, message: "Mật khẩu tối đa 128 ký tự" },
            ]}
          >
            <Input.Password
              size="large"
              prefix={<KeyRound size={16} />}
              placeholder="Nhập mật khẩu mới"
            />
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            message="Lưu ý bảo mật"
            description="Mật khẩu mới có hiệu lực ngay sau khi đặt lại. Hãy thông báo cho người dùng qua kênh an toàn."
          />
        </Form>
      </Modal>

      {/* DETAIL DRAWER */}
      <Drawer
        title={
          <div className="users-drawer-title">
            <UserRound size={18} />
            <span>Thông tin tài khoản</span>
          </div>
        }
        open={detailOpen}
        onClose={closeDetail}
        width={480}
        destroyOnHidden
      >
        {detailLoading ? (
          <div className="users-detail-loading">
            <RefreshCw size={22} className="users-loading-icon" />
            <Text type="secondary">Đang tải thông tin...</Text>
          </div>
        ) : detailUser ? (
          <div className="users-detail">
            <div className="users-detail-profile">
              <Avatar size={72} className="users-detail-avatar">
                {getInitials(detailUser.full_name)}
              </Avatar>

              <Title level={4}>{detailUser.full_name}</Title>

              <Text type="secondary">@{detailUser.username}</Text>

              <Space wrap className="users-detail-tags">
                <Tag color={ROLE_CONFIG[detailUser.role]?.color || "default"}>
                  {ROLE_CONFIG[detailUser.role]?.label || detailUser.role}
                </Tag>

                <Tag
                  color={detailUser.status === "active" ? "success" : "error"}
                >
                  {detailUser.status === "active"
                    ? "Đang hoạt động"
                    : "Đã khóa"}
                </Tag>
              </Space>
            </div>

            <Divider />

            <Descriptions
              column={1}
              bordered
              size="small"
              className="users-detail-descriptions"
            >
              <Descriptions.Item label="ID">#{detailUser.id}</Descriptions.Item>

              <Descriptions.Item label="Họ và tên">
                {detailUser.full_name || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Username">
                {detailUser.username || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Email">
                {detailUser.email || "Chưa cập nhật"}
              </Descriptions.Item>

              <Descriptions.Item label="Vai trò">
                {ROLE_CONFIG[detailUser.role]?.label || detailUser.role || "—"}
              </Descriptions.Item>

              <Descriptions.Item label="Trạng thái">
                {detailUser.status === "active" ? "Đang hoạt động" : "Đã khóa"}
              </Descriptions.Item>

              <Descriptions.Item label="Đăng nhập gần nhất">
                {formatDate(detailUser.last_login)}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày tạo">
                {formatDate(detailUser.created_at)}
              </Descriptions.Item>

              <Descriptions.Item label="Cập nhật lần cuối">
                {formatDate(detailUser.updated_at)}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div className="users-detail-actions">
              <Button
                block
                icon={<Pencil size={15} />}
                onClick={() => {
                  setDetailOpen(false);
                  openEditModal(detailUser);
                }}
              >
                Chỉnh sửa thông tin
              </Button>

              <Button
                block
                icon={<KeyRound size={15} />}
                onClick={() => {
                  setDetailOpen(false);
                  openPasswordModal(detailUser);
                }}
              >
                Đặt lại mật khẩu
              </Button>
            </div>
          </div>
        ) : (
          <Text type="secondary">Không có thông tin tài khoản.</Text>
        )}
      </Drawer>
    </div>
  );
};

export default UsersPage;
