import winston from 'winston';
import 'winston-loggly-bulk';

let logger = null;

const OPTIONS = {
  level: 'info',
  colorize: true,
  timestamp: true,
  prettyPrint: process.env.NODE_ENV !== 'production',
};

const logglyOptions = {
  inputToken: process.env.LOGGLY_CUSTOMER_TOKEN,
  subdomain: "polydice",
  tags: ["hypernova", process.env.APP_HOST],
  json: true,
};

const loggerInterface = {
  init(config) {
    const options = Object.assign({}, OPTIONS, config);
    logger = new winston.Logger({
      transports: [
        new(winston.transports.Console)(options),
        new(winston.transports.Loggly)(logglyOptions)
      ]
    });

    delete loggerInterface.init;
  },

  error(message, meta) {
    return logger.log('error', message, meta);
  },

  info(message, meta) {
    return logger.log('info', message, meta);
  },
};

export default loggerInterface;
