// tree-filter.js - 樹狀篩選器模組

(function(global) {
  'use strict';

  // 取得其他模組
  const Utils = global.TaiwanNewsApp.Utils;
  const DataManager = global.TaiwanNewsApp.DataManager;
  const StateManager = global.TaiwanNewsApp.StateManager;

  // ========================================
  // 私有變數
  // ========================================
  
  // 展開狀態管理
  const expandedNodes = {
    title: new Set(),
    keyword: new Set()
  };

  // 層級映射
  const LEVEL_MAPPING = {
    'major': 'mid',
    'mid': 'minor'
  };

  // ========================================
  // 私有函數
  // ========================================

  // 取得子層級
  function getChildLevel(currentLevel) {
    return LEVEL_MAPPING[currentLevel] || 'minor';
  }

  // 檢查節點是否被選中
  function isNodeSelected(dimension, level, name) {
    const currentFilters = StateManager ? StateManager.get('filters') : {};
    return currentFilters[dimension]?.[level]?.includes(name) || false;
  }

  // 檢查節點是否應該被禁用
  function isNodeDisabled(dimension, level, name, availableItems, selectedItems) {
    const filterMode = StateManager ? StateManager.get('filterMode') : 'and';
    
    if (filterMode === 'or') {
      // OR模式：所有選項都可用
      return false;
    }
    
    // AND模式：檢查選項是否可用
    const selectedAtLevel = selectedItems[level] || [];
    
    // 如果項目已被選中，則保持可用
    if (selectedAtLevel.includes(name)) {
      return false;
    }
    
    // 特殊處理：標題大分類在AND模式下應為單選
    if (dimension === 'title' && level === 'major' && selectedAtLevel.length > 0) {
      return true; // 已有選擇時，其他選項禁用
    }
    
    // 檢查是否在可用選項中
    const availableNames = getAvailableNamesForLevel(availableItems, dimension, level);
    return !availableNames.includes(name);
  }

  // 從可用資料中提取特定層級的名稱
  function getAvailableNamesForLevel(availableItems, dimension, level) {
    if (dimension === 'title') {
      if (level === 'major') {
        return Utils.unique(availableItems.map(item => item.標題大分類).filter(Boolean));
      } else if (level === 'mid') {
        return Utils.unique(availableItems.map(item => item.標題中分類).filter(Boolean));
      }
    } else if (dimension === 'keyword') {
      const names = [];
      availableItems.forEach(item => {
        if (item.關鍵詞列表) {
          item.關鍵詞列表.forEach(kw => {
            if (level === 'major' && kw.大分類) {
              names.push(kw.大分類);
            } else if (level === 'mid' && kw.中分類) {
              names.push(kw.中分類);
            } else if (level === 'minor' && kw.小分類) {
              names.push(kw.小分類);
            }
          });
        }
      });
      return Utils.unique(names);
    }
    return [];
  }

  // 計算節點的資料筆數
  function calculateNodeCount(dimension, level, name, availableItems) {
    if (dimension === 'title') {
      if (level === 'major') {
        return availableItems.filter(item => item.標題大分類 === name).length;
      } else if (level === 'mid') {
        return availableItems.filter(item => item.標題中分類 === name).length;
      }
    } else if (dimension === 'keyword') {
      const matchingItems = new Set();
      availableItems.forEach(item => {
        if (item.關鍵詞列表) {
          item.關鍵詞列表.forEach(kw => {
            if ((level === 'major' && kw.大分類 === name) ||
                (level === 'mid' && kw.中分類 === name) ||
                (level === 'minor' && kw.小分類 === name)) {
              matchingItems.add(item.資料編號);
            }
          });
        }
      });
      return matchingItems.size;
    }
    return 0;
  }

  // 創建樹節點
  function createTreeNode(data, dimension, level, parentKey = '') {
    const nodeKey = parentKey ? `${parentKey}-${data.name}` : data.name;
    const isExpanded = expandedNodes[dimension].has(nodeKey);
    const hasChildren = data.children?.length > 0;
    const isSelected = isNodeSelected(dimension, level, data.name);
    const isDisabled = data.disabled || false;
    
    const nodeDiv = document.createElement('div');
    nodeDiv.className = `tree-node ${hasChildren ? '' : 'tree-node-leaf'}`;
    
    // 創建節點頭部
    const headerDiv = createNodeHeader(data, dimension, level, nodeKey, {
      isSelected,
      isDisabled,
      isExpanded,
      hasChildren
    });
    
    nodeDiv.appendChild(headerDiv);
    
    // 創建子節點容器
    if (hasChildren) {
      const childrenDiv = createChildrenContainer(data.children, dimension, level, nodeKey, isExpanded);
      nodeDiv.appendChild(childrenDiv);
    }
    
    return nodeDiv;
  }

  // 創建節點頭部
  function createNodeHeader(data, dimension, level, nodeKey, options) {
    const { isSelected, isDisabled, isExpanded, hasChildren } = options;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = `tree-node-header ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
    
    // 展開/收合按鈕
    const toggleBtn = createToggleButton(isExpanded, isDisabled, hasChildren, () => {
      toggleNode(nodeKey, dimension);
    });
    
    // 核取方塊
    const checkbox = createCheckbox(data.name, isSelected, isDisabled, (checked) => {
      handleCheckboxChange(dimension, level, data.name, checked);
    });
    
    // 標籤
    const label = createLabel(data, isDisabled, () => {
      if (!isDisabled) {
        checkbox.checked = !checkbox.checked;
        handleCheckboxChange(dimension, level, data.name, checkbox.checked);
      }
    });
    
    headerDiv.appendChild(toggleBtn);
    headerDiv.appendChild(checkbox);
    headerDiv.appendChild(label);
    
    return headerDiv;
  }

  // 創建展開/收合按鈕
  function createToggleButton(isExpanded, isDisabled, hasChildren, onClick) {
    const toggleBtn = document.createElement('div');
    toggleBtn.className = `tree-toggle ${isExpanded ? 'expanded' : ''} ${isDisabled ? 'disabled' : ''}`;
    toggleBtn.textContent = isExpanded ? '−' : '+';
    
    if (!isDisabled && hasChildren) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
    
    return toggleBtn;
  }

  // 創建核取方塊
  function createCheckbox(value, isSelected, isDisabled, onChange) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tree-checkbox';
    checkbox.checked = isSelected;
    checkbox.disabled = isDisabled;
    checkbox.value = value;
    
    if (!isDisabled) {
      checkbox.addEventListener('change', () => onChange(checkbox.checked));
    }
    
    return checkbox;
  }

  // 創建標籤
  function createLabel(data, isDisabled, onClick) {
    const label = document.createElement('label');
    label.className = `tree-label ${isDisabled ? 'disabled' : ''}`;
    label.textContent = data.name;
    
    if (!isDisabled) {
      label.addEventListener('click', onClick);
    }
    
    // 計數顯示
    if (data.count !== undefined) {
      const countSpan = document.createElement('span');
      countSpan.className = `tree-count ${isNodeSelected ? 'selected' : ''}`;
      countSpan.textContent = `(${data.count})`;
      label.appendChild(countSpan);
    }
    
    return label;
  }

  // 創建子節點容器
  function createChildrenContainer(children, dimension, level, parentKey, isExpanded) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = `tree-children ${isExpanded ? '' : 'hidden'}`;
    
    const childLevel = getChildLevel(level);
    children.forEach(child => {
      const childNode = createTreeNode(child, dimension, childLevel, parentKey);
      childrenDiv.appendChild(childNode);
    });
    
    return childrenDiv;
  }

  // 切換節點展開狀態
  function toggleNode(nodeKey, dimension) {
    const expandedSet = expandedNodes[dimension];
    if (expandedSet.has(nodeKey)) {
      expandedSet.delete(nodeKey);
    } else {
      expandedSet.add(nodeKey);
    }
    
    // 重新渲染樹
    TreeFilterManager.updateTree(dimension);
  }

  // 處理核取方塊變更
  function handleCheckboxChange(dimension, level, value, checked) {
    if (!StateManager) return;
    
    const filterMode = StateManager.get('filterMode');
    const currentSelections = [...(StateManager.get(`filters.${dimension}.${level}`) || [])];
    
    if (checked) {
      // 特殊處理：AND模式下標題大分類為單選
      if (dimension === 'title' && level === 'major' && filterMode === 'and') {
        // 清空現有選擇，只保留新選擇
        const newSelections = [value];
        // 同時清空標題中分類選擇
        if (window.handleFilterChange) {
          window.handleFilterChange(dimension, level, newSelections);
          window.handleFilterChange(dimension, 'mid', []);
        }
        return;
      }
      
      // 一般多選邏輯
      if (!currentSelections.includes(value)) {
        currentSelections.push(value);
      }
    } else {
      const index = currentSelections.indexOf(value);
      if (index > -1) {
        currentSelections.splice(index, 1);
      }
    }
    
    // 使用全域函數更新篩選條件
    if (window.handleFilterChange) {
      window.handleFilterChange(dimension, level, currentSelections);
    } else {
      // 備用方案
      StateManager.set(`filters.${dimension}.${level}`, currentSelections);
      StateManager.updateRootDimension(dimension);
      window.dispatchEvent(new CustomEvent('stateChange'));
    }
  }

  // 建構標題樹資料
  function buildTitleTreeData(availableData, selectedItems) {
    const majorMap = new Map();
    
    availableData.forEach(item => {
      if (!item.標題大分類) return;
      
      const major = item.標題大分類;
      const mid = item.標題中分類;
      
      // 建立或更新大分類節點
      if (!majorMap.has(major)) {
        majorMap.set(major, {
          name: major,
          count: 0,
          children: new Map(),
          disabled: false
        });
      }
      
      const majorNode = majorMap.get(major);
      majorNode.count++;
      
      // 建立中分類節點
      if (mid) {
        if (!majorNode.children.has(mid)) {
          majorNode.children.set(mid, {
            name: mid,
            count: 0,
            disabled: false
          });
        }
        majorNode.children.get(mid).count++;
      }
    });
    
    // 轉換為樹結構並設定可用性
    return Array.from(majorMap.values()).map(major => {
      const majorDisabled = isNodeDisabled('title', 'major', major.name, availableData, selectedItems);
      major.disabled = majorDisabled;
      major.children = Array.from(major.children.values()).map(mid => {
        mid.disabled = isNodeDisabled('title', 'mid', mid.name, availableData, selectedItems);
        return mid;
      });
      return major;
    });
  }

  // 建構關鍵詞樹資料
  function buildKeywordTreeData(availableData, selectedMajor, selectedItems) {
    if (!selectedMajor) return [];
    
    const midMap = new Map();
    
    availableData.forEach(item => {
      if (!item.關鍵詞列表) return;
      
      item.關鍵詞列表.forEach(kw => {
        if (kw.大分類 !== selectedMajor) return;
        
        const mid = kw.中分類;
        const minor = kw.小分類;
        
        if (!mid) return;
        
        // 建立或更新中分類節點
        if (!midMap.has(mid)) {
          midMap.set(mid, {
            name: mid,
            count: 0,
            children: new Map(),
            disabled: false
          });
        }
        
        const midNode = midMap.get(mid);
        midNode.count++;
        
        // 建立小分類節點
        if (minor) {
          if (!midNode.children.has(minor)) {
            midNode.children.set(minor, {
              name: minor,
              count: 0,
              disabled: false
            });
          }
          midNode.children.get(minor).count++;
        }
      });
    });
    
    // 轉換為樹結構並設定可用性
    return Array.from(midMap.values()).map(mid => {
      const midDisabled = isNodeDisabled('keyword', 'mid', mid.name, availableData, selectedItems);
      mid.disabled = midDisabled;
      mid.children = Array.from(mid.children.values()).map(minor => {
        minor.disabled = isNodeDisabled('keyword', 'minor', minor.name, availableData, selectedItems);
        return minor;
      });
      return mid;
    });
  }

  // ========================================
  // 公開的 API
  // ========================================
  const TreeFilterManager = {
    // 更新標題樹
    updateTitleTree() {
      this.updateTree('title');
    },

    // 更新關鍵詞樹
    updateKeywordTree() {
      // 更新大分類選單
      this.updateKeywordMajorSelect();
      this.updateTree('keyword');
    },

    // 統一的樹更新方法
    updateTree(dimension) {
      const containerId = dimension === 'title' ? 'title-tree-container' : 'keyword-tree-container';
      const container = Utils.$(containerId);
      if (!container) return;
      
      // 計算可用資料範圍（根據篩選模式）
      const availableData = StateManager ? StateManager.calculateAvailableOptions(dimension, 'major') : [];
      
      if (availableData.length === 0) {
        container.innerHTML = '<div class="tree-empty">無可用選項</div>';
        return;
      }
      
      // 建構樹資料
      let treeData;
      const currentFilters = StateManager ? StateManager.get('filters') : {};
      const selectedItems = currentFilters[dimension] || {};
      
      if (dimension === 'title') {
        treeData = buildTitleTreeData(availableData, selectedItems);
      } else {
        // 關鍵詞樹需要先選擇大分類
        const selectedMajors = selectedItems.major || [];
        container.innerHTML = '';
        
        if (selectedMajors.length === 0) return;
        
        selectedMajors.forEach(selectedMajor => {
          treeData = buildKeywordTreeData(availableData, selectedMajor, selectedItems);
          if (treeData.length === 0) return;
          
          // 創建大分類標題
          const majorTitle = document.createElement('div');
          majorTitle.className = 'tree-major-title';
          majorTitle.style.cssText = 'font-weight: bold; margin: 8px 0 4px 0; padding: 4px; background: #f3f4f6; border-radius: 4px; font-size: 0.8rem;';
          majorTitle.textContent = selectedMajor;
          container.appendChild(majorTitle);
          
          // 渲染樹節點
          treeData.forEach(midData => {
            const treeNode = createTreeNode(midData, 'keyword', 'mid', selectedMajor);
            container.appendChild(treeNode);
          });
        });
        
        return; // 關鍵詞樹特殊處理，直接返回
      }
      
      // 清空容器並渲染樹節點（標題樹）
      container.innerHTML = '';
      treeData.forEach(majorData => {
        const treeNode = createTreeNode(majorData, dimension, 'major');
        container.appendChild(treeNode);
      });
    },

    // 更新關鍵詞大分類選單
    updateKeywordMajorSelect() {
      const select = Utils.$('keyword-major-select');
      if (!select) return;
      
      // 計算可用資料範圍
      const availableData = StateManager ? StateManager.calculateAvailableOptions('keyword', 'major') : [];
      
      if (availableData.length === 0) {
        select.innerHTML = '<option value="">無可用選項</option>';
        return;
      }
      
      // 取得所有關鍵詞大分類
      const allKeywords = availableData.flatMap(r => r.關鍵詞列表 || []);
      const majorOptions = Utils.unique(allKeywords.map(k => k.大分類));
      
      // 取得目前選中的項目
      const currentFilters = StateManager ? StateManager.get('filters') : {};
      const selectedMajors = currentFilters.keyword ? currentFilters.keyword.major : [];
      
      // 根據篩選模式決定選項可用性
      const filterMode = StateManager ? StateManager.get('filterMode') : 'and';
      const availableNames = filterMode === 'or' ? majorOptions : 
        getAvailableNamesForLevel(availableData, 'keyword', 'major');
      
      // 更新選單選項
      select.innerHTML = '<option value="">請選擇大分類</option>' +
        majorOptions.map(major => {
          const isSelected = selectedMajors.includes(major);
          const isDisabled = filterMode === 'and' && !isSelected && !availableNames.includes(major);
          return `<option value="${Utils.safe(major)}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${Utils.safe(major)}</option>`;
        }).join('');
    },

    // 初始化樹狀篩選器
    init() {
      this.setupKeywordMajorSelect();
      this.updateTitleTree();
      this.updateKeywordTree();
    },

    // 設定關鍵詞大分類選單事件
    setupKeywordMajorSelect() {
      const majorSelect = Utils.$('keyword-major-select');
      if (!majorSelect) return;
      
      majorSelect.addEventListener('change', (e) => {
        const selectedMajor = e.target.value;
        
        if (!StateManager) return;
        
        if (selectedMajor) {
          // 添加到選擇中（支援多選）
          const currentMajors = StateManager.get('filters.keyword.major') || [];
          if (!currentMajors.includes(selectedMajor)) {
            const newSelections = [...currentMajors, selectedMajor];
            this.updateFilterSelection('keyword', 'major', newSelections);
          }
        } else {
          // 清空選擇
          this.updateFilterSelection('keyword', 'major', []);
        }
      });
    },

    // 更新篩選選擇
    updateFilterSelection(dimension, level, selections) {
      if (window.handleFilterChange) {
        window.handleFilterChange(dimension, level, selections);
      } else {
        StateManager.set(`filters.${dimension}.${level}`, selections);
        if (selections.length > 0) {
          StateManager.updateRootDimension(dimension);
        }
        window.dispatchEvent(new CustomEvent('stateChange'));
      }
    },

    // 清空展開狀態
    clearExpandedState() {
      expandedNodes.title.clear();
      expandedNodes.keyword.clear();
    },

    // 取得當前展開狀態
    getExpandedState() {
      return {
        title: Array.from(expandedNodes.title),
        keyword: Array.from(expandedNodes.keyword)
      };
    },

    // 設定展開狀態
    setExpandedState(state) {
      if (state.title) {
        expandedNodes.title = new Set(state.title);
      }
      if (state.keyword) {
        expandedNodes.keyword = new Set(state.keyword);
      }
    },

    // 取得篩選模式說明
    getFilterModeInfo() {
      const mode = StateManager ? StateManager.get('filterMode') : 'and';
      return {
        mode: mode,
        description: mode === 'and' ? 
          'AND交集模式：選擇會互相影響，逐步縮小範圍' : 
          'OR聯集模式：選擇獨立進行，擴大查詢範圍'
      };
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.TreeFilterManager = TreeFilterManager;

})(this);