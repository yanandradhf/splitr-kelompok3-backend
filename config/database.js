module.exports = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'splitr_db',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'postgresql'
  },
  production: {
    // Production DB config
  }
};