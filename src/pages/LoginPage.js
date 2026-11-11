import React, { useState } from "react";
import { Button, Form, Input, Typography, Alert, message } from "antd";

import {
  ShieldCheck,
  LockKeyhole,
  UserRound,
  Eye,
  EyeOff,
  ScanFace,
  Activity,
  Fingerprint,
  Shield,
  Cpu,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";

import "./css/LoginPage.css";

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      setError("");

      await login({
        username: values.username.trim(),
        password: values.password,
      });

      message.success("Đăng nhập thành công");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Tên đăng nhập hoặc mật khẩu không chính xác");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="sf-login">
      {/* Background */}
      <div className="sf-login-bg">
        <div className="sf-grid-pattern" />
        <div className="sf-orb sf-orb-one" />
        <div className="sf-orb sf-orb-two" />

        <div className="sf-background-ring sf-ring-one" />
        <div className="sf-background-ring sf-ring-two" />
      </div>

      {/* Left visual */}
      <section className="sf-showcase">
        <div className="sf-showcase-top">
          <div className="sf-brand">
            <div className="sf-brand-logo">
              <img src={logo} alt="Smart Face Security" />
            </div>

            <div className="sf-brand-name">
              <strong>SMART FACE</strong>
              <span>SECURITY SYSTEM</span>
            </div>
          </div>

          <div className="sf-live-status">
            <span className="sf-live-dot" />
            AI SYSTEM
          </div>
        </div>

        <div className="sf-showcase-content">
          <div className="sf-eyebrow">
            <span />
            NEXT GENERATION SECURITY
          </div>

          <h1>
            An ninh thông minh.
            <br />
            <span>Nhận diện chính xác.</span>
          </h1>

          <p className="sf-showcase-description">
            Hệ thống giám sát ứng dụng trí tuệ nhân tạo, nhận diện khuôn mặt và
            cảnh báo an ninh theo thời gian thực.
          </p>

          <div className="sf-ai-visual">
            <div className="sf-ai-circle sf-ai-circle-outer" />
            <div className="sf-ai-circle sf-ai-circle-middle" />
            <div className="sf-ai-circle sf-ai-circle-inner" />

            <div className="sf-ai-center">
              <ScanFace size={112} strokeWidth={1.1} />
              <div className="sf-ai-scan-line" />
            </div>

            <div className="sf-ai-corner sf-corner-tl" />
            <div className="sf-ai-corner sf-corner-tr" />
            <div className="sf-ai-corner sf-corner-bl" />
            <div className="sf-ai-corner sf-corner-br" />

            <div className="sf-ai-label sf-ai-label-left">
              <Fingerprint size={15} />
              FACE DETECTION
            </div>

            <div className="sf-ai-label sf-ai-label-right">
              <Activity size={15} />
              LIVE ANALYSIS
            </div>

            <div className="sf-ai-coordinate sf-coordinate-one">AI / 01</div>
            <div className="sf-ai-coordinate sf-coordinate-two">
              SECURITY ACTIVE
            </div>
          </div>

          <div className="sf-feature-list">
            <div className="sf-feature">
              <div className="sf-feature-icon">
                <ScanFace size={19} />
              </div>
              <div>
                <strong>Face Recognition</strong>
                <span>Nhận diện khuôn mặt AI</span>
              </div>
            </div>

            <div className="sf-feature">
              <div className="sf-feature-icon">
                <Activity size={19} />
              </div>
              <div>
                <strong>Real-time Monitoring</strong>
                <span>Giám sát và cảnh báo tức thời</span>
              </div>
            </div>

            <div className="sf-feature">
              <div className="sf-feature-icon">
                <Shield size={19} />
              </div>
              <div>
                <strong>Smart Protection</strong>
                <span>Bảo vệ an ninh thông minh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sf-showcase-footer">
          <span>POWERED BY ARTIFICIAL INTELLIGENCE</span>
          <span>VERSION 1.0</span>
        </div>
      </section>

      {/* Right login */}
      <section className="sf-login-panel">
        <div className="sf-login-card">
          <div className="sf-mobile-brand">
            <img src={logo} alt="Smart Face Security" />
            <div>
              <strong>SMART FACE</strong>
              <span>SECURITY SYSTEM</span>
            </div>
          </div>

          <div className="sf-login-card-top">
            <div className="sf-login-icon">
              <LockKeyhole size={23} />
            </div>

            <div className="sf-login-secure">
              <span className="sf-live-dot" />
              SECURE ACCESS
            </div>
          </div>

          <div className="sf-login-heading">
            <div className="sf-login-overline">WELCOME BACK</div>

            <Title level={2}>Đăng nhập</Title>

            <Text>
              Chào mừng bạn quay trở lại.
              <br />
              Vui lòng đăng nhập để tiếp tục.
            </Text>
          </div>

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="sf-login-error"
            />
          )}

          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            size="large"
            className="sf-login-form"
          >
            <Form.Item
              label="Tên đăng nhập"
              name="username"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập tên đăng nhập",
                },
              ]}
            >
              <Input
                prefix={<UserRound size={18} />}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu",
                },
              ]}
            >
              <Input.Password
                prefix={<LockKeyhole size={18} />}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                iconRender={(visible) =>
                  visible ? <Eye size={18} /> : <EyeOff size={18} />
                }
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="sf-login-submit"
            >
              <span>{loading ? "ĐANG XÁC THỰC..." : "ĐĂNG NHẬP HỆ THỐNG"}</span>
              {!loading && <span className="sf-submit-arrow">→</span>}
            </Button>
          </Form>

          <div className="sf-login-security">
            <div className="sf-security-icon">
              <ShieldCheck size={17} />
            </div>

            <div>
              <strong>Kết nối an toàn</strong>
              <span>Phiên đăng nhập được bảo vệ bằng JWT</span>
            </div>

            <div className="sf-security-status">
              <span />
              SECURE
            </div>
          </div>

          <div className="sf-login-bottom">
            <div className="sf-login-divider" />

            <div className="sf-login-copyright">
              <span>SMART FACE SECURITY</span>
              <span>© {new Date().getFullYear()} ALL RIGHTS RESERVED</span>
            </div>
          </div>
        </div>

        <div className="sf-panel-decoration">
          <Cpu size={15} />
          INTELLIGENT SECURITY PLATFORM
        </div>
      </section>
    </main>
  );
}
