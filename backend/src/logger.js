const log4js = require('log4js');

// Use a simple stdout appender. We'll stringify objects before logging to ensure
// valid JSON output and avoid layout compatibility issues across log4js versions.
log4js.configure({
  appenders: { out: { type: 'stdout' } },
  categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('app');

// Provide a small helper to log JSON objects consistently
logger.json = (obj) => {
  try {
    logger.info(JSON.stringify(obj));
  } catch (e) {
    logger.info(String(obj));
  }
};

module.exports = logger;
