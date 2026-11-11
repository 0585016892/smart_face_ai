import React from "react";
import { Card, Empty, Typography } from "antd";

const { Title, Text } = Typography;

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="page-container">
      <div className="page-heading">
        <Title level={3}>{title}</Title>
        <Text type="secondary">{description}</Text>
      </div>

      <Card className="content-card">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chức năng đang được phát triển"
        />
      </Card>
    </div>
  );
}
