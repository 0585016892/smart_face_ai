import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Tooltip,
  Typography,
} from "antd";

import {
  Camera,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  UserSearch,
  Webcam,
  Activity,
  Cpu,
} from "lucide-react";

import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import NotificationDropdown from "../components/NotificationDropdown";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";

import "./MainLayout.css";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

/* =========================================================
   ROLE CONFIG
========================================================= */

const ROLE_ADMIN = ["admin", "administrator"];
const ROLE_OPERATOR = "operator";
const ROLE_VIEWER = "viewer";

const roleLabels = {
  admin: "Quản trị viên",
  operator: "Nhân viên vận hành",
  viewer: "Người xem",
};

function getUserRole(user) {
  const role = String(user?.role || user?.role_name || "")
    .trim()
    .toLowerCase();

  if (ROLE_ADMIN.includes(role)) return "admin";
  if (role === ROLE_OPERATOR) return ROLE_OPERATOR;
  if (role === ROLE_VIEWER) return ROLE_VIEWER;

  // Không xác định role thì không cấp quyền admin/operator.
  return ROLE_VIEWER;
}

function getHomePath(role) {
  return role === ROLE_VIEWER ? "/live-monitoring" : "/dashboard";
}

/* =========================================================
   PERMISSION CONFIG
========================================================= */

// Chỉ những đường dẫn được khai báo mới được phép truy cập.
const ROLE_PERMISSIONS = {
  admin: [
    "/dashboard",
    "/live-monitoring",
    "/recognition",
    "/persons",
    "/unknown",
    "/cameras",
    "/history",
    "/telegram",
    "/users",
    "/settings",
  ],

  operator: [
    "/dashboard",
    "/live-monitoring",
    "/recognition",
    "/persons",
    "/unknown",
    "/cameras",
    "/history",
  ],

  viewer: ["/live-monitoring"],
};

function isPathMatch(pathname, allowedPath) {
  return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
}

function canAccessPath(role, pathname) {
  const permissions = ROLE_PERMISSIONS[role] || [];

  return permissions.some((path) => isPathMatch(pathname, path));
}

/* =========================================================
   MENU CONFIG
========================================================= */

const menuGroups = [
  {
    label: "TỔNG QUAN",
    items: [
      {
        key: "/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={19} />,
      },
      {
        key: "/live-monitoring",
        label: "Giám sát AI trực tiếp",
        icon: <Webcam size={19} />,
      },
    ],
  },
  {
    label: "NHẬN DIỆN",
    items: [
      {
        key: "/recognition",
        label: "Giám sát trực tiếp",
        icon: <Activity size={19} />,
      },
      {
        key: "/persons",
        label: "Người quen",
        icon: <Users size={19} />,
      },
      {
        key: "/unknown",
        label: "Người chưa xác định",
        icon: <UserSearch size={19} />,
      },
    ],
  },
  {
    label: "QUẢN LÝ HỆ THỐNG",
    items: [
      {
        key: "/cameras",
        label: "Camera",
        icon: <Camera size={19} />,
      },
      {
        key: "/history",
        label: "Lịch sử nhận diện",
        icon: <Clock3 size={19} />,
      },
      {
        key: "/telegram",
        label: "Thông báo Telegram",
        icon: <Radio size={19} />,
      },
    ],
  },
  {
    label: "CẤU HÌNH",
    items: [
      {
        key: "/users",
        label: "Tài khoản",
        icon: <ShieldCheck size={19} />,
      },
      {
        key: "/settings",
        label: "Cài đặt",
        icon: <Settings size={19} />,
      },
    ],
  },
];

const pageTitles = {
  "/dashboard": "Dashboard",
  "/recognition": "Giám sát trực tiếp",
  "/persons": "Quản lý người quen",
  "/unknown": "Người chưa xác định",
  "/cameras": "Quản lý camera",
  "/history": "Lịch sử nhận diện",
  "/telegram": "Thông báo Telegram",
  "/users": "Quản lý tài khoản",
  "/settings": "Cài đặt hệ thống",
  "/live-monitoring": "Giám sát AI trực tiếp",
};

/* =========================================================
   HELPERS
========================================================= */

