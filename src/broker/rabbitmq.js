import amqp from 'amqplib';
import crypto from 'crypto';
import { config } from '../config/index.js';

let connection = null;
let channel = null;

/**
 * Initializes and returns the RabbitMQ channel.
 * Uses persistent topic exchange for flexible routing.
 */
export async function getRabbitChannel() {
  if (channel) {
    return channel;
  }

  try {
    console.log(`🔌 [Broker] Connecting to RabbitMQ at ${config.rabbitmq.url}...`);
    connection = await amqp.connect(config.rabbitmq.url);

    connection.on('error', (err) => {
      console.error('[Broker] RabbitMQ connection error:', err.message);
      channel = null;
      connection = null;
    });

    connection.on('close', () => {
      console.warn('[Broker] RabbitMQ connection closed');
      channel = null;
      connection = null;
    });

    channel = await connection.createChannel();

    // Assert a topic exchange for user domain events
    await channel.assertExchange(config.rabbitmq.exchange, 'topic', {
      durable: true,
    });

    console.log(`[Broker] Connected to RabbitMQ. Exchange asserted: "${config.rabbitmq.exchange}" (type: topic)`);
    return channel;
  } catch (error) {
    console.error('[Broker] Failed to connect to RabbitMQ:', error.message);
    throw error;
  }
}

/**
 * Publishes the "UserSignedUp" domain event to the exchange.
 * @param {Object} user - The newly registered user
 * @returns {Promise<Object>} The published event envelope
 */
export async function publishUserSignedUpEvent(user) {
  const ch = await getRabbitChannel();

  const eventPayload = {
    eventId: crypto.randomUUID(),
    eventType: 'UserSignedUp',
    timestamp: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    metadata: {
      source: config.appName,
      routingKey: config.rabbitmq.routingKey,
      correlationId: crypto.randomUUID(),
    },
  };

  const messageBuffer = Buffer.from(JSON.stringify(eventPayload));

  const published = ch.publish(
    config.rabbitmq.exchange,
    config.rabbitmq.routingKey,
    messageBuffer,
    {
      persistent: true, // Messages survive broker restarts
      contentType: 'application/json',
      messageId: eventPayload.eventId,
      timestamp: Date.now(),
    }
  );

  if (!published) {
    console.warn(`[Broker] Buffer full, message buffered for write: ${eventPayload.eventId}`);
  }

  console.log(`[Broker] Event Published: UserSignedUp -> Exchange: "${config.rabbitmq.exchange}" | RoutingKey: "${config.rabbitmq.routingKey}" | EventID: ${eventPayload.eventId}`);

  return eventPayload;
}

/**
 * Gracefully closes the RabbitMQ channel and connection.
 */
export async function closeBrokerConnection() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    console.log('[Broker] Connection closed gracefully');
  } catch (err) {
    console.error('[Broker] Error closing RabbitMQ connection:', err.message);
  }
}
