import { Client, fetchExchange } from 'urql';

export const graphqlClient = new Client({
  url: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql',
  exchanges: [fetchExchange],
  fetchOptions: () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'apollo-require-preflight': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  },
});
