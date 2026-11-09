module.exports = {
  development: {
    username: process.env.DB_USER || 'vibe_ai',
    password: process.env.DB_PASSWORD || 'vibe_ai_local',
    database: process.env.DB_NAME || 'vibe_ai',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
  },
};
