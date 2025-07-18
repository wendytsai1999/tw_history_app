// filter.js - 修正版樹狀篩選器管理模組

// ========================================
// 樹狀篩選器管理類別
// ========================================

class TreeFilterManager {
  constructor() {
    // 依賴注入
    this._stateManager = null;
    this._utils = null;
    this._searchManager = null;
    
    // 效能優化快取
    this._cache = new Map();
    this._maxCacheSize = 50;
    
    // 收闔狀態管理 - 修正版
    this._collapseState = {
      titleTree: new Map(),
      keywordTrees: new Map(),
      columnTree: new Map()
    };
    
    // 展開狀態管理
    this._expandState = {
      titleShowAll: new Map(),
      keywordShowAll: new Map(),
      columnShowAll: new Map()
    };
    
    // 事件處理器
    this._eventHandlers = new Map();
    this._eventsBound = false;
    
    // 彈出式視窗管理 - 改進版
    this._modalManager = new ModalManager();
  }

  // 初始化
  init(stateManager, utils, searchManager = null) {
    this._stateManager = stateManager;
    this._utils = utils;
    this._searchManager = searchManager;
    
    console.log('[TreeFilterManager] 初始化');
    this.clearCache();
    this._bindGlobalEvents();
  }

  // ========================================
  // 私有方法 - 資料處理
  // ========================================

