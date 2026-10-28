const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://movymmlayggqzjtunlfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdnltbWxheWdncXpqdHVubGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNjY1MDYsImV4cCI6MjEwODc0MjUwNn0.wnYGxn8vr3EvMMVe__qeTrurkLmCP2-5UsqKA9y9tLw';

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

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and code are required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const { data, error } = await supabase
      .from('signup_otps')
      .select('*')
      .eq('email', cleanEmail)
      .eq('code', cleanCode)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[Melo] Supabase query error:', error);
      return res.status(500).json({ success: false, message: 'Database error validating reset code' });
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    return res.status(200).json({ success: true, message: 'Code verified successfully' });
  } catch (err) {
    console.error('[Melo] Reset verification error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to verify code' });
  }
};
