import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DatabaseOutlined,
  ShareAltOutlined,
  WarningOutlined,
  FileTextOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import LineageGraphPage from './pages/LineageGraphPage';
import ImpactAnalysisPage from './pages/ImpactAnalysisPage';
import SQLParserPage from './pages/SQLParserPage';
import DataQualityDashboard from './pages/DataQualityDashboard';

const { Header, Content, Sider } = Layout;

const App = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [currentPage, setCurrentPage] = useState('lineage');

  const menuItems = [
    {
      key: 'lineage',
      icon: <ShareAltOutlined />,
      label: '血缘图谱',
    },
    {
      key: 'impact',
      icon: <WarningOutlined />,
      label: '影响分析',
    },
    {
      key: 'parser',
      icon: <FileTextOutlined />,
      label: 'SQL解析',
    },
    {
      key: 'quality',
      icon: <SafetyOutlined />,
      label: '数据质量',
    },
  ];

  const renderContent = () => {
    switch (currentPage) {
      case 'lineage':
        return <LineageGraphPage />;
      case 'impact':
        return <ImpactAnalysisPage />;
      case 'parser':
        return <SQLParserPage />;
      case 'quality':
        return <DataQualityDashboard />;
      default:
        return <LineageGraphPage />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <DatabaseOutlined style={{ color: '#fff', fontSize: 24, marginRight: 16 }} />
        <h1 style={{ color: '#fff', margin: 0, fontSize: 20 }}>数据血缘追踪平台</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onSelect={({ key }) => setCurrentPage(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
