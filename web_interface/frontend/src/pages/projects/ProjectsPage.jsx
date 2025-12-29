import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Table, Space, Modal, Form, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getProjects, createProject, updateProject, deleteProject } from '../../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('create'); // create or edit
  const [selectedProject, setSelectedProject] = useState(null);
  const [form] = Form.useForm();
  
  // 搜索参数
  const [searchParams, setSearchParams] = useState({
    projectId: '',
    projectName: '',
    creator: '',
    isCompetitive: '全部',
    status: '全部'
  });
  
  // 分页参数
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取项目列表
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = {
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize
      };
      
      // 添加搜索筛选条件
      if (searchParams.projectName) params.name = searchParams.projectName;
      if (searchParams.creator) params.created_by = searchParams.creator;
      if (searchParams.isCompetitive !== '全部') params.is_competitive = searchParams.isCompetitive === '是';
      if (searchParams.status !== '全部') params.status = searchParams.status;
      
      const data = await getProjects(params);
      setProjects(data);
      setPagination(prev => ({
        ...prev,
        total: data.length // 实际项目中应该从API返回总条数
      }));
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化时获取项目列表
  useEffect(() => {
    fetchProjects();
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 搜索处理
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchProjects();
  };

  // 重置搜索条件
  const handleReset = () => {
    setSearchParams({
      projectId: '',
      projectName: '',
      creator: '',
      isCompetitive: '全部',
      status: '全部'
    });
    form.resetFields();
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchProjects();
  };

  // 新建项目
  const handleCreateProject = () => {
    setModalType('create');
    setSelectedProject(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 编辑项目
  const handleEditProject = (record) => {
    setModalType('edit');
    setSelectedProject(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      isCompetitive: record.is_competitive,
      status: record.status
    });
    setModalVisible(true);
  };

  // 删除项目
  const handleDeleteProject = async (id) => {
    try {
      await deleteProject(id);
      message.success('项目删除成功');
      fetchProjects();
    } catch (error) {
      console.error('删除项目失败:', error);
      message.error('删除项目失败');
    }
  };

  // 查看项目详情
  const handleViewProject = (record) => {
    message.info(`查看项目详情: ${record.name}`);
  };

  // 处理模态框提交
  const handleModalSubmit = async (values) => {
    try {
      if (modalType === 'create') {
        // 创建新项目
        await createProject({
          name: values.name,
          description: values.description,
          is_competitive: values.isCompetitive,
          status: values.status
        });
        message.success('项目创建成功');
      } else {
        // 更新项目
        await updateProject(selectedProject.id, {
          name: values.name,
          description: values.description,
          is_competitive: values.isCompetitive,
          status: values.status
        });
        message.success('项目更新成功');
      }
      setModalVisible(false);
      fetchProjects();
    } catch (error) {
      console.error(`${modalType === 'create' ? '创建' : '更新'}项目失败:`, error);
      message.error(`${modalType === 'create' ? '创建' : '更新'}项目失败`);
    }
  };

  // 表格列配置
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '是否竞争性',
      dataIndex: 'is_competitive',
      key: 'is_competitive',
      width: 100,
      render: (isCompetitive) => (
        <span style={{ color: isCompetitive ? '#ff4d4f' : '#52c41a' }}>
          {isCompetitive ? '是' : '否'}
        </span>
      )
    },
    {
      title: '项目状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        let color = '#d9d9d9';
        if (status === 'active') color = '#52c41a';
        if (status === 'completed') color = '#1890ff';
        if (status === 'paused') color = '#faad14';
        return (
          <span style={{ color }}>
            {status === 'active' ? '正常' : status === 'completed' ? '已完成' : '已暂停'}
          </span>
        );
      }
    },
    {
      title: '统计状态',
      dataIndex: 'status',
      key: 'statistics_status',
      width: 100,
      render: (status) => (
        <span style={{ color: '#52c41a' }}>正常</span>
      )
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '结束时间',
      dataIndex: 'ended_at',
      key: 'ended_at',
      width: 150,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewProject(record)}>详情</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditProject(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteProject(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="container">
      <div className="page-title">项目管理</div>
      
      {/* 搜索筛选区域 */}
      <div className="table-container" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>项目ID:</span>
            <Input
              placeholder="请输入项目ID"
              value={searchParams.projectId}
              onChange={(e) => setSearchParams(prev => ({ ...prev, projectId: e.target.value }))}
              style={{ width: 150 }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>项目名称:</span>
            <Input
              placeholder="请输入项目名称"
              value={searchParams.projectName}
              onChange={(e) => setSearchParams(prev => ({ ...prev, projectName: e.target.value }))}
              style={{ width: 200 }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>创建人:</span>
            <Input
              placeholder="请输入创建人"
              value={searchParams.creator}
              onChange={(e) => setSearchParams(prev => ({ ...prev, creator: e.target.value }))}
              style={{ width: 150 }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>是否竞争性项目:</span>
            <Select
              value={searchParams.isCompetitive}
              onChange={(value) => setSearchParams(prev => ({ ...prev, isCompetitive: value }))}
              style={{ width: 120 }}
            >
              <Option value="全部">全部</Option>
              <Option value="是">是</Option>
              <Option value="否">否</Option>
            </Select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>项目状态:</span>
            <Select
              value={searchParams.status}
              onChange={(value) => setSearchParams(prev => ({ ...prev, status: value }))}
              style={{ width: 120 }}
            >
              <Option value="全部">全部</Option>
              <Option value="active">正常</Option>
              <Option value="completed">已完成</Option>
              <Option value="paused">已暂停</Option>
            </Select>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProject}>新建项目</Button>
        </div>
      </div>
      
      {/* 项目列表表格 */}
      <div className="table-container">
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize
              }));
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </div>
      
      {/* 新建/编辑项目模态框 */}
      <Modal
        title={modalType === 'create' ? '新建项目' : '编辑项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleModalSubmit}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea placeholder="请输入项目描述" rows={3} />
          </Form.Item>
          
          <Form.Item
            name="isCompetitive"
            label="是否竞争性项目"
            rules={[{ required: true, message: '请选择是否为竞争性项目' }]}
          >
            <Select placeholder="请选择">
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="status"
            label="项目状态"
            rules={[{ required: true, message: '请选择项目状态' }]}
          >
            <Select placeholder="请选择">
              <Option value="active">正常</Option>
              <Option value="paused">已暂停</Option>
              <Option value="completed">已完成</Option>
            </Select>
          </Form.Item>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              {modalType === 'create' ? '创建' : '更新'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
