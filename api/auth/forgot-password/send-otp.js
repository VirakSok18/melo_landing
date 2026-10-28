const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://movymmlayggqzjtunlfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdnltbWxheWdncXpqdHVubGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY1MDYsImV4cCI6MjEwODc0MjUwNn0.wnYGxn8vr3EvMMVe__qeTrurkLmCP2-5UsqKA9y9tLw';

const EMAIL_USER = process.env.EMAIL_USER || 'melonoreply@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'wwxgmfabpwqmpcky';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-melo-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 1. Invalidate previous unused OTPs
    try {
      await supabase
        .from('signup_otps')
        .update({ is_used: true })
        .eq('email', cleanEmail)
        .eq('is_used', false);
    } catch (_) {}

    // 2. Insert new OTP record
    const { error: dbError } = await supabase.from('signup_otps').insert({
      email: cleanEmail,
      code,
      expires_at: expiresAt,
      is_used: false,
    });

    if (dbError) {
      console.error('[Melo] Supabase DB error storing reset OTP:', dbError);
    }

    // 3. Send email using melonoreply@gmail.com
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 40px 20px; text-align: center;">
        <h1 style="color: #514AED; margin-bottom: 4px; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Melo</h1>
        <p style="color: #a0a0a0; font-size: 14px; margin-top: 0;">Password Reset Request</p>
        <div style="background-color: #1a1a1a; border-radius: 16px; padding: 32px 24px; margin: 28px auto; max-width: 440px; border: 1px solid #2a2a2a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <p style="font-size: 15px; color: #e0e0e0; margin-bottom: 24px; line-height: 1.5;">We received a request to reset your Melo account password. Use this code to continue:</p>
          <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #514AED; padding: 18px 24px; background: rgba(81, 74, 237, 0.12); border: 1px solid rgba(81, 74, 237, 0.3); border-radius: 12px; display: inline-block;">
            ${code}
          </div>
          <p style="color: #777777; font-size: 13px; margin-top: 24px; line-height: 1.5;">This code will expire in 10 minutes.<br/>If you didn't request a password reset, please ignore this email.</p>
        </div>
        <p style="color: #555555; font-size: 12px; margin-top: 24px;">© 2026 Melo Music. All rights reserved.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `Melo <${EMAIL_USER}>`,
      to: cleanEmail,
      subject: `Your Melo Password Reset Code: ${code}`,
      html: htmlContent,
      text: `Your Melo password reset code is: ${code}. It expires in 10 minutes.`,
    });

    console.log(`[Melo] Reset OTP ${code} sent to ${cleanEmail}`);
    return res.status(200).json({ success: true, message: 'Password reset code sent to your email' });
  } catch (err) {
    console.error('[Melo] Error sending reset OTP:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to send reset code' });
  }
};
