// Karma configuration file
module.exports = function (config) {
  const which = require('which');

  if (!process.env.CHROME_BIN) {
    const bins = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    for (const bin of bins) {
      const resolved = which.sync(bin, { nothrow: true });
      if (resolved) {
        process.env.CHROME_BIN = resolved;
        break;
      }
    }
  }

  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};

