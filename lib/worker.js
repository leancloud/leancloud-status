const _ = require('lodash');
const Promise = require('bluebird');

const Checker = require('./checker');
const {S3Storage} = require('./object-storage');
const nodeSettings = require('./node-settings');

const objectStorage = exports.objectStorage = new S3Storage;

const checkers = _.mapValues(nodeSettings, (keys, nodeId) => {
  return new Checker(nodeId, keys);
});

function checkAll() {
  Promise.props(_.mapValues(checkers, (checker) => {
    return checker.checkAll();
  })).then( results => {
    objectStorage.uploadLatestStatus({
      status: results
    });
  });
}

if (process.env.LEANCLOUD_APP_ENV === 'production') {
  setInterval(checkAll, 300 * 1000);
  checkAll();
}
