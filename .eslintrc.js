module.exports = require('@dwp/eslint-config-base');

module.exports.rules['import/no-extraneous-dependencies'] = ['error', { devDependencies: true }];
