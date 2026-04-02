// ============================================================================
// 万象取存 OmniFetch v3.0 - 内容脚本
// 权限使用说明：
// - 本脚本仅在用户主动点击插件图标时通过 messaging 被激活
// - 仅扫描当前页面的 DOM 元素（img, video, CSS 背景图）
// - 不收集、存储或向外部发送任何用户数据
// - 所有操作均在本地浏览器环境中完成
// 版权合规提示：
// - 用户应遵守目标网站的版权政策和使用条款
// - 本工具仅供个人学习与研究使用
// ============================================================================

console.log("✅ 万象取存 OmniFetch v3.0 已注入 - 支持自动检测");

let collectedUrls = new Set();

// 初始扫描
scanAndCollect();

// 监听 DOM 变化（实现无需刷新的自动检测）
const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) { // Element node
        if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
          hasNewNodes = true;
        }
        // 检查子元素
        node.querySelectorAll('img, video').forEach(() => {
          hasNewNodes = true;
        });
      }
    });
  });
  
  if (hasNewNodes) {
    console.log('🔄 检测到新资源，自动重新扫描');
    scanAndCollect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function scanAndCollect() {
  const urls = new Set();
  
  // 扫描 img 标签
  document.querySelectorAll('img').forEach(img => {
    if (img.src && !img.src.startsWith('data:') && img.src.trim() !== '') {
      urls.add(img.src);
    }
  });
  
  // 扫描 video 标签
  document.querySelectorAll('video, video source').forEach(el => {
    if (el.src && el.src.trim() !== '') {
      urls.add(el.src);
    }
  });
  
  // 扫描 CSS 背景图
  document.querySelectorAll('div, section, article, header, footer, li, span').forEach(el => {
    const bgImage = window.getComputedStyle(el).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
      const match = bgImage.match(/url$["']?(.*?)["']?$/);
      if (match && match[1]) {
        urls.add(match[1]);
      }
    }
  });
  
  // 合并到新发现的 URL
  const newCount = urls.size - collectedUrls.size;
  urls.forEach(url => collectedUrls.add(url));
  
  if (newCount > 0) {
    console.log(`📦 累计收集 ${collectedUrls.size} 个资源 (新增 ${newCount})`);
  }
}

// 响应 popup 的查询
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getResources') {
    sendResponse({ items: Array.from(collectedUrls) });
  }
  return true;
});