  _buildTitleTreeData(availableData) {
    const cacheKey = `title_${availableData.length}_${this._generateDataHash(availableData)}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const majorMap = new Map();
    
    availableData.forEach(item => {
      if (!item?.標題大分類) return;
      
      const major = item.標題大分類;
      let mid = item.標題中分類;
      const itemId = item.資料編號;
      
      if (!majorMap.has(major)) {
        majorMap.set(major, {
          name: major,
          count: 0,
          itemIds: new Set(),
          children: new Map()
        });
      }
      
      const majorNode = majorMap.get(major);
      if (itemId && !majorNode.itemIds.has(itemId)) {
        majorNode.itemIds.add(itemId);
        majorNode.count++;
      }
      
      if (mid) {
        mid = String(mid).trim();
        if (!majorNode.children.has(mid)) {
          majorNode.children.set(mid, {
            name: mid,
            count: 0,
            itemIds: new Set()
          });
        }
        const midNode = majorNode.children.get(mid);
        if (itemId && !midNode.itemIds.has(itemId)) {
          midNode.itemIds.add(itemId);
          midNode.count++;
        }
      }
    });
    
    const result = Array.from(majorMap.values())
      .map(major => ({
        name: major.name,
        count: major.count,
        children: Array.from(major.children.values())
          .map(mid => ({
            name: mid.name,
            count: mid.count
          }))
          .sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => b.count - a.count);
    
    this._setCache(cacheKey, result);
    return result;
  }

  _buildKeywordTreesByMajor(availableData, availableMajors) {
    const cacheKey = `keyword_${availableData.length}_${availableMajors.join(',')}_${this._generateDataHash(availableData)}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const result = [];
    
    availableMajors.forEach(majorCategory => {
      if (!majorCategory) return;
      
      const midMap = new Map();
      let majorOccurrenceCount = 0;
      
      availableData.forEach(item => {
        if (!item?.關鍵詞列表?.length) return;
        
        item.關鍵詞列表.forEach(kw => {
          if (!kw || kw.大分類 !== majorCategory) return;
          
          majorOccurrenceCount++;
          
          const mid = kw.中分類;
          const minor = kw.小分類;
          
          if (!mid) return;
          
          if (!midMap.has(mid)) {
            midMap.set(mid, {
              name: mid,
              count: 0,
              children: new Map()
            });
          }
          
          const midNode = midMap.get(mid);
          midNode.count++;
          
          if (minor) {
            if (!midNode.children.has(minor)) {
              midNode.children.set(minor, {
                name: minor,
                count: 0
              });
            }
            
            midNode.children.get(minor).count++;
          }
        });
      });
      
      if (midMap.size > 0 && majorOccurrenceCount > 0) {
        result.push({
          majorCategory: majorCategory,
          totalCount: majorOccurrenceCount,
          midCategories: Array.from(midMap.values())
            .filter(mid => mid.count > 0)
            .map(mid => ({
              name: mid.name,
              count: mid.count,
              children: Array.from(mid.children.values())
                .filter(minor => minor.count > 0)
                .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.count - a.count)
        });
      }
    });
    
    this._setCache(cacheKey, result);
    return result;
  }

  _buildColumnTreeData(availableData) {
    const cacheKey = `column_${availableData.length}_${this._generateDataHash(availableData)}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const rootMap = new Map();
    
    availableData.forEach(item => {
      const l1 = item['分類(一)'] || '';
      const l2 = item['分類(二)'] || '';
      const l3 = item['分類(三)'] || '';
      const category = item['分類'] || '';
      
      if (!l1 || !category) return;
      
      const path = [l1];
      if (l2) path.push(l2);
      if (l3) path.push(l3);
      path.push(category);
      
      let currentLevel = rootMap;
      for (let i = 0; i < path.length; i++) {
        const nodeName = path[i];
        const isLastLevel = (i === path.length - 1);
        
        if (!currentLevel.has(nodeName)) {
          currentLevel.set(nodeName, {
            name: nodeName,
            count: 0,
            children: isLastLevel ? null : new Map(),
            level: isLastLevel ? 'category' : `level${i + 1}`,
            selectable: isLastLevel,
            pathDepth: i + 1,
            totalDepth: path.length
          });
        }
        
        const node = currentLevel.get(nodeName);
        node.count++;
        
        if (!isLastLevel) {
          currentLevel = node.children;
        }
      }
    });

    const buildHierarchy = (nodeMap) => {
      if (!nodeMap || nodeMap.size === 0) return [];
      
      return Array.from(nodeMap.values())
        .map(node => ({
          name: node.name,
          count: node.count,
          level: node.level,
          selectable: node.selectable || false,
          pathDepth: node.pathDepth,
          totalDepth: node.totalDepth,
          children: node.children ? buildHierarchy(node.children) : []
        }))
        .filter(node => node.count > 0)
        .sort((a, b) => b.count - a.count);
    };

    const result = buildHierarchy(rootMap);
    this._setCache(cacheKey, result);
    return result;
  }

  // ========================================
  // 私有方法 - UI 生成
  // ========================================

  _createTitleTreeNode(data, level, parentMajor = null, nodeIndex = 0, majorName = '') {
    const isSelected = this._checkTitleNodeSelected(data, level, parentMajor);
    const isDisabled = data.count === 0;
    const nodeId = `title-${level}-${data.name}`;
    
    // 小分類預設收合
    const isCollapsed = level === 2 ? 
      (this._collapseState.titleTree.get(nodeId) !== undefined ? 
        this._collapseState.titleTree.get(nodeId) : true) :
      (this._collapseState.titleTree.get(nodeId) || false);
    
    const hasChildren = data.children && data.children.length > 0;
    
    // 中分類顯示邏輯
    const showAllKey = `title-${majorName}`;
    const showAll = this._expandState.titleShowAll.get(showAllKey) || false;
    const shouldShow = nodeIndex < 5 || showAll;
    
    if (level === 2 && !shouldShow) {
      return '';
    }
    
    const highlightClass = isSelected ? 'filter-highlight' : '';
    
    const radioBtn = `<input type="radio" name="title-${level}" class="title-radio" 
                         ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                         value="${data.name}" data-level="${level}" data-parent="${parentMajor || ''}">`;
    
    const toggleBtn = hasChildren ? 
      `<span class="tree-toggle" data-node-id="${nodeId}">${isCollapsed ? '+' : '−'}</span>` : 
      `<span class="tree-toggle-placeholder"></span>`;
    
    let html = `
      <div class="tree-node tree-level-${level}" data-node-id="${nodeId}">
        <div class="tree-node-header ${highlightClass} ${isDisabled ? 'disabled' : ''}">
          <div class="tree-node-label">
            ${toggleBtn}
            <label class="title-label-container">
              ${radioBtn}
              <span class="title-text">${data.name}</span>
            </label>
            <span class="tree-node-count ${data.count === 0 ? 'zero' : ''}">${data.count}</span>
          </div>
        </div>
    `;
    
    if (hasChildren) {
      html += `<div class="tree-node-content" style="display: ${isCollapsed ? 'none' : 'block'};">`;
      data.children.forEach((child, index) => {
        html += this._createTitleTreeNode(child, level + 1, data.name, index, majorName);
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  _createKeywordTreeNode(data, level, majorCategory, parentKey = '', nodeIndex = 0) {
    const isSelected = this._checkKeywordNodeSelected(data, level, majorCategory, parentKey);
    const isDisabled = data.count === 0;
    const nodeId = `keyword-${majorCategory}-${level}-${data.name}`;
    
    // 小分類預設收合
    const isCollapsed = level === 1 ? 
      (this._collapseState.keywordTrees.get(nodeId) !== undefined ? 
        this._collapseState.keywordTrees.get(nodeId) : true) :
      (this._collapseState.keywordTrees.get(nodeId) || false);
    
    const hasChildren = data.children && data.children.length > 0;
    
    // 中分類顯示邏輯
    const showAllKey = `keyword-${majorCategory}`;
    const showAll = this._expandState.keywordShowAll.get(showAllKey) || false;
    const shouldShow = level !== 1 || nodeIndex < 5 || showAll;
    
    if (level === 1 && !shouldShow) {
      return '';
    }
    
    const highlightClass = isSelected ? 'filter-highlight' : '';
    
    const toggleBtn = hasChildren ? 
      `<span class="tree-toggle" data-node-id="${nodeId}">${isCollapsed ? '+' : '−'}</span>` : 
      `<span class="tree-toggle-placeholder"></span>`;

    let html = `
      <div class="tree-node tree-level-${level}" data-node-id="${nodeId}">
        <div class="tree-node-header ${highlightClass} ${isDisabled ? 'disabled' : ''}">
          <div class="tree-node-label">
            ${toggleBtn}
            <label class="keyword-label-container">
              <input type="checkbox" class="keyword-checkbox" 
                     data-major="${majorCategory}" data-mid="${parentKey}" data-minor="${data.name}"
                     ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
              <span class="keyword-text">${data.name}</span>
            </label>
            <span class="tree-node-count ${data.count === 0 ? 'zero' : ''}">${data.count}</span>
          </div>
        </div>
    `;

    if (hasChildren) {
      html += `<div class="tree-node-content" style="display: ${isCollapsed ? 'none' : 'block'};">`;
      data.children.forEach((child, index) => {
        html += this._createKeywordTreeNode(child, level + 1, majorCategory, data.name, index);
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

// 修正版：創建欄目樹節點生成，增強層級縮排和視覺差異
  _createColumnTreeNode(data, majorName = '', depth = 0) {
    if (!data || data.count === 0) return '';

    const hasChildren = data.children && data.children.length > 0;
    const nodeId = `column-${data.level}-${data.name}`;
    const isCollapsed = this._collapseState.columnTree.get(nodeId) || false;
    const isSelected = this._checkColumnNodeSelected(data);
    const highlightClass = isSelected ? 'filter-highlight' : '';
    const isDisabled = data.count === 0;

    let html = '';

    if (data.selectable && data.level === 'category') {
      const radioBtn = `<input type="radio" name="column-category" class="tree-radio" 
                              value="${data.name}" data-level="category" 
                              ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>`;
      html += `
        <div class="tree-node tree-level-category column-depth-${depth}" data-node-id="${nodeId}">
          <div class="tree-node-header ${highlightClass} ${isDisabled ? 'disabled' : ''}">
            <div class="tree-node-label">
              <span class="tree-toggle-placeholder"></span>
              <label class="title-label-container">
                ${radioBtn}
                <span class="title-text">${data.name}</span>
              </label>
              <span class="tree-node-count ${data.count === 0 ? 'zero' : ''}">${data.count}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      const toggleBtn = hasChildren ? 
        `<span class="tree-toggle" data-node-id="${nodeId}">${isCollapsed ? '+' : '−'}</span>` : 
        `<span class="tree-toggle-placeholder"></span>`;

      html += `
        <div class="tree-node tree-level-${data.level} column-depth-${depth}" data-node-id="${nodeId}">
          <div class="tree-node-header ${highlightClass} ${isDisabled ? 'disabled' : ''}">
            <div class="tree-node-label">
              ${toggleBtn}
              <span class="title-text">${data.name}</span>
              <span class="tree-node-count ${data.count === 0 ? 'zero' : ''}">${data.count}</span>
            </div>
          </div>
      `;
      
      if (hasChildren) {
        const showAllKey = `column-${majorName || data.name}`;
        const showAll = this._expandState.columnShowAll.get(showAllKey) || false;
        
        let childrenToShow = data.children;
        let showAllBtn = '';
        
        if (data.children.length > 5) {
          childrenToShow = showAll ? data.children : data.children.slice(0, 5);
          showAllBtn = `
            <div class="show-all-container">
              <button class="show-all-btn" data-category="${majorName || data.name}" data-type="column">
                ${showAll ? `收合 (${data.children.length - 5})` : `顯示全部 (${data.children.length - 5})`}
              </button>
            </div>
          `;
        }
        
        html += `
          <div class="tree-node-content" style="display: ${isCollapsed ? 'none' : 'block'};">
            ${childrenToShow.map(child => this._createColumnTreeNode(child, majorName || data.name, depth + 1)).join('')}
            ${showAllBtn}
          </div>
        `;
      }
      html += '</div>';
    }
    return html;
  }

  // ========================================
  // 私有方法 - 狀態檢查
  // ========================================

  _checkTitleNodeSelected(data, level, parentMajor) {
    if (!this._stateManager) return false;
    
    const filters = this._stateManager.get('filters') || {};
    const titleFilter = filters.title || {};
    
    if (level === 1) {
      return titleFilter.type === 'major' && titleFilter.value === data.name;
    } else if (level === 2) {
      return titleFilter.type === 'mid' && titleFilter.value === data.name && titleFilter.major === parentMajor;
    }
    
    return false;
  }

  _checkKeywordNodeSelected(data, level, majorCategory, parentKey) {
    if (!this._stateManager) return false;
    
    const filters = this._stateManager.get('filters') || {};
    const keywordFilters = filters.keyword || {};
    const selections = keywordFilters.userSelected?.selections || [];
    
    if (level === 1) {
      return selections.some(selection => 
        selection.major === majorCategory && 
        selection.type === 'mid' && 
        selection.value === data.name
      );
    } else if (level === 2) {
      return selections.some(selection => 
        selection.major === majorCategory && 
        selection.type === 'minor' && 
        selection.mid === parentKey && 
        selection.value === data.name
      );
    }
    
    return false;
  }

  _checkColumnNodeSelected(data) {
    if (!this._stateManager || data.level !== 'category') return false;
    
    const filters = this._stateManager.get('filters') || {};
    const categoryFilter = filters.category || {};
    
    return categoryFilter.level === 'category' && categoryFilter.value === data.name;
  }

  // ========================================
  // 私有方法 - 事件處理（修正版）
  // ========================================

  _bindGlobalEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    
    // 收合切換事件
    this._eventHandlers.set('toggle', (event) => {
      const toggleBtn = event.target.closest('.tree-toggle');
      if (!toggleBtn) return;
      
      const nodeId = toggleBtn.dataset.nodeId;
      if (nodeId) {
        this._toggleTreeNode(nodeId);
      }
    });

    // 顯示全部切換事件 - 修正為彈出式視窗
    this._eventHandlers.set('showAll', (event) => {
      const showAllBtn = event.target.closest('.show-all-btn');
      if (!showAllBtn) return;
      
      const categoryName = showAllBtn.dataset.category;
      const type = showAllBtn.dataset.type;
      if (categoryName) {
        this._showModalForCategory(type, categoryName);
      }
    });

    // 綁定事件到 document（事件委派）
    document.addEventListener('click', (event) => {
      this._eventHandlers.get('toggle')?.(event);
      this._eventHandlers.get('showAll')?.(event);
    });
  }

