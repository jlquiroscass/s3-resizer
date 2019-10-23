'use strict'


const AWS = require('aws-sdk')
const S3 = new AWS.S3({signatureVersion: 'v4'});
const Sharp = require('sharp');
const PathPattern = new RegExp("(.*/)?(.*)/(.*)");

// parameters
const {BUCKET, URL} = process.env


exports.handler = function(event, _context, callback) {
    var path = event.queryStringParameters.path;
    var parts = PathPattern.exec(path);
    var dir = parts[1] || '';
    var options = parts[2].split('_');
    var filename = parts[3];


    var sizes = options[0].split("x");
    var action = options.length > 1 ? options[1] : null;

    if (action && action !== 'max' && action !== 'min') {
        callback(null, {
            statusCode: 400,
            body: `Unknown func parameter "${action}"\n` +
                  'For query ".../150x150_func", "_func" must be either empty, "_min" or "_max"',
            headers: {"Content-Type": "text/plain"}
        });
        return;
    }

    var contentType;
    S3.getObject({Bucket: BUCKET, Key: dir + filename})
        .promise()
        .then(data => {
            contentType = data.ContentType;
            var width = sizes[0] === 'AUTO' ? null : parseInt(sizes[0]);
            var height = sizes[1] === 'AUTO' ? null : parseInt(sizes[1]);
            var fit;
            switch (action) {
                case 'max':
                    fit = 'inside';
                    break;
                case 'min':
                    fit = 'outside';
                    break
                default:
                    fit = 'cover';
                    break;
            }
            var options = {
                withoutEnlargement: true,
                fit
            };
            return Sharp(data.Body)
                .resize(width, height, options)
                .rotate()
                .toBuffer();
        })
        .then(result =>
            S3.putObject({
                Body: result,
                Bucket: BUCKET,
                ContentType: contentType,
		CacheControl: 'max-age=31536000',
                Key: path
            }).promise()
        )
        .then(() =>
            callback(null, {
                statusCode: 301,
                headers: {"Location" : `${URL}/${path}`}
            })
        )
        .catch(e => {
            callback(null, {
                statusCode: e.statusCode || 400,
                body: 'Exception: ' + e.message,
                headers: {"Content-Type": "text/plain"}
            })
        });
}
