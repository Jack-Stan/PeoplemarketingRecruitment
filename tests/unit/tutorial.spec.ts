import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import type { User } from 'firebase/auth';

const currentRoute = { value: { path: '/dashboard' } };
const push = vi.fn(async (to: string) => {
  currentRoute.value = { path: to };
});
vi.mock('vue-router', () => ({ useRouter: () => ({ push, currentRoute }) }));

import WelcomeTutorial from '@/components/WelcomeTutorial.vue';
import { useTutorial } from '@/composables/useTutorial';
import { chaptersForRole, tutorialChapters } from '@/content/tutorial';
import { tourForUser, tourStops } from '@/content/tour';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/router/routes';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/user';

const ids = (role: Role | null) => chaptersForRole(role).map((c) => c.id);

describe('chaptersForRole', () => {
  it('gives a Teamlid Mijn planning but not the staff/admin pages', () => {
    const got = ids('TeamMember');
    expect(got).toContain('my-planning');
    for (const id of ['planning', 'employees', 'users', 'audit']) expect(got).not.toContain(id);
  });

  it('gives a Teammanager Planning/Medewerkers but no admin pages', () => {
    const got = ids('TeamManager');
    expect(got).toEqual(expect.arrayContaining(['planning', 'employees']));
    for (const id of ['my-planning', 'users', 'audit']) expect(got).not.toContain(id);
  });

  it('gives a Beheerder every chapter except Mijn planning', () => {
    expect(ids('Administrator')).toEqual(
      tutorialChapters.map((c) => c.id).filter((id) => id !== 'my-planning'),
    );
  });

  it('never shows a step to a role it is not meant for', () => {
    const manager = chaptersForRole('TeamManager').find((c) => c.id === 'planning')!;
    expect(manager.steps.some((s) => s.text.includes('"Goedkeuren"'))).toBe(false);
  });

  it('drops chapters left without steps', () => {
    for (const role of ['Administrator', 'TeamManager', 'TeamMember'] as Role[])
      for (const c of chaptersForRole(role)) expect(c.steps.length).toBeGreaterThan(0);
  });

  it('only links to routes that role is actually allowed on', () => {
    for (const role of ['Administrator', 'TeamManager', 'TeamMember'] as Role[])
      for (const c of chaptersForRole(role).filter((c) => c.to)) {
        const route = routes.find((r) => r.path === c.to);
        expect(route, `${c.to} exists`).toBeDefined();
        expect(route!.meta?.roles ?? [role], `${role} may open ${c.to}`).toContain(role);
      }
  });
});

describe('WelcomeTutorial', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useTutorial().close();
  });

  function signIn(role: Role | null, uid = 'u1') {
    const auth = useAuthStore();
    auth.user = { uid } as User;
    auth.role = role;
    auth.displayName = 'Sam Peeters';
  }

  it('opens on first login and stays closed once dismissed', async () => {
    signIn('TeamMember');
    const w = mount(WelcomeTutorial);
    await flushPromises();
    expect(w.text()).toContain('Hallo Sam, eerste keer hier?');

    await w
      .findAll('button')
      .find((b) => b.text() === 'Nee, bedankt')!
      .trigger('click');
    expect(w.text()).toBe('');
    expect(localStorage.getItem('pm_tutorial_seen_u1')).toBe('1');

    w.unmount();
    const again = mount(WelcomeTutorial);
    await flushPromises();
    expect(again.text()).toBe('');
  });

  it('does not open for an account still waiting for a role', async () => {
    signIn(null);
    const w = mount(WelcomeTutorial);
    await flushPromises();
    expect(w.text()).toBe('');
  });

  it('steps through every chapter for the role and marks seen on Klaar', async () => {
    signIn('TeamManager');
    const w = mount(WelcomeTutorial);
    await flushPromises();
    const click = (label: string) =>
      w
        .findAll('button')
        .find((b) => b.text() === label)!
        .trigger('click');

    await click('Start rondleiding');
    const n = tourForUser('TeamManager').length;
    expect(w.text()).toContain(`1 / ${n}`);
    for (let i = 1; i < n; i++) await click('Volgende');
    expect(w.text()).toContain(`${n} / ${n}`);
    await click('Klaar');
    expect(localStorage.getItem('pm_tutorial_seen_u1')).toBe('1');
  });

  it('can be reopened from Instellingen after it was seen', async () => {
    localStorage.setItem('pm_tutorial_seen_u1', '1');
    signIn('Administrator');
    const w = mount(WelcomeTutorial);
    await flushPromises();
    expect(w.text()).toBe('');
    useTutorial().open();
    await flushPromises();
    expect(w.text()).toContain('eerste keer hier?');
  });
});

