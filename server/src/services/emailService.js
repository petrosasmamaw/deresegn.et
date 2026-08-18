/**
 * Transactional email via Brevo (https://www.brevo.com) HTTP API.
 *
 * Uses the REST endpoint directly (no SDK) so the only requirement is a
 * BREVO_API_KEY. In development, if the key is missing we log the email to the
 * console instead of failing, so the reset-password flow is still testable.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function getSender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL || 'no-reply@tamagncheck.online',
    name: process.env.BREVO_SENDER_NAME || 'Tamagn Check',
  }
}

/**
 * Send a transactional email through Brevo.
 * @param {{ to: string, toName?: string, subject: string, html: string, text?: string }} params
 * @returns {Promise<{ ok: boolean, skipped?: boolean, messageId?: string, error?: string }>}
 */
export async function sendEmail({ to, toName, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY?.trim()

  if (!apiKey) {
    console.warn(
      '[email] BREVO_API_KEY not set — email not sent. Set it in server/.env.\n' +
        `        To: ${to}\n        Subject: ${subject}`,
    )
    return { ok: false, skipped: true, error: 'BREVO_API_KEY not configured' }
  }

  const sender = getSender()
  const payload = {
    sender,
    to: [{ email: to, ...(toName ? { name: toName } : {}) }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const message = body?.message || `Brevo responded ${res.status}`
      console.error('[email] Brevo send failed:', message)
      return { ok: false, error: message }
    }

    console.log(`[email] Sent "${subject}" to ${to} (messageId: ${body?.messageId || 'n/a'})`)
    return { ok: true, messageId: body?.messageId }
  } catch (err) {
    console.error('[email] Brevo request error:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Branded password-reset email. `resetUrl` is the link the user clicks to
 * choose a new password.
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const displayName = name?.trim() || 'there'
  const subject = 'Reset your Tamagn Check password'

  const html = `
  <div style="margin:0;padding:0;background:#f4f1ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e0d5;border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:#0f4d3a;padding:28px 32px;text-align:center;">
                <div style="color:#f4f1ea;font-size:20px;font-weight:700;letter-spacing:.3px;">Tamagn Check</div>
                <div style="color:#c6a24e;font-size:13px;margin-top:4px;">ታማኝ ቸክ</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
                  Hi ${displayName}, we received a request to reset the password for your Tamagn Check account.
                  Click the button below to choose a new password. This link expires in 1 hour.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:#0f4d3a;">
                      <a href="${resetUrl}" target="_blank"
                        style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#777;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;color:#0f4d3a;">
                  <a href="${resetUrl}" target="_blank" style="color:#0f4d3a;">${resetUrl}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#999;">
                  If you didn't request this, you can safely ignore this email — your password will stay the same.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#faf8f2;border-top:1px solid #eee;text-align:center;">
                <div style="font-size:12px;color:#999;">© ${new Date().getFullYear()} Tamagn Check · Ethiopian receipt verification</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`

  const textLines = [
    `Hi ${displayName},`,
    '',
    'We received a request to reset your Tamagn Check password.',
    'Open the link below to choose a new password (expires in 1 hour):',
    '',
    resetUrl,
    '',
    "If you didn't request this, you can ignore this email.",
    '',
    '— Tamagn Check',
  ]

  return sendEmail({ to, toName: name, subject, html, text: textLines.join('\n') })
}
