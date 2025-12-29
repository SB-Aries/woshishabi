import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Breadcrumb, message } from 'antd';
import { 
  ProjectOutlined, 
  ScheduleOutlined, 
  FileTextOutlined, 
  ToolOutlined, 
  SettingOutlined, 
  QuestionCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  HeartOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/MainLayout.css';

const { Header, Content, Sider } = Layout;

const MainLayout = ({ toggleTheme, currentTheme }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(['projects']);
  const [openKeys, setOpenKeys] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/projects')) {
      setSelectedKeys(['projects']);
    } else if (path.includes('/tasks')) {
      setSelectedKeys(['tasks']);
    } else if (path.includes('/reports')) {
      setSelectedKeys(['reports']);
    } else if (path.includes('/tools')) {
      setSelectedKeys(['tools']);
    } else if (path.includes('/settings')) {
      setSelectedKeys(['settings']);
    } else if (path.includes('/help')) {
      setSelectedKeys(['help']);
    }
  }, [location.pathname]);

  // 菜单项
  const menuItems = [
    {
      key: 'projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
      onClick: () => navigate('/projects')
    },
    {
      key: 'tasks',
      icon: <ScheduleOutlined />,
      label: '任务管理',
      onClick: () => navigate('/tasks')
    },
    {
      key: 'reports',
      icon: <FileTextOutlined />,
      label: '报告任务',
      onClick: () => navigate('/reports')
    },
    {
      key: 'tools',
      icon: <ToolOutlined />,
      label: '常用工具',
      onClick: () => navigate('/tools')
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings')
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: '帮助文档',
      onClick: () => navigate('/help')
    }
  ];

  // 用户下拉菜单项
  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        logout();
        message.success('退出登录成功');
        navigate('/login');
      }
    }
  ];

  // 面包屑导航
  const getBreadcrumbItems = () => {
    const path = location.pathname;
    const items = [{ title: '首页', href: '/' }];
    
    if (path.includes('/projects')) {
      items.push({ title: '项目管理', href: '/projects' });
    } else if (path.includes('/tasks')) {
      items.push({ title: '任务管理', href: '/tasks' });
    } else if (path.includes('/reports')) {
      items.push({ title: '报告任务', href: '/reports' });
    } else if (path.includes('/tools')) {
      items.push({ title: '常用工具', href: '/tools' });
    } else if (path.includes('/settings')) {
      items.push({ title: '系统设置', href: '/settings' });
    } else if (path.includes('/help')) {
      items.push({ title: '帮助文档', href: '/help' });
    }
    
    return items;
  };

  return (
    <Layout className="main-layout">
      {/* 左侧功能栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="main-sider"
      >
        <div className="sider-logo">
          <ProjectOutlined className="logo-icon" />
          {!collapsed && <span className="logo-text">漏洞扫描系统</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          className="main-menu"
        />
      </Sider>
      
      <Layout>
        {/* 顶部导航 */}
        <Header className="main-header">
          <div className="header-left">
            <Breadcrumb items={getBreadcrumbItems()} className="header-breadcrumb" />
          </div>
          
          <div className="header-right">
            {/* 主题切换按钮 */}
            <Button
              type="text"
              icon={currentTheme === 'light' ? <MoonOutlined /> : currentTheme === 'dark' ? <SunOutlined /> : <HeartOutlined />}
              onClick={toggleTheme}
              className="theme-toggle-btn"
            />
            
            {/* 用户信息 */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <div className="user-info">
                <Avatar icon={<UserOutlined />} className="user-avatar" />
                <span className="user-name">{user?.username || 'admin'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        {/* 主内容区域 */}
        <Content className="main-content">
          <div className="content-container">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
