// SRS §3, §13.6 — MSG91 primary, Fast2SMS fallback.
// MVP: real provider integration is deferred until DLT template approval is
// complete. In dev/test we log to console; in production we throw so a missing
// adapter doesn't silently swallow OTPs.

export interface SmsPayload {
  to: string;
  template: "otp";
  variables: Record<string, string>;
}

export interface SmsAdapter {
  send(payload: SmsPayload): Promise<{ provider: string; messageId?: string }>;
}

class ConsoleSmsAdapter implements SmsAdapter {
  async send(payload: SmsPayload) {
    const env = process.env.NODE_ENV ?? "development";
    if (env === "production") {
      console.warn("WARNING: ConsoleSmsAdapter is being used in production. Real SMS will not be sent.");
    }
    console.log(
      `[SMS:${payload.template}] -> ${payload.to} variables=${JSON.stringify(payload.variables)}`,
    );
    return { provider: "console" };
  }
}

let adapter: SmsAdapter = new ConsoleSmsAdapter();

export function setSmsAdapter(next: SmsAdapter): void {
  adapter = next;
}

export function getSmsAdapter(): SmsAdapter {
  return adapter;
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await adapter.send({
    to: phone,
    template: "otp",
    variables: { code, expiryMinutes: "5" },
  });
}
