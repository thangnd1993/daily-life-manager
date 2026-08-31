import { routes } from './app.routes';

describe('app routes', () => {
  it('keeps the root redirect valid and guards the destination', () => {
    const root = routes.find((route) => route.path === '');
    const users = routes.find((route) => route.path === 'users');

    expect(root).toMatchObject({ redirectTo: 'users', pathMatch: 'full' });
    expect(root?.canActivate).toBeUndefined();
    expect(users?.canActivate).toHaveLength(1);
  });
});