  // 修正版：樹節點收展切換
  _toggleTreeNode(nodeId) {
    console.log('[TreeFilterManager] 切換節點收闔狀態:', nodeId);
    
    let targetMap;
    
    // 修正收展功能的判斷邏輯
    if (nodeId.startsWith('keyword-')) {
      targetMap = this._collapseState.keywordTrees;
    } else if (nodeId.startsWith('column-')) {
      targetMap = this._collapseState.columnTree;
    } else if (nodeId.startsWith('title-')) {
      targetMap = this._collapseState.titleTree;
    } else if (nodeId.startsWith('major-')) {
      // 處理主要分類的切換
      if (nodeId.includes('keyword') || document.querySelector(`[data-node-id="${nodeId}"]`)?.closest('.keyword-major-block')) {
        targetMap = this._collapseState.keywordTrees;
      } else if (nodeId.includes('column') || document.querySelector(`[data-node-id="${nodeId}"]`)?.closest('.column-major-block')) {
        targetMap = this._collapseState.columnTree;
      } else {
        targetMap = this._collapseState.titleTree;
      }
    }
    
    if (!targetMap) return;
    
    const isCollapsed = targetMap.get(nodeId) || false;
    const newState = !isCollapsed;
    targetMap.set(nodeId, newState);
    
    // 立即更新UI - 修正版
    this._updateNodeUI(nodeId, newState);
  }

