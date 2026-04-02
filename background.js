// ============================================================================
// 万象取存 OmniFetch v3.0 - 后台服务 Worker
// 权限使用说明：
// - downloads: 调用浏览器原生下载 API 保存文件，不记录下载历史
// - 不收集、存储或向外部发送任何用户数据
// - 所有操作均在本地浏览器环境中完成
// 数据保护声明：
// - 本插件符合 GDPR 和 Edge 商店隐私政策要求
// - 不追踪用户行为，不上传浏览数据
// ============================================================================

console.log("背景服务已启动");

// 监听来自 popup 或 content-script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("收到消息:", request);

  if (request.action === 'download') {
    // 处理下载请求（调用浏览器原生 API）
    chrome.downloads.download({
      url: request.url,
      filename: request.filename || 'downloaded_file',
      saveAs: false
    }, (downloadId) => {
      console.log("开始下载:", downloadId);
    });
    return true; // 保持消息通道开放
  }

  if (request.action === 'getResources') {
    // 如果需要后台协助获取资源，可在此处理
    sendResponse({ items: [] });
    return true;
  }
});

// 监听插件安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("万象取存 OmniFetch 已安装/更新");
  // 可选：首次安装时显示欢迎页面
  // chrome.tabs.create({ url: "welcome.html" });
});
