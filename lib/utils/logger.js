Object.defineProperty(exports, "__esModule", {
  value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

require('winston-loggly-bulk');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var logger = null;

var OPTIONS = {
  level: 'info',
  colorize: true,
  timestamp: true,
  prettyPrint: process.env.NODE_ENV !== 'production'
};

var logglyOptions = {
  inputToken: process.env.LOGGLY_CUSTOMER_TOKEN,
  subdomain: "polydice",
  tags: ["hypernova", process.env.APP_HOST],
  json: true
};

var loggerInterface = {
  init: function () {
    function init(config) {
      var options = Object.assign({}, OPTIONS, config);
      logger = new _winston2['default'].Logger({
        transports: [new _winston2['default'].transports.Console(options), new _winston2['default'].transports.Loggly(logglyOptions)]
      });

      delete loggerInterface.init;
    }

    return init;
  }(),
  error: function () {
    function error(message, meta) {
      return logger.log('error', message, meta);
    }

    return error;
  }(),
  info: function () {
    function info(message, meta) {
      return logger.log('info', message, meta);
    }

    return info;
  }()
};

exports['default'] = loggerInterface;
module.exports = exports['default'];