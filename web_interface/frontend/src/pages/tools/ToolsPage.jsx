import React, { useState } from 'react';
import { Card, Button, Input, Form, message, Space, Row, Col, Tabs, Tag, Select } from 'antd';
import { CheckOutlined, CopyOutlined, CodeOutlined, DatabaseOutlined, LockOutlined, InfoCircleOutlined, ScanOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { checkUrl, validateIp, generatePassword, encodingConverter, portScan, assetSorting } from '../../utils/api';

const { TabPane } = Tabs;
const { Option } = Select;

const ToolsPage = () => {
  const [form] = Form.useForm();
  const [urlCheckResult, setUrlCheckResult] = useState(null);
  const [ipCheckResult, setIpCheckResult] = useState(null);
  const [passwordResult, setPasswordResult] = useState(null);
  const [encodingResult, setEncodingResult] = useState(null);
  const [portScanResult, setPortScanResult] = useState(null);
  const [assetSortingResult, setAssetSortingResult] = useState(null);

  // URL检测
  const handleUrlCheck = async (values) => {
    try {
      const response = await checkUrl(values.url);
      setUrlCheckResult(response);
      message.success('URL检测完成');
    } catch (error) {
      message.error('URL检测失败');
      console.error('Failed to check URL:', error);
    }
  };

  // IP验证
  const handleIpCheck = async (values) => {
    try {
      const response = await validateIp(values.ip);
      setIpCheckResult(response);
      message.success('IP验证完成');
    } catch (error) {
      message.error('IP验证失败');
      console.error('Failed to validate IP:', error);
    }
  };

  // 生成密码
  const handleGeneratePassword = async (values) => {
    try {
      const response = await generatePassword(values.length || 12, values.options || {});
      setPasswordResult(response);
      message.success('密码生成成功');
    } catch (error) {
      message.error('密码生成失败');
      console.error('Failed to generate password:', error);
    }
  };

  // 编码转换
  const handleEncodingConvert = async (values) => {
    try {
      const response = await encodingConverter({
        text: values.text,
        action: values.action,
        encoding_type: values.encoding_type
      });
      setEncodingResult(response);
      message.success('编码转换完成');
    } catch (error) {
      message.error('编码转换失败');
      console.error('Failed to convert encoding:', error);
    }
  };

  // 端口扫描
  const handlePortScan = async (values) => {
    try {
      const response = await portScan({
        target: values.target,
        ports: values.ports || '1-1000',
        timeout: values.timeout || 1
      });
      setPortScanResult(response);
      message.success('端口扫描完成');
    } catch (error) {
      message.error('端口扫描失败');
      console.error('Failed to scan ports:', error);
    }
  };

  // 资产分拣
  const handleAssetSorting = async (values) => {
    try {
      const response = await assetSorting({
        text: values.text
      });
      setAssetSortingResult(response);
      message.success('资产分拣完成');
    } catch (error) {
      message.error('资产分拣失败');
      console.error('Failed to sort assets:', error);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  return (
    <div className="tools-page">
      <div className="page-header">
        <h1>常用工具</h1>
      </div>

      <div className="tools-content">
        <Tabs defaultActiveKey="url-check" size="large">
          {/* URL检测 */}
          <TabPane tab={<><CodeOutlined /> URL检测</>} key="url-check">
            <Card title="URL有效性检测" bordered>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleUrlCheck}
                className="tool-form"
              >
                <Form.Item
                  name="url"
                  label="URL地址"
                  rules={[{ required: true, message: '请输入URL地址' }]}
                >
                  <Input placeholder="请输入URL地址，例如：https://example.com" />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    检测
                  </Button>
                </Form.Item>
              </Form>

              {urlCheckResult && (
                <div className="tool-result">
                  <h3>检测结果</h3>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <p><strong>有效性：</strong>
                        {urlCheckResult.is_valid ? 
                          <CheckOutlined style={{ color: 'green' }} /> : 
                          <CheckOutlined style={{ color: 'red' }} />}
                      </p>
                    </Col>
                    <Col span={12}>
                      <p><strong>协议：</strong>{urlCheckResult.protocol}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>域名：</strong>{urlCheckResult.domain}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>端口：</strong>{urlCheckResult.port}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>路径：</strong>{urlCheckResult.path}</p>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </TabPane>

          {/* IP验证 */}
          <TabPane tab={<><DatabaseOutlined /> IP验证</>} key="ip-check">
            <Card title="IP地址验证" bordered>
              <Form
                layout="vertical"
                onFinish={handleIpCheck}
                className="tool-form"
              >
                <Form.Item
                  name="ip"
                  label="IP地址"
                  rules={[{ required: true, message: '请输入IP地址' }]}
                >
                  <Input placeholder="请输入IP地址，例如：192.168.1.1" />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    验证
                  </Button>
                </Form.Item>
              </Form>

              {ipCheckResult && (
                <div className="tool-result">
                  <h3>验证结果</h3>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <p><strong>有效性：</strong>
                        {ipCheckResult.is_valid ? 
                          <CheckOutlined style={{ color: 'green' }} /> : 
                          <CheckOutlined style={{ color: 'red' }} />}
                      </p>
                    </Col>
                    <Col span={12}>
                      <p><strong>类型：</strong>{ipCheckResult.type}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>国家：</strong>{ipCheckResult.country}</p>
                    </Col>
                    <Col span={12}>
                      <p><strong>城市：</strong>{ipCheckResult.city}</p>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </TabPane>

          {/* 密码生成 */}
          <TabPane tab={<><LockOutlined /> 密码生成</>} key="password-generator">
            <Card title="强密码生成器" bordered>
              <Form
                layout="vertical"
                onFinish={handleGeneratePassword}
                initialValues={{ length: 12 }}
                className="tool-form"
              >
                <Form.Item
                  name="length"
                  label="密码长度"
                  rules={[{ required: true, message: '请输入密码长度' }, { type: 'number', min: 6, max: 32 }]}
                >
                  <Input type="number" placeholder="请输入密码长度（6-32位）" />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    生成密码
                  </Button>
                </Form.Item>
              </Form>

              {passwordResult && (
                <div className="tool-result">
                  <h3>生成的密码</h3>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input value={passwordResult.password} readOnly style={{ width: 'calc(100% - 80px)' }} />
                    <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(passwordResult.password)}>
                      复制
                    </Button>
                  </Space.Compact>
                  <p className="password-strength">
                    <strong>强度：</strong>
                    <Tag color={passwordResult.strength === 'strong' ? 'green' : passwordResult.strength === 'medium' ? 'orange' : 'red'}>
                      {{ strong: '强', medium: '中', weak: '弱' }[passwordResult.strength]}
                    </Tag>
                  </p>
                </div>
              )}
            </Card>
          </TabPane>

          {/* 编码转换 */}
          <TabPane tab={<><CodeSandboxOutlined /> 编码转换</>} key="encoding-converter">
            <Card title="多种编码转换工具" bordered>
              <Form
                layout="vertical"
                onFinish={handleEncodingConvert}
                className="tool-form"
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="encoding_type"
                      label="编码类型"
                      rules={[{ required: true, message: '请选择编码类型' }]}
                    >
                      <Select placeholder="请选择编码类型">
                        <Option value="base64">Base64</Option>
                        <Option value="base32">Base32</Option>
                        <Option value="base16">Base16</Option>
                        <Option value="url">URL编码</Option>
                        <Option value="hex">十六进制(Hex)</Option>
                        <Option value="ascii">ASCII码</Option>
                        <Option value="binary">二进制(Binary)</Option>
                        <Option value="html">HTML实体编码</Option>
                        <Option value="rot13">ROT13</Option>
                        <Option value="reverse">字符串反转</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="action"
                      label="操作类型"
                      rules={[{ required: true, message: '请选择操作类型' }]}
                    >
                      <Select placeholder="请选择操作类型">
                        <Option value="encode">编码</Option>
                        <Option value="decode">解码</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="text"
                  label="输入内容"
                  rules={[{ required: true, message: '请输入内容' }]}
                >
                  <Input.TextArea 
                    rows={4} 
                    placeholder="请输入要转换的内容" 
                    showCount
                    maxLength={10000}
                  />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    转换
                  </Button>
                  <Button 
                    htmlType="button" 
                    onClick={() => {
                      form.setFieldsValue({ text: '' });
                      setEncodingResult(null);
                    }}
                  >
                    清空
                  </Button>
                </Form.Item>
              </Form>

              {encodingResult && (
                <div className="tool-result">
                  <h3>转换结果</h3>
                  <div className="encoding-result">
                    <Row gutter={16}>
                      <Col span={12}>
                        <p><strong>原始内容：</strong></p>
                        <Input.TextArea
                          value={encodingResult.original_text}
                          readOnly
                          rows={4}
                          style={{ marginBottom: '16px' }}
                        />
                      </Col>
                      <Col span={12}>
                        <p><strong>转换结果：</strong></p>
                        <Space.Compact style={{ width: '100%' }}>
                          <Input.TextArea
                            value={encodingResult.result}
                            readOnly
                            rows={4}
                            style={{ width: 'calc(100% - 80px)' }}
                          />
                          <Button 
                            icon={<CopyOutlined />} 
                            onClick={() => copyToClipboard(encodingResult.result)}
                            style={{ height: 'auto' }}
                          >
                            复制
                          </Button>
                        </Space.Compact>
                      </Col>
                    </Row>
                    <div style={{ marginTop: '16px' }}>
                      <Tag color="blue">{encodingResult.encoding_type.toUpperCase()}</Tag>
                      <Tag color="green">{encodingResult.action === 'encode' ? '编码' : '解码'}</Tag>
                      <span style={{ marginLeft: '16px' }}>
                        <strong>字符数：</strong> {encodingResult.result.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabPane>

          {/* 端口扫描 */}
          <TabPane tab={<><ScanOutlined /> 端口扫描</>} key="port-scan">
            <Card title="端口扫描" bordered>
              <Form
                layout="vertical"
                onFinish={handlePortScan}
                initialValues={{ ports: '1-1000', timeout: 1 }}
                className="tool-form"
              >
                <Form.Item
                  name="target"
                  label="目标地址"
                  rules={[{ required: true, message: '请输入目标地址' }]}
                >
                  <Input placeholder="请输入目标地址，192.168.1.1" />
                </Form.Item>

                <Form.Item
                  name="ports"
                  label="端口范围"
                  rules={[{ required: true, message: '请输入端口范围' }]}
                >
                  <Input placeholder="端口范围，例如：1-1000 或 22,80,443" />
                </Form.Item>

                <Form.Item
                  name="timeout"
                  label="超时时间(秒)"
                  rules={[{ required: true, message: '请输入超时时间' }, { type: 'number', min: 1, max: 10 }]}
                >
                  <Input type="number" placeholder="超时时间，单位秒" />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    开始扫描
                  </Button>
                </Form.Item>
              </Form>

              {portScanResult && (
                <div className="tool-result">
                  <h3>扫描结果</h3>
                  <p><strong>目标：</strong>{portScanResult.target}</p>
                  <p><strong>开放端口数量：</strong><Tag color="green">{portScanResult.total_open}</Tag></p>
                  
                  {portScanResult.open_ports && portScanResult.open_ports.length > 0 ? (
                    <div className="port-results">
                      <h4>开放的端口：</h4>
                      <Row gutter={[16, 16]}>
                        {portScanResult.open_ports.map((portInfo, index) => (
                          <Col span={8} key={index}>
                            <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
                              <p><strong>端口：</strong>{portInfo.port}</p>
                              <p><strong>服务：</strong>{portInfo.service}</p>
                              <p><strong>状态：</strong><Tag color="green">{portInfo.status}</Tag></p>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ) : (
                    <p>未发现开放的端口</p>
                  )}
                </div>
              )}
            </Card>
          </TabPane>

          {/* 资产分拣 */}
          <TabPane tab={<><DatabaseOutlined /> 资产分拣</>} key="asset-sorting">
            <Card title="资产自动分拣工具" bordered>
              <Form
                layout="vertical"
                onFinish={handleAssetSorting}
                className="tool-form"
              >
                <Form.Item
                  name="text"
                  label="输入资产列表"
                  rules={[{ required: true, message: '请输入要分拣的资产' }]}
                >
                  <Input.TextArea 
                    rows={8} 
                    placeholder="请输入资产列表，支持多种格式：&#10;- IP地址 (如: 192.168.1.1, 10.0.0.1)&#10;- 域名 (如: example.com, sub.example.com)&#10;- URL (如: https://example.com/path)&#10;每行一个资产，支持混合格式" 
                    showCount
                    maxLength={50000}
                  />
                </Form.Item>

                <Form.Item className="form-actions">
                  <Button type="primary" htmlType="submit">
                    开始分拣
                  </Button>
                  <Button 
                    htmlType="button" 
                    onClick={() => {
                      form.setFieldsValue({ text: '' });
                      setAssetSortingResult(null);
                    }}
                  >
                    清空
                  </Button>
                </Form.Item>
              </Form>

              {assetSortingResult && (
                <div className="tool-result">
                  <h3>分拣结果</h3>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title={`内网IP (${assetSortingResult.internal_ips.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.internal_ips.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.internal_ips.map((ip, index) => (
                              <Tag 
                                key={index} 
                                color="blue"
                                style={{ marginBottom: '4px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(ip)}
                              >
                                {ip}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                      
                      <Card size="small" title={`外网IP (${assetSortingResult.external_ips.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.external_ips.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.external_ips.map((ip, index) => (
                              <Tag 
                                key={index} 
                                color="green"
                                style={{ marginBottom: '4px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(ip)}
                              >
                                {ip}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                      
                      <Card size="small" title={`主域名 (${assetSortingResult.main_domains.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.main_domains.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.main_domains.map((domain, index) => (
                              <Tag 
                                key={index} 
                                color="orange"
                                style={{ marginBottom: '4px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(domain)}
                              >
                                {domain}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                    </Col>
                    
                    <Col span={12}>
                      <Card size="small" title={`子域名 (${assetSortingResult.sub_domains.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.sub_domains.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.sub_domains.map((domain, index) => (
                              <Tag 
                                key={index} 
                                color="purple"
                                style={{ marginBottom: '4px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(domain)}
                              >
                                {domain}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                      
                      <Card size="small" title={`C段 (${assetSortingResult.c_segments.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.c_segments.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.c_segments.map((csegment, index) => (
                              <Tag 
                                key={index} 
                                color="red"
                                style={{ marginBottom: '4px', cursor: 'pointer' }}
                                onClick={() => copyToClipboard(csegment)}
                              >
                                {csegment}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                      
                      <Card size="small" title={`URL (${assetSortingResult.urls.length})`} style={{ marginBottom: 16 }}>
                        {assetSortingResult.urls.length > 0 ? (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {assetSortingResult.urls.map((url, index) => (
                              <Tag 
                                key={index} 
                                color="geekblue"
                                style={{ marginBottom: '4px', cursor: 'pointer', display: 'block' }}
                                onClick={() => copyToClipboard(url)}
                              >
                                {url}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#ccc', fontStyle: 'italic' }}>无数据</p>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default ToolsPage;