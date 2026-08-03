var { getRecords, getProfile, dateKey } = require('../../utils/store');
var { byName } = require('../../utils/moods');

Page({
  data: {
    records: [],
    profile: null,
    exportFormat: 'json',
    recordCount: 0,
    dateRange: '',
    exporting: false
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    try {
      var records = getRecords();
      var profile = getProfile();
      var dateRange = '';
      if (records.length > 0) {
        var sorted = records.slice().sort(function(a, b) {
          return (a.timestamp || 0) - (b.timestamp || 0);
        });
        dateRange = (sorted[0].date || '') + ' ~ ' + (sorted[sorted.length - 1].date || '');
      }
      this.setData({
        records: records,
        profile: profile,
        recordCount: records.length,
        dateRange: dateRange
      });
    } catch (err) {
      console.error('[data-export] loadData error:', err);
    }
  },

  // 选择导出格式
  selectFormat(e) {
    this.setData({ exportFormat: e.currentTarget.dataset.format });
  },

  // 导出数据
  exportData() {
    if (this.data.records.length === 0) {
      wx.showToast({ title: '没有数据可导出', icon: 'none' });
      return;
    }

    this.setData({ exporting: true });

    try {
      var format = this.data.exportFormat;
      var content = '';
      var filename = '';
      var ext = '';

      if (format === 'json') {
        content = this.generateJSON();
        filename = 'mood_journal_' + dateKey();
        ext = 'json';
      } else if (format === 'markdown') {
        content = this.generateMarkdown();
        filename = 'mood_journal_' + dateKey();
        ext = 'md';
      } else if (format === 'csv') {
        content = this.generateCSV();
        filename = 'mood_journal_' + dateKey();
        ext = 'csv';
      }

      // 写入临时文件
      var fs = wx.getFileSystemManager();
      var filePath = wx.env.USER_DATA_PATH + '/' + filename + '.' + ext;
      fs.writeFileSync(filePath, content, 'utf8');

      // 分享文件
      wx.shareFileMessage({
        filePath: filePath,
        success: function() {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail: function(err) {
          console.error('[export] shareFileMessage error:', err);
          // 降级：复制到剪贴板
          wx.setClipboardData({
            data: content,
            success: function() {
              wx.showToast({ title: '已复制到剪贴板', icon: 'none' });
            }
          });
        }
      });
    } catch (err) {
      console.error('[export] error:', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }

    this.setData({ exporting: false });
  },

  // 生成JSON
  generateJSON() {
    var data = {
      app: 'Mood Journey',
      exportDate: new Date().toISOString(),
      profile: this.data.profile,
      recordCount: this.data.records.length,
      records: this.data.records.map(function(r) {
        var moodInfo = byName(r.mood);
        return {
          id: r.id,
          date: r.date,
          time: r.time,
          mood: r.mood,
          moodScore: moodInfo.score,
          moodEmoji: moodInfo.emoji,
          note: r.note || '',
          weather: r.weather || '',
          location: r.location || '',
          weatherImpact: r.weatherImpact || '',
          bodyFeelings: r.bodyFeelings || [],
          triggerCategory: r.triggerCategory || '',
          triggerItems: r.triggerItems || [],
          images: (r.images || []).length,
          audioDuration: r.audioDuration || 0,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        };
      })
    };
    return JSON.stringify(data, null, 2);
  },

  // 生成Markdown
  generateMarkdown() {
    var lines = [];
    lines.push('# 我的情绪日记');
    lines.push('');
    lines.push('> 导出自 Mood Journey · 情绪手账');
    lines.push('');
    lines.push('**导出时间**：' + new Date().toLocaleString());
    lines.push('**记录总数**：' + this.data.records.length + ' 条');
    if (this.data.dateRange) {
      lines.push('**日期范围**：' + this.data.dateRange);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // 按日期分组
    var dayMap = {};
    this.data.records.forEach(function(r) {
      if (!dayMap[r.date]) dayMap[r.date] = [];
      dayMap[r.date].push(r);
    });

    var dates = Object.keys(dayMap).sort().reverse();
    dates.forEach(function(date) {
      lines.push('## ' + date);
      lines.push('');
      var dayRecords = dayMap[date].sort(function(a, b) {
        return (a.time || '').localeCompare(b.time || '');
      });
      dayRecords.forEach(function(r) {
        var moodInfo = byName(r.mood);
        lines.push('### ' + (r.time || '') + ' ' + moodInfo.emoji + ' ' + r.mood + ' (' + moodInfo.score + '/5)');
        if (r.note) {
          lines.push('');
          lines.push('> ' + r.note);
        }
        var meta = [];
        if (r.weather) meta.push('天气: ' + r.weather);
        if (r.location) meta.push('地点: ' + r.location);
        if (r.weatherImpact) meta.push('天气影响: ' + r.weatherImpact);
        if (r.bodyFeelings && r.bodyFeelings.length) meta.push('身体感受: ' + r.bodyFeelings.join(', '));
        if (r.triggerItems && r.triggerItems.length) meta.push('诱因: ' + r.triggerItems.join(', '));
        if (meta.length) {
          lines.push('');
          lines.push(meta.join(' | '));
        }
        lines.push('');
      });
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  },

  // 生成CSV
  generateCSV() {
    var headers = ['日期', '时间', '心情', '分数', '笔记', '天气', '地点', '天气影响', '身体感受', '情绪诱因'];
    var lines = [headers.join(',')];
    this.data.records.forEach(function(r) {
      var moodInfo = byName(r.mood);
      var row = [
        r.date || '',
        r.time || '',
        r.mood || '',
        moodInfo.score,
        '"' + (r.note || '').replace(/"/g, '""') + '"',
        r.weather || '',
        r.location || '',
        r.weatherImpact || '',
        '"' + (r.bodyFeelings || []).join('; ') + '"',
        '"' + (r.triggerItems || []).join('; ') + '"'
      ];
      lines.push(row.join(','));
    });
    return lines.join('\n');
  },

  // 导入数据
  importData() {
    var self = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: function(res) {
        var filePath = res.tempFiles[0].path;
        var fs = wx.getFileSystemManager();
        try {
          var content = fs.readFileSync(filePath, 'utf8');
          var data = JSON.parse(content);
          if (data.records && Array.isArray(data.records)) {
            wx.showModal({
              title: '导入确认',
              content: '将导入' + data.records.length + '条记录，是否继续？',
              success: function(r) {
                if (r.confirm) {
                  wx.setStorageSync('mood_journal_records', data.records);
                  wx.showToast({ title: '导入成功', icon: 'success' });
                  self.loadData();
                }
              }
            });
          } else {
            wx.showToast({ title: '文件格式不正确', icon: 'none' });
          }
        } catch (err) {
          console.error('[import] error:', err);
          wx.showToast({ title: '导入失败', icon: 'none' });
        }
      },
      fail: function() {}
    });
  },

  // 清除数据
  clearData() {
    wx.showModal({
      title: '清除数据',
      content: '所有心情记录将被永久清除，建议先导出备份。',
      success: function(r) {
        if (r.confirm) {
          wx.removeStorageSync('mood_journal_records');
          wx.showToast({ title: '已清除', icon: 'success' });
          this.loadData();
        }
      }.bind(this)
    });
  }
});
