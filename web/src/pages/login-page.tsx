import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useMutation } from 'urql';

const { Paragraph, Text, Title } = Typography;

const LOGIN_MUTATION = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      accessToken
      user {
        id
        empid
        username
        nickname
        first_name
        last_name
        email
      }
    }
  }
`;

interface LoginResult {
  login: {
    accessToken: string;
    user: {
      id: string;
      empid: string;
      username: string;
      nickname?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
    };
  };
}

interface LoginVariables {
  username: string;
  password: string;
}

interface LoginPageProps {
  onLogin: (accessToken: string, user: LoginResult['login']['user']) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [errorMessage, setErrorMessage] = useState<string>();
  const [result, login] = useMutation<LoginResult, LoginVariables>(
    LOGIN_MUTATION,
  );

  const submit = async ({ username, password }: LoginVariables) => {
    setErrorMessage(undefined);
    const response = await login({ username, password });
    if (response.error) {
      setErrorMessage(response.error.graphQLErrors[0]?.message ?? response.error.message);
      return;
    }

    const auth = response.data?.login;
    if (!auth?.accessToken || !auth.user) {
      setErrorMessage('The authentication service returned an invalid response.');
      return;
    }

    onLogin(auth.accessToken, auth.user);
  };

  return (
    <main className="login-shell">
      <Card className="login-card">
        <div className="login-brand">
          <Text className="eyebrow">VIBE AI</Text>
          <Title level={2}>Welcome back</Title>
          <Paragraph>
            Sign in with your company account to access the knowledge base.
          </Paragraph>
        </div>
        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message="Sign in failed"
            description={errorMessage}
            className="form-alert"
          />
        )}
        <Form<LoginVariables> layout="vertical" onFinish={submit}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Enter your username.' }]}
          >
            <Input autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Enter your password.' }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={result.fetching}
            size="large"
            block
          >
            Sign in
          </Button>
        </Form>
        <Space className="login-support">
          <Text type="secondary">Use your company account.</Text>
        </Space>
      </Card>
    </main>
  );
}