  // 修正版：節點UI更新
  _updateNodeUI(nodeId, isCollapsed) {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const contentElement = nodeElement.querySelector('.tree-node-content, .title-major-content, .keyword-major-content, .column-major-content');
    const toggleElement = nodeElement.querySelector('.tree-toggle');
    
    if (contentElement && toggleElement) {
      // 修正：確保內容完全隱藏或顯示
      if (isCollapsed) {
        contentElement.style.display = 'none';
        contentElement.style.height = '0';
        contentElement.style.overflow = 'hidden';
      } else {
        contentElement.style.display = 'block';
        contentElement.style.height = 'auto';
        contentElement.style.overflow = 'visible';
      }
      
      toggleElement.textContent = isCollapsed ? '+' : '−';
    }
    
    // 為主要分類添加收合樣式
    if (nodeId.startsWith('major-')) {
      const blockElement = nodeElement.closest('.title-major-block, .keyword-major-block, .column-major-block');
      if (blockElement) {
        if (isCollapsed) {
          blockElement.classList.add('collapsed');
        } else {
          blockElement.classList.remove('collapsed');
        }
      }
    }
  }

  // ========================================
  // 彈出式視窗功能（改進版）
  // ========================================

  _showModalForCategory(type, categoryName) {
    let data = [];
    let title = '';
    
    switch (type) {
      case 'title':
        const availableData = this._stateManager.getAvailableData('title');
        const treeData = this._buildTitleTreeData(availableData);
        data = treeData.find(item => item.name === categoryName);
        title = `題名分類：${categoryName}`;
        break;
      case 'keyword':
        const kwData = this._stateManager.getAvailableData('keyword');
        const availableMajors = [...new Set(kwData.flatMap(item => 
          item.關鍵詞列表?.map(kw => kw.大分類).filter(Boolean) || []
        ))];
        const kwTreeData = this._buildKeywordTreesByMajor(kwData, availableMajors);
        data = kwTreeData.find(item => item.majorCategory === categoryName);
        title = `關鍵詞分類：${categoryName}`;
        break;
      case 'column':
        const colData = this._stateManager.getAvailableData('category');
        const colTreeData = this._buildColumnTreeData(colData);
        data = colTreeData.find(item => item.name === categoryName);
        title = `欄目分類：${categoryName}`;
        break;
    }
    
    if (data) {
      this._modalManager.showModal(title, data, type, categoryName, this);
    }
  }

