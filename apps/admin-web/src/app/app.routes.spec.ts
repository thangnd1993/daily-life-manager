import { routes } from './app.routes';

describe('app routes', () => {
  it('keeps the root redirect valid and guards the destination', () => {
    const root = routes.find((route) => route.path === '');
    const dashboard = routes.find((route) => route.path === 'dashboard');

    expect(root).toMatchObject({ redirectTo: 'dashboard', pathMatch: 'full' });
    expect(root?.canActivate).toBeUndefined();
    expect(dashboard?.canActivate).toHaveLength(1);
  });
});
