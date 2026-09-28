/**
 * Interactive End-to-End Demo Script
 * Demonstrates:
 * 1. Health check & Feature Flags inspection
 * 2. Synchronous registration (simulate slow SMTP response)
 * 3. Feature flag toggle to true
 * 4. Asynchronous registration via RabbitMQ (lightning fast response)
 * 5. Verification of all users
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function step(title, fn) {
  console.log(`\n  ${title}`);
  await fn();
}

async function runDemo() {
  console.log(`
=========================================================
 Event-Driven Notification Broker Interactive Demo
 Target API: ${BASE_URL}
=========================================================
  `);

  await step('1. Checking API Health & Initial Feature Flags', async () => {
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    const flags = await fetch(`${BASE_URL}/config/flags`).then((r) => r.json());
    console.log('Health:', health);
    console.log('Flags:', flags.flags);
  });

  await step('2. Triggering Synchronous User Registration (ENABLE_ASYNC_NOTIFICATIONS = false)', async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Linear Larry', email: `larry.${Date.now()}@example.com` }),
    });
    const duration = Date.now() - start;
    const body = await res.json();
    console.log(`Status: ${res.status} | Duration: ${duration}ms`);
    console.log('Response body:', JSON.stringify(body, null, 2));
  });

  await step('3. Flipping Feature Flag ENABLE_ASYNC_NOTIFICATIONS to true', async () => {
    const res = await fetch(`${BASE_URL}/config/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag: 'ENABLE_ASYNC_NOTIFICATIONS', enabled: true }),
    });
    const body = await res.json();
    console.log('Updated flags:', body);
  });

  await step('4. Triggering Asynchronous User Registration (ENABLE_ASYNC_NOTIFICATIONS = true)', async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Async Annie', email: `annie.${Date.now()}@example.com` }),
    });
    const duration = Date.now() - start;
    const body = await res.json();
    console.log(`Status: ${res.status} | Duration: ${duration}ms`);
    console.log('Response body:', JSON.stringify(body, null, 2));
  });

  await step('5. Listing all registered users in store', async () => {
    const res = await fetch(`${BASE_URL}/users`);
    const body = await res.json();
    console.log('Users stored:', body);
  });

  console.log(`
=========================================================
Demo completed successfully!
Check the Worker terminal window to see the asynchronous
email delivery handled in the background without blocking!
=========================================================
  `);
}

runDemo().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
