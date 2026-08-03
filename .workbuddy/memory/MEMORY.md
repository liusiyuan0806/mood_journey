# 情绪手账 · 项目长期记忆

## 项目概况
- 微信小程序「情绪手账 / Mood Journey」
- 暖色调设计系统：#FFF8F2 基底, #E8856A 主色, 28rpx 圆角卡片
- 5 个 Tab：今日心情 / 情绪日历 / 情绪分析 / 共情墙 / 我的
- 自定义 TabBar（custom: true）

## 关键技术约束
- **enhance: true**（已从 false 改为 true）— 启用增强编译（Babel），支持 ES6+ 语法转译
- **ES2017 API polyfill** — app.js 顶部已添加 Object.entries / Object.values / String.prototype.padStart 的 polyfill
- **对象展开 `{...obj}` 已全部替换为 `Object.assign()`** — ES2018 语法在 enhance:false 下无法转译，会导致白屏（已修复 7 处：weather.js, home.js, day.js, record.js, profile.js）
- **CSS 类名必须纯 ASCII** — 中文类名会导致白屏（已踩坑 2 次：weekly-report.wxss、breathing.wxss）
- 云开发环境：cloud1-d3gk0pt5475dc1ad4

## EHI 情绪健康指数公式
`EHI = avg/5×100 − std×3 − low×1 + streakBonus`

## 页面清单（17 页）
home, calendar, insights, profile, record, edit-profile, day, favorites,
weather-mood, weekly-report, mood-tree, badges, breathing, data-export, onboarding, empathy-wall, weather-personality

## 工具模块（10 个）
store（含离线同步队列）, moods, weather, quotes, weeklyReport,
achievements, moodTree, breathing, smartReminder, moodPrediction, empathyWall

## 云函数
- getWeather — 腾讯地图 API 获取真实天气
- getMoodInsight — 规则引擎 AI 情绪洞察（无需外部 API）

## 设计决策记录
- 走势图固定 7 天，避免窄柱图标挤压
- 天气背景色透明度 40%+ 才可辨识
- 情绪树用 CSS 绝对定位渲染（非 SVG，兼容性更好）
- 果实位置用 seededRandom 保证确定性
- 呼吸练习 phase 用 id（inhale/hold/exhale）而非 name 做CSS类
- AI 洞察优先调云函数，失败降级到本地规则引擎
- TabBar 索引：home=0, calendar=1, insights=2, empathy-wall=3, profile=4
- **`**` → Math.pow()，`?.` → (obj||{}).prop，`??` → != null ? a : b（之前 enhance:false 时必须遵守，现已启用 enhance:true）**
- **对象展开 `{...obj}` → Object.assign({}, obj, {...})** — ES2018 语法，enhance:false 下基础转译器无法处理，会导致文件编译失败、页面白屏
- **WXML style 属性警惕手写错误**：`style="width:{{x}}%'"` 多了个 `'` 会导致整页 WXML 解析失败、整页空白（已踩坑 1 次：calendar.wxml L183）
- **致命陷阱：模块顶层数组字面量里引用函数参数** — `{ condition: fn(records, stats), desc: 'xxx' + stats.streak + 'xxx' }` 中 desc 在 require 时立即执行，但 stats 是 condition 的参数尚未传入 → ReferenceError → 整个模块加载失败 → 所有 require 该模块的页面 Page 构造崩溃 → 白屏。修复：动态 desc 改为 `desc: function(stats) { return '...'; }`，condition 返回 true 时再调用。历史案例：smartReminder.js L66（2026-08-03 修复，导致 home+profile 同时白屏）
- **白屏排查必须用 `vm.runInContext` 实际跑 Page()**，不能只看 `new Function()` 语法检查（后者只测语法、不测运行时 require/构造错误）
- **微信开发者工具项目缓存损坏会导致整项目空白**：如果连零依赖测试页都空白、编辑器报已删除文件不存在，应新建目录从 git 重新导出源码导入
- **微信小程序 WXSS 不支持本地图片作为 `background-image`**：`.bg { background: url('/image/x.jpg'); }` 不会报错也不会显示，必须用 `<image src="/image/x.jpg">` 组件

## 情绪树背景图方案（2026-08-04）
- 用户期望的树形直接用参考图作为背景：`image/tree-bg.png`（透明背景 PNG）
- **重要陷阱：微信小程序 WXSS 不支持本地图片作为 `background-image`**，必须用 `<image>` 组件引用本地图片
- 树背景：`<image class="tree-bg" src="/image/tree-bg.png" mode="aspectFit" />`
- 树背景尺寸：480×480rpx，居中，`bottom: 80rpx`
- 心情果实仍用绝对定位动态渲染在背景图树冠区域
- 树冠区域常量（基于 750×580 canvas）：`CROWN_CX=375, CROWN_CY=195, CROWN_RX=220, CROWN_RY=130`（新树冠更宽更扁）
- 果实按树等级 `fruitScale` 缩放分布范围（0.82 → 1.08），避免果实跑到树干或天空
- 移除了原先 CSS 手绘的树干、树冠、树叶、树枝，全部交给背景图
- `tree-canvas` 背景改用柔和天空渐变（#E8F6FC → #FFF9F5），与透明树图融合
- 云朵参考首页风格：椭圆主体 + `::before/::after` 模糊云瓣，白色半透明，缓慢漂浮
- 太阳采用双层结构：`.sun-core` 黄橙径向渐变 + `.sun-halo` 橙色光晕脉冲
- z-index 层级：`sky-bg=1`，`cloud/sun=2`，`ground=3`，`tree-bg=5`，`fruits=10`

## 项目目录
- **主目录：`C:\Users\兮灵子\Desktop\mood_journey`**（2026-08-04 已从 mood_journey_fixed 迁移回来）
- `mood_journey_fixed` 仍保留作为备份
- 微信小程序登录信息存储在开发者工具运行时缓存中，不在代码文件里，迁移代码不影响登录态