  // ========================================
  // 公開方法
  // ========================================

  updateTitleTree() {
    if (!this._stateManager || !this._utils) return;
    
    const container = this._utils.$('title-tree-container');
    if (!container) return;

    const availableData = this._stateManager.getAvailableData('title');
    
    if (!Array.isArray(availableData) || availableData.length === 0) {
      container.innerHTML = '<div class="tree-empty">無可用分類</div>';
      return;
    }

    try {
      const treeData = this._buildTitleTreeData(availableData);
      
      if (treeData.length === 0) {
        container.innerHTML = '<div class="tree-empty">無可用分類</div>';
        return;
      }

      let html = '';
      treeData.forEach(major => {
        html += this._createTitleTreeBlock(major);
      });

      container.innerHTML = html;
      this._bindTitleEvents(container);

      console.log('[TreeFilterManager] 標題樹更新完成');
    } catch (error) {
      console.error('[TreeFilterManager] 更新標題樹時發生錯誤:', error);
      container.innerHTML = '<div class="tree-error">標題樹載入失敗</div>';
    }
  }

  updateKeywordTrees() {
    if (!this._stateManager || !this._utils) return;
    
    const container = this._utils.$('keyword-trees-container');
    if (!container) return;

    const availableData = this._stateManager.getAvailableData('keyword');
    
    if (!Array.isArray(availableData) || availableData.length === 0) {
      container.innerHTML = '<div class="tree-empty">無可用關鍵詞</div>';
      return;
    }

    try {
      const availableMajors = [...new Set(availableData.flatMap(item => 
        item.關鍵詞列表?.map(kw => kw.大分類).filter(Boolean) || []
      ))];
      
      const treesData = this._buildKeywordTreesByMajor(availableData, availableMajors);
      
      if (treesData.length === 0) {
        container.innerHTML = '<div class="tree-empty">無可用關鍵詞</div>';
        return;
      }

      let html = '';
      treesData.forEach(tree => {
        html += this._createKeywordTreeBlock(tree);
      });

      container.innerHTML = html;
      this._bindKeywordEvents(container);

      console.log('[TreeFilterManager] 關鍵詞樹更新完成');
    } catch (error) {
      console.error('[TreeFilterManager] 更新關鍵詞樹時發生錯誤:', error);
      container.innerHTML = '<div class="tree-error">關鍵詞樹載入失敗</div>';
    }
  }

