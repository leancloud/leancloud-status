const _ = require('lodash');
const Promise = require('bluebird');

const Checker = require('./checker');
const {S3Storage} = require('./object-storage');
const nodeSettings = require('./node-settings');
const cloudStorage = require('./cloud-storage');

const objectStorage = exports.objectStorage = new S3Storage;

const checkers = _.mapValues(nodeSettings, (keys, nodeId) => {
  return new Checker(nodeId, keys);
});

var intervalId = null;
var lastCheck = 'success';

if (process.env.LEANCLOUD_APP_ENV === 'production') {
  changeInterval(300 * 1000);
  checkAll();
}

setTimeout( () => {
  process.exit();
}, 6 * 3600 * 1000);

function checkAll() {
  Promise.props(_.mapValues(checkers, (checker) => {
    return checker.checkAll();
  })).then( results => {
    cloudStorage.uploadCheckResult(results).catch(console.error);

    objectStorage.uploadLatestStatus({
      status: results,
      charts: cloudStorage.getChartData()
    });

    if (someThingWrong(results) && lastCheck === 'success') {
      lastCheck = 'failed';
      changeInterval(60 * 1000);
    } else if (!someThingWrong(results) && lastCheck === 'failed') {
      lastCheck = 'success';
      changeInterval(300 * 1000);
    }
  });
}

function changeInterval(interval) {
  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(checkAll, interval);
  console.log(`changeInterval: ${interval}ms`);
}

function someThingWrong(results) {
  return _.some(results, (services, nodeName) => {
    return _.some(services, ({error}) => {
      return error;
    });
  });
}
