import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AuthContext from './contexts/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import MainLayout from './components/layout/MainLayout';
import ProjectsPage from './pages/projects/ProjectsPage';
import TasksPage from './pages/tasks/TasksPage';
import ReportsPage from './pages/reports/ReportsPage';
import ToolsPage from './pages/tools/ToolsPage';
import SettingsPage from './pages/settings/SettingsPage';
import HelpPage from './pages/help/HelpPage';
import { getCurrentUser } from './utils/api';

function App() {
  // 主题状态
  const [theme, setTheme] = useState('light');
  
  // 用户认证状态
  const [user, setUser] = useState(null);
  // 初始状态直接从localStorage获取token，避免初始渲染时重定向问题
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  

  
  // 调试日志 - 组件初始化
  console.log('App component initialized');

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);
  
  // 调试日志 - token状态变化
  useEffect(() => {
    console.log('Token state changed:', token);
    console.log('Token in localStorage:', localStorage.getItem('token'));
  }, [token]);
  
  // 监听localStorage中token的变化
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        console.log('localStorage token changed:', e.newValue);
        setToken(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 当token存在时获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (token) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Failed to fetch current user:', error);
          // 如果获取用户信息失败，可能是token无效，清除token
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    fetchCurrentUser();
  }, [token]);

  // 切换主题
  const toggleTheme = () => {
    let newTheme;
    if (theme === 'light') {
      newTheme = 'dark';
    } else if (theme === 'dark') {
      newTheme = 'kuromi';
    } else {
      newTheme = 'light';
    }
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // 登录处理
  const login = (userData, tokenData) => {
    console.log('Login function called');
    console.log('userData:', userData);
    console.log('tokenData:', tokenData);
    
    // 确保tokenData有access_token字段
    if (tokenData && tokenData.access_token) {
      setUser(userData);
      setToken(tokenData.access_token);
      localStorage.setItem('token', tokenData.access_token);
      console.log('Token stored successfully');
    } else {
      console.error('Invalid tokenData format:', tokenData);
    }
  };

  // 登出处理
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  // Ant Design主题配置
  const antdTheme = {
    token: {
      colorPrimary: 'var(--primary-color)',
      colorBgContainer: 'var(--bg-primary)',
      colorText: 'var(--text-primary)',
      colorTextSecondary: 'var(--text-secondary)',
      colorBorder: 'var(--border-color)',
    },
  };

  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AuthContext.Provider value={{ user, token, login, logout }}>
        <Router>
          <Routes>
            {/* 未登录路由 */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* 已登录路由 */}
            <Route path="/" element={token ? <MainLayout toggleTheme={toggleTheme} currentTheme={theme} /> : <Navigate to="/login" />}>
              <Route index element={<Navigate to="/projects" />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="tools" element={<ToolsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
            
            {/* 404路由 */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ConfigProvider>
  );
}

export default App;