  // 修正版：更新欄目樹，改進樣式
  updateColumnTree() {
    if (!this._stateManager || !this._utils) return;
    
    const container = this._utils.$('column-tree-container');
    if (!container) return;

    const availableData = this._stateManager.getAvailableData('category');
    const treeData = this._buildColumnTreeData(availableData);
    
    if (treeData.length === 0) {
      container.innerHTML = '<div class="tree-empty">無可用欄目</div>';
      return;
    }

    let html = '';
    treeData.forEach(item => {
      html += this._createColumnTreeBlock(item);
    });

    container.innerHTML = html;
    this._bindColumnEvents(container);

    console.log('[TreeFilterManager] 欄目樹更新完成');
  }

  _createTitleTreeBlock(data) {
    const isCollapsed = this._collapseState.titleTree.get(`major-${data.name}`) || false;
    const isSelected = this._stateManager.get('filters.title.type') === 'major' && 
                      this._stateManager.get('filters.title.value') === data.name;
    const highlightClass = isSelected ? 'filter-highlight' : '';
    
    const radioBtn = `<input type="radio" name="title-1" class="title-radio" 
                            value="${data.name}" data-level="1" data-parent="" ${isSelected ? 'checked' : ''}>`;

    const totalCount = data.children.length;
    const showAllBtn = totalCount > 5 ? `
      <div class="show-all-container">
        <button class="show-all-btn" data-category="${data.name}" data-type="title">
          顯示全部 (共 ${totalCount} 個)
        </button>
      </div>
    ` : '';

    return `
      <div class="title-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="title-major-header ${highlightClass}">
          <span class="tree-toggle" data-node-id="major-${data.name}">${isCollapsed ? '+' : '−'}</span>
          <label class="title-label-container">${radioBtn}<span class="title-major-title">${data.name}</span></label>
          <span class="title-major-count">(${data.count})</span>
        </div>
        <div class="title-major-content" style="display: ${isCollapsed ? 'none' : 'block'};">
          ${data.children.slice(0, 5).map((child, index) => this._createTitleTreeNode(child, 2, data.name, index, data.name)).join('')}
          ${showAllBtn}
        </div>
      </div>
    `;
  }

  _createKeywordTreeBlock(tree) {
    const isCollapsed = this._collapseState.keywordTrees.get(`major-${tree.majorCategory}`) || false;

    const totalCount = tree.midCategories.length;
    const showAllBtn = totalCount > 5 ? `
      <div class="show-all-container">
        <button class="show-all-btn" data-category="${tree.majorCategory}" data-type="keyword">
          顯示全部 (共 ${totalCount} 個)
        </button>
      </div>
    ` : '';

    return `
      <div class="keyword-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="keyword-major-header">
          <span class="tree-toggle" data-node-id="major-${tree.majorCategory}">${isCollapsed ? '+' : '−'}</span>
          <span class="keyword-major-title">${tree.majorCategory}</span>
          <span class="keyword-major-count">(${tree.totalCount})</span>
        </div>
        <div class="keyword-major-content" style="display: ${isCollapsed ? 'none' : 'block'};">
          ${tree.midCategories.slice(0, 5).map((mid, index) => this._createKeywordTreeNode(mid, 1, tree.majorCategory, '', index)).join('')}
          ${showAllBtn}
        </div>
      </div>
    `;
  }

  // 修正版：創建欄目樹區塊，與關鍵詞、題名風格一致
  _createColumnTreeBlock(data) {
    const isCollapsed = this._collapseState.columnTree.get(`major-${data.name}`) || false;

    const totalCount = data.children.length;
    const showAllBtn = totalCount > 5 ? `
      <div class="show-all-container">
        <button class="show-all-btn" data-category="${data.name}" data-type="column">
          顯示全部 (共 ${totalCount} 個)
        </button>
      </div>
    ` : '';

    return `
      <div class="column-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="column-major-header">
          <span class="tree-toggle" data-node-id="major-${data.name}">${isCollapsed ? '+' : '−'}</span>
          <span class="column-major-title">${data.name}</span>
          <span class="column-major-count">(${data.count})</span>
        </div>
        <div class="column-major-content" style="display: ${isCollapsed ? 'none' : 'block'};">
          ${data.children.slice(0, 5).map(child => this._createColumnTreeNode(child, data.name)).join('')}
          ${showAllBtn}
        </div>
      </div>
    `;
  }

