const KEY = 'mood_journal_records';
const getProfile = () =>
  wx.getStorageSync('mood_journal_profile') || null;

const saveProfile = profile => {
  wx.setStorageSync('mood_journal_profile', profile);
};

// 始终向各页面返回数组；也兼容之前误存为对象的旧数据
const getRecords = () => {
  const records = wx.getStorageSync(KEY);

  if (Array.isArray(records)) {
    return records;
  }

  if (records && typeof records === 'object') {
    const list = Object.values(records);
    wx.setStorageSync(KEY, list);
    return list;
  }

  return [];
};

// 同一天保存时覆盖旧记录，不会重复新增
const saveRecord = record => {
  const all = getRecords();
  const index = all.findIndex(item => item.id === record.id);

  if (index >= 0) {
    all[index] = {
      ...all[index],
      ...record,
      updatedAt: Date.now()
    };
  } else {
    all.push(record);
  }

  wx.setStorageSync(KEY, all);

  wx.cloud.database()
    .collection('emotion_records')
    .add({ data: record })
    .catch(err => console.error('云端保存失败', err));

  return all;
};
const deleteRecord = id => {
  const all = getRecords().filter(item => item.id !== id);
  wx.setStorageSync(KEY, all);
  return all;
};

const pad = value => String(value).padStart(2, '0');

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const streak = records => {
  const list = Array.isArray(records) ? records : [];
  let days = 0;
  const cursor = new Date();

  while (list.some(item => item.date === dateKey(cursor))) {
    days++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return days;
};
module.exports = {
  getProfile,
  saveProfile,
  getRecords,
  saveRecord,
  deleteRecord,
  dateKey,
  streak
};