describe('tourForUser', () => {
  const ids = (role: Role | null, tl = false) => tourForUser(role, tl).map((s) => s.id);

  it('walks a Teamlid through their own planning, not the staff pages', () => {
    const got = ids('TeamMember');
    expect(got).toEqual(expect.arrayContaining(['add-shift', 'availability', 'submit-week']));
    for (const id of ['new-shift', 'add-lead', 'invite', 'draw-tools'])
      expect(got).not.toContain(id);
  });

  it('shows the drawing tools to a Teamlid only when they are Teamleider', () => {
    expect(ids('TeamMember', true)).toContain('draw-tools');
  });

  it('gives a Teammanager planning and recruitment but no admin stops', () => {
    const got = ids('TeamManager');
    expect(got).toEqual(expect.arrayContaining(['new-shift', 'add-lead', 'draw-tools']));
    for (const id of ['invite', 'audit', 'add-employee', 'planning-list-admin'])
      expect(got).not.toContain(id);
  });

  it('starts at the menu and ends at the help link for every role', () => {
    for (const role of ['Administrator', 'TeamManager', 'TeamMember'] as Role[]) {
      const got = ids(role);
      expect(got[0]).toBe('nav');
      expect(got.at(-1)).toBe('account');
    }
  });

  it('only sends a role to pages it is allowed on', () => {
    for (const role of ['Administrator', 'TeamManager', 'TeamMember'] as Role[])
      for (const s of tourForUser(role)) {
        const route = routes.find((r) => r.path === s.route);
        expect(route?.meta?.roles ?? [role], `${role} → ${s.route}`).toContain(role);
      }
  });

  it('points every stop at a data-tour anchor that exists in the source', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : e.name.endsWith('.vue')
            ? [join(dir, e.name)]
            : [],
      );
    const anchors = new Set(
      files(join(__dirname, '../../src')).flatMap((f) =>
        [...readFileSync(f, 'utf-8').matchAll(/data-tour="([^"]+)"/g)].flatMap((m) =>
          m[1].split(' '),
        ),
      ),
    );
    for (const s of tourStops.filter((s) => s.target)) expect(anchors, s.id).toContain(s.target);
  });
});

describe('WelcomeTutorial spotlight', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useTutorial().close();
    currentRoute.value = { path: '/settings' };
    push.mockClear();
  });

  it('opens the stop page and lights up the target element', async () => {
    const target = document.createElement('nav');
    target.setAttribute('data-tour', 'nav');
    target.getBoundingClientRect = () =>
      ({ top: 100, left: 20, width: 200, height: 300, bottom: 400, right: 220 }) as DOMRect;
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const auth = useAuthStore();
    auth.user = { uid: 'u2' } as User;
    auth.role = 'TeamMember';
    const w = mount(WelcomeTutorial);
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Start rondleiding')!
      .trigger('click');
    await flushPromises();
    await new Promise((r) => setTimeout(r, 0));
    await flushPromises();

    expect(push).toHaveBeenCalledWith('/dashboard');
    const hole = w.find('[data-testid="tour-hole"]');
    expect(hole.exists()).toBe(true);
    expect(hole.attributes('style')).toContain('top: 92px');
    expect(w.text()).toContain('Het menu');

    w.unmount();
    target.remove();
  });
});
