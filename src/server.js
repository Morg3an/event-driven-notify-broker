import express from 'express';
import { config, features } from './config/index.js';
import { userService } from './services/userService.js';
import { sendWelcomeEmail } from './services/emailService.js';
import { publishUserSignedUpEvent } from './broker/rabbitmq.js';

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: config.appName,
    features: {
      ENABLE_ASYNC_NOTIFICATIONS: features.ENABLE_ASYNC_NOTIFICATIONS,
    },
  });
});

// Feature Flag Management Endpoints
app.get('/config/flags', (req, res) => {
  res.json({
    flags: features,
    description: {
      ENABLE_ASYNC_NOTIFICATIONS:
        'When false: synchronous SMTP email blocks HTTP response. When true: event published to RabbitMQ broker asynchronously.',
    },
  });
});

app.post('/config/flags', (req, res) => {
  const { flag, enabled } = req.body;
  if (!flag || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Payload must contain "flag" (string) and "enabled" (boolean)' });
  }

  if (!(flag in features)) {
    return res.status(404).json({ error: `Flag "${flag}" not found in feature toggle registry` });
  }

  features[flag] = enabled;
  console.log(`[FeatureFlags] Toggled flag "${flag}" -> ${enabled}`);

  return res.json({
    success: true,
    message: `Feature flag "${flag}" updated to ${enabled}`,
    currentFlags: features,
  });
});

// GET /users
app.get('/users', (req, res) => {
  const allUsers = userService.getAllUsers();
  res.json({
    count: allUsers.length,
    users: allUsers,
  });
});

// POST /users - Implements Feature Toggle for EDA Migration
app.post('/users', async (req, res) => {
  const requestStartTime = Date.now();
  const { name, email } = req.body;

  try {
    // 1. Create the user record in database/store
    const user = userService.createUser({ name, email });
    console.log(`[UserAPI] Created user record: ${user.name} (${user.email})`);

    // 2. Branch logic based on Feature Flag
    if (features.ENABLE_ASYNC_NOTIFICATIONS) {
      // --- ASYNCHRONOUS EDA PATH (RabbitMQ Broker) ---
      console.log(`[UserAPI] Flag ENABLE_ASYNC_NOTIFICATIONS is TRUE -> Publishing event to RabbitMQ`);

      const eventEnvelope = await publishUserSignedUpEvent(user);
      const totalDuration = Date.now() - requestStartTime;

      // Immediately respond 201 Created without blocking for email
      return res.status(201).json({
        success: true,
        mode: 'asynchronous',
        message: 'User registered successfully! Welcome email notification queued via RabbitMQ.',
        user,
        event: {
          id: eventEnvelope.eventId,
          type: eventEnvelope.eventType,
          routingKey: eventEnvelope.metadata.routingKey,
        },
        latency: {
          totalResponseTimeMs: totalDuration,
          nonBlocking: true,
        },
      });
    } else {
      // --- SYNCHRONOUS LEGACY PATH (Blocking SMTP) ---
      console.log(`[UserAPI] Flag ENABLE_ASYNC_NOTIFICATIONS is FALSE -> Executing legacy synchronous email`);

      const emailResult = await sendWelcomeEmail(user);
      const totalDuration = Date.now() - requestStartTime;

      return res.status(201).json({
        success: true,
        mode: 'synchronous',
        message: 'User registered and welcome email sent synchronously (blocking).',
        user,
        emailResult,
        latency: {
          totalResponseTimeMs: totalDuration,
          blockingTimeMs: emailResult.durationMs,
        },
      });
    }
  } catch (error) {
    console.error(`[UserAPI] Error handling registration:`, error.message);
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: error.message,
    });
  }
});

// Start the server
const server = app.listen(config.port, () => {
  console.log(`
=========================================================
Notification Broker Service (API Gateway)
Server listening on: http://localhost:${config.port}
Environment: ${config.nodeEnv}
Feature Flag ENABLE_ASYNC_NOTIFICATIONS: ${features.ENABLE_ASYNC_NOTIFICATIONS}
=========================================================
  `);
});

export { app, server };

