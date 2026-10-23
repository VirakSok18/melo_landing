const nodemailer = require('nodemailer');

const SHARED_SECRET = process.env.MELO_RELAY_SECRET || '';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

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
    const authHeader = req.headers['x-melo-secret'];
    const { secret, to, subject, html, text } = req.body || {};

    if (authHeader !== SHARED_SECRET && secret !== SHARED_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized relay access' });
    }

    if (!to || !html) {
      return res.status(400).json({ success: false, error: 'Missing required fields: to, html' });
    }

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
  } catch (error) {
    console.error('[Relay] Error sending email:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send email' });
  }
};
