// src/queue.js
// RabbitMQ connection and channel management

import amqp from 'amqplib';

let connection = null;
let channel = null;

export const QUEUES = {
  TELEGRAM_INCOMING: 'telegram.incoming',
  INTENT_CLASSIFY: 'intent.classify',
  WEB_SEARCH: 'web.search',
  RESPONSE_GENERATE: 'response.generate',
  TELEGRAM_OUTGOING: 'telegram.outgoing'
};

export async function connectQueue() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  console.log(`🔌 Conectando ao RabbitMQ: ${url.replace(/(:\/\/.*:).*@/, '$1****')}`);
  
  const maxRetries = 10;
  const retryDelay = 3000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      connection = await amqp.connect(url);
      channel = await connection.createChannel();
      
      // Declare all queues
      for (const queue of Object.values(QUEUES)) {
        await channel.assertQueue(queue, { durable: true });
      }
      
      console.log('✅ RabbitMQ connected');
      return channel;
    } catch (err) {
      console.error(`❌ RabbitMQ connection failed (${i + 1}/${maxRetries}):`, err.message);
      if (i < maxRetries - 1) {
        console.log(`⏳ Tentando novamente em ${retryDelay/1000}s...`);
        await new Promise(r => setTimeout(r, retryDelay));
      } else {
        throw err;
      }
    }
  }
}

export function getChannel() {
  if (!channel) {
    throw new Error('Queue not connected. Call connectQueue() first.');
  }
  return channel;
}

export async function publish(queue, message) {
  const ch = getChannel();
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true
  });
}

export async function consume(queue, handler) {
  const ch = getChannel();
  await ch.consume(queue, async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        ch.ack(msg);
      } catch (err) {
        console.error(`❌ Error processing message from ${queue}:`, err);
        ch.nack(msg, false, false); // Don't requeue on error
      }
    }
  });
}

export async function closeQueue() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
