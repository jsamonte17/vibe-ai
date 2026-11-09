import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  List,
  Popconfirm,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { KnowledgePage } from './knowledge-page';

const { Paragraph, Text, Title } = Typography;

const PLATFORM_SETTINGS_QUERY = `
  query PlatformSettings {
    platformSettings {
      brainInstruction
      representativeInstruction
    }
  }
`;

const ADMIN_USERS_QUERY = `
  query AdminUsers {
    adminUsers {
      username
      role
      createdAt
    }
  }
`;

const UPDATE_PLATFORM_SETTINGS = `
  mutation UpdatePlatformSettings($input: UpdatePlatformSettingsInput!) {
    updatePlatformSettings(input: $input) {
      brainInstruction
      representativeInstruction
    }
  }
`;

const SET_ADMINISTRATOR_ROLE = `
  mutation SetAdministratorRole($username: String!, $isAdmin: Boolean!) {
    setAdministratorRole(username: $username, isAdmin: $isAdmin) {
      username
      role
      createdAt
    }
  }
`;

interface PlatformSettings {
  brainInstruction: string;
  representativeInstruction: string;
}

interface AdminUser {
  username: string;
  role: string;
  createdAt: string;
}

interface SettingsPageProps {
  onLogout: () => void;
  onBack: () => void;
}

export function SettingsPage({ onLogout, onBack }: SettingsPageProps) {
  const [settingsForm] = Form.useForm<PlatformSettings>();
  const [userForm] = Form.useForm<{ username: string }>();
  const [settingsError, setSettingsError] = useState<string>();
  const [usersError, setUsersError] = useState<string>();
  const [settingsResult] = useQuery<{ platformSettings: PlatformSettings }>({
    query: PLATFORM_SETTINGS_QUERY,
  });
  const [usersResult, reexecuteUsers] = useQuery<{ adminUsers: AdminUser[] }>({
    query: ADMIN_USERS_QUERY,
  });
  const [saveResult, updateSettings] = useMutation<
    { updatePlatformSettings: PlatformSettings },
    { input: PlatformSettings }
  >(UPDATE_PLATFORM_SETTINGS);
  const [roleResult, setAdministratorRole] = useMutation<
    { setAdministratorRole: AdminUser[] },
    { username: string; isAdmin: boolean }
  >(SET_ADMINISTRATOR_ROLE);
  const { message } = AntdApp.useApp();

  useEffect(() => {
    if (settingsResult.data?.platformSettings) {
      settingsForm.setFieldsValue(settingsResult.data.platformSettings);
    }
  }, [settingsForm, settingsResult.data]);

  const saveSettings = async (values: PlatformSettings) => {
    setSettingsError(undefined);
    const result = await updateSettings({ input: values });
    if (result.error) {
      setSettingsError(result.error.message);
      return;
    }
    message.success('Assistant instructions saved.');
  };

  const changeAdminRole = async (targetUsername: string, isAdmin: boolean) => {
    setUsersError(undefined);
    const result = await setAdministratorRole({
      username: targetUsername,
      isAdmin,
    });
    if (result.error) {
      setUsersError(result.error.message);
      return;
    }
    if (isAdmin) {
      userForm.resetFields();
    }
    reexecuteUsers({ requestPolicy: 'network-only' });
    message.success(
      isAdmin ? 'Administrator added.' : 'Administrator access removed.',
    );
  };

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="page-header-row">
          <Text className="eyebrow">VIBE AI · ADMINISTRATION</Text>
          <Space>
            <Button onClick={onBack}>Back to chat</Button>
            <Button onClick={onLogout}>Sign out</Button>
          </Space>
        </div>
        <Title level={1}>Settings</Title>
        <Paragraph>
          Manage company knowledge, assistant instructions, and administrator
          access.
        </Paragraph>
      </header>

      <Tabs
        defaultActiveKey="knowledge"
        items={[
          {
            key: 'knowledge',
            label: 'Knowledge base',
            children: <KnowledgePage />,
          },
          {
            key: 'instructions',
            label: 'AI instructions',
            children: (
              <Card title="Assistant instructions">
                <Paragraph type="secondary">
                  These instructions are shared by all employees and take effect
                  on subsequent chat requests.
                </Paragraph>
                {settingsError && (
                  <Alert
                    className="form-alert"
                    type="error"
                    showIcon
                    message="Could not save instructions"
                    description={settingsError}
                  />
                )}
                {settingsResult.error && (
                  <Alert
                    className="form-alert"
                    type="error"
                    showIcon
                    message="Could not load instructions"
                    description={settingsResult.error.message}
                  />
                )}
                <Form
                  form={settingsForm}
                  layout="vertical"
                  onFinish={saveSettings}
                  requiredMark="optional"
                >
                  <Form.Item
                    label="Brain instruction"
                    name="brainInstruction"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Enter the Brain instruction.',
                      },
                      {
                        max: 20000,
                        message: 'Instruction must be 20,000 characters or fewer.',
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={12}
                      maxLength={20000}
                      showCount
                      placeholder="Guide how the Brain selects registered actions."
                    />
                  </Form.Item>
                  <Form.Item
                    label="Representative instruction"
                    name="representativeInstruction"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Enter the representative instruction.',
                      },
                      {
                        max: 20000,
                        message: 'Instruction must be 20,000 characters or fewer.',
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={12}
                      maxLength={20000}
                      showCount
                      placeholder="Guide how the assistant answers employees."
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saveResult.fetching}
                    disabled={!settingsResult.data}
                  >
                    Save instructions
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: 'users',
            label: 'User management',
            children: (
              <Card title="Administrator access">
                <Paragraph type="secondary">
                  Admins can manage the shared knowledge base, assistant
                  instructions, and administrator roles.
                </Paragraph>
                {usersError && (
                  <Alert
                    className="form-alert"
                    type="error"
                    showIcon
                    message="Could not update administrator access"
                    description={usersError}
                  />
                )}
                {usersResult.error && (
                  <Alert
                    className="form-alert"
                    type="error"
                    showIcon
                    message="Could not load administrators"
                    description={usersResult.error.message}
                  />
                )}
                <Form
                  form={userForm}
                  layout="inline"
                  onFinish={({ username: targetUsername }) =>
                    void changeAdminRole(targetUsername, true)
                  }
                  className="admin-user-form"
                >
                  <Form.Item
                    label="Username"
                    name="username"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Enter a company username.',
                      },
                      {
                        max: 100,
                        message: 'Username must be 100 characters or fewer.',
                      },
                    ]}
                  >
                    <Input
                      maxLength={100}
                      placeholder="Company username"
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={roleResult.fetching}
                  >
                    Add administrator
                  </Button>
                </Form>
                <Text type="secondary">
                  Enter the exact username of an existing company account.
                </Text>
                {usersResult.data?.adminUsers.length ? (
                  <List
                    className="admin-user-list"
                    dataSource={usersResult.data.adminUsers}
                    renderItem={(admin) => (
                      <List.Item
                        key={admin.username}
                        actions={[
                          <Popconfirm
                            key="remove"
                            title={`Remove administrator access from ${admin.username}?`}
                            okText="Remove"
                            cancelText="Cancel"
                            onConfirm={() =>
                              void changeAdminRole(admin.username, false)
                            }
                          >
                            <Button danger type="link">
                              Remove
                            </Button>
                          </Popconfirm>,
                        ]}
                      >
                        <Space>
                          <Text strong>{admin.username}</Text>
                          <Tag color="blue">{admin.role}</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Text type="secondary">No administrators were found.</Text>
                )}
              </Card>
            ),
          },
        ]}
      />
    </main>
  );
}
