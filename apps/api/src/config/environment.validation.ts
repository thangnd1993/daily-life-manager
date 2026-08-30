import Joi from 'joi';

export const environmentSchema = Joi.object({
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),
  PASSWORD_RESET_TTL_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(30),
  ADMIN_EMAIL: Joi.string().email().allow('').optional(),
  ADMIN_PASSWORD: Joi.string().min(12).allow('').optional(),
  ADMIN_DISPLAY_NAME: Joi.string().min(2).max(100).default('Administrator'),
  GOLD_PROVIDER: Joi.string().valid('pha').default('pha'),
  GOLD_PROVIDER_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://www.pha.vn/api/v1'),
  GOLD_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  GOLD_PROVIDER_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(15000)
    .default(5000),
});
