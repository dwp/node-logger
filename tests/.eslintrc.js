module.exports = require('@dwp/eslint-config-mocha');

module.exports.rules['import/no-extraneous-dependencies'] = ['error', { devDependencies: true }];
