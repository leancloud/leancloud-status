const request = require('request-promise');
const Promise = require('bluebird');
const {Realtime, TextMessage} = require('leancloud-realtime');
const _ = require('lodash');

const REGION = process.env.REGION || 'lcoal';

module.exports = class Checker {
  constructor(nodeId, keys) {
    _.extend(this, keys, {nodeId});

    this.schema = this.nodeId === REGION ? 'http://' : 'https://';
  }

  checkAll(timeout = 15000) {
    const checks = _.pickBy({
      'LeanStorage': this.checkLeanStorage,
      'LeanMessage': this.checkLeanMessage,
      'LeanPush': this.checkLeanPush,
      'LeanAnalytics': this.checkLeanAnalytics,
      'LeanEngine': this.checkLeanEngine,
      'Website': this.checkWebsite,
      'Support': this.checkSupport
    }, (__, service) => {
      if (!_.includes(this.ignore, service)) {
        return true;
      }
    })

    return Promise.props(_.mapValues(checks, (func) => {
      const startedAt = Date.now();

      return Promise.try(func.bind(this)).timeout(timeout).then( () => {
        return {latency: Date.now() - startedAt, time: new Date()};
      }).catch( err => {
        return {
          latency: Date.now() - startedAt,
          timeout: (Date.now() - startedAt) >= timeout ? true : false,
          time: new Date(),
          error: err.message
        };
      });
    }));
  }

  checkLeanStorage() {
    return request({
      url: `${this.schema}${this.urlPrefix}/1.1/classes/CheckTarget?${encodeURI('where={"hello":"world"}')}`,
      json: true,
      headers: {
        'X-LC-Id': this.appId,
        'X-LC-Key': this.appKey
      }
    }).then( res => {
      if (!(res.results.length >= 1)) {
        throw new Error(JSON.stringify(res));
      }
    });
  }

  checkLeanMessage() {
    const realtime = new Realtime({
      appId: this.appId,
      region: this.region.toLowerCase()
    });

    return realtime.createIMClient(`${REGION}-status-check`).then( client => {
      client.close()
    });
  }

  checkLeanPush() {
    return request({
      method: 'POST',
      url: `${this.schema}${this.urlPrefix}/1.1/push`,
      json: true,
      headers: {
        'X-LC-Id': this.appId,
        'X-LC-Key': this.appKey
      },
      body: {
        data: {
          alert: 'Hello from LeanCloud'
        }
      }
    }).then( res => {
      if (!res.objectId) {
        throw new Error(JSON.stringify(res));
      }
    });
  }

  checkLeanAnalytics() {
    return request({url: `${this.schema}${this.urlPrefix}/1/stats/ping`});
  }

  checkLeanEngine() {
    return request({url: this.engineUrl});
  }

  checkWebsite() {
    return Promise.map(this.websiteUrls, (url) => {
      return request({url});
    });
  }

  checkSupport() {
    return request({url: 'https://leanticket.cn'});
  }
};
