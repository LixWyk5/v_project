import React from "react";
import { Layout, theme, Grid } from "antd";
import Header from "./Header";
import Sidebar from "./Sidebar";

const { Content } = Layout;
const { useToken } = theme;
const { useBreakpoint } = Grid;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { token } = useToken();
    const screens = useBreakpoint();

    return (
    <Layout
      style={{ 
        height: "100vh", 
        maxHeight: "100vh",
        display: "flex", 
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
            <Header />
      <Layout style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                <Sidebar />
        <Layout
          style={{
            padding: screens.xs ? "0 12px 12px" : screens.sm ? "0 16px 16px" : "0 24px 24px",
            background: token.colorBgBase,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
                    <Content
                        style={{
                            padding: screens.xs ? 12 : screens.sm ? 16 : 24,
                            margin: 0,
                            background: token.colorBgBase,
                            borderRadius: token.borderRadius,
                            color: token.colorTextBase,
              flex: 1,
              overflow: "hidden",
              minHeight: 0,
                        }}
                    >
                        {children}
                    </Content>
                </Layout>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
