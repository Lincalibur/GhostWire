import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Deliver a One-Time Password over the configured out-of-band channel.
 *
 * In `console` mode (development default) the code is printed to the server
 * log. `email`/`sms` are stubbed integration points — wire in Mailgun/Twilio
 * here. The raw OTP is intentionally never returned to the HTTP client.
 *
 * @param {{ handle: string, email: string }} operator
 * @param {string} otpCode The plaintext OTP to deliver
 * @returns {Promise<{ channel: string, delivered: boolean }>}
 */
export async function dispatchOtp(operator, otpCode) {
  const channel = config.otp.channel;

  switch (channel) {
    case 'console':
      logger.warn('OTP dispatch (console channel — DEV ONLY)', {
        handle: operator.handle,
        otp: otpCode,
        ttlSeconds: config.otp.ttlSeconds,
      });
      return { channel, delivered: true };

    case 'email':
      // TODO: integrate Mailgun using config.gateways.mailgunApiKey / mailgunDomain.
      logger.info('OTP email dispatch requested (integration pending).', { handle: operator.handle });
      return { channel, delivered: Boolean(config.gateways.mailgunApiKey) };

    case 'sms':
      // TODO: integrate an SMS gateway using config.gateways.smsApiKey.
      logger.info('OTP SMS dispatch requested (integration pending).', { handle: operator.handle });
      return { channel, delivered: Boolean(config.gateways.smsApiKey) };

    default:
      logger.error('Unknown OTP channel configured', { channel });
      return { channel, delivered: false };
  }
}
