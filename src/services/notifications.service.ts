import emailjs from '@emailjs/browser';

/**
 * "New account waiting for approval" mail to the admins. Spark plan = no
 * Cloud Functions, so this goes straight from the browser via EmailJS.
 *
 * Abuse limits live in the EmailJS dashboard, not here — the public key is
 * public by design:
 *   - the template's "To" is hard-coded to the admin address(es); it is never
 *     a template variable, so a caller can't point this at arbitrary inboxes
 *   - the template has reCAPTCHA v2 verification on, so every send needs a
 *     fresh `g-recaptcha-response` token (see RecaptchaCheckbox.vue)
 *   - the domain allowlist restricts browser origins
 *
 * Best-effort: the account + pending profile already exist by the time this
 * runs, and the admin still sees them on the Users page / nav badge, so a
 * failed mail must never surface as a failed signup. Never rejects.
 */
export interface PendingSignupNotice {
  name: string;
  email: string;
  officeName: string;
  captchaToken: string;
}

function config(): { serviceId: string; templateId: string; publicKey: string } | null {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_PENDING_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey };
}

export const notificationsService = {
  isConfigured(): boolean {
    return config() !== null;
  },

  /** Signup forms require a captcha tick only when a mail would actually go out. */
  needsCaptcha(): boolean {
    return config() !== null && !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  },

  async notifyPendingSignup(notice: PendingSignupNotice): Promise<boolean> {
    const cfg = config();
    if (!cfg) {
      console.warn('[notifications] EmailJS not configured — skipping admin mail');
      return false;
    }
    try {
      await emailjs.send(
        cfg.serviceId,
        cfg.templateId,
        {
          name: notice.name,
          email: notice.email,
          office: notice.officeName,
          'g-recaptcha-response': notice.captchaToken,
        },
        { publicKey: cfg.publicKey },
      );
      return true;
    } catch (err) {
      console.warn('[notifications] admin mail failed', err);
      return false;
    }
  },
};
