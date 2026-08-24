// Vitest setup: provide stubs so modules that import the Firebase SDK don't
// try to talk to real services in unit tests. Individual tests that need
// Firebase behaviour should mock the service layer (see auth.service.ts).
import { vi } from 'vitest';

vi.mock('@/services/auth.service', () => ({
  authService: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
    getClaims: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/firebase', () => ({
  auth: {},
  db: {},
  app: {},
}));