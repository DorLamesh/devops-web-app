const log4js = require('log4js');

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    json: { type: 'file', filename: 'logs/json.log', layout: { type: 'messagePassThrough' } },
    actions: { type: 'file', filename: 'logs/actions.log', layout: { type: 'messagePassThrough' } }
  },
  categories: {
    default: { appenders: ['out'], level: 'info' },
    json: { appenders: ['json'], level: 'info' },
    actions: { appenders: ['actions'], level: 'info' }
  }
});

const jsonLogger = log4js.getLogger('json');
jsonLogger.json = (obj) => {
  try{
    jsonLogger.info(JSON.stringify(obj));
  }catch(err){
    jsonLogger.warn('Failed to stringify JSON log entry', err);
    jsonLogger.info(String(obj));
  }
};

const actionLogger = log4js.getLogger('actions');
actionLogger.json = (obj) => {
  try{
    actionLogger.info(JSON.stringify(obj));
  }catch(err){
    actionLogger.warn('Failed to stringify JSON log entry', err);
    actionLogger.info(String(obj));
  }
};

module.exports = { jsonLogger, actionLogger };