function getDisplayName(user) {
  return (
    user?.full_name ||
    user?.fullname ||
    user?.name ||
    user?.username ||
    "Tài khoản"
  );
}

function getRoleLabel(user) {
  return roleLabels[getUserRole(user)] || "Người dùng";
}

function getInitials(name) {
  if (!name) return "U";

  const words = String(name).trim().split(/\s+/);

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/* =========================================================
   MAIN LAYOUT
========================================================= */

export default function MainLayout() {
  const { user, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const role = getUserRole(user);
  const homePath = getHomePath(role);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  /* =========================================================
     RESPONSIVE
  ========================================================= */

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (event) => {
      setIsMobile(event.matches);

      if (event.matches) {
        setCollapsed(false);
        setMobileDrawerOpen(false);
      }
    };

    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  /* =========================================================
     PERMISSION
  ========================================================= */

  const hasPermission = canAccessPath(role, location.pathname);

  /* =========================================================
     FILTER MENU BY ROLE
  ========================================================= */

  const visibleMenuGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessPath(role, item.key)),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  const menuItems = useMemo(() => {
    return visibleMenuGroups.map((group) => ({
      type: "group",
      label: collapsed && !isMobile ? null : group.label,
      children: group.items.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    }));
  }, [visibleMenuGroups, collapsed, isMobile]);

  /* =========================================================
     CURRENT PAGE
  ========================================================= */

  const matchedPath = useMemo(() => {
    return Object.keys(pageTitles)
      .sort((a, b) => b.length - a.length)
      .find((path) => isPathMatch(location.pathname, path));
  }, [location.pathname]);

  const currentTitle = pageTitles[matchedPath] || "Smart Face Security";

  const selectedMenuKey = matchedPath || location.pathname;

  /* =========================================================
     USER INFO
  ========================================================= */

  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user);
  const initials = getInitials(displayName);

  /* =========================================================
     ACTIONS
  ========================================================= */

  const handleMenuClick = ({ key }) => {
    // Kiểm tra quyền lần nữa trước khi điều hướng.
    if (!canAccessPath(role, key)) {
      navigate(homePath, { replace: true });
      return;
    }

    navigate(key);
    setMobileDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  /* =========================================================
     ACCOUNT MENU
  ========================================================= */

  const accountMenuItems = [];

  // Chỉ Admin mới thấy các mục cấu hình tài khoản.
  if (role === "admin") {
    accountMenuItems.push(
      {
        key: "profile",
        icon: <Shield size={16} />,
        label: "Thông tin tài khoản",
        onClick: () => navigate("/settings"),
      },
      {
        key: "settings",
        icon: <Settings size={16} />,
        label: "Cài đặt hệ thống",
        onClick: () => navigate("/settings"),
      },
      {
        type: "divider",
      },
    );
  }

  accountMenuItems.push({
    key: "logout",
    icon: <LogOut size={16} />,
    label: "Đăng xuất",
    danger: true,
    onClick: handleLogout,
  });

  const accountMenu = {
    items: accountMenuItems,
  };

  /* =========================================================
     SIDEBAR
  ========================================================= */

  const SidebarContent = (
    <div className="sf-sidebar-container">
      <div className="sf-sidebar-top">
        <div
          className={`sf-sidebar-brand ${
            collapsed && !isMobile ? "is-collapsed" : ""
          }`}
          onClick={() => {
            navigate(homePath);
            setMobileDrawerOpen(false);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              navigate(homePath);
              setMobileDrawerOpen(false);
            }
          }}
        >
          <div className="sf-brand-image">
            <img src={logo} alt="Smart Face Security" />
          </div>

          {(!collapsed || isMobile) && (
            <div className="sf-brand-content">
              <div className="sf-brand-title">SMART FACE</div>
              <div className="sf-brand-caption">SECURITY SYSTEM</div>
            </div>
          )}
        </div>

        <Tooltip
          title={collapsed && !isMobile ? "Hệ thống đang hoạt động" : ""}
          placement="right"
        >
          <div className="sf-system-indicator">
            <span className="sf-system-dot" />

            {(!collapsed || isMobile) && (
              <>
                <span className="sf-system-text">Hệ thống đang hoạt động</span>
                <span className="sf-system-live">LIVE</span>
              </>
            )}
          </div>
        </Tooltip>

        <div className="sf-menu-caption">
          {(!collapsed || isMobile) && "WORKSPACE"}
          {collapsed && !isMobile && <span>MENU</span>}
        </div>

        {/* Chỉ render những nhóm menu có quyền */}
        <Menu
          mode="inline"
          theme="dark"
          inlineCollapsed={collapsed && !isMobile}
          selectedKeys={[selectedMenuKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="sf-sidebar-menu"
        />
      </div>

      <div className="sf-sidebar-bottom">
        {(!collapsed || isMobile) && (
          <div className="sf-sidebar-help">
            <div className="sf-help-icon">
              <CircleHelp size={18} />
            </div>

            <div className="sf-help-content">
              <strong>Cần hỗ trợ?</strong>
              <span>Liên hệ quản trị viên</span>
            </div>

            <ChevronRight size={16} className="sf-help-arrow" />
          </div>
        )}

        <div className="sf-sidebar-version">
          {(!collapsed || isMobile) && (
            <span className="sf-version-name">
              <Cpu size={12} />
              SMART FACE SECURITY
            </span>
          )}

          <span className="sf-version-number">v1.0.0</span>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     REDIRECT UNAUTHORIZED ROUTES
     Đặt SAU TẤT CẢ HOOKS để tránh lỗi React Hooks.
  ========================================================= */

  if (!hasPermission) {
    return <Navigate to={homePath} replace />;
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <Layout className="sf-app-layout">
      {!isMobile && (
        <Sider
          width={264}
          collapsedWidth={78}
          collapsed={collapsed}
          trigger={null}
          className="sf-app-sidebar"
        >
          {SidebarContent}
        </Sider>
      )}

      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileDrawerOpen(false)}
        open={isMobile && mobileDrawerOpen}
        width={285}
        className="sf-mobile-sidebar-drawer"
        styles={{
          body: {
            padding: 0,
            backgroundColor: "#09182b",
          },
        }}
      >
        {SidebarContent}
      </Drawer>

      <Layout
        className={`sf-main-layout ${
          collapsed && !isMobile ? "is-collapsed" : ""
        }`}
      >
        <Header className="sf-app-header">
          <div className="sf-header-left">
            <Tooltip
              title={
                isMobile
                  ? "Mở menu"
                  : collapsed
                    ? "Mở rộng menu"
                    : "Thu gọn menu"
              }
            >
              <Button
                type="text"
                className="sf-sidebar-toggle"
                icon={
                  isMobile ? (
                    <MenuIcon size={20} />
                  ) : collapsed ? (
                    <PanelLeftOpen size={20} />
                  ) : (
                    <PanelLeftClose size={20} />
                  )
                }
                onClick={() =>
                  isMobile
                    ? setMobileDrawerOpen(true)
                    : setCollapsed((prev) => !prev)
                }
              />
            </Tooltip>

            <div className="sf-header-breadcrumb">
              <span className="sf-breadcrumb-root">
                <Activity size={14} />
                Smart Face
              </span>

              <ChevronRight size={15} className="sf-breadcrumb-separator" />

              <span className="sf-breadcrumb-current">{currentTitle}</span>
            </div>
          </div>

          <div className="sf-header-right">
            <div className="sf-header-system-status">
              <span className="sf-system-dot" />
              <span>Hệ thống online</span>
            </div>

            {/* Viewer không có quyền xem thông báo */}
            {role !== ROLE_VIEWER && (
              <div className="sf-header-notification">
                <NotificationDropdown user={user} />
              </div>
            )}

            <div className="sf-header-divider" />

            <Dropdown
              menu={accountMenu}
              placement="bottomRight"
              trigger={["click"]}
            >
              <div className="sf-profile-dropdown">
                <Avatar
                  size={39}
                  src={user?.avatar || user?.avatar_url || undefined}
                  className="sf-profile-avatar"
                >
                  {initials}
                </Avatar>

                <div className="sf-profile-info">
                  <Text className="sf-profile-name" ellipsis>
                    {displayName}
                  </Text>

                  <Text className="sf-profile-role">{roleLabel}</Text>
                </div>

                <ChevronDown size={15} className="sf-profile-chevron" />
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="sf-app-content">
          <div className="sf-page-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
