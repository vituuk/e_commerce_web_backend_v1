require("dotenv").config();

const sharedPool = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
  evict: 1000,
};

const sharedDialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  keepAlive: true,
};

module.exports = {
  development: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    pool: sharedPool,
    dialectOptions: sharedDialectOptions,
  },

  test: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    pool: sharedPool,
    dialectOptions: sharedDialectOptions,
  },

  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    pool: sharedPool,
    dialectOptions: sharedDialectOptions,
  },
};