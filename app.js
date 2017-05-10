'use strict';
var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');
var basicAuth = require('basic-auth');

require('./cloud');

var app = express();

app.use(express.static('public'));

app.use(timeout('15s'));
app.use(AV.express());

app.enable('trust proxy');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const worker = require('./lib/worker');

app.get('/', function(req, res) {
  res.json({ currentTime: new Date() });
});

app.put('/events.json', function(req, res) {
  const credentials = basicAuth(req);

  if (credentials && process.env.USERNAME && process.env.PASSWORD &&
    credentials.name === process.env.USERNAME && credentials.pass === process.env.PASSWORD
  ) {
    worker.objectStorage.uploadStatusEvents(req.body).then( () => {
      res.sendStatus(201);
    }).catch( err => {
      res.status(500).json({
        error: err.message
      });
    });
  } else {
    res.header('WWW-Authenticate', 'Basic realm="status.leancloud.cn"');
    res.sendStatus(401);
  }
});

app.use(function(req, res, next) {
  if (!res.headersSent) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  }
});

app.use(function(err, req, res, next) {
  if (req.timedout && req.headers.upgrade === 'websocket') {
    return;
  }

  var statusCode = err.status || 500;
  if (statusCode === 500) {
    console.error(err.stack || err);
  }
  if (req.timedout) {
    console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
  }
  res.status(statusCode);
  // 默认不输出异常详情
  var error = {}
  if (app.get('env') === 'development') {
    // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
    error = err;
  }
  res.json({
    error: err.message
  });
});

module.exports = app;
