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

  },

  globalData: {
    weatherApiKey: ""
  }

})
