import { config } from '../config/index.js';

/**
 * Simulates a slow SMTP email dispatch.
 * In a synchronous architecture, this blocks the HTTP response cycle.
 */
export async function sendWelcomeEmail(user) {
  const startTime = Date.now();
  console.log(`\n [EmailService] Initiating welcome email dispatch for: ${user.email} (ID: ${user.id})`);
  console.log(`[EmailService] Connecting to SMTP mail server (simulating network latency of ${config.emailDelayMs}ms)...`);

  await new Promise((resolve) => setTimeout(resolve, config.emailDelayMs));

  const duration = Date.now() - startTime;
  console.log(`[EmailService] Welcome email successfully delivered to ${user.email} [${duration}ms elapsed]`);

  return {
    recipient: user.email,
    subject: `Welcome to our platform, ${user.name}!`,
    sentAt: new Date().toISOString(),
    durationMs: duration,
  };
}
