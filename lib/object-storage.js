const Promise = require('bluebird');
const AWS = require('aws-sdk');

const REGION = process.env.REGION || 'lcoal';

exports.S3Storage = class S3Storage {
  constructor() {
    this.s3Client = new AWS.S3({
      apiVersion: '2006-03-01',
      region: 'cn-north-1'
    });
  }

  uploadLatestStatus(lasestStatus) {
    this.s3Client.putObject({
      Bucket: 'leancloud-status',
      Key: `${REGION}-latest.json`,
      Body: JSON.stringify(lasestStatus),
      ACL: 'public-read',
      ContentType: 'application/json'
    }, (err, result) => {
      if (err) {
        console.error(err.stack);
      }
    });
  }

  uploadStatusEvents(statusEvents) {
    return Promise.fromCallback( callback => {
      this.s3Client.putObject({
        Bucket: 'leancloud-status',
        Key: 'events.json',
        Body: JSON.stringify(statusEvents),
        ACL: 'public-read',
        ContentType: 'application/json'
      }, callback);
    });
  }
};
