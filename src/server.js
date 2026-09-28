import express from 'express';
import { config } from './config/index.js';
import { userService } from './services/userService.js';
import { sendWelcomeEmail } from './services/emailService.js';

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

// POST /users - Legacy Synchronous Implementation (Baseline)
app.post('/users', async (req, res) => {
  const requestStartTime = Date.now();
  const { name, email } = req.body;

  try {
    // 1. Create the user record in database/store
    const user = userService.createUser({ name, email });
    console.log(`[UserAPI] Created user record: ${user.name} (${user.email})`);

    // 2. Legacy Synchronous Flow: Wait for slow SMTP email dispatch
    console.log(`[UserAPI] Executing synchronous email dispatch (legacy blocking flow)...`);
    const emailResult = await sendWelcomeEmail(user);

    const totalDuration = Date.now() - requestStartTime;

    // 3. Return response to client after full blocking operation
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
Notification Broker Service (Baseline Synchronous API)
Server listening on: http://localhost:${config.port}
Environment: ${config.nodeEnv}
Architecture Mode: SYNCHRONOUS (Blocking SMTP Email)
=========================================================
  `);
});

export { app, server };
