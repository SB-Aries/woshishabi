import React, { useState } from 'react';
import { Form, Input, Button, Card, Space, Typography, Row, Col } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login as loginAPI } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/LoginPage.css';

const { Title } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { login } = useAuth();
  const navigate = useNavigate();

  // 处理登录
  const handleLogin = async (values) => {
    try {
      setLoading(true);
      
      // 调用登录API
      const response = await loginAPI({
        username: values.username,
        password: values.password
      });
      
      // 调试日志
      console.log('Login response:', response);
      
      // 保存用户信息和令牌
      // 由于api.js的响应拦截器会将响应数据转换为response.data
      // 所以response已经是token对象本身，不需要再访问response.data
      login({
        username: values.username
      }, response);
      
      // 将access_token和refresh_token都存储到localStorage
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      
      // 等待状态更新
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 调试日志
      console.log('After login - token in localStorage:', localStorage.getItem('token'));
      
      // 登录成功后跳转到主页
      navigate('/projects');
      console.log('Navigated to /projects');
      
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Row justify="center" align="middle" className="login-row">
        <Col xs={24} sm={20} md={12} lg={8} xl={6}>
          <Card className="login-card">
            <div className="login-header">
              <Title level={3} className="login-title">漏洞扫描系统</Title>
              <Typography.Text type="secondary">请登录您的账号</Typography.Text>
            </div>
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleLogin}
              className="login-form"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<UserOutlined className="site-form-item-icon" />}
                  placeholder="请输入用户名"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="site-form-item-icon" />}
                  placeholder="请输入密码"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  className="login-button"
                >
                  登录
                </Button>
              </Form.Item>
              
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div className="login-footer">
                  <Typography.Text type="secondary">I'm because you are </Typography.Text>
                </div>

              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LoginPage;
