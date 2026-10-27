import { demoLinks } from './demo-nav';
import { routes } from '../app.routes';

describe('demoLinks', () => {
  it('lists every titled route and skips redirects', () => {
    const links = demoLinks(routes);
    expect(links.length).toBe(routes.filter((route) => typeof route.title === 'string').length);
    expect(links).toContainEqual({ path: '/grid-demo', title: 'Cell kit · Editors' });
    expect(links.some((link) => link.path === '/' || link.path === '/**')).toBe(false);
  });
});
