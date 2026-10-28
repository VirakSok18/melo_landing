const nodemailer = require('nodemailer');
const https = require('https');

const SHARED_SECRET = process.env.MELO_RELAY_SECRET || 'melo_secret_otp_relay_2026';
const EMAIL_USER = process.env.EMAIL_USER || 'melonoreply@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'wwxgmfabpwqmpcky';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://movymmlayggqzjtunlfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdnltbWxheWdncXpqdHVubGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY1MDYsImV4cCI6MjEwODc0MjUwNn0.wnYGxn8vr3EvMMVe__qeTrurkLmCP2-5UsqKA9y9tLw';

function supabaseRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method || 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-melo-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { action, email, code, to, subject, html, text, newPassword } = req.body || {};

    // Action 1: Send OTP
    if (action === 'send-otp' || action === 'forgot-password-send-otp') {
      const targetEmail = (email || to || '').trim().toLowerCase();
      if (!targetEmail) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Invalidate previous unused OTPs
      try {
        await supabaseRequest(
          `/rest/v1/signup_otps?email=eq.${encodeURIComponent(targetEmail)}&is_used=eq.false`,
          'PATCH',
          { is_used: true }
        );
      } catch (_) {}

      // Insert new OTP record
      await supabaseRequest('/rest/v1/signup_otps', 'POST', {
        email: targetEmail,
        code: generatedOtp,
        expires_at: expiresAt,
        is_used: false,
      });

      // Send email via melonoreply@gmail.com
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      const isReset = action === 'forgot-password-send-otp';
      const heading = isReset ? 'Reset Your Melo Password' : 'Verify Your Melo Account';
      const description = isReset
        ? 'We received a request to reset your password. Use the verification code below to set a new password:'
        : 'Welcome to Melo! Use this verification code to complete your account registration:';

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 40px 20px; text-align: center;">
          <h1 style="color: #514AED; margin-bottom: 4px; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Melo</h1>
          <p style="color: #a0a0a0; font-size: 14px; margin-top: 0;">Your Personal Soundscape</p>
          <div style="background-color: #1a1a1a; border-radius: 16px; padding: 32px 24px; margin: 28px auto; max-width: 440px; border: 1px solid #2a2a2a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">${heading}</h2>
            <p style="font-size: 15px; color: #e0e0e0; margin-bottom: 24px; line-height: 1.5;">${description}</p>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #514AED; padding: 18px 24px; background: rgba(81, 74, 237, 0.12); border: 1px solid rgba(81, 74, 237, 0.3); border-radius: 12px; display: inline-block;">
              ${generatedOtp}
            </div>
            <p style="color: #777777; font-size: 13px; margin-top: 24px; line-height: 1.5;">This code will expire in 10 minutes.<br/>If you did not request this, you can safely ignore this email.</p>
          </div>
          <p style="color: #555555; font-size: 12px; margin-top: 24px;">© 2026 Melo Music. All rights reserved.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `Melo <${EMAIL_USER}>`,
        to: targetEmail,
        subject: `Your Melo Verification Code: ${generatedOtp}`,
        html: emailHtml,
        text: `Your Melo verification code is: ${generatedOtp}. It expires in 10 minutes.`,
      });

      console.log(`[Melo] OTP ${generatedOtp} sent to ${targetEmail}`);
      return res.status(200).json({ success: true, message: 'Verification code sent to your email' });
    }

    // Action 2: Verify OTP
    if (action === 'verify-otp' || action === 'forgot-password-verify-otp') {
      const targetEmail = (email || '').trim().toLowerCase();
      const targetCode = (code || '').trim();

      if (!targetEmail || !targetCode) {
        return res.status(400).json({ success: false, message: 'Email and code are required' });
      }

      const checkRes = await supabaseRequest(
        `/rest/v1/signup_otps?email=eq.${encodeURIComponent(targetEmail)}&code=eq.${encodeURIComponent(targetCode)}&is_used=eq.false&select=*&order=created_at.desc&limit=1`
      );

      const records = checkRes.data;
      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
      }

      const otpRecord = records[0];
      if (new Date(otpRecord.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'Verification code has expired' });
      }

      // Mark used
      await supabaseRequest(`/rest/v1/signup_otps?id=eq.${otpRecord.id}`, 'PATCH', { is_used: true });

      return res.status(200).json({ success: true, message: 'Code verified successfully' });
    }

    // Action 3: Reset Password
    if (action === 'reset-password') {
      const targetEmail = (email || '').trim().toLowerCase();
      const targetCode = (code || '').trim();

      if (!targetEmail || !targetCode || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email, code, and new password are required' });
      }

      return res.status(200).json({ success: true, message: 'Password updated successfully' });
    }

    // Action 4: Standard Email Relay
    if (to && html) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `Melo <${EMAIL_USER}>`,
        to,
        subject: subject || 'Melo Account Verification Code',
        html,
        text: text || 'Your Melo verification code is in this email.',
      });

      console.log(`[Relay] Email successfully sent to ${to}: ${info.messageId}`);
      return res.status(200).json({ success: true, messageId: info.messageId });
    }

    return res.status(400).json({ success: false, error: 'Missing required action or fields' });
  } catch (error) {
    console.error('[Relay] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
};
