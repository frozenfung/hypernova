Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

require('./environment');

var _logger = require('./utils/logger');

var _logger2 = _interopRequireDefault(_logger);

var _renderBatch = require('./utils/renderBatch');

var _renderBatch2 = _interopRequireDefault(_renderBatch);

var _lifecycle = require('./utils/lifecycle');

var _BatchManager = require('./utils/BatchManager');

var _BatchManager2 = _interopRequireDefault(_BatchManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var closing = false;

var attachMiddleware = function attachMiddleware(app, config) {
  app.use(_bodyParser2['default'].json(config.bodyParser));
};

var attachEndpoint = function attachEndpoint(app, config, callback) {
  app.post(config.endpoint, (0, _renderBatch2['default'])(config, callback));
};

var initServer = function initServer(app, config, callback) {
  var server = void 0;

  function exit(code) {
    return function () {
      return process.exit(code);
    };
  }

  function close() {
    return new Promise(function (resolve) {
      if (!server) {
        resolve();
        return;
      }

      try {
        closing = true;
        server.close(function (e) {
          if (e) {
            _logger2['default'].info('Ran into error during close', { stack: e.stack });
          }
          resolve();
        });
      } catch (e) {
        _logger2['default'].info('Ran into error on close', { stack: e.stack });
        resolve();
      }
    });
  }

  function shutDownSequence(error, req) {
    var code = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

    if (error) {
      _logger2['default'].info(error.stack);
    }

    (0, _lifecycle.raceTo)(close(), 1000, 'Closing the worker took too long.').then(function () {
      return (0, _lifecycle.runAppLifecycle)('shutDown', config.plugins, config, error, req);
    }).then(exit(code))['catch'](exit(code));
  }

  function errorHandler(err, req, res, next) {
    // eslint-disable-line no-unused-vars
    // If there is an error with body-parser and the status is set then we can safely swallow
    // the error and report it.
    // Here are a list of errors https://github.com/expressjs/body-parser#errors
    if (err.status && err.status >= 400 && err.status < 600) {
      _logger2['default'].info('Non-fatal error encountered.');
      _logger2['default'].info(err.stack);

      res.status(err.status).end();

      // In a promise in case one of the plugins throws an error.
      new Promise(function () {
        // eslint-disable-line no-new
        var manager = new _BatchManager2['default'](req, res, req.body, config);
        (0, _lifecycle.errorSync)(err, config.plugins, manager);
      });

      return;
    }
    shutDownSequence(err, req, 1);
  }

  // Middleware
  app.use(errorHandler);

  // Last safety net
  process.on('uncaughtException', errorHandler);

  // if all the workers are ready then we should be good to start accepting requests
  process.on('message', function (msg) {
    if (msg === 'kill') {
      shutDownSequence(null, null, 0);
    }
  });

  // run through the initialize methods of any plugins that define them
  (0, _lifecycle.runAppLifecycle)('initialize', config.plugins, config).then(function () {
    server = app.listen(config.port, callback);
  })['catch'](shutDownSequence);
};

var worker = function worker(app, config, onServer, workerId) {
  // ===== Middleware =========================================================
  attachMiddleware(app, config);

  if (onServer) {
    onServer(app, process);
  }

  // ===== Routes =============================================================
  attachEndpoint(app, config, function () {
    return closing;
  });

  // ===== initialize server's nuts and bolts =================================
  initServer(app, config, function () {
    if (process.send) {
      // tell our coordinator that we're ready to start receiving requests
      process.send({ workerId: workerId, ready: true });
    }

    _logger2['default'].info('Connected', { port: config.port });
  });
};

worker.attachMiddleware = attachMiddleware;
worker.attachEndpoint = attachEndpoint;
worker.initServer = initServer;

exports['default'] = worker;
module.exports = exports['default'];