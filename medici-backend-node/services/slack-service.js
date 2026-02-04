/**
 * Slack Notification Service
 * Sends notifications to Slack channels
 */

const axios = require('axios');
const logger = require('../config/logger');

class SlackService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.enabled = process.env.SLACK_ENABLED === 'true';
  }

  /**
   * Send a message to Slack
   * @param {string} message - The message text
   * @param {Object} options - Additional options
   */
  async sendMessage(message, options = {}) {
    if (!this.enabled) {
      logger.info('[Slack] Disabled - skipping message');
      return { success: true, skipped: true };
    }

    if (!this.webhookUrl) {
      logger.warn('[Slack] Webhook URL not configured');
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const payload = {
        text: message,
        username: options.username || 'Medici Bot',
        icon_emoji: options.icon || ':hotel:',
        channel: options.channel || undefined
      };

      await axios.post(this.webhookUrl, payload);
      logger.info('[Slack] Message sent successfully');
      return { success: true };
    } catch (error) {
      logger.error('[Slack] Error sending message:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a new reservation notification
   * @param {Object} reservation - Reservation details
   */
  async notifyNewReservation(reservation) {
    const message = `
🎉 *New Reservation!*
━━━━━━━━━━━━━━━━━━━━
*Hotel:* ${reservation.hotelName || 'N/A'}
*Guest:* ${reservation.guestName || 'N/A'}
*Check-in:* ${reservation.checkIn}
*Check-out:* ${reservation.checkOut}
*Price:* €${reservation.price || 0}
*Confirmation:* ${reservation.confirmationId || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendMessage(message, { icon: ':white_check_mark:' });
  }

  /**
   * Send a cancellation notification
   * @param {Object} cancellation - Cancellation details
   */
  async notifyCancellation(cancellation) {
    const message = `
❌ *Reservation Cancelled*
━━━━━━━━━━━━━━━━━━━━
*Hotel:* ${cancellation.hotelName || 'N/A'}
*Guest:* ${cancellation.guestName || 'N/A'}
*Confirmation:* ${cancellation.confirmationId || 'N/A'}
*Reason:* ${cancellation.reason || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendMessage(message, { icon: ':x:' });
  }

  /**
   * Send a booking error notification
   * @param {Object} error - Error details
   */
  async notifyBookingError(error) {
    const message = `
⚠️ *Booking Error*
━━━━━━━━━━━━━━━━━━━━
*Hotel:* ${error.hotelName || 'N/A'}
*Opportunity:* ${error.opportunityId || 'N/A'}
*Error:* ${error.message || 'Unknown error'}
*Time:* ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendMessage(message, { icon: ':warning:' });
  }

  /**
   * Send a successful purchase notification
   * @param {Object} purchase - Purchase details
   */
  async notifyPurchase(purchase) {
    const message = `
💰 *Room Purchased!*
━━━━━━━━━━━━━━━━━━━━
*Hotel:* ${purchase.hotelName || 'N/A'}
*Dates:* ${purchase.checkIn} - ${purchase.checkOut}
*Buy Price:* €${purchase.buyPrice || 0}
*Push Price:* €${purchase.pushPrice || 0}
*Profit:* €${(purchase.pushPrice - purchase.buyPrice).toFixed(2)}
*Booking ID:* ${purchase.bookingId || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return this.sendMessage(message, { icon: ':moneybag:' });
  }

  /**
   * Send purchase notification (for BuyRoom Worker)
   */
  static async sendPurchaseNotification(data) {
    const slackService = new SlackService();
    const message = `
💰 *Room Purchased Successfully!*
━━━━━━━━━━━━━━━━━━━━
*Reservation:* #${data.reservationId}
*Hotel:* ${data.hotelName}
*Guest:* ${data.guestName}
*Dates:* ${data.checkIn.toLocaleDateString()} - ${data.checkOut.toLocaleDateString()}
*Selling Price:* €${data.sellingPrice}
*Purchase Price:* €${data.purchasePrice}
*💵 Profit:* €${data.profit.toFixed(2)} (${((data.profit / data.sellingPrice) * 100).toFixed(1)}%)
*Supplier Booking:* ${data.supplierBookingId}
━━━━━━━━━━━━━━━━━━━━
    `.trim();
    return slackService.sendMessage(message, { icon: ':moneybag:' });
  }

  /**
   * Send cancellation notification
   */
  static async sendCancellationNotification(data) {
    const slackService = new SlackService();
    const message = `
⚠️ *${data.type === 'auto-cancel' ? 'Auto-Cancellation' : 'Cancellation'}*
━━━━━━━━━━━━━━━━━━━━
*Opportunity:* #${data.opportunityId}
*Hotel:* ${data.hotelName}
*Room:* ${data.roomName}
*Dates:* ${data.checkIn.toLocaleDateString()} - ${data.checkOut.toLocaleDateString()}
*Purchase Price:* €${data.purchasePrice}
*Refund:* €${data.refundAmount}
*Loss:* €${(data.purchasePrice - data.refundAmount).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
    `.trim();
    return slackService.sendMessage(message, { icon: ':warning:' });
  }

  /**
   * Send error notification
   */
  static async sendError(data) {
    const slackService = new SlackService();
    const message = `
🚨 *Error: ${data.type}*
━━━━━━━━━━━━━━━━━━━━
${data.hotel ? `*Hotel:* ${data.hotel}\n` : ''}${data.reservationId ? `*Reservation:* #${data.reservationId}\n` : ''}${data.opportunityId ? `*Opportunity:* #${data.opportunityId}\n` : ''}*Error:* ${data.error}
*Time:* ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━
    `.trim();
    return slackService.sendMessage(message, { icon: ':x:' });
  }

  /**
   * Send generic notification
   */
  static async sendNotification(message) {
    const slackService = new SlackService();
    return slackService.sendMessage(message);
  }

  /**
   * Send alert (static, used by alerts-agent and alert-manager)
   */
  static async sendAlert(messageOrObj, detail) {
    const slackService = new SlackService();
    let text;
    if (typeof messageOrObj === 'string') {
      text = detail ? `*${messageOrObj}*\n${detail}` : messageOrObj;
    } else {
      const severity = messageOrObj.severity || 'info';
      const emoji = severity === 'critical' ? ':rotating_light:' :
                    severity === 'warning' ? ':warning:' : ':information_source:';
      text = `${emoji} *${messageOrObj.title || 'Alert'}*\n${messageOrObj.message || ''}`;
      if (messageOrObj.category) {
        text += `\nCategory: ${messageOrObj.category}`;
      }
    }
    return slackService.sendMessage(text, { icon: ':rotating_light:' });
  }
}

// Export a singleton instance with static methods also available on it
const instance = new SlackService();
instance.sendPurchaseNotification = SlackService.sendPurchaseNotification;
instance.sendCancellationNotification = SlackService.sendCancellationNotification;
instance.sendError = SlackService.sendError;
instance.sendNotification = SlackService.sendNotification;
instance.sendAlert = SlackService.sendAlert;

module.exports = instance;
module.exports.SlackService = SlackService;
