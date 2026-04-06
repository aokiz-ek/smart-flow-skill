import type { SkillDefinition } from './types';

export const mobileReviewSkill: SkillDefinition = {
  id: 'mobile-review',
  name: '移动端专项审查',
  nameEn: 'mobile_review',
  order: 34,
  description: '审查移动端应用的平台合规、性能基准、离线同步、无障碍与崩溃防护',
  descriptionEn: 'Review mobile app platform compliance, performance benchmarks, offline sync, accessibility, and crash protection',
  detailDescription: `移动端应用面临独特的挑战：App Store 合规审查、有限的设备性能、不稳定的网络环境和严格的无障碍要求。
本 Skill 提供系统化的移动端专项审查框架：覆盖 iOS/Android 平台合规要求、
启动性能和内存基准、离线缓存与数据同步策略、VoiceOver/TalkBack 无障碍检查，
以及主线程阻塞和内存泄漏防护，确保应用通过审核并提供卓越的用户体验。`,
  triggers: [
    '移动端审查',
    'mobile review',
    'ios review',
    'android review',
    'flutter review',
    'react native review',
    '移动端性能',
    'app review',
    '@ethan mobile-review',
    '/mobile-review',
  ],
  steps: [
    {
      title: '1. 平台合规审查',
      content: `检查 iOS 和 Android 的合规要求，确保顺利通过审核：

**iOS App Store 合规 Checklist**
\`\`\`
□ 隐私权限声明
  - Info.plist 中每个权限 Key 必须有 Usage Description
  - NSCameraUsageDescription: "用于拍摄商品照片"
  - NSLocationWhenInUseUsageDescription: "用于查找附近服务"
  - NSPhotoLibraryUsageDescription: "用于选择头像图片"

□ App Tracking Transparency (ATT)
  - iOS 14+ 追踪用户需要弹窗授权
  - NSUserTrackingUsageDescription 必须填写

□ 隐私清单 (Privacy Manifest, iOS 17+)
  - PrivacyInfo.xcprivacy 文件
  - 声明使用的 Required Reason API（UserDefaults/File timestamp 等）

□ 网络安全配置
  - 所有网络请求使用 HTTPS（ATS 默认开启）
  - 自定义 Exception 需要合理理由

□ 支付合规
  - 数字商品/虚拟货币必须使用 In-App Purchase
  - 不得引导用户到外部网站购买
\`\`\`

**Android Google Play 合规 Checklist**
\`\`\`
□ 权限最小化
  - 仅申请功能必需的权限
  - targetSdkVersion ≥ 33（Play Store 要求）
  - 危险权限在使用前实时申请（非安装时）

□ 数据安全表（Data Safety Section）
  - 明确声明收集的数据类型
  - 说明是否与第三方共享

□ 广告 ID（GAID）
  - Android 12+ 需要 AD_ID 权限
  - 儿童类应用禁止使用广告 ID

□ 64位支持
  - 所有 native library 提供 arm64-v8a 版本
\`\`\`

**输出**：平台合规检查报告（iOS + Android，通过/未通过标注）`,
    },
    {
      title: '2. 性能专项审查',
      content: `评估移动端应用的关键性能指标：

**性能基准标准**

| 指标 | 优秀 | 可接受 | 需优化 |
|------|------|--------|--------|
| **冷启动时间** | < 1.5s | < 2.5s | > 2.5s |
| **热启动时间** | < 0.5s | < 1.0s | > 1.0s |
| **帧率（FPS）** | 60fps | 55fps | < 50fps |
| **首屏渲染** | < 1.0s | < 2.0s | > 2.0s |
| **内存占用（前台）** | < 150MB | < 250MB | > 250MB |
| **安装包大小** | < 30MB | < 60MB | > 60MB |
| **电池消耗** | < 5%/h | < 10%/h | > 10%/h |

**启动性能优化**
\`\`\`swift
// iOS — 减少 AppDelegate 启动时工作
@main class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
    didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    // ❌ 避免在启动时进行：
    // - 同步网络请求
    // - 大量数据库初始化
    // - 复杂计算

    // ✅ 启动时只做：
    setupCrashReporting()  // 轻量
    configureDependencyInjection()  // 必须

    // ✅ 延迟到首屏渲染后
    DispatchQueue.main.async {
      self.setupAnalytics()
      self.prefetchData()
    }
    return true
  }
}
\`\`\`

\`\`\`kotlin
// Android — 使用 App Startup 库延迟初始化
class MyInitializer : Initializer<Unit> {
  override fun create(context: Context) {
    // 只初始化核心功能
  }
  override fun dependencies() = emptyList<Class<out Initializer<*>>>()
}
\`\`\`

**包大小优化**
\`\`\`
iOS:
  - 使用 Asset Catalog 而非散落图片
  - On-Demand Resources 下载非核心资源
  - App Thinning（Bitcode + Slicing）

Android:
  - App Bundle (.aab) 替代 APK（减少 20-40%）
  - R8/ProGuard 代码压缩
  - WebP 替换 PNG/JPEG
  - 动态功能模块（Dynamic Feature Modules）
\`\`\`

**输出**：性能基准报告 + 优化建议清单`,
    },
    {
      title: '3. 离线与数据同步',
      content: `设计可靠的离线能力和数据同步策略：

**离线架构模式**

**① Cache-First（适合内容类 App）**
\`\`\`typescript
// React Native — 先读本地缓存，后台刷新
async function getArticles(): Promise<Article[]> {
  const cached = await AsyncStorage.getItem('articles');

  // 立即返回缓存（用户不等待）
  if (cached) {
    const data = JSON.parse(cached);
    // 后台静默刷新
    fetchAndCache().catch(console.error);
    return data;
  }

  // 无缓存时等待网络
  return fetchAndCache();
}
\`\`\`

**② Optimistic Update（适合操作类 App）**
\`\`\`typescript
// 先更新本地，后台同步到服务器
async function toggleLike(postId: string) {
  // 立即更新 UI（乐观更新）
  dispatch({ type: 'TOGGLE_LIKE', postId });

  try {
    await api.post(\`/posts/\${postId}/like\`);
  } catch (error) {
    // 失败时回滚
    dispatch({ type: 'REVERT_LIKE', postId });
    showToast('操作失败，已恢复');
  }
}
\`\`\`

**冲突解决策略**
\`\`\`
策略                  适用场景
─────────────────────────────────
Last-Write-Wins       一般设置、非关键数据
Server-Wins           金融数据、库存数量
Client-Wins           用户个人偏好
Merge（合并）          文档协作（CRDT）
Ask User（提示用户）   重要数据冲突
\`\`\`

**网络状态监听**
\`\`\`typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  if (state.isConnected && hasPendingSync()) {
    syncPendingOperations();  // 联网后自动同步
  }
});

// 队列离线操作
async function queueOperation(op: Operation) {
  await OfflineQueue.push(op);
  if (await NetInfo.fetch().then(s => s.isConnected)) {
    await flushQueue();
  }
}
\`\`\`

**输出**：离线架构方案 + 冲突解决策略 + 代码模板`,
    },
    {
      title: '4. 无障碍审查',
      content: `确保应用对视障、听障、行动不便用户友好：

**无障碍审查 Checklist**

**① 屏幕阅读器（VoiceOver/TalkBack）**
\`\`\`swift
// iOS — 所有交互元素必须有 accessibilityLabel
imageView.accessibilityLabel = "用户头像"
imageView.accessibilityHint = "双击查看个人资料"

// 自定义控件
button.isAccessibilityElement = true
button.accessibilityTraits = .button
button.accessibilityLabel = "发布文章"

// ❌ 避免：仅用图标表示功能，无文字描述
// ✅ 正确：图标 + accessibilityLabel
\`\`\`

\`\`\`kotlin
// Android
imageButton.contentDescription = "发布文章"
// 装饰性图片应设置 importantForAccessibility = no
decorativeImage.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
\`\`\`

**② 触控目标大小**
\`\`\`
最小触控目标：
- iOS: 44pt × 44pt（Apple HIG 标准）
- Android: 48dp × 48dp（Material Design 标准）

检查方法：
- iOS Accessibility Inspector: Xcode → Open Developer Tool
- Android: 开发者选项 → 显示触控区域
\`\`\`

**③ 色彩对比度**
\`\`\`
WCAG 2.1 标准：
- 正文文字（<18pt）：对比度 ≥ 4.5:1
- 大文字（≥18pt）：对比度 ≥ 3:1
- 用户界面组件：对比度 ≥ 3:1

工具：
- Colour Contrast Analyser（桌面工具）
- axe DevTools（Web）
- Xcode Accessibility Inspector（iOS）
\`\`\`

**④ 动态字体支持**
\`\`\`swift
// iOS — 支持系统字体大小调整
label.font = UIFont.preferredFont(forTextStyle: .body)
label.adjustsFontForContentSizeCategory = true
\`\`\`

**⑤ 减弱动态效果**
\`\`\`swift
// 尊重"减弱动态效果"设置
if UIAccessibility.isReduceMotionEnabled {
  // 使用简单的淡入淡出替代复杂动画
  UIView.animate(withDuration: 0.1) { view.alpha = 1 }
} else {
  // 完整动画
  performFullAnimation()
}
\`\`\`

**输出**：无障碍审查报告（VoiceOver/TalkBack + 色彩 + 触控 + 字体）`,
    },
    {
      title: '5. 崩溃与 ANR 防护',
      content: `防止主线程阻塞、内存泄漏和崩溃：

**崩溃防护 Checklist**

**① 主线程保护（ANR / 卡顿）**
\`\`\`kotlin
// Android — 严格模式检测主线程 I/O（开发阶段）
if (BuildConfig.DEBUG) {
  StrictMode.setThreadPolicy(
    StrictMode.ThreadPolicy.Builder()
      .detectDiskReads()
      .detectDiskWrites()
      .detectNetwork()
      .penaltyLog()
      .build()
  )
}
\`\`\`

\`\`\`swift
// iOS — 所有耗时操作移到后台线程
// ❌ 在主线程执行网络请求（卡 UI）
let data = try! Data(contentsOf: url)  // 同步，阻塞主线程

// ✅ 后台执行，主线程更新 UI
Task {
  let data = await fetchData(url: url)  // 异步
  await MainActor.run {
    updateUI(data)  // 回主线程
  }
}
\`\`\`

**② 内存泄漏防护**
\`\`\`swift
// iOS — 使用 weak/unowned 避免循环引用
class ViewController: UIViewController {
  var closure: (() -> Void)?

  func setup() {
    // ❌ 强引用循环
    closure = { self.doSomething() }

    // ✅ weak 引用
    closure = { [weak self] in self?.doSomething() }
  }
}

// 使用 Instruments 的 Leaks 模板检测
// Xcode → Product → Profile → Leaks
\`\`\`

**③ 崩溃上报集成**
\`\`\`typescript
// React Native — 集成 Sentry
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  tracesSampleRate: 0.2,
  beforeSend: (event) => {
    // 过滤敏感信息
    delete event.user?.email;
    return event;
  },
});

// 自定义崩溃上下文
Sentry.setContext('order', { orderId, userId });
\`\`\`

**④ 崩溃率基准**
\`\`\`
指标          目标值     警戒线
──────────────────────────────
崩溃率         < 0.1%    > 0.5%
ANR 率         < 0.05%   > 0.2%
内存 OOM 率    < 0.01%   > 0.1%
\`\`\`

**输出**：崩溃防护代码模板 + ANR 检测配置 + 崩溃率监控方案`,
    },
  ],
  outputFormat: '平台合规报告（iOS + Android）+ 性能基准报告 + 离线架构方案 + 无障碍审查报告 + 崩溃防护 Checklist',
  examples: [],
  notes: [
    'App Store 审核可能因隐私声明不完整被拒——提交前必须逐项核对 Info.plist 权限说明',
    '移动端性能优化应以真机测试为准，模拟器结果不具代表性（特别是低端 Android 设备）',
    '无障碍功能不仅是道德责任，在部分国家/地区（如美国 ADA、欧盟 EAA）也是法律要求',
    '崩溃率超过 0.5% 会被 Google Play 标记为"问题应用"，影响商店排名',
    '包大小每增加 10MB 约导致 Android 安装转化率下降 1-2%，务必定期监控',
  ],
  category: '质量侧',
  nextSkill: 'performance',
};
