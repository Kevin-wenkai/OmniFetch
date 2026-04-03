// ============================================================================
// 万象取存 OmniFetch v3.0 - 内容脚本
// ============================================================================

console.log("✅ 万象取存 OmniFetch v3.0 已注入 - 支持自动检测");

let collectedUrls = new Set();

// 核心扫描函数
function scanAndCollect() {
  let urls = new Set();
  
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
      const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
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

// 初始扫描
scanAndCollect();

// 监听 DOM 变化（加入防抖机制，解决网页卡顿问题）
let scanTimeout = null;
const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      hasNewNodes = true;
    }
  });
  
  if (hasNewNodes) {
    // 如果之前有等待的扫描任务，先取消掉
    if (scanTimeout) clearTimeout(scanTimeout);
    // 延迟 800 毫秒后再执行扫描，极大节省电脑性能
    scanTimeout = setTimeout(() => {
      console.log('🔄 检测到新资源，自动重新扫描');
      scanAndCollect();
    }, 800);
  }
});

observer.observe(document.body, { childList: true, subtree: true });  

// 响应 popup 的查询
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getResources') {
    sendResponse({ items: Array.from(collectedUrls) });
  }
  return true;
});
