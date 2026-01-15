/**
 * Email Notification Service using SendGrid
 */

const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'zvi.g@medicihotels.com';
    this.recipients = (process.env.SENDGRID_RECIPIENTS || '').split(',').filter(Boolean);
    
    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email(s)
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text body
   * @param {string} options.html - HTML body
   */
  async sendEmail(options) {
    if (!this.apiKey) {
      console.warn('[Email] SendGrid API key not configured');
      return { success: false, error: 'API key not configured' };
    }

    try {
      const msg = {
        to: options.to || this.recipients,
        from: this.fromEmail,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      await sgMail.send(msg);
      console.log('[Email] Sent successfully to:', msg.to);
      return { success: true };
    } catch (error) {
      console.error('[Email] Error sending:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new reservation notification
   */
  async notifyNewReservation(reservation) {
    const subject = `🎉 New Reservation - ${reservation.hotelName || 'Hotel'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">New Reservation Received!</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Hotel:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reservation.hotelName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Guest:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reservation.guestName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Check-in:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reservation.checkIn}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Check-out:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${reservation.checkOut}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Price:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">€${reservation.price || 0}</td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Confirmation:</strong></td>
            <td style="padding: 10px;">${reservation.confirmationId || 'N/A'}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Sent by Medici Hotels System
        </p>
      </div>
    `;

    return this.sendEmail({ subject, html, text: `New Reservation: ${reservation.hotelName}` });
  }

  /**
   * Send cancellation notification
   */
  async notifyCancellation(cancellation) {
    const subject = `❌ Cancellation - ${cancellation.hotelName || 'Hotel'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Reservation Cancelled</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Hotel:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${cancellation.hotelName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Guest:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${cancellation.guestName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Confirmation:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${cancellation.confirmationId || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Reason:</strong></td>
            <td style="padding: 10px;">${cancellation.reason || 'N/A'}</td>
          </tr>
        </table>
      </div>
    `;

    return this.sendEmail({ subject, html, text: `Cancellation: ${cancellation.hotelName}` });
  }

  /**
   * Send error notification
   */
  async notifyError(error) {
    const subject = `⚠️ System Error - Medici Hotels`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">System Error</h2>
        <p><strong>Error:</strong> ${error.message || 'Unknown error'}</p>
        <p><strong>Component:</strong> ${error.component || 'N/A'}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">${error.stack || ''}</pre>
      </div>
    `;

    return this.sendEmail({ subject, html, text: `Error: ${error.message}` });
  }
}

module.exports = new EmailService();
