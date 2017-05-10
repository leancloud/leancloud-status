const AV = require('leanengine');

const CheckResult = AV.Object.extend('CheckResult');

AV.Cloud.define('destroyStaleCheckResult', (request) => {
  return new AV.Query(CheckResult).lessThan('createdAt', new Date(Date.now() - 30 * 3600 * 1000))
  .ascending('createdAt').limit(1000).find().then( results => {
    console.log(results);
    return AV.Object.destroyAll(results);
  });
});
