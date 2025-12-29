import React from 'react';
import { Card, Typography, Collapse, Space, Divider, List, Tag } from 'antd';
import { QuestionCircleOutlined, InfoCircleOutlined, AlertOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const HelpPage = () => {
  // 常见问题
  const faqs = [
    {
      question: '如何创建一个新项目？',
      answer: '在项目管理页面点击"创建项目"按钮，填写项目名称、目标URL和描述，然后点击"创建"即可。'
    },
    {
      question: '扫描任务需要多长时间？',
      answer: '扫描时间取决于目标网站的大小和复杂度，以及选择的扫描类型。快速扫描通常需要几分钟，全面扫描可能需要几十分钟甚至更长时间。'
    },
    {
      question: '如何查看扫描报告？',
      answer: '在报告任务页面可以查看所有扫描报告，支持按严重程度分类查看，点击"查看"按钮可以查看报告详情。'
    },
    {
      question: '如何下载扫描报告？',
      answer: '在报告任务页面，找到需要下载的报告，点击对应的下载按钮（PDF或JSON）即可下载报告。'
    },
    {
      question: '如何切换主题？',
      answer: '在页面右上角点击主题切换按钮，可以在浅色主题和深色主题之间切换。'
    },
    {
      question: '忘记密码怎么办？',
      answer: '目前系统不支持密码重置功能，请联系管理员重置密码。'
    },
    {
      question: '扫描任务失败了怎么办？',
      answer: '请检查目标URL是否可访问，网络连接是否正常，或者尝试调整扫描参数后重新扫描。'
    },
    {
      question: '支持哪些扫描类型？',
      answer: '系统支持全面扫描、快速扫描和定向扫描三种扫描类型。'
    }
  ];

  // 快速开始指南
  const quickStartSteps = [
    {
      title: '创建项目',
      description: '登录系统后，在项目管理页面创建一个新项目，填写项目名称和目标URL。',
      icon: <CheckCircleOutlined />
    },
    {
      title: '创建扫描任务',
      description: '在任务管理页面，为项目创建一个扫描任务，选择合适的扫描类型。',
      icon: <CheckCircleOutlined />
    },
    {
      title: '启动扫描',
      description: '在任务列表中找到创建的任务，点击"启动"按钮开始扫描。',
      icon: <CheckCircleOutlined />
    },
    {
      title: '查看报告',
      description: '扫描完成后，在报告任务页面查看扫描结果和详细报告。',
      icon: <CheckCircleOutlined />
    }
  ];

  // 扫描状态说明
  const scanStatus = [
    { name: '等待中', description: '任务已创建，等待系统分配资源开始扫描', color: 'blue' },
    { name: '运行中', description: '扫描任务正在执行，请耐心等待', color: 'green' },
    { name: '已完成', description: '扫描任务已成功完成', color: 'orange' },
    { name: '已停止', description: '扫描任务被用户手动停止', color: 'gray' },
    { name: '失败', description: '扫描任务执行失败，请检查错误信息', color: 'red' }
  ];

  return (
    <div className="help-page">
      <div className="page-header">
        <h1>帮助文档</h1>
      </div>

      <div className="help-content">
        {/* 快速开始 */}
        <Card title="快速开始" bordered>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Paragraph>
              欢迎使用漏洞扫描系统！以下是快速上手指南，帮助您快速了解和使用系统功能。
            </Paragraph>
            
            <List
              dataSource={quickStartSteps}
              renderItem={(item, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Tag color="green">{index + 1}</Tag>}
                    title={item.title}
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </Space>
        </Card>

        <Divider />

        {/* 常见问题 */}
        <Card title="常见问题" bordered>
          <Collapse defaultActiveKey={['1']} ghost>
            {faqs.map((faq, index) => (
              <Panel header={faq.question} key={index + 1}>
                <Paragraph>{faq.answer}</Paragraph>
              </Panel>
            ))}
          </Collapse>
        </Card>

        <Divider />

        {/* 扫描状态说明 */}
        <Card title="扫描状态说明" bordered>
          <List
            grid={{ gutter: 16, column: 2 }}
            dataSource={scanStatus}
            renderItem={(status) => (
              <List.Item>
                <Card bordered={false}>
                  <Space>
                    <Tag color={status.color}>{status.name}</Tag>
                    <Text>{status.description}</Text>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Card>

        <Divider />

        {/* 系统说明 */}
        <Card title="系统说明" bordered>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4}>关于系统</Title>
              <Paragraph>
                Aries采用前后端分离,前端基于React + Ant Design实现页面交互,提供项目、任务、报告的可视化管理界面;后端采用Node.js/Express提供RESTful API,调用Wapiti引擎进行漏洞扫描,支持任务调度、结果解析与PDF/JSON报告生成。
              </Paragraph>
            </div>
            
            <div>
              <Title level={4}>支持的扫描类型</Title>
              <List
                dataSource={[
                  '全面扫描：扫描所有常见漏洞类型',
                  '快速扫描：只扫描主要漏洞类型，速度更快',
                  '定向扫描：针对特定漏洞类型进行扫描'
                ]}
                renderItem={(item) => <List.Item prefix={<CheckCircleOutlined />}>{item}</List.Item>}
              />
            </div>
            
            <div>
              <Title level={4}>注意事项</Title>
              <List
                dataSource={[
                  '本系统仅用于授权安全测试，禁止用于任何非法用途。使用本系统即视为您已获得目标系统的合法授权，并同意自行承担因使用本系统所产生的一切风险与责任。开发者不对因滥用本系统而导致的任何直接或间接损失承担责任'
                ]}
                renderItem={(item) => <List.Item prefix={<AlertOutlined />}>{item}</List.Item>}
              />
            </div>

            <div>
              <Title level={4}>爱的本质是创造力</Title>
              <Paragraph>
                <Text>
                  在人类经验的核心，爱被视为一种深刻的本质力量。这种本质并非单纯的情感冲动或性，而是根本上的一种创造力。它源于个体内在的丰盈，驱使我们构建连接、生成意义，并通过互动重塑自我与他者的世界。爱是灵魂的向善之欲，是一种从匮乏中升华的创造过程。然而，当我们审视当代社会时，很难说清楚爱到底是什么。当吃饱穿暖已经不再是人们考虑的首要时，于是人们开始追寻精神上的满足，爱到底是什么？ 爱在哪里？又发现爱的实践往往被内在的空虚所扭曲。这种扭曲源于人类存在的根本矛盾：我们本是创造者，却常常陷入匮乏的状态，将这种缺失投影至亲密关系之中。
                  匮乏，作为存在主义哲学中的核心概念，由海德格尔等思想家阐述为“此在”的不安定性。它并非物质上的贫乏，而是精神层面的虚空；一种对完整自我的渴望。这种匮乏在亲密关系中表现得尤为显著。个体往往将自身的成长经历欠缺投射到伴侣身上，期望对方成为填补者。这种投影机制类似于弗洛伊德心理分析中的移情现象：我们将未解决的内在冲突转移到外部对象上。在亲密关系中，常表现出缺乏安全感，希望通过对方的肯定、关怀或存在来弥补自身的不足。然而，这种期望注定短暂的。因为爱的本质是创造，而非被动填充。如果一方处于匮乏状态，关系便从互补转向寄生，伴侣被视为拯救者，而非平等的共创者。结果往往是失望与冲突的循环，正如尼采所言，“爱是一种意志的创造”，但当意志被匮乏主导时，它便堕落为占有欲。
                  情绪只是一面镜子，反映着我们心中小孩现在的真实感受，而在情绪这座冰山下面，藏着更多是自己不完美的成长经历，童年的创伤，曾经受到的伤害，这些一起组成了爱情中的自己
                  爱的创造力，恰恰体现在对自我缺陷的接纳与超越。真正的爱，是先与自己的成长经历和解，承认那些伤害与匮乏的存在，却不被其束缚。它是在看清自身不完美后，依然选择以温柔对待世界；是在理解人性的脆弱后，依然愿意以真诚搭建连接。这种爱不再是向对方索取安全感，而是主动创造安全感 —— 为自己，也为彼此。它会在分歧时创造沟通的桥梁，在孤独时创造陪伴的温暖，在迷茫时创造共同成长的力量。
                </Text>
              </Paragraph>
            </div>

          </Space>
        </Card>
      </div>
    </div>
  );
};

export default HelpPage;