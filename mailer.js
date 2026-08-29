const nodemailer = require('nodemailer');

// Determine if SMTP credentials are configured in .env
const isConfigured = Boolean(
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS &&
  process.env.EMAIL_USER.trim() !== '' &&
  process.env.EMAIL_PASS.trim() !== ''
);

let transporter = null;

if (isConfigured) {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Default to Gmail Service
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
}

/**
 * Verify SMTP connection on server startup
 */
async function verifyMailerConnection() {
  if (!isConfigured) {
    console.log('[Mailer] ℹ️  Real email dispatch is currently in SIMULATION mode.');
    console.log('[Mailer] 👉 To enable live email dispatch, add your EMAIL_USER and Gmail App Password (EMAIL_PASS) to .env');
    return false;
  }

  try {
    await transporter.verify();
    console.log(`[Mailer] ✅ SMTP connection verified successfully! Sending real emails via ${process.env.EMAIL_USER}`);
    return true;
  } catch (err) {
    console.error(`[Mailer] ⚠️  SMTP verification failed: ${err.message}`);
    console.error(`[Mailer] 👉 For Gmail, ensure you are using a 16-character App Password (not your normal Google password).`);
    return false;
  }
}

/**
 * Send 6-Digit OTP Email for Authentication
 */
async function sendOtpEmail(toEmail, otp) {
  const cleanEmail = toEmail.toLowerCase().trim();

  // If credentials are not yet configured in .env, simulate and return
  if (!isConfigured || !transporter) {
    console.log(`[Mailer] 📧 [Simulated Email] OTP code ${otp} for ${cleanEmail} (Add EMAIL_USER & EMAIL_PASS in .env for real emails)`);
    return {
      success: true,
      mode: 'simulated',
      message: 'Email credentials not configured in .env; OTP logged to console.'
    };
  }

  const fromAddress = process.env.EMAIL_FROM || `"Ann Food Redistribution" <${process.env.EMAIL_USER}>`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code - Ann</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%; background-color: #f3f4f6; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Ann</h1>
              <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 14px; font-weight: 500;">Surplus Food Redistribution Platform</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px; color: #374151;">
              <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 20px; font-weight: 700;">Your Sign-In Verification Code</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                Use the 6-digit one-time password below to authenticate your account. This code is valid for <strong>5 minutes</strong>.
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 12px; padding: 18px 24px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #065f46; letter-spacing: 8px; display: inline-block;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Safety Warning -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>Security Reminder:</strong> Never share this code with anyone. Our team will never ask for your verification code.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                Together connecting surplus food with hunger alleviation.<br>
                &copy; ${new Date().getFullYear()} Ann Food Redistribution Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: `Your Ann Verification Code: ${otp}`,
      text: `Your Ann verification code is: ${otp}. It expires in 5 minutes. Please do not share this code.`,
      html: htmlContent
    });

    console.log(`[Mailer] 🚀 Live OTP email sent to ${cleanEmail} (Message ID: ${info.messageId})`);
    return {
      success: true,
      mode: 'smtp',
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[Mailer] ❌ Error sending OTP email to ${cleanEmail}:`, err.message);
    return {
      success: false,
      mode: 'failed',
      error: err.message
    };
  }
}

/**
 * Send Notification when a Food Listing is Claimed
 */
async function sendListingClaimedEmail(donorEmail, listingTitle, claimerName) {
  if (!isConfigured || !transporter || !donorEmail) return null;

  try {
    const fromAddress = process.env.EMAIL_FROM || `"Ann Food Redistribution" <${process.env.EMAIL_USER}>`;
    return await transporter.sendMail({
      from: fromAddress,
      to: donorEmail,
      subject: `Good News! Your Food Donation was Claimed — ${listingTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
          <h2 style="color: #10b981; margin-top: 0;">Food Donation Claimed!</h2>
          <p>Hello,</p>
          <p>Your surplus food listing <strong>"${listingTitle}"</strong> has just been claimed by <strong>${claimerName || 'a verified NGO partner'}</strong>.</p>
          <p>The partner NGO/volunteer will arrive during the pickup window to rescue this food.</p>
          <p>Thank you for preventing food waste and feeding those in need!</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #888;">Ann — Surplus Food Redistribution Platform</small>
        </div>
      `
    });
  } catch (err) {
    console.error(`[Mailer] Failed to send claim notification email: ${err.message}`);
    return null;
  }
}

module.exports = {
  isConfigured,
  verifyMailerConnection,
  sendOtpEmail,
  sendListingClaimedEmail
};
