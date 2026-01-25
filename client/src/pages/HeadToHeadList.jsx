import React from "react";
import { Card, Typography } from "antd";
import { PageMotion, SectionMotion } from "../utils/PageMotion";

const { Title, Paragraph } = Typography;

export default function HeadToHeadList() {
  return (
    <PageMotion>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
          backgroundColor: "#0d1117",
          padding: 24,
        }}
      >
        <SectionMotion>
          <Card
            style={{
              width: 600,
              padding: 24,
              borderRadius: 12,
              backgroundColor: "#161b22",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            <Title level={3} style={{ color: "#fff", textAlign: "center" }}>
              Head-to-Head List
            </Title>
            <Paragraph style={{ color: "#ccc", textAlign: "center" }}>
              This is a placeholder for the Head-to-Head list page. You can
              later show top matchups or player comparisons here.
            </Paragraph>
          </Card>
        </SectionMotion>
      </div>
    </PageMotion>
  );
}
