import React, { useState, useEffect } from 'react';
import { Button, Table, Card, Space, Tooltip, Select, DatePicker, message, Modal, Tabs, List } from 'antd';
import { DownloadOutlined, EyeOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons';
import { getReports, deleteReport, downloadReport } from '../../utils/api';
import { getTasks } from '../../utils/api';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filters, setFilters] = useState({
    taskId: null,
    dateRange: null,
    severity: null
  });

  // 获取报告列表
  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await getReports();
      setReports(response);
    } catch (error) {
      message.error('获取报告列表失败');
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const response = await getTasks();
      setTasks(response);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchTasks();
  }, []);

  // 下载报告
  const handleDownload = async (report) => {
    try {
      const blobData = await downloadReport(report.id);
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scan_report_${report.id}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('报告下载成功');
    } catch (error) {
      message.error('报告下载失败');
      console.error('Failed to download report:', error);
    }
  };

  // 删除报告
  const handleDelete = async (id) => {
    try {
      await deleteReport(id);
      message.success('报告删除成功');
      fetchReports();
    } catch (error) {
      message.error('报告删除失败');
      console.error('Failed to delete report:', error);
    }
  };

  // 查看报告
  const handleView = (report) => {
    setSelectedReport(report);
    setViewModalVisible(true);
  };

  // 关闭查看模态框
  const closeViewModal = () => {
    setViewModalVisible(false);
    setSelectedReport(null);
  };

  // 应用筛选
  const applyFilters = () => {
    // 这里可以根据筛选条件过滤报告
    // 目前只是关闭筛选模态框
    setFilterVisible(false);
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      taskId: null,
      dateRange: null,
      severity: null
    });
  };

  // 表格列配置
  const columns = [
    {
      title: '报告ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '所属任务',
      dataIndex: 'task_id',
      key: 'task_id',
      render: (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        return task ? task.name : '未知任务';
      },
    },
    {
      title: '高危漏洞',
      dataIndex: 'vulnerabilities',
      key: 'high_vulnerabilities',
      render: (vulnerabilities) => {
        if (!vulnerabilities || !Array.isArray(vulnerabilities)) return 0;
        const count = vulnerabilities.filter(v => v.severity === 'high' || v.severity === 'High').length;
        return <span style={{ color: '#ff4d4f' }}>{count}</span>;
      },
    },
    {
      title: '中危漏洞',
      dataIndex: 'vulnerabilities',
      key: 'medium_vulnerabilities',
      render: (vulnerabilities) => {
        if (!vulnerabilities || !Array.isArray(vulnerabilities)) return 0;
        const count = vulnerabilities.filter(v => v.severity === 'medium' || v.severity === 'Medium').length;
        return <span style={{ color: '#faad14' }}>{count}</span>;
      },
    },
    {
      title: '低危漏洞',
      dataIndex: 'vulnerabilities',
      key: 'low_vulnerabilities',
      render: (vulnerabilities) => {
        if (!vulnerabilities || !Array.isArray(vulnerabilities)) return 0;
        const count = vulnerabilities.filter(v => v.severity === 'low' || v.severity === 'Low').length;
        return <span style={{ color: '#1890ff' }}>{count}</span>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看">
            <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="下载">
            <Button type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>报告管理</h1>
        <div className="header-actions">
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={() => setFilterVisible(true)}
          >
            筛选
          </Button>
        </div>
      </div>

      <div className="reports-content">
        {reports.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '16px', color: '#999' }}>暂无报告数据</p>
            <p style={{ fontSize: '14px', color: '#ccc' }}>请先创建并运行扫描任务以生成报告</p>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={reports}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            bordered
          />
        )}
      </div>

      {/* 筛选模态框 */}
      <Modal
        title="筛选报告"
        open={filterVisible}
        onCancel={() => setFilterVisible(false)}
        onOk={applyFilters}
        footer={[
          <Button key="reset" onClick={resetFilters}>重置</Button>,
          <Button key="cancel" onClick={() => setFilterVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={applyFilters}>应用</Button>
        ]}
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            placeholder="选择任务"
            style={{ width: '100%' }}
            value={filters.taskId}
            onChange={(value) => setFilters({...filters, taskId: value})}
          >
            {tasks.map(task => (
              <Option key={task.id} value={task.id}>
                {task.name}
              </Option>
            ))}
          </Select>

          <RangePicker
            style={{ width: '100%' }}
            value={filters.dateRange}
            onChange={(value) => setFilters({...filters, dateRange: value})}
          />

          <Select
            placeholder="选择严重程度"
            style={{ width: '100%' }}
            value={filters.severity}
            onChange={(value) => setFilters({...filters, severity: value})}
          >
            <Option value="high">高危</Option>
            <Option value="medium">中危</Option>
            <Option value="low">低危</Option>
          </Select>
        </Space>
      </Modal>

      {/* 查看报告模态框 */}
      <Modal
        title={`报告 #${selectedReport?.id}`}
        open={viewModalVisible}
        onCancel={closeViewModal}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        {selectedReport && (
          <div className="report-view-content">
            <Tabs defaultActiveKey="overview">
              <TabPane tab="概览" key="overview">
                <Card title="报告概览">
                  <p><strong>报告ID：</strong>{selectedReport.id}</p>
                  <p><strong>所属任务：</strong>
                    {tasks.find(t => t.id === selectedReport.task_id)?.name || '未知任务'}
                  </p>
                  <p><strong>扫描类型：</strong>{selectedReport.scan_type}</p>
                  <p><strong>状态：</strong>{selectedReport.status}</p>
                  <p><strong>创建时间：</strong>{new Date(selectedReport.created_at).toLocaleString()}</p>
                  <p><strong>高危漏洞：</strong><span style={{ color: '#ff4d4f' }}>
                    {selectedReport.vulnerabilities && Array.isArray(selectedReport.vulnerabilities) ? selectedReport.vulnerabilities.filter(v => v.severity === 'high' || v.severity === 'High').length : 0}
                  </span></p>
                  <p><strong>中危漏洞：</strong><span style={{ color: '#faad14' }}>
                    {selectedReport.vulnerabilities && Array.isArray(selectedReport.vulnerabilities) ? selectedReport.vulnerabilities.filter(v => v.severity === 'medium' || v.severity === 'Medium').length : 0}
                  </span></p>
                  <p><strong>低危漏洞：</strong><span style={{ color: '#1890ff' }}>
                    {selectedReport.vulnerabilities && Array.isArray(selectedReport.vulnerabilities) ? selectedReport.vulnerabilities.filter(v => v.severity === 'low' || v.severity === 'Low').length : 0}
                  </span></p>
                  <p><strong>总计漏洞：</strong>
                    {selectedReport.vulnerabilities && Array.isArray(selectedReport.vulnerabilities) ? selectedReport.vulnerabilities.length : 0}
                  </p>
                </Card>
              </TabPane>
              <TabPane tab="漏洞详情" key="details">
                <Card title="漏洞列表">
                  {selectedReport.vulnerabilities && Array.isArray(selectedReport.vulnerabilities) && selectedReport.vulnerabilities.length > 0 ? (
                    <List
                      dataSource={selectedReport.vulnerabilities}
                      renderItem={(vuln, index) => (
                        <List.Item key={index}>
                          <Card
                            title={`${vuln.type} - ${vuln.severity}`}
                            style={{
                              backgroundColor: 
                                vuln.severity === 'high' || vuln.severity === 'High' ? '#fff1f0' :
                                vuln.severity === 'medium' || vuln.severity === 'Medium' ? '#fffbe6' :
                                '#f6ffed'
                            }}
                          >
                            <p><strong>位置：</strong>{vuln.location}</p>
                            <p><strong>描述：</strong>{vuln.description}</p>
                            {vuln.details && (
                              <div>
                                <strong>详细信息：</strong>
                                <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                  {JSON.stringify(vuln.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </Card>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: '50px 0' }}>
                      未发现漏洞
                    </p>
                  )}
                </Card>
              </TabPane>
              <TabPane tab="修复建议" key="suggestions">
                <Card title="修复建议">
                  {selectedReport.remediation_suggestions && Array.isArray(selectedReport.remediation_suggestions) && selectedReport.remediation_suggestions.length > 0 ? (
                    <List
                      dataSource={selectedReport.remediation_suggestions}
                      renderItem={(suggestion, index) => (
                        <List.Item key={index}>
                          <Card title={`针对 ${suggestion.vulnerability_type} 的修复建议`}>
                            <p>{suggestion.suggestion}</p>
                            {suggestion.code_example && (
                              <div>
                                <strong>代码示例：</strong>
                                <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
                                  {suggestion.code_example}
                                </pre>
                              </div>
                            )}
                          </Card>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: '50px 0' }}>
                      暂无修复建议
                    </p>
                  )}
                </Card>
              </TabPane>
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportsPage;