// Thin wrapper around Resend's REST API. Deliberately dependency-free: Node
// 18+ (which this project already requires) has a built-in `fetch`, so no
// new npm package is needed just to send an email.
//
// Requires the RESEND_API_KEY environment variable to be set. On Resend's
// free tier, sending from a custom domain requires domain verification —
// out of scope for this project — so we send from Resend's ready-to-use
// address instead. Recipients will see this as the "from" address.
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'ChatSpace <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Fail loudly in logs, but don't crash the request — an admin should
    // notice this in the logs and fix the environment variable, but a
    // missing mail config shouldn't 500 the whole endpoint.
    console.error('RESEND_API_KEY is not set — email was not sent.');
    return { sent: false };
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html })
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Resend API error:', res.status, body);
    return { sent: false };
  }

  return { sent: true };
}

function sendOtpEmail(to, otp) {
  return sendEmail({
    to,
    subject: 'Your ChatSpace verification code',
    html: `
      <p>Your ChatSpace email verification code is:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    `
  });
}

function sendUsernameEmail(to, username) {
  return sendEmail({
    to,
    subject: 'Your ChatSpace username',
    html: `
      <p>You (or someone with access to this email) requested a username reminder for ChatSpace.</p>
      <p>Your username is: <strong>${username}</strong></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
  });
}

function sendPasswordResetEmail(to, resetUrl) {
  return sendEmail({
    to,
    subject: 'Reset your ChatSpace password',
    html: `
      <p>You (or someone with access to this email) requested a password reset for ChatSpace.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    `
  });
}

module.exports = { sendOtpEmail, sendUsernameEmail, sendPasswordResetEmail };
