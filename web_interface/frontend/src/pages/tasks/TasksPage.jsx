import React, { useState, useEffect } from 'react';
import { Button, Table, Form, Input, Select, Modal, message, Space, DatePicker, Switch, Tag, Progress, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { getTasks, createTask, updateTask, deleteTask, startTask, stopTask, getTaskProgress } from '../../utils/api';
import { getProjects } from '../../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm(); // 搜索表单实例
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('create'); // create or edit
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchParams, setSearchParams] = useState({ taskName: '', projectId: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [pollingIntervals, setPollingIntervals] = useState({}); // 存储每个任务的轮询定时器
  const [detailModalVisible, setDetailModalVisible] = useState(false); // 详情模态框显示状态
  const [currentTask, setCurrentTask] = useState(null); // 当前查看详情的任务
  const [networkStatus, setNetworkStatus] = useState('checking'); // 网络状态: checking, connected, disconnected, error
  const [networkCheckError, setNetworkCheckError] = useState(null); // 网络检查错误信息

  // 获取任务列表
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        ...searchParams
      };
      const response = await getTasks(params);
      setTasks(response);
    } catch (error) {
      message.error('获取任务列表失败');
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      setProjects(response);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 当任务列表更新时，自动开始轮询所有运行中的任务
  useEffect(() => {
    tasks.forEach(task => {
      if (task.status === 'running') {
        startPolling(task.id);
      }
    });
    
    // 组件卸载时停止所有轮询
    return () => {
      Object.keys(pollingIntervals).forEach(id => {
        stopPolling(id);
      });
    };
  }, [tasks]);

  // 创建任务
  const handleCreate = () => {
    setModalType('create');
    setSelectedTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 编辑任务
  const handleEdit = (task) => {
    setModalType('edit');
    setSelectedTask(task);
    form.setFieldsValue({
      name: task.name,
      projectId: task.project_id,
      targetUrl: task.target_url,
      scanType: task.scan_type,
      isRecurring: task.is_recurring,
      cronExpression: task.cron_expression,
      description: task.description
    });
    setModalVisible(true);
  };

  // 删除任务
  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      message.success('任务删除成功');
      fetchTasks();
    } catch (error) {
      message.error('任务删除失败');
      console.error('Failed to delete task:', error);
    }
  };

  // 获取单个任务进度
  const fetchTaskProgress = async (id) => {
    try {
      const progress = await getTaskProgress(id);
      setTasks(prevTasks => {
        return prevTasks.map(task => {
          if (task.id === id) {
            return { ...task, progress: progress.progress || 0, status: progress.status };
          }
          return task;
        });
      });
      
      // 同时更新当前查看的任务详情
      if (currentTask && currentTask.id === id) {
        setCurrentTask(prev => ({
          ...prev,
          progress: progress.progress || 0,
          status: progress.status
        }));
      }
      
      // 如果任务已完成或停止，停止轮询
      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'stopped') {
        stopPolling(id);
      }
    } catch (error) {
      // 如果是404错误，说明任务不存在，停止轮询
      if (error.response && error.response.status === 404) {
        stopPolling(id);
      }
      console.error('Failed to fetch task progress:', error);
    }
  };

  // 获取动态轮询间隔（根据任务状态调整）
  const getDynamicInterval = (status) => {
    // 运行中的任务使用较短间隔，提高实时性
    if (status === 'running') {
      return 1000; // 1秒
    }
    // 其他状态使用较长间隔，减少资源消耗
    return 5000; // 5秒
  };

  // 开始轮询任务进度
  const startPolling = (id) => {
    // 先停止可能已经存在的轮询
    stopPolling(id);
    
    // 获取任务状态以确定轮询间隔
    const task = tasks.find(t => t.id === id);
    const interval = getDynamicInterval(task?.status || 'pending');
    
    // 立即获取一次进度
    fetchTaskProgress(id);
    // 设置轮询定时器
    const timer = setInterval(() => {
      fetchTaskProgress(id);
    }, interval);
    // 存储定时器ID
    setPollingIntervals(prev => ({
      ...prev,
      [id]: timer
    }));
  };

  // 停止轮询任务进度
  const stopPolling = (id) => {
    const timer = pollingIntervals[id];
    if (timer) {
      clearInterval(timer);
      setPollingIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[id];
        return newIntervals;
      });
    }
  };

  // 启动任务
  const handleStart = async (id) => {
    try {
      await startTask(id);
      message.success('任务启动成功');
      fetchTasks();
      // 开始轮询任务进度
      startPolling(id);
    } catch (error) {
      message.error('任务启动失败');
      console.error('Failed to start task:', error);
    }
  };

  // 停止任务
  const handleStop = async (id) => {
    try {
      await stopTask(id);
      message.success('任务停止成功');
      fetchTasks();
    } catch (error) {
      message.error('任务停止失败');
      console.error('Failed to stop task:', error);
    }
  };

  // 查看任务详情
  const handleView = (task) => {
    setCurrentTask(task);
    setDetailModalVisible(true);
    checkNetworkConnectivity(task.target_url);
  };

  // 检查网络连通性
  const checkNetworkConnectivity = async (url) => {
    setNetworkStatus('checking');
    setNetworkCheckError(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.type === 'opaque' || response.ok) {
        setNetworkStatus('connected');
      } else {
        setNetworkStatus('disconnected');
      }
    } catch (error) {
      setNetworkCheckError(error.message);
      
      if (error.name === 'AbortError') {
        setNetworkStatus('disconnected');
      } else {
        setNetworkStatus('error');
      }
    }
  };

  // 提交任务表单
  const handleSubmit = async (values) => {
    try {
      if (modalType === 'create') {
        await createTask({
          name: values.name,
          project_id: values.projectId,
          target_url: values.targetUrl,
          scan_type: values.scanType,
          is_recurring: values.isRecurring,
          cron_expression: values.isRecurring ? values.cronExpression : null,
          description: values.description
        });
        message.success('任务创建成功');
      } else {
        await updateTask(selectedTask.id, {
          name: values.name,
          project_id: values.projectId,
          target_url: values.targetUrl,
          scan_type: values.scanType,
          is_recurring: values.isRecurring,
          cron_expression: values.isRecurring ? values.cronExpression : null,
          description: values.description
        });
        message.success('任务更新成功');
      }
      setModalVisible(false);
      fetchTasks();
    } catch (error) {
      message.error(`${modalType === 'create' ? '创建' : '更新'}任务失败`);
      console.error(`Failed to ${modalType} task:`, error);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchTasks();
  };

  // 处理重置
  const handleReset = () => {
    setSearchParams({ taskName: '', projectId: '' });
    fetchTasks();
  };

  // 获取任务状态标签
  const getStatusTag = (status) => {
    switch (status) {
      case 'pending':
        return <Tag color="default">待执行</Tag>;
      case 'running':
        return <Tag color="processing">执行中</Tag>;
      case 'completed':
        return <Tag color="success">已完成</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
      case 'stopped':
        return <Tag color="warning">已停止</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 获取扫描类型标签
  const getScanTypeTag = (type) => {
    switch (type) {
      case 'full':
        return <Tag color="blue">全面扫描</Tag>;
      case 'quick':
        return <Tag color="green">快速扫描</Tag>;
      case 'custom':
        return <Tag color="purple">自定义扫描</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '所属项目',
      dataIndex: 'project_id',
      key: 'project_id',
      render: (projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : '未知项目';
      },
    },
    {
      title: '扫描类型',
      dataIndex: 'scan_type',
      key: 'scan_type',
      render: (type) => getScanTypeTag(type),
    },
    {
      title: '任务状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => (
        <Progress percent={progress} size="small" status={progress === 100 ? 'success' : 'active'} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '下次执行',
      dataIndex: 'next_run',
      key: 'next_run',
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_, record) => (
        <Space size="middle" wrap>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          {record.status === 'running' ? (
            <Button type="link" danger icon={<StopOutlined />} onClick={() => handleStop(record.id)}>停止</Button>
          ) : (
            <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleStart(record.id)}>启动</Button>
          )}
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="tasks-page">
      <div className="page-header">
        <h1>任务管理</h1>
        <div className="header-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建任务</Button>
        </div>
      </div>

      {/* 搜索筛选区域 */}
      <div className="search-filter" style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 4 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item label="任务名称" name="taskName" style={{ marginBottom: 0 }}>
            <Input
              placeholder="请输入任务名称"
              onChange={(e) => searchForm.setFieldsValue({ taskName: e.target.value })}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item label="所属项目" name="projectId" style={{ marginBottom: 0 }}>
            <Select
              placeholder="选择项目"
              onChange={(value) => searchForm.setFieldsValue({ projectId: value })}
              style={{ width: 200 }}
            >
              <Option value="">全部</Option>
              {projects.map(project => (
                <Option key={project.id} value={project.id}>{project.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginLeft: 'auto' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          </div>
        </Form>
      </div>

      {/* 任务列表表格 */}
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          onChange: (page, pageSize) => {
            setPagination(prev => ({ ...prev, current: page, pageSize }));
          },
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`,
          pageSizeOptions: ['10', '20', '50', '100']
        }}
      />

      {/* 新建/编辑任务模态框 */}
      <Modal
        title={modalType === 'create' ? '新建任务' : '编辑任务'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="所属项目"
            rules={[{ required: true, message: '请选择所属项目' }]}
          >
            <Select placeholder="请选择所属项目">
              {projects.map(project => (
                <Option key={project.id} value={project.id}>{project.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetUrl"
            label="目标URL"
            rules={[{ required: true, message: '请输入目标URL' }, { type: 'url', message: '请输入有效的URL' }]}
          >
            <Input placeholder="请输入目标URL" />
          </Form.Item>

          <Form.Item
            name="scanType"
            label="扫描类型"
            rules={[{ required: true, message: '请选择扫描类型' }]}
          >
            <Select placeholder="请选择扫描类型">
              <Option value="full">全面扫描</Option>
              <Option value="quick">快速扫描</Option>
              <Option value="custom">自定义扫描</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isRecurring"
            label="是否周期执行"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.isRecurring !== currentValues.isRecurring}
          >
            {({ getFieldValue }) => {
              return getFieldValue('isRecurring') ? (
                <Form.Item
                  name="cronExpression"
                  label="Cron表达式"
                  rules={[{ required: true, message: '请输入Cron表达式' }]}
                >
                  <Input placeholder="例如: 0 0 * * * (每天凌晨执行)" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
          >
            <TextArea placeholder="请输入任务描述" rows={3} />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              {modalType === 'create' ? '创建' : '更新'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 任务详情模态框 */}
      <Modal
        title="任务详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentTask && (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="任务ID">{currentTask.id}</Descriptions.Item>
              <Descriptions.Item label="任务名称">{currentTask.name}</Descriptions.Item>
              <Descriptions.Item label="所属项目">
                {projects.find(p => p.id === currentTask.project_id)?.name || '未知项目'}
              </Descriptions.Item>
              <Descriptions.Item label="目标URL">{currentTask.target_url}</Descriptions.Item>
              <Descriptions.Item label="网络连通性">
                {networkStatus === 'checking' ? (
                  <Tag color="blue">检查中...</Tag>
                ) : networkStatus === 'connected' ? (
                  <Tag color="green">连通</Tag>
                ) : networkStatus === 'disconnected' ? (
                  <Tag color="orange">无法连通</Tag>
                ) : (
                  <Tag color="red">检查失败</Tag>
                )}
                {networkStatus === 'error' && networkCheckError && (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: '12px' }}>
                    错误: {networkCheckError}
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="扫描类型">{getScanTypeTag(currentTask.scan_type)}</Descriptions.Item>
              <Descriptions.Item label="任务状态">{getStatusTag(currentTask.status)}</Descriptions.Item>
              <Descriptions.Item label="进度">
                <Progress percent={currentTask.progress} status={currentTask.progress === 100 ? 'success' : 'active'} />
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {currentTask.created_at ? new Date(currentTask.created_at).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {currentTask.started_at ? new Date(currentTask.started_at).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {currentTask.completed_at ? new Date(currentTask.completed_at).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="是否周期执行">
                {currentTask.is_recurring ? '是' : '否'}
              </Descriptions.Item>
              {currentTask.is_recurring && (
                <Descriptions.Item label="Cron表达式">{currentTask.cron_expression || '-'}</Descriptions.Item>
              )}
              <Descriptions.Item label="下次执行">
                {currentTask.next_run ? new Date(currentTask.next_run).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建者">{currentTask.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="任务描述">{currentTask.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="扫描结果">
                {currentTask.scan_result ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                    {currentTask.scan_result.length > 200 ? (
                      <div>
                        <p>扫描结果预览（完整结果请查看报告）:</p>
                        <pre style={{ fontSize: '12px', margin: '5px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {currentTask.scan_result.substring(0, 200)}...
                        </pre>
                      </div>
                    ) : (
                      <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {currentTask.scan_result}
                      </pre>
                    )}
                  </div>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TasksPage;