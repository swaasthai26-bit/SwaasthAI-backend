import nodemailer from "nodemailer";

// Lazily created transporter — re-used across requests.
let _transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // In development with no SMTP config — use Ethereal (fake SMTP, captures emails online)
  if (!host || !user || !pass) {
    console.log("No SMTP config found — creating Ethereal test account...");
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`Ethereal test account: ${testAccount.user} / ${testAccount.pass}`);
    console.log(`Preview emails at: https://ethereal.email`);
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on port 587
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

function buildOtpHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <h2 style="color:#1a1a2e;margin-top:0;">SwaasthAI — Your OTP</h2>
      <p style="color:#555;font-size:15px;">Use the code below to verify your email address. It expires in <strong>5 minutes</strong>.</p>
      <div style="text-align:center;margin:32px 0;">
        <span style="display:inline-block;background:#f0f4ff;border:2px dashed #4a90e2;border-radius:8px;padding:16px 40px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">${code}</span>
      </div>
      <p style="color:#999;font-size:13px;">If you did not request this, please ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="color:#bbb;font-size:12px;text-align:center;">SwaasthAI &nbsp;·&nbsp; noreply@swaasthai.com</p>
    </div>
  </body>
</html>
  `.trim();
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? "noreply@swaasthai.com";
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: `SwaasthAI <${from}>`,
    to: email,
    subject: `${code} is your SwaasthAI verification code`,
    text: `Your SwaasthAI OTP is: ${code}\n\nIt expires in 5 minutes.\n\nIf you did not request this, ignore this email.`,
    html: buildOtpHtml(code),
  });

  // In dev — print the Ethereal preview URL so you can see the email
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`\n📧 OTP Email Preview: ${previewUrl}\n`);
  }
}

/** Verify SMTP connectivity — call once at server startup. */
export async function verifySmtpConnection(): Promise<void> {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    console.log("SMTP connection verified successfully");
  } catch (err) {
    console.error("SMTP connection failed:", err);
  }
}
