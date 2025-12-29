import axios from 'axios';
import { message } from 'antd';

// 创建Axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加认证令牌
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取令牌，与响应拦截器保持一致
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 刷新令牌的函数
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    return null;
  }
  
  try {
    // 直接使用axios而不是api实例，避免请求拦截器的影响
    const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
    const newAccessToken = response.data.access_token;
    localStorage.setItem('token', newAccessToken);
    return newAccessToken;
  } catch (error) {
    // 刷新令牌失败，清除所有令牌
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    return null;
  }
};

// 标记是否正在刷新令牌，避免并发请求重复刷新
let isRefreshing = false;
// 存储等待刷新的请求队列
let refreshSubscribers = [];

// 通知所有等待的请求使用新令牌
const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response) {
      // 服务器返回错误
      switch (error.response.status) {
        case 401:
          // 处理401错误，考虑token过期等情况
          if (!originalRequest._retry) {
            // 防止重复重试
            originalRequest._retry = true;
            
            if (!isRefreshing) {
              isRefreshing = true;
              
              // 尝试刷新令牌
              const newToken = await refreshAccessToken();
              isRefreshing = false;
              
              if (newToken) {
                // 刷新成功，更新请求头并重新发起请求
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                onTokenRefreshed(newToken);
                return api(originalRequest);
              } else {
                // 刷新失败，需要重新登录
                message.error('认证已过期，请重新登录');
                if (!window.location.pathname.includes('/login')) {
                  window.location.href = '/login';
                }
              }
            } else {
              // 正在刷新令牌，将请求加入队列等待
              return new Promise((resolve) => {
                refreshSubscribers.push((token) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(api(originalRequest));
                });
              });
            }
          }
          break;
        case 403:
          message.error('您没有权限执行此操作');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器内部错误');
          break;
        default:
          message.error(`请求失败: ${error.response.data.message || '未知错误'}`);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      message.error('网络错误，请检查您的网络连接');
    } else {
      // 请求配置错误
      message.error('请求配置错误');
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const login = (credentials) => {
  // 后端使用OAuth2PasswordRequestForm，需要使用form-urlencoded格式
  const formData = new URLSearchParams();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);
  
  return api.post('/auth/token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
};
export const getCurrentUser = () => api.get('/auth/users/me');

// 项目相关API
export const getProjects = (params) => api.get('/projects/', { params });
export const getProjectById = (id) => api.get(`/projects/${id}/`);
export const createProject = (data) => api.post('/projects/', data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

// 任务相关API
export const getTasks = (params) => api.get('/tasks/', { params });
export const getTaskById = (id) => api.get(`/tasks/${id}`);
export const getTaskProgress = (id) => api.get(`/tasks/${id}/progress`);
export const createTask = (data) => api.post('/tasks/', data);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const startTask = (id) => api.post(`/tasks/${id}/run`);
export const stopTask = (id) => api.post(`/tasks/${id}/stop`);

// 报告相关API
export const getReports = (params) => api.get('/reports/', { params });
export const getReportById = (id) => api.get(`/reports/${id}/`);
export const downloadReport = (id) => api.get(`/reports/${id}/download`, { responseType: 'blob' });
export const deleteReport = (id) => api.delete(`/reports/${id}`);

// 工具相关API
export const checkUrl = (url) => api.post('/tools/url-check/', { url });
export const validateIp = (ip) => api.post('/tools/ip-validate/', { ip });
export const generatePassword = (length, options) => api.post('/tools/generate-password/', { length, options });
export const encodeBase64 = (text) => api.post('/tools/base64-encode/', { text });
export const decodeBase64 = (text) => api.post('/tools/base64-decode/', { text });

// 设置相关API
export const getSettings = () => api.get('/settings/');
export const updateSettings = (data) => api.put('/settings/', data);
export const getUserProfile = () => api.get('/auth/users/me');
export const updateUserProfile = (data) => api.put('/auth/users/me', data);

// 端口扫描API
export const portScan = (data) => api.post('/tools/port-scan/', data);

// 编码转换API
export const encodingConverter = (data) => api.post('/tools/encoding-converter/', data);

// 资产分拣API
export const assetSorting = (data) => api.post('/tools/asset-sorting/', data);

export default api;
