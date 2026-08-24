const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

export function isValidRole(value: string): value is 'Administrator' | 'TeamManager' | 'TeamMember' {
  return value === 'Administrator' || value === 'TeamManager' || value === 'TeamMember';
}
