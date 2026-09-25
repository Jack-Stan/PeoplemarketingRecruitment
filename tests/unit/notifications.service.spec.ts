import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@emailjs/browser', () => ({
  default: { send: (...args: unknown[]) => sendMock(...args) },
}));

import { notificationsService } from '@/services/notifications.service';

const notice = {
  name: 'Jan Janssens',
  email: 'jan@example.com',
  officeName: 'Antwerpen',
  captchaToken: 'tok-123',
};

function configure(withCaptcha = true): void {
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'svc');
  vi.stubEnv('VITE_EMAILJS_PENDING_TEMPLATE_ID', 'tpl');
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'pub');
  vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', withCaptcha ? 'site' : '');
}

describe('notificationsService', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PENDING_TEMPLATE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '');
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is a no-op (and needs no captcha) when EmailJS is not configured', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'site');
    expect(notificationsService.needsCaptcha()).toBe(false);
    expect(await notificationsService.notifyPendingSignup(notice)).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('requires a captcha only when both EmailJS and a site key are set', () => {
    configure(false);
    expect(notificationsService.needsCaptcha()).toBe(false);
    configure(true);
    expect(notificationsService.needsCaptcha()).toBe(true);
  });

  // The template's "To" is fixed in the EmailJS dashboard — the recipient
  // must never be a param a caller controls.
  it('sends the template with the captcha token and no recipient param', async () => {
    configure();
    sendMock.mockResolvedValue({ status: 200 });
    expect(await notificationsService.notifyPendingSignup(notice)).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      'svc',
      'tpl',
      {
        name: 'Jan Janssens',
        email: 'jan@example.com',
        office: 'Antwerpen',
        'g-recaptcha-response': 'tok-123',
      },
      { publicKey: 'pub' },
    );
  });

  it('never rejects when EmailJS fails — signup must not look failed', async () => {
    configure();
    sendMock.mockRejectedValue({ status: 400, text: 'reCAPTCHA failed' });
    await expect(notificationsService.notifyPendingSignup(notice)).resolves.toBe(false);
  });
});
