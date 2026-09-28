/**
 * Performance Benchmark & Architecture Comparison Script
 *
 * Compares:
 * 1. Mode A: Synchronous / Linear Programming (ENABLE_ASYNC_NOTIFICATIONS = false)
 *    API blocks the client while connecting to SMTP email server.
 * 2. Mode B: Asynchronous / Event-Driven Architecture (ENABLE_ASYNC_NOTIFICATIONS = true)
 *    API emits event to RabbitMQ message broker and responds immediately.
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function setFeatureFlag(enabled) {
  const response = await fetch(`${API_BASE_URL}/config/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flag: 'ENABLE_ASYNC_NOTIFICATIONS', enabled }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set feature flag: ${response.statusText}`);
  }
  return response.json();
}

async function registerUser(name, email) {
  const start = performance.now();
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  });
  const duration = Math.round(performance.now() - start);
  const data = await response.json();
  return { status: response.status, data, durationMs: duration };
}

async function runBenchmark() {
  console.log(`
================================================================================
EVENT-DRIVEN ARCHITECTURE BENCHMARK: Synchronous vs. RabbitMQ Broker
================================================================================
Target API: ${API_BASE_URL}
Testing Mindset Shift: Blocking I/O vs. Asynchronous Event Decoupling
`);

  // --- TEST 1: Synchronous Mode (Flag = false) ---
  console.log('----------------------------------------------------------------');
  console.log('PHASE 1: Testing Synchronous Mode (Legacy Blocking SMTP)');
  console.log('   Setting ENABLE_ASYNC_NOTIFICATIONS = false...');
  await setFeatureFlag(false);

  console.log('   Sending POST /users request for "John Doe" (john.sync@example.com)...');
  const syncResult = await registerUser('John Doe', `john.sync.${Date.now()}@example.com`);

  console.log(`    Synchronous HTTP Response Time: ${syncResult.durationMs}ms`);
  console.log(`    Mode in Response:               ${syncResult.data.mode}`);
  console.log(`    API Message:                    "${syncResult.data.message}"`);

  // --- TEST 2: Asynchronous Event-Driven Mode (Flag = true) ---
  console.log('\n----------------------------------------------------------------');
  console.log(' PHASE 2: Testing Asynchronous EDA Mode (RabbitMQ Message Broker)');
  console.log('   Setting ENABLE_ASYNC_NOTIFICATIONS = true...');
  await setFeatureFlag(true);

  console.log('   Sending POST /users request for "Jane Smith" (jane.async@example.com)...');
  const asyncResult = await registerUser('Jane Smith', `jane.async.${Date.now()}@example.com`);

  console.log(`    Asynchronous HTTP Response Time: ${asyncResult.durationMs}ms`);
  console.log(`    Mode in Response:               ${asyncResult.data.mode}`);
  console.log(`    Published Event ID:             ${asyncResult.data.event?.id}`);
  console.log(`    API Message:                    "${asyncResult.data.message}"`);

  // --- SUMMARY COMPARISON ---
  const latencyReduction = Math.round(((syncResult.durationMs - asyncResult.durationMs) / syncResult.durationMs) * 100);
  const speedupFactor = (syncResult.durationMs / Math.max(asyncResult.durationMs, 1)).toFixed(1);

  console.log(`
================================================================================
 PERFORMANCE BENCHMARK SUMMARY
================================================================================
Mode                      | HTTP Latency | User Experience
--------------------------+--------------+--------------------------------------
Synchronous (Legacy)      | ${String(syncResult.durationMs).padEnd(10)}ms | User blocked waiting for SMTP email
Event-Driven (RabbitMQ)   | ${String(asyncResult.durationMs).padEnd(10)}ms | Immediate confirmation (<50ms)
--------------------------+--------------+--------------------------------------
 Speedup Factor:         ${speedupFactor}x faster response
 Latency Reduction:      ${latencyReduction}% lower latency for client
================================================================================
`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err.message);
  process.exit(1);
});
