// filter.js - 修正版篩選器管理模組

// ========================================
// 篩選器管理類別
// ========================================
console.log('filter.js loaded');

class TreeFilterManager {
  constructor() {
    // 依賴注入
    this._stateManager = null;
    this._utils = null;
    this._searchManager = null;
    
    // 效能優化快取
    this._cache = new Map();
    this._maxCacheSize = 50;
    
    // 收闔狀態管理
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
    const isSearchHighlight = this._checkTitleSearchMatch(data, level);
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
    
    const highlightClass = this._getHighlightClass(isSearchHighlight, isSelected, 'title');
    
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
    const isSearchHighlight = this._checkKeywordSearchMatch(data, level, majorCategory);
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
    
    const highlightClass = this._getHighlightClass(isSearchHighlight, isSelected, 'keyword');
    
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

  _createColumnTreeNode(data, majorName = '') {
    if (!data || data.count === 0) return '';

    const hasChildren = data.children && data.children.length > 0;
    const nodeId = `column-${data.level}-${data.name}`;
    const isCollapsed = this._collapseState.columnTree.get(nodeId) || false;
    const isSelected = this._checkColumnNodeSelected(data);
    const isSearchHighlight = this._checkColumnSearchMatch(data);
    const highlightClass = this._getHighlightClass(isSearchHighlight, isSelected, 'column');

    let html = '';

    if (data.selectable && data.level === 'category') {
      const radioBtn = `<input type="radio" name="column-category" class="tree-radio" 
                              value="${data.name}" data-level="category" ${isSelected ? 'checked' : ''}>`;
      html += `
        <div class="tree-node tree-level-category" data-node-id="${nodeId}">
          <div class="tree-node-header ${highlightClass}">
            <div class="tree-node-label">
              <span class="tree-toggle-placeholder"></span>
              <label class="title-label-container">
                ${radioBtn}
                <span class="title-text">${data.name}</span>
              </label>
              <span class="tree-node-count">${data.count}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="tree-node tree-level-${data.level}" data-node-id="${nodeId}">
          <div class="tree-node-header ${highlightClass}">
            <div class="tree-node-label">
              ${hasChildren ? 
                `<span class="tree-toggle" data-node-id="${nodeId}">${isCollapsed ? '+' : '−'}</span>` : 
                `<span class="tree-toggle-placeholder"></span>`
              }
              <span class="title-text">${data.name}</span>
            </div>
          </div>
      `;
      
      if (hasChildren) {
        const showAllKey = `column-${majorName || data.name}`;
        const showAll = this._expandState.columnShowAll.get(showAllKey) || false;
        const isCategoryLevel = data.children.length > 0 && data.children[0].level === 'category';
        
        let childrenToShow = data.children;
        let showAllBtn = '';
        
        if (data.children.length > 5) {
          childrenToShow = showAll ? data.children : data.children.slice(0, 5);
          showAllBtn = `
            <button class="show-all-btn" data-category="${majorName || data.name}">
              ${showAll ? `收合 (${data.children.length - 5})` : `顯示全部 (${data.children.length - 5})`}
            </button>
          `;
        }
        
        html += `
          <div class="tree-node-content" style="display: ${isCollapsed ? 'none' : 'block'};">
            ${childrenToShow.map(child => this._createColumnTreeNode(child, majorName || data.name)).join('')}
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

  _checkTitleSearchMatch(data, level) {
    if (!this._searchManager || !this._stateManager) return false;
    
    const searchData = this._stateManager.get('currentSearchData');
    if (!searchData || !searchData.query) return false;
    
    // 檢查是否為題名欄位的檢索
    const isTargetField = this._isTargetSearchField(searchData, 'title');
    if (!isTargetField) return false;
    
    return this._searchManager.containsSearchTerms(data.name, searchData, searchData.mode || 'general');
  }

  _checkKeywordSearchMatch(data, level, majorCategory) {
    if (!this._searchManager || !this._stateManager) return false;
    
    const searchData = this._stateManager.get('currentSearchData');
    if (!searchData || !searchData.query) return false;
    
    // 檢查是否為關鍵詞欄位的檢索
    const isTargetField = this._isTargetSearchField(searchData, 'keyword');
    if (!isTargetField) return false;
    
    // 檢查名稱和大分類
    return this._searchManager.containsSearchTerms(data.name, searchData, searchData.mode || 'general') ||
           this._searchManager.containsSearchTerms(majorCategory, searchData, searchData.mode || 'general');
  }

  _checkColumnSearchMatch(data) {
    if (!this._searchManager || !this._stateManager) return false;
    
    const searchData = this._stateManager.get('currentSearchData');
    if (!searchData || !searchData.query) return false;
    
    // 檢查是否為欄目欄位的檢索
    const isTargetField = this._isTargetSearchField(searchData, 'category');
    if (!isTargetField) return false;
    
    return this._searchManager.containsSearchTerms(data.name, searchData, searchData.mode || 'general');
  }

  _isTargetSearchField(searchData, targetField) {
    if (!searchData) return false;
    
    // 智能檢索不針對特定欄位
    if (searchData.mode === 'smart') return false;
    
    // 一般檢索
    if (searchData.mode === 'general') {
      return searchData.fieldType === targetField || searchData.fieldType === 'all';
    }
    
    // 進階檢索
    if (searchData.mode === 'advanced' && searchData.conditions) {
      return searchData.conditions.some(condition => 
        condition.field === targetField || condition.field === 'all'
      );
    }
    
    return false;
  }

  _getHighlightClass(isSearchHighlight, isFilterHighlight, fieldType) {
    if (isSearchHighlight) return 'search-highlight';
    if (isFilterHighlight) return 'filter-highlight';
    return '';
  }

  // ========================================
  // 私有方法 - 事件處理
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

    // 顯示全部切換事件
    this._eventHandlers.set('showAll', (event) => {
      const showAllBtn = event.target.closest('.show-all-btn');
      if (!showAllBtn) return;
      
      const categoryName = showAllBtn.dataset.category;
      if (categoryName) {
        this._toggleShowAll(categoryName);
      }
    });

    // 綁定事件到 document（事件委派）
    document.addEventListener('click', (event) => {
      this._eventHandlers.get('toggle')?.(event);
      this._eventHandlers.get('showAll')?.(event);
    });
  }

  _toggleTreeNode(nodeId) {
    console.log('[TreeFilterManager] 切換節點收闔狀態:', nodeId);
    
    let targetMap;
    let rerenderFn;
    if (nodeId.startsWith('keyword-')) {
      targetMap = this._collapseState.keywordTrees;
      rerenderFn = this.updateKeywordTrees;
      // 如果是大分類，收合時一併收合所有中分類
      if (nodeId.startsWith('major-')) {
        const isCollapsed = targetMap.get(nodeId) || false;
        targetMap.set(nodeId, !isCollapsed);
        if (isCollapsed === false) { // 要收合
          // 收合所有該大分類下的中分類
          for (const key of targetMap.keys()) {
            if (key.startsWith('keyword-') && key.includes(nodeId.replace('major-', ''))) {
              targetMap.set(key, true);
            }
          }
        }
        rerenderFn && rerenderFn.call(this);
        return;
      }
    } else if (nodeId.startsWith('column-')) {
      targetMap = this._collapseState.columnTree;
      rerenderFn = this.updateColumnTree;
    } else {
      targetMap = this._collapseState.titleTree;
      rerenderFn = this.updateTitleTree;
    }
    
    const isCollapsed = targetMap.get(nodeId) || false;
    targetMap.set(nodeId, !isCollapsed);
    rerenderFn && rerenderFn.call(this);
  }

  _toggleShowAll(categoryName) {
    console.log('[TreeFilterManager] 切換顯示全部狀態:', categoryName);
    
    // 判斷是哪種類型的展開
    let showAllKey;
    let targetMap;
    
    if (categoryName.includes('title-')) {
      showAllKey = categoryName;
      targetMap = this._expandState.titleShowAll;
    } else if (categoryName.includes('keyword-')) {
      showAllKey = categoryName;
      targetMap = this._expandState.keywordShowAll;
    } else {
      showAllKey = `column-${categoryName}`;
      targetMap = this._expandState.columnShowAll;
    }
    
    const currentState = targetMap.get(showAllKey) || false;
    targetMap.set(showAllKey, !currentState);
    
    // 重新渲染對應的樹
    this._reRenderTree(categoryName);
  }

  _updateNodeUI(nodeId, isCollapsed) {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const contentElement = nodeElement.querySelector('.tree-node-content');
    const toggleElement = nodeElement.querySelector('.tree-toggle');
    
    if (contentElement && toggleElement) {
      contentElement.style.display = isCollapsed ? 'none' : 'block';
      toggleElement.textContent = isCollapsed ? '+' : '−';
    }
  }

  _reRenderTree(categoryName) {
    if (categoryName.includes('title-')) {
      this.updateTitleTree();
    } else if (categoryName.includes('keyword-')) {
      this.updateKeywordTrees();
    } else {
      this.updateColumnTree();
    }
  }

  // ========================================
  // 私有方法 - 快取管理
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
    const isSearchHighlight = this._checkTitleSearchMatch(data, 1);
    const highlightClass = this._getHighlightClass(isSearchHighlight, isSelected, 'title');
    
    const radioBtn = `<input type="radio" name="title-1" class="title-radio" 
                            value="${data.name}" data-level="1" data-parent="" ${isSelected ? 'checked' : ''}>`;

    const showAllKey = `title-${data.name}`;
    const showAll = this._expandState.titleShowAll.get(showAllKey) || false;
    const totalCount = data.children.length;
    const showAllBtn = totalCount > 5 ? `
      <button class="show-all-btn" data-category="${showAllKey}">
        ${showAll ? `收合 (只顯示 5 個)` : `顯示全部 (共 ${totalCount} 個)`}
      </button>
    ` : '';

    return `
      <div class="title-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="title-major-header ${highlightClass}">
          <span class="tree-toggle" data-node-id="major-${data.name}">${isCollapsed ? '+' : '−'}</span>
          <label class="title-label-container">${radioBtn}<span class="title-major-title">${data.name}</span></label>
          <span class="title-major-count">(${data.count})</span>
        </div>
        <div class="title-major-content">
          ${data.children.map((child, index) => this._createTitleTreeNode(child, 2, data.name, index, data.name)).join('')}
          ${showAllBtn}
        </div>
      </div>
    `;
  }

  _createKeywordTreeBlock(tree) {
    const isCollapsed = this._collapseState.keywordTrees.get(`major-${tree.majorCategory}`) || false;
    const isSearchHighlight = this._checkKeywordSearchMatch({ name: tree.majorCategory }, 0, tree.majorCategory);
    const highlightClass = this._getHighlightClass(isSearchHighlight, false, 'keyword');

    const showAllKey = `keyword-${tree.majorCategory}`;
    const showAll = this._expandState.keywordShowAll.get(showAllKey) || false;
    const visibleCount = Math.min(5, tree.midCategories.length);
    const hiddenCount = Math.max(0, tree.midCategories.length - 5);
    const totalCount = tree.midCategories.length;
    const showAllBtn = totalCount > 5 ? `
      <button class="show-all-btn" data-category="${showAllKey}">
        ${showAll ? `收合 (只顯示 5 個)` : `顯示全部 (共 ${totalCount} 個)`}
      </button>
    ` : '';

    return `
      <div class="keyword-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="keyword-major-header ${highlightClass}">
          <span class="tree-toggle" data-node-id="major-${tree.majorCategory}">${isCollapsed ? '+' : '−'}</span>
          <span class="keyword-major-title">${tree.majorCategory}</span>
          <span class="keyword-major-count">(${tree.totalCount})</span>
        </div>
        <div class="keyword-major-content">
          ${tree.midCategories.map((mid, index) => this._createKeywordTreeNode(mid, 1, tree.majorCategory, '', index)).join('')}
          ${showAllBtn}
        </div>
      </div>
    `;
  }

  _createColumnTreeBlock(data) {
    const isCollapsed = this._collapseState.columnTree.get(`major-${data.name}`) || false;
    const isSearchHighlight = this._checkColumnSearchMatch(data);
    const highlightClass = this._getHighlightClass(isSearchHighlight, false, 'column');

    const showAllKey = `column-${data.name}`;
    const showAll = this._expandState.columnShowAll.get(showAllKey) || false;
    const totalCount = data.children.length;
    const showAllBtn = totalCount > 5 ? `
      <button class="show-all-btn" data-category="${showAllKey}">
        ${showAll ? `收合 (只顯示 5 個)` : `顯示全部 (共 ${totalCount} 個)`}
      </button>
    ` : '';

    return `
      <div class="column-major-block ${isCollapsed ? 'collapsed' : ''}">
        <div class="column-major-header ${highlightClass}">
          <span class="tree-toggle" data-node-id="major-${data.name}">${isCollapsed ? '+' : '−'}</span>
          <span class="column-major-title">${data.name}</span>
          <span class="column-major-count">(${data.count})</span>
        </div>
        <div class="column-major-content">
          ${data.children.slice(0, showAll ? data.children.length : 5).map(child => this._createColumnTreeNode(child, data.name)).join('')}
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
}

// ========================================
// 公開的 API
// ========================================
export const treeFilterManager = new TreeFilterManager();