  _bindTitleEvents(container) {
    container.querySelectorAll('.title-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked && this._stateManager.setTitleFilter) {
          const level = parseInt(radio.dataset.level);
          const value = radio.value;
          const parent = radio.dataset.parent;
          
          console.log('[TreeFilterManager] 標題篩選變更:', { level, value, parent });
          this._stateManager.setTitleFilter(level, value, parent || null);
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('stateChange'));
          }, 0);
        }
      });
    });
  }

  _bindKeywordEvents(container) {
    container.querySelectorAll('.keyword-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (this._stateManager.toggleKeywordSelection) {
          const major = checkbox.dataset.major;
          const mid = checkbox.dataset.mid;
          const minor = checkbox.dataset.minor;
          
          let selection;
          if (mid && minor) {
            selection = {
              major: major,
              type: 'minor',
              mid: mid,
              value: minor
            };
          } else {
            selection = {
              major: major,
              type: 'mid',
              value: minor
            };
          }
          
          console.log('[TreeFilterManager] 關鍵詞篩選變更:', selection);
          this._stateManager.toggleKeywordSelection(selection);
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('stateChange'));
          }, 0);
        }
      });
    });
  }

  _bindColumnEvents(container) {
    container.querySelectorAll('.tree-radio[data-level="category"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked && this._stateManager.setCategoryFilter) {
          const level = 'category';
          const value = radio.value;
          const parent = radio.dataset.parent;
          
          console.log('[TreeFilterManager] 欄目篩選變更:', { level, value, parent });
          this._stateManager.setCategoryFilter(level, value, parent);
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('stateChange'));
          }, 0);
        }
      });
    });
  }

  updateAllTrees() {
    console.log('[TreeFilterManager] updateAllTrees 被調用');
    
    try {
      this.updateTitleTree();
      this.updateKeywordTrees();
      this.updateColumnTree();
      
      console.log('[TreeFilterManager] 所有樹更新完成');
    } catch (error) {
      console.error('[TreeFilterManager] 更新樹時發生錯誤:', error);
    }
  }

  forceUpdate() {
    this.clearCache();
    this.updateAllTrees();
  }

  clearCache() {
    this._cache.clear();
  }

  resetCollapseState() {
    this._collapseState.titleTree.clear();
    this._collapseState.keywordTrees.clear();
    this._collapseState.columnTree.clear();
    this._expandState.titleShowAll.clear();
    this._expandState.keywordShowAll.clear();
    this._expandState.columnShowAll.clear();
  }

  getCacheStats() {
    return {
      size: this._cache.size,
      maxSize: this._maxCacheSize
    };
  }

  // ========================================
  // 私有方法 - 工具函數
  // ========================================

  _generateDataHash(data) {
    return JSON.stringify(data.slice(0, 3).map(i => i.資料編號)).substring(0, 20);
  }

  _setCache(key, value) {
    if (this._cache.size >= this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }
}

// ========================================
// 彈出式視窗管理器（改進版）
// ========================================

class ModalManager {
  constructor() {
    this.currentModal = null;
  }

  showModal(title, data, type, categoryName, treeManager) {
    this.closeModal(); // 關閉現有的視窗
    
    const modalHtml = this._createModalHtml(title, data, type, categoryName, treeManager);
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    this.currentModal = document.getElementById('category-modal');
    this._bindModalEvents(treeManager);
    
    // 顯示動畫
    setTimeout(() => {
      if (this.currentModal) {
        this.currentModal.classList.add('show');
      }
    }, 10);
  }

  _createModalHtml(title, data, type, categoryName, treeManager) {
    let contentHtml = '';
    
    switch (type) {
      case 'title':
        contentHtml = this._createTitleModalContent(data, treeManager);
        break;
      case 'keyword':
        contentHtml = this._createKeywordModalContent(data, treeManager);
        break;
      case 'column':
        contentHtml = this._createColumnModalContent(data, treeManager);
        break;
    }

    return `
      <div id="category-modal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" aria-label="關閉">×</button>
          </div>
          <div class="modal-body">
            ${contentHtml}
          </div>
        </div>
      </div>
    `;
  }

