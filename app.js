// ===== ES2017 API Polyfill =====
// enhance:false 环境下，es6:true 只转译语法不补 API
// 这些 polyfill 确保旧设备上也能使用 Object.entries / Object.values / padStart
if (!Object.entries) {
  Object.entries = function(obj) {
    var result = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result.push([key, obj[key]]);
      }
    }
    return result;
  };
}
if (!Object.values) {
  Object.values = function(obj) {
    var result = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result.push(obj[key]);
      }
    }
    return result;
  };
}
if (!String.prototype.padStart) {
  String.prototype.padStart = function(targetLength, padString) {
    var str = String(this);
    var pad = padString || ' ';
    while (str.length < targetLength) {
      str = pad + str;
    }
    return str;
  };
}

App({

  onLaunch() {

    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上基础库');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-d3gk0pt5475dc1ad4',
      traceUser: true
    });

    // 检查首次使用引导
    var hasOnboarded = wx.getStorageSync('has_onboarded');
    if (!hasOnboarded) {
      this.globalData.needOnboarding = true;
    }

    // 检查上次使用时间，用于智能提醒
    var lastUsed = wx.getStorageSync('last_used_time');
    this.globalData.lastUsedTime = lastUsed;
    wx.setStorageSync('last_used_time', Date.now());
  },

  // 全局错误捕获
  onError(err) {
    console.error('[全局错误]', err);
  },

  // 页面不存在
  onPageNotFound() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  globalData: {
    needOnboarding: false,
    lastUsedTime: 0
  }

})
