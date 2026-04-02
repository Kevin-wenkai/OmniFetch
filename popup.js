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
  container.innerHTML = '';
  
  const filtered = currentFilter === 'all' 
    ? allResources 
    : allResources.filter(r => r.type === currentFilter);
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无资源</div>';
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
    info.innerHTML = `
      <div>${res.name}</div>
      <span class="format-tag format-${res.type}">${res.type.toUpperCase()}</span>
    `;
    
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
  
  // ⚠️ 版权合规提示
  if (!confirm('⚠️ 版权提醒：请确保您有权下载这些资源。\n\n本工具仅供个人学习与研究使用，请勿用于商业用途或侵犯他人版权。\n\n是否继续下载？')) {
    btn.disabled = false;
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
    for (let i = 0; i < selected.length; i++) {
      status.textContent = `正在获取资源 (${i + 1}/${selected.length})...`;
      try {
        const res = await fetch(selected[i].url);
        const blob = await res.blob();
        const safeName = selected[i].name.replace(/[^a-z0-9.]/gi, '_').substring(0, 50);
        zip.file(safeName, blob);
      } catch (err) {
        console.warn(`跳过失败资源 ${selected[i].url}:`, err);
      }
    }
    
    status.textContent = '正在打包压缩...';
    const content = await zip.generateAsync({ type: 'blob' });
    const now = new Date();
    const timeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniFetch_${timeStr}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    status.textContent = '✅ 打包下载完成！';
    setTimeout(() => { 
      status.textContent = `已找到 ${allResources.length} 个资源`; 
    }, 3000);
  } catch (e) {
    console.error('下载失败:', e);
    alert('下载失败：' + e.message);
    status.textContent = '❌ 下载失败';
  } finally {
    btn.disabled = false;
  }
}
