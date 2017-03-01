Object.defineProperty(exports, "__esModule", {
  value: true
});

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

require('./environment');

var _logger = require('./utils/logger');

var _logger2 = _interopRequireDefault(_logger);

var _lifecycle = require('./utils/lifecycle');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var WORKER_COUNT = _os2['default'].cpus().length - 1 || 1;

function close() {
  return Promise.all(Object.values(_cluster2['default'].workers).map(function (worker) {
    var promise = new Promise(function (resolve, reject) {
      worker.on('disconnect', resolve);
      worker.on('exit', function (code) {
        if (code !== 0) reject();
      });
    });
    worker.send('kill');
    return promise;
  }));
}

function shutdown() {
  return (0, _lifecycle.raceTo)(close(), 5000, 'Closing the coordinator took too long.');
}

function workersReady() {
  var workers = Object.values(_cluster2['default'].workers);

  return workers.length === WORKER_COUNT && workers.every(function (worker) {
    return worker.isReady;
  });
}

exports['default'] = function () {
  function onWorkerMessage(msg) {
    if (msg.ready) {
      _cluster2['default'].workers[msg.workerId].isReady = true;
    }

    if (workersReady()) {
      Object.values(_cluster2['default'].workers).forEach(function (worker) {
        return worker.send('healthy');
      });
    }
  }

  _cluster2['default'].on('online', function (worker) {
    return _logger2['default'].info('Worker #' + String(worker.id) + ' is now online');
  });

  _cluster2['default'].on('listening', function (worker, address) {
    _logger2['default'].info('Worker #' + String(worker.id) + ' is now connected to ' + String(address.address) + ':' + String(address.port));
  });

  _cluster2['default'].on('disconnect', function (worker) {
    _logger2['default'].info('Worker #' + String(worker.id) + ' has disconnected');
  });

  _cluster2['default'].on('exit', function (worker, code, signal) {
    if (worker.suicide === true || code === 0) {
      _logger2['default'].info('Worker #' + String(worker.id) + ' shutting down.');
    } else {
      _logger2['default'].error('Worker #' + String(worker.id) + ' died with code ' + String(signal || code) + '. Restarting worker.');
      var newWorker = _cluster2['default'].fork();
      newWorker.on('message', onWorkerMessage);
    }
  });

  process.on('SIGTERM', function () {
    _logger2['default'].info('Hypernova got SIGTERM. Going down.');
    shutdown().then(function () {
      return process.exit(0);
    }, function () {
      return process.exit(1);
    });
  });

  process.on('SIGINT', function () {
    shutdown().then(function () {
      return process.exit(0);
    }, function () {
      return process.exit(1);
    });
  });

  Array.from({ length: WORKER_COUNT }, function () {
    return _cluster2['default'].fork();
  });

  Object.values(_cluster2['default'].workers).forEach(function (worker) {
    return worker.on('message', onWorkerMessage);
  });
};

module.exports = exports['default'];