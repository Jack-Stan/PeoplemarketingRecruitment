// Vitest setup: provide stubs so modules that import the Firebase SDK don't
// try to talk to real services in unit tests. Individual tests that need
// Firebase behaviour should mock the service layer (see auth.service.ts).
import { vi } from 'vitest';

vi.mock('@/services/auth.service', () => ({
  authService: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    sendInvite: vi.fn(),
    isInviteLink: vi.fn(() => true),
    completeInvite: vi.fn(),
    setPassword: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/services/users.service', () => ({
  usersService: {
    createProfile: vi.fn(),
    getOnce: vi.fn().mockResolvedValue(null),
    subscribeOwn: vi.fn(() => () => {}),
    subscribeAll: vi.fn(() => () => {}),
    assignRole: vi.fn(),
  },
}));

vi.mock('@/services/firebase', () => ({
  auth: {},
  db: {},
  app: {},
}));
