var KEY = 'mood_journal_records';
var SYNC_QUEUE_KEY = 'mood_journal_sync_queue';

var getProfile = function() {
  return wx.getStorageSync('mood_journal_profile') || null;
};

var saveProfile = function(profile) {
  wx.setStorageSync('mood_journal_profile', profile);
};

// 始终向各页面返回数组；也兼容之前误存为对象的旧数据
var getRecords = function() {
  var records = wx.getStorageSync(KEY);

  if (Array.isArray(records)) {
    return records;
  }

  if (records && typeof records === 'object') {
    var list = Object.values(records);
    wx.setStorageSync(KEY, list);
    return list;
  }

  return [];
};

// 离线优先保存：先写本地，再异步同步云端
var saveRecord = function(record) {
  var all = getRecords();
  var index = all.findIndex(function(item) { return item.id === record.id; });

  // 标记云同步状态
  record.cloudSynced = false;

  if (index >= 0) {
    all[index] = Object.assign({}, all[index], record, { updatedAt: Date.now() });
  } else {
    all.push(record);
  }

  // 1. 先写本地（立即可见）
  wx.setStorageSync(KEY, all);

  // 2. 加入同步队列
  var queue = wx.getStorageSync(SYNC_QUEUE_KEY) || [];
  queue.push({ id: record.id, type: 'save', timestamp: Date.now() });
  wx.setStorageSync(SYNC_QUEUE_KEY, queue);

  // 3. 异步同步到云端
  syncToCloud(record);

  return all;
};

// 云同步函数
var syncToCloud = function(record) {
  if (!wx.cloud) {
    console.warn('[Cloud] 云开发未初始化，跳过同步');
    return;
  }

  wx.cloud.database()
    .collection('emotion_records')
    .add({
      data: Object.assign({}, record, { cloudSynced: true })
    })
    .then(function() {
      // 同步成功，更新本地记录的同步状态
      var all = getRecords();
      var idx = all.findIndex(function(item) { return item.id === record.id; });
      if (idx >= 0) {
        all[idx].cloudSynced = true;
        wx.setStorageSync(KEY, all);
      }

      // 从同步队列中移除
      var queue = wx.getStorageSync(SYNC_QUEUE_KEY) || [];
      var newQueue = queue.filter(function(item) { return item.id !== record.id; });
      wx.setStorageSync(SYNC_QUEUE_KEY, newQueue);
    })
    .catch(function(err) {
      console.error('[Cloud] 云端同步失败:', err);
      // 保留在同步队列中，下次启动时重试
    });
};

// 重试同步队列中的记录
var retrySync = function() {
  var queue = wx.getStorageSync(SYNC_QUEUE_KEY) || [];
  if (queue.length === 0) return;

  var all = getRecords();
  queue.forEach(function(item) {
    var record = all.find(function(r) { return r.id === item.id; });
    if (record && !record.cloudSynced) {
      syncToCloud(record);
    }
  });
};

var deleteRecord = function(id) {
  var all = getRecords().filter(function(item) { return item.id !== id; });
  wx.setStorageSync(KEY, all);

  // 尝试从云端删除
  if (wx.cloud) {
    wx.cloud.database()
      .collection('emotion_records')
      .where({ id: id })
      .remove()
      .catch(function(err) {
        console.error('[Cloud] 云端删除失败:', err);
      });
  }

  return all;
};

var pad = function(value) { return String(value).padStart(2, '0'); };

var dateKey = function(date) {
  date = date || new Date();
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

var streak = function(records) {
  var list = Array.isArray(records) ? records : [];
  var days = 0;
  var cursor = new Date();

  while (list.some(function(item) { return item.date === dateKey(cursor); })) {
    days++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return days;
};

// 获取同步状态
var getSyncStatus = function() {
  var queue = wx.getStorageSync(SYNC_QUEUE_KEY) || [];
  return {
    pendingCount: queue.length,
    isSyncing: queue.length > 0
  };
};

module.exports = {
  getProfile: getProfile,
  saveProfile: saveProfile,
  getRecords: getRecords,
  saveRecord: saveRecord,
  deleteRecord: deleteRecord,
  dateKey: dateKey,
  streak: streak,
  retrySync: retrySync,
  getSyncStatus: getSyncStatus
};
