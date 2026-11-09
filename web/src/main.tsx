import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import { Refine } from '@refinedev/core';
import { Provider } from 'urql';
import { ApolloProvider } from '@apollo/client';
import { gql, useQuery } from '@apollo/client';
import { apolloClient } from './providers/apollo-client';
import { graphqlClient } from './providers/graphql-client';
import { ChatPage } from './pages/chat-page';
import { LoginPage } from './pages/login-page';
import { SettingsPage } from './pages/settings-page';
import './styles.css';

const CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      username
      isAdmin
    }
  }
`;

interface CurrentUserData {
  currentUser: {
    username: string;
    isAdmin: boolean;
  };
}

function AppRoot() {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('token') ?? '',
  );
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const { data: currentUserData } = useQuery<CurrentUserData>(CURRENT_USER, {
    skip: !accessToken,
    fetchPolicy: 'network-only',
  });

  const login = (token: string, user: object) => {
    void apolloClient.clearStore();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setAccessToken(token);
    setActiveView('chat');
  };

  const logout = () => {
    void apolloClient.clearStore();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAccessToken('');
    setActiveView('chat');
  };

  if (!accessToken) {
    return <LoginPage onLogin={login} />;
  }

  if (activeView === 'settings' && currentUserData?.currentUser.isAdmin) {
    return (
      <SettingsPage
        onLogout={logout}
        onBack={() => setActiveView('chat')}
      />
    );
  }

  return (
    <ChatPage
      onLogout={logout}
      isAdmin={currentUserData?.currentUser.isAdmin ?? false}
      onSettings={() => setActiveView('settings')}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <AntdApp>
        <ApolloProvider client={apolloClient}>
          <Provider value={graphqlClient}>
            <Refine
              resources={[
                {
                  name: 'chat',
                  list: '/',
                  meta: { label: 'Chat' },
                },
              ]}
            >
              <AppRoot />
            </Refine>
          </Provider>
        </ApolloProvider>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
