let allResources = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  initFilterTabs();
  await loadResources();
});

async function loadResources() {
  const statusMsg = document.getElementById('status-msg');
  const batchPanel = document.getElementById('batch-panel');
  const filterTabs = document.getElementById('filter-tabs');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getResources' });
    
    if (response && response.items && response.items.length > 0) {
      allResources = response.items.map((url, i) => {
        const type = getResourceType(url);
        return { 
          id: i, 
          url, 
          name: url.split('/').pop().split('?')[0], 
          type,
          selected: true 
        };
      });
      
      updateCounts();
      statusMsg.textContent = `找到 ${allResources.length} 个资源`;
      batchPanel.style.display = 'flex';
      filterTabs.style.display = 'flex';
      renderResources();
      initEventListeners();
    } else {
      statusMsg.textContent = '未发现任何资源 (请尝试向下滚动页面)';
    }
  } catch (error) {
    console.error('加载资源失败:', error);
    statusMsg.textContent = '错误：无法连接到页面脚本 (请刷新页面)';
  }
}

function getResourceType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'video';
  if (ext === 'svg') return 'svg';
  return 'image'; // 默认归为图片
}

function updateCounts() {
  const counts = { all: allResources.length, image: 0, video: 0, svg: 0 };
  allResources.forEach(r => counts[r.type]++);
  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = counts[key];
  });
}

function initFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderResources();
    });
  });
}

function renderResources() {
  const container = document.getElementById('resource-list');
  container.innerHTML = ''; // 清空内容是安全的
  
  const filtered = currentFilter === 'all' 
    ? allResources 
    : allResources.filter(r => r.type === currentFilter);
  
  if (filtered.length === 0) {
    // 修复 innerHTML 警告：使用安全的 DOM 创建方式
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'text-align:center;color:#999;padding:20px;';
    emptyDiv.textContent = '暂无资源';
    container.appendChild(emptyDiv);
    return;
  }
  
  filtered.forEach(res => {
    const card = document.createElement('div');
    card.className = 'resource-card' + (res.selected ? ' selected' : '');
    
    const checkbox = document.createElement('div');
    checkbox.className = 'checkbox';
    checkbox.textContent = res.selected ? '✅' : '⬜';
    checkbox.onclick = (e) => { 
      e.stopPropagation();
      res.selected = !res.selected; 
      renderResources(); 
    };
    
    const img = document.createElement('img');
    img.src = res.url;
    img.loading = 'lazy';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect fill="%23f0f0f0" width="50" height="50"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23999">无预览</text></svg>';
    };
    
    const info = document.createElement('div');
    info.className = 'resource-info';
    
    // 修复 innerHTML 警告：使用 textContent 替代模板字符串插入
    const nameDiv = document.createElement('div');
    nameDiv.textContent = res.name;
    
    const tagSpan = document.createElement('span');
    tagSpan.className = `format-tag format-${res.type}`;
    tagSpan.textContent = res.type.toUpperCase();
    
    info.appendChild(nameDiv);
    info.appendChild(tagSpan);
    
    card.appendChild(checkbox);
    card.appendChild(img);
    card.appendChild(info);
    container.appendChild(card);
  });
  
  updateBatchButton();
}

function initEventListeners() {
  document.getElementById('btn-select-all').onclick = () => { 
    allResources.forEach(r => r.selected = true); 
    renderResources(); 
  };
  document.getElementById('btn-invert').onclick = () => { 
    allResources.forEach(r => r.selected = !r.selected); 
    renderResources(); 
  };
  document.getElementById('btn-clear').onclick = () => { 
    allResources.forEach(r => r.selected = false); 
    renderResources(); 
  };
  document.getElementById('btn-batch-download').onclick = startBatchDownload;
}

function updateBatchButton() {
  const count = allResources.filter(r => r.selected).length;
  const btn = document.getElementById('btn-batch-download');
  btn.textContent = `批量下载 (${count})`;
  btn.disabled = count === 0;
}

async function startBatchDownload() {
  const selected = allResources.filter(r => r.selected);
  const status = document.getElementById('status-msg');
  const btn = document.getElementById('btn-batch-download');
  
  if (!confirm('⚠️ 版权提醒：请确保您有权下载这些资源。\n\n本工具仅供个人学习与研究使用，请勿用于商业用途或侵犯他人版权。\n\n是否继续下载？')) {
    return;
  }
  
  btn.disabled = true;
  
  try {
    if (typeof JSZip === 'undefined') {
      alert('错误：JSZip 库未加载，请确保 jszip.min.js 文件存在');
      btn.disabled = false;
      return;
    }
    
    const zip = new JSZip();
    let zipHasFiles = false; // 记录压缩包里是否有文件
    
    for (let i = 0; i < selected.length; i++) {
      status.textContent = `正在处理资源 (${i + 1}/${selected.length})...`;
      const resObj = selected[i];
      
      // 优化1：安全的命名规则，过滤掉系统不允许的特殊字符
      let safeName = resObj.name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
      if (!safeName || safeName.trim() === '') {
        safeName = `unnamed_resource.${resObj.type}`; // 兜底命名
      }
      // 优化2：加上序号前缀，绝对防止重名文件互相覆盖
      const finalName = `${i + 1}_${safeName}`;
      
      // 优化3：视频文件（MP4等）直接调用浏览器底层下载，防止内存撑爆
      if (resObj.type === 'video') {
        chrome.runtime.sendMessage({
          action: 'download',
          url: resObj.url,
          filename: `OmniFetch_Videos/${finalName}` // 会在浏览器的下载目录建一个文件夹
        });
      } else {
        // 图片和 SVG 走原本的 ZIP 打包流程
        try {
          const res = await fetch(resObj.url);
          const blob = await res.blob();
          zip.file(finalName, blob);
          zipHasFiles = true;
        } catch (err) {
          console.warn(`跳过失败资源 ${resObj.url}:`, err);
        }
      }
    }
    
    // 如果打包了图片/SVG，才生成 ZIP 下载
    if (zipHasFiles) {
      status.textContent = '正在打包图片压缩包...';
      const content = await zip.generateAsync({ type: 'blob' });
      const now = new Date();
      const timeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OmniFetch_Images_${timeStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    status.textContent = '✅ 处理完成！(视频已直接下载，图片已打包)';
    setTimeout(() => { 
      status.textContent = `已找到 ${allResources.length} 个资源`; 
    }, 4000);
  } catch (e) {
    console.error('下载失败:', e);
    alert('下载失败：' + e.message);
    status.textContent = '❌ 下载失败';
  } finally {
    btn.disabled = false;
  }
}
