const fs = require('fs');
const path = require('path');

// Mock wx environment
const wxMock = {
  cloud: {
    init: () => {},
    callFunction: ({success}) => { if (success) success({ result: { success: false } }); },
    database: () => ({ collection: () => ({ add: () => ({ then: () => ({ catch: () => {} }) }), where: () => ({ remove: () => ({ catch: () => {} }) }) }) })
  },
  getStorageSync: () => null,
  setStorageSync: () => {},
  removeStorageSync: () => {},
  getLocation: () => {},
  chooseLocation: () => {},
  showToast: () => {},
  showModal: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showActionSheet: () => {},
  switchTab: () => {},
  navigateTo: () => {},
  navigateBack: () => {},
  redirectTo: () => {},
  pageScrollTo: () => {},
  stopPullDownRefresh: () => {},
  vibrateShort: () => {},
  createSelectorQuery: () => ({ select: () => ({ fields: () => ({ exec: () => {} }), boundingClientRect: () => ({ exec: () => {} }) }), in: () => ({ select: () => ({ fields: () => ({ exec: () => {} }) }) }) }),
  getSystemInfoSync: () => ({ pixelRatio: 2, statusBarHeight: 20 }),
  getWindowInfo: () => ({ pixelRatio: 2 }),
  saveImageToPhotosAlbum: () => {},
  canvasToTempFilePath: () => {},
  openSetting: () => {},
  requestSubscribeMessage: () => {},
  onPageNotFound: () => {},
  startPullDownRefresh: () => {},
};

function loadModule(filePath, visited) {
  visited = visited || new Set();
  if (visited.has(filePath)) return {};
  visited.add(filePath);
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);
  const module = { exports: {} };
  const sandbox = {
    module: module,
    exports: module.exports,
    require: function(name) {
      if (name.startsWith('./') || name.startsWith('../')) {
        let resolved = path.resolve(path.dirname(filePath), name);
        if (!fs.existsSync(resolved)) resolved += '.js';
        return loadModule(resolved, visited);
      }
      return {};
    },
    Page: function(obj) {
      const instance = Object.assign({}, obj);
      try {
        if (typeof instance.onLoad === 'function') instance.onLoad.call(instance, {});
        if (typeof instance.onShow === 'function') instance.onShow.call(instance, {});
      } catch (e) {
        console.error('  Page ERROR:', e.message);
        console.error('  Stack:', e.stack.split('\n').slice(0, 5).join('\n'));
      }
    },
    App: function(obj) {
      try {
        if (typeof obj.onLaunch === 'function') obj.onLaunch();
      } catch (e) {
        console.error('  App ERROR:', e.message);
      }
    },
    getApp: () => ({ globalData: {}, onLaunch: () => {} }),
    console: console,
    wx: wxMock,
    Date: Date, Math: Math, Object: Object, Array: Array, String: String, Number: Number,
    Boolean: Boolean, JSON: JSON, RegExp: RegExp, Error: Error, Promise: Promise,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    setTimeout: setTimeout, setInterval: setInterval, clearTimeout: clearTimeout, clearInterval: clearInterval
  };
  try {
    const fn = new Function('module', 'exports', 'require', 'wx', 'console', 'Page', 'App', 'getApp', code);
    fn(module, module.exports, sandbox.require, sandbox.wx, sandbox.console, sandbox.Page, sandbox.App, sandbox.getApp);
  } catch (e) {
    console.error('LOAD ERROR', filePath, ':', e.message);
    throw e;
  }
  return module.exports;
}

const pages = [
  'pages/home/home.js',
  'pages/calendar/calendar.js',
  'pages/insights/insights.js',
  'pages/profile/profile.js',
  'pages/record/record.js',
  'pages/edit-profile/edit-profile.js',
  'pages/day/day.js',
  'pages/favorites/favorites.js',
  'pages/weather-mood/weather-mood.js',
  'pages/weekly-report/weekly-report.js',
  'pages/mood-tree/mood-tree.js',
  'pages/badges/badges.js',
  'pages/breathing/breathing.js',
  'pages/data-export/data-export.js',
  'pages/onboarding/onboarding.js',
  'pages/empathy-wall/empathy-wall.js',
  'pages/weather-personality/weather-personality.js'
];

console.log('=== Constructing all pages ===');
pages.forEach(p => {
  try {
    console.log('\n---', p, '---');
    loadModule('C:/Users/兮灵子/Desktop/mood_journey/' + p, new Set());
    console.log('  OK');
  } catch (e) {
    console.error('  FAILED:', e.message);
  }
});
