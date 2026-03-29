// src/core/queue.ts
// RabbitMQ — gerenciamento de filas

import amqp from 'amqplib';

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;

export const QUEUES = {
  TELEGRAM_INCOMING:  'telegram.incoming',
  INTENT_CLASSIFY:    'intent.classify',
  WEB_SEARCH:         'web.search',
  RESPONSE_GENERATE:  'response.generate',
  TELEGRAM_OUTGOING:  'telegram.outgoing',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

export async function connectQueue(): Promise<amqp.Channel> {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  console.log(`🔌 Conectando ao RabbitMQ: ${url.replace(/(:\/\/[^:]+:[^@]+)@/, '$1****')}`);

  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      connection = await amqp.connect(url);
      channel = await connection.createChannel();
      for (const queue of Object.values(QUEUES)) {
        await channel.assertQueue(queue, { durable: true });
      }
      console.log('✅ RabbitMQ connected');
      return channel!;
    } catch (err) {
      console.error(`❌ RabbitMQ (${i + 1}/${maxRetries}):`, (err as Error).message);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 3000));
      else throw err;
    }
  }
  throw new Error('RabbitMQ: max retries exceeded');
}

export function getChannel(): amqp.Channel {
  if (!channel) throw new Error('Queue not connected. Call connectQueue() first.');
  return channel;
}

export async function publish(queue: QueueName, message: unknown): Promise<void> {
  getChannel().sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}

export async function consume<T = unknown>(queue: QueueName, handler: (msg: T) => Promise<void>): Promise<void> {
  const ch = getChannel();
  await ch.consume(queue, async (msg) => {
    if (msg) {
      try {
        await handler(JSON.parse(msg.content.toString()) as T);
        ch.ack(msg);
      } catch (err) {
        console.error(`❌ Error processing message from ${queue}:`, err);
        ch.nack(msg, false, false);
      }
    }
  });
}

export async function closeQueue(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
