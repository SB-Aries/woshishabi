import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Switch, message, Divider, Select, Space } from 'antd';
import { SaveOutlined, UserOutlined, LockOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import { updateSettings, getUserProfile, updateUserProfile } from '../../utils/api';

const { Option } = Select;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // 获取用户信息
  const fetchUserProfile = async () => {
    try {
      const response = await getUserProfile();
      setUser(response.data);
      userForm.setFieldsValue(response.data);
    } catch (error) {
      message.error('获取用户信息失败');
      console.error('Failed to fetch user profile:', error);
    }
  };

  // 获取系统设置
  const fetchSettings = async () => {
    try {
      const response = await getSettings();
      form.setFieldsValue(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchSettings();
  }, []);

  // 保存系统设置
  const handleSettingsSave = async (values) => {
    setLoading(true);
    try {
      await updateSettings(values);
      message.success('系统设置保存成功');
    } catch (error) {
      message.error('系统设置保存失败');
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新用户信息
  const handleProfileUpdate = async (values) => {
    setLoading(true);
    try {
      await updateUserProfile(values);
      message.success('用户信息更新成功');
      fetchUserProfile();
    } catch (error) {
      message.error('用户信息更新失败');
      console.error('Failed to update user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>系统设置</h1>
      </div>

      <div className="settings-content">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 用户信息设置 */}
          <Card title={<><UserOutlined /> 用户信息</>} bordered>
            <Form
              form={userForm}
              layout="vertical"
              onFinish={handleProfileUpdate}
              className="settings-form"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" prefix={<UserOutlined />} />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input placeholder="请输入邮箱" prefix={<MailOutlined />} />
              </Form.Item>

              <Form.Item
                name="old_password"
                label="旧密码"
              >
                <Input.Password placeholder="请输入旧密码" prefix={<LockOutlined />} />
              </Form.Item>

              <Form.Item
                name="new_password"
                label="新密码"
              >
                <Input.Password placeholder="请输入新密码" prefix={<LockOutlined />} />
              </Form.Item>

              <Form.Item className="form-actions">
                <Button type="primary" htmlType="submit" loading={loading}>
                  <SaveOutlined /> 保存用户信息
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Divider />

          {/* 系统设置 */}
          <Card title={<><SettingOutlined /> 系统配置</>} bordered>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSettingsSave}
              className="settings-form"
            >
              <Form.Item
                name="scan_timeout"
                label="扫描超时时间（秒）"
                rules={[{ required: true, message: '请输入扫描超时时间' }, { type: 'number', min: 60, max: 3600 }]}
              >
                <Input type="number" placeholder="请输入扫描超时时间（秒）" />
              </Form.Item>

              <Form.Item
                name="max_scan_threads"
                label="最大扫描线程数"
                rules={[{ required: true, message: '请输入最大扫描线程数' }, { type: 'number', min: 1, max: 10 }]}
              >
                <Input type="number" placeholder="请输入最大扫描线程数" />
              </Form.Item>

              <Form.Item
                name="auto_save_reports"
                label="自动保存报告"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item
                name="default_report_format"
                label="默认报告格式"
                rules={[{ required: true, message: '请选择默认报告格式' }]}
              >
                <Select placeholder="请选择默认报告格式">
                  <Option value="pdf">PDF格式</Option>
                  <Option value="json">JSON格式</Option>
                  <Option value="html">HTML格式</Option>
                  <Option value="txt">文本格式</Option>
                </Select>
              </Form.Item>

              <Form.Item className="form-actions">
                <Button type="primary" htmlType="submit" loading={loading}>
                  <SaveOutlined /> 保存系统设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Space>
      </div>
    </div>
  );
};

export default SettingsPage;