import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  split,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const graphqlUrl =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql';
const wsUrl =
  import.meta.env.VITE_GRAPHQL_WS_URL ?? 'ws://localhost:3000/graphql';

const httpLink = new HttpLink({ uri: graphqlUrl });
const authenticatedHttpLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      'apollo-require-preflight': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}).concat(httpLink);

const wsLink = new GraphQLWsLink(
  createClient({
    url: wsUrl,
    connectionParams: () => {
      const token = localStorage.getItem('token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    retryAttempts: 5,
  }),
);

const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  authenticatedHttpLink,
);

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
