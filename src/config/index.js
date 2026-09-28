import dotenv from 'dotenv';

dotenv.config();

import { features } from './features.js';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  emailDelayMs: parseInt(process.env.EMAIL_SIMULATION_DELAY_MS || '2000', 10),
  appName: 'event-driven-notify-broker',
  features,
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'user.events',
    queue: process.env.RABBITMQ_QUEUE || 'email_service_queue',
    routingKey: process.env.RABBITMQ_ROUTING_KEY || 'user.signup',
  },
};

export { features };

