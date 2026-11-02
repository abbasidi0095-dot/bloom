import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

const from = process.env.MAIL_FROM || "Bloom <hello@bloom.local>";
const appUrl = process.env.APP_URL || "http://localhost:3001";

export function mailerConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2a2522">
  <div style="max-width:560px;margin:32px auto;background:#fffdf9;border-radius:24px;padding:36px;border:1px solid #eee5d8">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a3826a">Bloom</div>
    <h1 style="font-size:24px;margin:14px 0 18px;font-weight:600">${title}</h1>
    <div style="font-size:15px;line-height:1.65;color:#5c534c">${body}</div>
    <p style="margin-top:28px;font-size:12px;color:#9a8f86">Sent by Bloom · ${appUrl}</p>
  </div></body></html>`;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ delivered: boolean }> {
  if (!mailerConfigured()) {
    const dir = path.join(process.cwd(), "outbox");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${input.to.replace(/[^a-z0-9]/gi, "_")}.html`);
    await writeFile(file, input.html || `<pre>${input.text}</pre>`, "utf8");
    console.info(`[bloom mail:dev] ${input.subject} -> ${input.to}\n${input.text}\n(file: ${file})`);
    return { delivered: false };
  }
  await transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return { delivered: true };
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: "Verify your Bloom email",
    text: `Welcome to Bloom. Confirm your email: ${link}\n\nThe link expires in 24 hours.`,
    html: shell(
      "Confirm your email",
      `<p>Welcome to Bloom, a calmer way to care for your little one together.</p>
       <p><a href="${link}" style="display:inline-block;background:#c97b5a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Verify email</a></p>
       <p style="font-size:13px;color:#8b8078">This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
    ),
  });
}

export async function sendResetEmail(to: string, token: string) {
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: "Reset your Bloom password",
    text: `Reset your password: ${link}\n\nThe link expires in 1 hour.`,
    html: shell(
      "Reset your password",
      `<p>We received a request to reset the password for your Bloom account.</p>
       <p><a href="${link}" style="display:inline-block;background:#c97b5a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Choose a new password</a></p>
       <p style="font-size:13px;color:#8b8078">This link expires in 1 hour. If this wasn't you, you can safely ignore it.</p>`,
    ),
  });
}

export async function sendInvitationEmail(input: {
  to: string;
  familyName: string;
  inviterName: string;
  token: string;
  code: string;
  role: string;
}) {
  const link = `${appUrl}/invite/${encodeURIComponent(input.token)}`;
  return sendMail({
    to: input.to,
    subject: `${input.inviterName} invited you to ${input.familyName} on Bloom`,
    text: `${input.inviterName} invited you to join ${input.familyName} on Bloom as ${input.role}.\n\nJoin: ${link}\nInvitation code: ${input.code}\n\nThe invitation expires in 7 days.`,
    html: shell(
      `Join ${input.familyName}`,
      `<p><strong>${input.inviterName}</strong> invited you to share baby tracking with <strong>${input.familyName}</strong> as <strong>${input.role}</strong>.</p>
       <p><a href="${link}" style="display:inline-block;background:#c97b5a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Accept invitation</a></p>
       <p>Or use this code: <strong style="letter-spacing:.12em">${input.code}</strong></p>
       <p style="font-size:13px;color:#8b8078">Expires in 7 days.</p>`,
    ),
  });
}