  _createTitleModalContent(data, treeManager) {
    if (!data || !data.children) return '<p>無可用分類</p>';
    
    return `
      <div class="modal-tree-grid">
        ${data.children.map(child => `
          <div class="modal-tree-item">
            <label class="modal-tree-label">
              <input type="radio" name="modal-title" class="modal-radio" 
                     value="${child.name}" data-level="2" data-parent="${data.name}">
              <span class="modal-tree-text">${child.name}</span>
              <span class="modal-tree-count">(${child.count})</span>
            </label>
          </div>
        `).join('')}
      </div>
    `;
  }

  _createKeywordModalContent(data, treeManager) {
    if (!data || !data.midCategories) return '<p>無可用關鍵詞</p>';
    
    return `
      <div class="modal-tree-grid">
        ${data.midCategories.map(mid => `
          <div class="modal-tree-group">
            <div class="modal-tree-item">
              <label class="modal-tree-label">
                <input type="checkbox" class="modal-checkbox" 
                       data-major="${data.majorCategory}" data-mid="" data-minor="${mid.name}">
                <span class="modal-tree-text modal-tree-mid">${mid.name}</span>
                <span class="modal-tree-count">(${mid.count})</span>
              </label>
            </div>
            ${mid.children ? `
              <div class="modal-tree-children">
                ${mid.children.map(minor => `
                  <div class="modal-tree-item modal-tree-minor">
                    <label class="modal-tree-label">
                      <input type="checkbox" class="modal-checkbox" 
                             data-major="${data.majorCategory}" data-mid="${mid.name}" data-minor="${minor.name}">
                      <span class="modal-tree-text">${minor.name}</span>
                      <span class="modal-tree-count">(${minor.count})</span>
                    </label>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  _createColumnModalContent(data, treeManager) {
    if (!data || !data.children) return '<p>無可用欄目</p>';
    
    const createColumnNode = (node, level = 0) => {
      const hasChildren = node.children && node.children.length > 0;
      const isSelectable = node.level === 'category';
      const indent = level * 20;
      
      let html = `
        <div class="modal-tree-item" style="margin-left: ${indent}px">
          <label class="modal-tree-label ${isSelectable ? 'selectable' : ''}">
            ${isSelectable ? `
              <input type="radio" name="modal-column" class="modal-radio" 
                     value="${node.name}" data-level="category">
            ` : ''}
            <span class="modal-tree-text">${node.name}</span>
            <span class="modal-tree-count">(${node.count})</span>
          </label>
        </div>
      `;
      
      if (hasChildren) {
        html += node.children.map(child => createColumnNode(child, level + 1)).join('');
      }
      
      return html;
    };
    
    return `
      <div class="modal-tree-list">
        ${data.children.map(child => createColumnNode(child)).join('')}
      </div>
    `;
  }

  _bindModalEvents(treeManager) {
    if (!this.currentModal) return;
    
    // 關閉按鈕
    this.currentModal.querySelector('.modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });
    
    // 點擊遮罩關閉
    this.currentModal.addEventListener('click', (e) => {
      if (e.target === this.currentModal) {
        this.closeModal();
      }
    });
    
    // ESC 鍵關閉
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // 綁定選擇事件
    this.currentModal.querySelectorAll('.modal-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked && treeManager._stateManager) {
          const level = parseInt(radio.dataset.level) || 1;
          const value = radio.value;
          const parent = radio.dataset.parent;
          
          if (radio.name === 'modal-title') {
            treeManager._stateManager.setTitleFilter(level, value, parent || null);
          } else if (radio.name === 'modal-column') {
            treeManager._stateManager.setCategoryFilter('category', value, parent);
          }
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('stateChange'));
          }, 0);
          
          this.closeModal();
        }
      });
    });
    
    this.currentModal.querySelectorAll('.modal-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (treeManager._stateManager && treeManager._stateManager.toggleKeywordSelection) {
          const major = checkbox.dataset.major;
          const mid = checkbox.dataset.mid;
          const minor = checkbox.dataset.minor;
          
          let selection;
          if (mid && minor) {
            selection = {
              major: major,
              type: 'minor',
              mid: mid,
              value: minor
            };
          } else {
            selection = {
              major: major,
              type: 'mid',
              value: minor
            };
          }
          
          treeManager._stateManager.toggleKeywordSelection(selection);
          
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('stateChange'));
          }, 0);
        }
      });
    });
  }

  closeModal() {
    if (this.currentModal) {
      this.currentModal.classList.add('hiding');
      setTimeout(() => {
        if (this.currentModal) {
          this.currentModal.remove();
          this.currentModal = null;
        }
      }, 300);
    }
  }
}

// ========================================
// 公開的 API
// ========================================
export const treeFilterManager = new TreeFilterManager();
