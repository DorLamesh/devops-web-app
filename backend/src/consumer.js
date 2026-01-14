const { Kafka } = require('kafkajs');
const logger = require('./logger');

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'tidb-cdc-consumer' });

async function run(){
  await consumer.connect();
  await consumer.subscribe({ topic: 'tidb_cdc', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let value = message.value ? message.value.toString() : '';
      try{
        const parsed = JSON.parse(value);
        // Log structured message as JSON string
        logger.json({ timestamp: new Date().toISOString(), action: 'db_change', data: parsed });
      }catch(err){
        logger.json({ timestamp: new Date().toISOString(), action: 'db_change', raw: value });
      }
    }
  });
}

run().catch(err => { console.error(err); process.exit(1); });
