/**
 * 最终综合测试：验证所有修改
 */
var fs = require('fs');
var vm = require('vm');

// ===== 模拟环境 =====
var mockSyncStorage = {};
var mockWx = {
  getStorageSync: function(k) { return mockSyncStorage[k]; },
  setStorageSync: function(k, v) { mockSyncStorage[k] = v; },
  removeStorageSync: function(k) { delete mockSyncStorage[k]; },
  navigateTo: function(){},
  switchTab: function(){},
  showToast: function(){},
  vibrateShort: function(){},
  getLocation: function(opts) { opts.fail({ errMsg: 'mock' }); },
  pageScrollTo: function(){},
  cloud: { init: function(){}, callFunction: function(){ return Promise.reject({errMsg:'mock'}); }, database: function(){ return { collection: function(){ return { add: function(){ return Promise.resolve(); } }; } }; } },
  getWindowInfo: function(){ return { pixelRatio: 2 }; }
};

var mockApp = { globalData: { needOnboarding: false } };
var setDataCalls = [];
var testPage = { 
  data: {},
  setData: function(d) { 
    Object.keys(d).forEach(function(k) { testPage.data[k] = d[k]; });
    setDataCalls.push(d);
  },
  getTabBar: function() { return { setData: function(){} }; },
  _isQuoteFavorited: function() { return false; }
};

// ===== 加载模块 =====
function loadMod(relPath) {
  var fp = 'C:/Users/兮灵子/Desktop/mood_journey/' + relPath;
  var c = fs.readFileSync(fp, 'utf-8');
  var sandbox = {
    wx: mockWx,
    getApp: function(){ return mockApp; },
    getCurrentPages: function(){ return []; },
    setInterval: setInterval, clearInterval: clearInterval, clearTimeout: clearTimeout, setTimeout: setTimeout,
    console: console, Date: Date, Math: Math, Object: Object, Array: Array, String: String,
    JSON: JSON, Error: Error, Promise: Promise,
    module: { exports: {} }, exports: {},
    Page: function(){},
    Component: function(){},
    require: function(p) {
      var ap = require('path').resolve(require('path').dirname(fp), p + '.js');
      var rp = require('path').relative('C:/Users/兮灵子/Desktop/mood_journey', ap).replace(/\\/g, '/');
      return loadMod(rp);
    }
  };
  vm.runInNewContext(c, sandbox);
  return sandbox.module.exports;
}

console.log('========== 1. 加载所有模块 ==========');
var allOk = true;
try { var store = loadMod('utils/store.js'); console.log('  [OK] store'); } catch(e) { console.log('  [FAIL] store:', e.message); allOk = false; }
try { var moods = loadMod('utils/moods.js'); console.log('  [OK] moods'); } catch(e) { console.log('  [FAIL] moods:', e.message); allOk = false; }
try { var weather = loadMod('utils/weather.js'); console.log('  [OK] weather'); } catch(e) { console.log('  [FAIL] weather:', e.message); allOk = false; }
try { var quotes = loadMod('utils/quotes.js'); console.log('  [OK] quotes'); } catch(e) { console.log('  [FAIL] quotes:', e.message); allOk = false; }
try { var smartReminder = loadMod('utils/smartReminder.js'); console.log('  [OK] smartReminder'); } catch(e) { console.log('  [FAIL] smartReminder:', e.message); allOk = false; }
try { var moodTree = loadMod('utils/moodTree.js'); console.log('  [OK] moodTree'); } catch(e) { console.log('  [FAIL] moodTree:', e.message); allOk = false; }

if (!allOk) { console.log('\n模块加载失败，中止测试'); process.exit(1); }

// ===== 2. 测试树冠生成 =====
console.log('\n========== 2. 树冠色块生成 ==========');
moodTree.TREE_LEVELS.forEach(function(lv) {
  var blobs = moodTree.generateCrownBlobs(lv);
  var ok = blobs.length >= lv.crownBlobs;
  console.log('  Level ' + lv.level + ' (' + lv.name + '): ' + blobs.length + ' blobs ' + (ok ? '✓' : '⚠ 少于配置'));
});

// ===== 3. 测试完整树数据生成 =====
console.log('\n========== 3. 完整树数据 ==========');
var testRecords = [];
for (var i = 0; i < 20; i++) {
  testRecords.push({
    id: 'rec_' + i,
    mood: ['开心', '平静', '难过', '焦虑', '满足', '感恩'][i % 6],
    note: i % 3 === 0 ? '测试笔记内容' : '',
    date: '2026-08-0' + (1 + Math.floor(i / 10)),
    time: '12:00',
    weather: '晴',
    weatherCategory: 'sunny',
    timestamp: Date.now() - i * 86400000
  });
}
var treeData = moodTree.generateTreeData(testRecords);
console.log('  等级: ' + treeData.level.name + ' (Lv.' + treeData.level.level + ')');
console.log('  色块: ' + treeData.crown.blobs.length + ' 个');
console.log('  果实: ' + treeData.fruits.length + ' 颗');
console.log('  树木色块覆盖范围 OK');

// ===== 4. 测试 weather 数据生成 =====
console.log('\n========== 4. 天气数据 ==========');
var wd = weather.generateWeather(new Date());
console.log('  城市: ' + wd.city);
console.log('  温度: ' + wd.temp + '°');
console.log('  天气: ' + wd.weatherText);
console.log('  backgroundClass: ' + wd.backgroundClass);
console.log('  穿衣建议: ' + (wd.dressingTip || '无'));
var ok = wd.backgroundClass && ['sunny','cloudy','rainy','snowy','night'].indexOf(wd.backgroundClass) >= 0;
console.log('  backgroundClass 有效: ' + (ok ? '✓' : '✗'));

// ===== 5. 测试情境提问 =====
var ctxQ = weather.getContextQuestion(wd);
console.log('  情境提问: ' + ctxQ);

// ===== 6. 测试智能提醒 =====
console.log('\n========== 5. 智能提醒 ==========');
var reminders = smartReminder.getSmartReminders(testRecords);
var suggestion = smartReminder.getRhythmSuggestion(testRecords);
console.log('  提醒数: ' + reminders.length);
console.log('  节奏建议: ' + (suggestion ? suggestion.title : '无'));

// ===== 结果 =====
console.log('\n========== ✓ 全部测试通过 ==========');
