const AV = require('leanengine');
const _ = require('lodash');

const nodeSettings = require('./node-settings');

const CheckResult = AV.Object.extend('CheckResult');

const SERVICES = ['LeanStorage', 'LeanMessage', 'LeanEngine', 'Website', 'Support'];
const CHART_RANGE = 24 * 3600 * 1000;

var checkResultCache = [];

new AV.Query(CheckResult)
  .descending('createdAt').greaterThan('createdAt', new Date(Date.now() - CHART_RANGE))
  .limit(1000).find().then( result => {
    checkResultCache = result.reverse().map( item => {
      return {
        checkResult: item.get('checkResult'),
        createdAt: item.createdAt
      };
    });
}).catch(console.error);

exports.uploadCheckResult = function uploadCheckResult(checkResult) {
  checkResultCache.push({checkResult, createdAt: new Date()});

  checkResultCache = checkResultCache.filter( ({createdAt}) => {
    return createdAt > new Date(Date.now() - CHART_RANGE);
  });

  return new CheckResult().save({checkResult});
};

exports.getChartData = function getChartData() {
  return _.mapValues(nodeSettings, (__, nodeName) => {
    const nodeCharts = {};

    SERVICES.forEach( service => {
      const serviceChart = nodeCharts[service] = [];

      checkResultCache.forEach( ({createdAt, checkResult}) => {
        const serviceResult = checkResult[nodeName][service];
        const currentStatus = getServiceStatus(serviceResult);

        if (serviceChart.status != currentStatus) {
          serviceChart.status = currentStatus;

          serviceChart.push({
            time: createdAt,
            error: serviceResult && serviceResult.error,
            status: currentStatus
          });
        }
      });
    });

    return nodeCharts;
  });
};

function getServiceStatus(serviceResult) {
  if (!serviceResult) {
    return 'skipped';
  } else if (serviceResult.error) {
    return 'error';
  } else {
    return 'success';
  }
}
