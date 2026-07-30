const {
  getRecords,
  deleteRecord,
  streak,
  dateKey
} = require('../../utils/store');
const {
  byName
} = require('../../utils/moods');
Page({
  data: {
    year: 0,
    month: 0,
    days: [],
    records: [],
    selected: null,
    streak: 0,
    summary: []
  },
  onShow() {
    const n = new Date();
    if (!this.data.year)
      this.setData({
        year: n.getFullYear(),
        month: n.getMonth() + 1
      });
    this.build();
  },
  build() {
    const {
      year,
      month
    } = this.data,
      records = getRecords(),
      first = new Date(year, month - 1, 1).getDay(),
      total = new Date(year, month, 0).getDate(),
      days = [];
    for (let i = 0; i < first; i++) days.push({
      empty: true
    });
    for (let d = 1; d <= total; d++) {
      const date = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        // 2. build() 中：按日期从数组中查找记录
const record = records.find(item => item.date === date);
const mood = record && byName(record.mood);

days.push({
  day: d,
  date,
  record,
  color: mood && mood.color
});
    }
    // 3. 本月数据不需要 Object.values
const monthly = records.filter(item =>
  item.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)
);
    const groups = {};
    monthly.forEach(r => groups[r.mood] = (groups[r.mood] || 0) + 1);
    const summary = Object.keys(groups).slice(0, 3).map(name => ({
      name,
      count: groups[name],
      width: `${Math.round(groups[name]/Math.max(monthly.length,1)*100)}%`
    }));
    this.setData({
      days,
      records,
      streak: streak(records),
      summary
    });
  },
  prev() {
    let {
      year,
      month
    } = this.data;
    if (--month === 0) {
      year--;
      month = 12
    }
    this.setData({
      year,
      month
    });
    this.build()
  },
  next() {
    let {
      year,
      month
    } = this.data;
    if (++month === 13) {
      year++;
      month = 1
    }
    this.setData({
      year,
      month
    })
    this.build()
  },
  choose(e) {
    const date = e.currentTarget.dataset.date;
    const record = e.currentTarget.dataset.record;
    // 如果已有记录
    if (record) {
      this.setData({
        selected: record
      });
      return;
    }
    // 没有记录，直接去新增
    wx.navigateTo({
      url: '/pages/day/day?date=' + date
    });
  },
  close() {
    this.setData({
      selected: null
    })
  },
  edit() {
    wx.navigateTo({
      url: '/pages/record/record?id=' + this.data.selected.id
    })
  },
  remove() {
    const id = this.data.selected.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条的记录吗？',
      success: r => {
        if (r.confirm) {
          deleteRecord(d);
          this.setData({
            selected: null
          });
          this.build()
        }
      }
    })
  }
});