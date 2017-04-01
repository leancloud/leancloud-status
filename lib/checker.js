const request = require('request-promise');
const Promise = require('bluebird');
const {Realtime, TextMessage} = require('leancloud-realtime');
const _ = require('lodash');

module.exports = class Checker {
  constructor(nodeId, keys) {
    _.extend(this, keys, {nodeId});

    if (this.appId) {
      this.realtime = new Realtime({
        appId: this.appId,
        region: this.region.toLowerCase()
      });
    }
  }

  checkAll(timeout = 5000) {
    return Promise.props(_.mapValues({
      'LeanStorage': this.checkLeanStorage,
      'LeanMessage': this.checkLeanMessage,
      'LeanPush': this.checkLeanPush,
      'LeanAnalytics': this.checkLeanAnalytics,
      'LeanEngine': this.checkLeanEngine,
      'Website': this.checkWebsite,
      'Support': this.checkSupport
    }, (func) => {
      const startedAt = Date.now();
      return Promise.try(func.bind(this)).timeout(timeout).then( () => {
        return {time: Date.now() - startedAt};
      }).catch( err => {
        return {time: Date.now() - startedAt, err: err.message};
      });
    }));
  }

  checkLeanStorage() {
    return request({
      url: `${this.urlPrefix}/1.1/classes/CheckTarget?${encodeURI('where={"hello":"world"}')}`,
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
    return new Promise( (resolve, reject) => {
      this.realtime.createIMClient('Tom').then( tom => {
        return tom.createConversation({
          members: ['Jerry'],
          name: 'Tom & Jerry',
          unique: true,
        }).then( conversation => {
          return this.realtime.createIMClient('Jerry').then( jerry => {
            jerry.on('message', function(message) {
              resolve();
            });

            conversation.send(new TextMessage('ping'));
          })
        });
      }).catch(reject);
    });
  }

  checkLeanPush() {
    return request({
      method: 'POST',
      url: `${this.urlPrefix}/1.1/push`,
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
    return request({url: `${this.urlPrefix}/1/stats/ping`});
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
