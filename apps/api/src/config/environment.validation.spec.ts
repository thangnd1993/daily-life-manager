import { environmentSchema } from './environment.validation';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
  JWT_ACCESS_SECRET: 'a-production-secret-with-at-least-32-characters',
};

describe('environment validation security', () => {
  it('rejects weak JWT secrets and wildcard CORS', () => {
    expect(
      environmentSchema.validate({ ...valid, JWT_ACCESS_SECRET: 'weak' }).error,
    ).toBeDefined();
    expect(
      environmentSchema.validate({ ...valid, CORS_ORIGINS: '*' }).error,
    ).toBeDefined();
  });

  it('accepts explicit comma-separated HTTP origins', () => {
    const result = environmentSchema.validate({
      ...valid,
      CORS_ORIGINS: 'http://localhost:4200,https://admin.example.com',
    });
    expect(result.error).toBeUndefined();
  });

  it('bounds the number of trusted reverse proxies', () => {
    expect(
      environmentSchema.validate({ ...valid, TRUST_PROXY_HOPS: 1 }).error,
    ).toBeUndefined();
    expect(
      environmentSchema.validate({ ...valid, TRUST_PROXY_HOPS: 4 }).error,
    ).toBeDefined();
  });
});
