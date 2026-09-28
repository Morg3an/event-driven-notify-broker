import amqp from 'amqplib';
import { config } from './config/index.js';
import { sendWelcomeEmail } from './services/emailService.js';

let connection = null;
let channel = null;
let isShuttingDown = false;

/**
 * Connects to RabbitMQ broker and sets up queue, exchange, and consumer.
 */
async function startWorker() {
  console.log(`
=========================================================
Notification Background Worker Starting...
Listening for: "UserSignedUp" domain events
Broker: ${config.rabbitmq.url}
Exchange: "${config.rabbitmq.exchange}" (topic)
Queue: "${config.rabbitmq.queue}"
Binding Key: "${config.rabbitmq.routingKey}"
=========================================================
  `);

  try {
    connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();

    connection.on('error', (err) => {
      console.error('[Worker] RabbitMQ connection error:', err.message);
    });

    connection.on('close', () => {
      if (!isShuttingDown) {
        console.warn('[Worker] RabbitMQ connection lost. Reconnecting in 5s...');
        setTimeout(startWorker, 5000);
      }
    });

    // Ensure exchange exists
    await channel.assertExchange(config.rabbitmq.exchange, 'topic', {
      durable: true,
    });

    // Ensure dedicated worker queue exists
    const q = await channel.assertQueue(config.rabbitmq.queue, {
      durable: true,
    });

    // Bind queue to exchange using the routing key
    await channel.bindQueue(q.queue, config.rabbitmq.exchange, config.rabbitmq.routingKey);
    console.log(`[Worker] Queue "${q.queue}" bound to "${config.rabbitmq.exchange}" with key "${config.rabbitmq.routingKey}"`);

    // Fair dispatch: process 1 message at a time per worker instance
    await channel.prefetch(1);

    console.log(`[Worker] Waiting for messages in "${q.queue}". To exit press CTRL+C\n`);

    // Start consuming messages
    await channel.consume(
      q.queue,
      async (msg) => {
        if (!msg) return;

        const deliveryTag = msg.fields.deliveryTag;
        const startTime = Date.now();

        try {
          const rawContent = msg.content.toString();
          const event = JSON.parse(rawContent);

          console.log(`\n---------------------------------------------------------`);
          console.log(`[Worker] Received Event: "${event.eventType}"`);
          console.log(`   Message ID:    ${event.eventId}`);
          console.log(`   Routing Key:   ${msg.fields.routingKey}`);
          console.log(`   Timestamp:     ${event.timestamp}`);
          console.log(`   User Info:     ${event.user.name} <${event.user.email}>`);
          console.log(`---------------------------------------------------------`);

          // Process the asynchronous task (email dispatch)
          const result = await sendWelcomeEmail(event.user);

          const processingTime = Date.now() - startTime;
          console.log(`[Worker] Asynchronous job completed in ${processingTime}ms`);

          // Acknowledge the message once processing succeeds
          channel.ack(msg);
          console.log(`[Worker] Acknowledged message deliveryTag: ${deliveryTag}\n`);
        } catch (processError) {
          console.error(`Worker] Error processing message (Tag: ${deliveryTag}):`, processError.message);
          // Reject and do not requeue corrupted messages to avoid infinite poisoning loops
          channel.nack(msg, false, false);
        }
      },
      {
        noAck: false, // Manual acknowledgment ensures zero message loss
      }
    );
  } catch (error) {
    console.error('[Worker] Startup failure:', error.message);
    if (!isShuttingDown) {
      console.log('Retrying connection in 5 seconds...');
      setTimeout(startWorker, 5000);
    }
  }
}

// Graceful shutdown handling
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[Worker] Shutting down gracefully...');

  try {
    if (channel) {
      await channel.close();
      console.log('   Channel closed.');
    }
    if (connection) {
      await connection.close();
      console.log('   Connection closed.');
    }
    console.log('[Worker] Worker exited cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startWorker();
