module.exports = require('@dwp/eslint-config-mocha');

module.exports.rules['import/no-extraneous-dependencies'] = ['error', { devDependencies: true }];
module.exports.rules['mocha/max-top-level-suites'] = 0;
