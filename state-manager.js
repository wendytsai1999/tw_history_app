// state-manager.js - 狀態管理模組

(function(global) {
  'use strict';

  // ========================================
  // 私有狀態變數
  // ========================================
  
  let appState = {
    // 資料狀態
    filtered: [],
    filters: {
      // 日期篩選
      startDate: null,
      endDate: null,
      dateFilterType: 'western',
      
      // 日治年號篩選
      era: null,
      eraStartYear: null,
      eraEndYear: null,
      
      // 樹狀篩選狀態
      title: {
        major: [],     // AND模式下應為單選，OR模式下可多選
        mid: []        // 基於major的範圍
      },
      keyword: {
        major: [],     // 可多選
        mid: [],       // 基於major的範圍
        minor: []      // 基於major和mid的範圍
      }
    },
    
    // 篩選模式：'and' (交集) | 'or' (聯集)
    filterMode: 'and',
    
    // 根基狀態追蹤
    rootDimension: null,
    
    sortOrder: 'relevance',
    currentPage: 1,
    searchMode: 'smart',
    currentSearchData: null,
    traditionalSearchFields: ['all'],
    
    // 初始化狀態
    isInitialized: false,
    isDataLoaded: false
  };

  // 狀態變更監聽器
  const stateListeners = new Set();

  // ========================================
  // 私有函數
  // ========================================
  
  function notifyStateChange(changes) {
    stateListeners.forEach(listener => {
      try {
        listener(changes, appState);
      } catch (error) {
        console.error('狀態監聽器錯誤:', error);
      }
    });
  }

  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(deepClone);
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  // ========================================
  // 新增：完整篩選邏輯實現
  // ========================================

  // 取得基礎資料集（檢索結果或全部資料）
  function getBaseDataset() {
    const DataManager = global.TaiwanNewsApp.DataManager;
    const currentSearchData = appState.currentSearchData;
    
    return currentSearchData ? 
      currentSearchData.results : 
      (DataManager ? DataManager.getAllData() : []);
  }

  // 套用日期篩選
  function applyDateFilters(data, filters) {
    const Utils = global.TaiwanNewsApp.Utils;
    
    return data.filter(item => {
      // 西元年日期篩選
      if (filters.startDate || filters.endDate) {
        if (!item._日期) return false;
        if (filters.startDate && item._日期 < filters.startDate) return false;
        if (filters.endDate && item._日期 > filters.endDate) return false;
      }

      // 日治年號篩選
      if (filters.dateFilterType === 'japanese' && filters.era) {
        if (!item._年份) return false;
        
        let startYear = null;
        let endYear = null;
        
        if (filters.eraStartYear) {
          startYear = Utils ? Utils.convertEraToWestern(filters.era, filters.eraStartYear) : null;
        }
        if (filters.eraEndYear) {
          endYear = Utils ? Utils.convertEraToWestern(filters.era, filters.eraEndYear) : null;
        }
        
        if (startYear && item._年份 < startYear) return false;
        if (endYear && item._年份 > endYear) return false;
      }
      
      return true;
    });
  }

  // AND模式篩選邏輯
  function applyAndModeFilters(data, filters) {
    return data.filter(item => {
      // 標題分類篩選（AND邏輯）
      let titleMatch = true;
      if (filters.title.major.length > 0) {
        // AND模式下標題大分類應為單選，但程式上仍支援多選的邏輯
        titleMatch = filters.title.major.includes(item.標題大分類);
      }
      if (titleMatch && filters.title.mid.length > 0) {
        titleMatch = filters.title.mid.includes(item.標題中分類);
      }

      // 關鍵詞分類篩選（AND邏輯）
      let keywordMatch = true;
      const hasKeywordFilters = filters.keyword.major.length > 0 || 
                               filters.keyword.mid.length > 0 || 
                               filters.keyword.minor.length > 0;
      
      if (hasKeywordFilters) {
        keywordMatch = item.關鍵詞列表.some(kw => {
          let kwMatch = true;
          
          // 必須同時符合所有已選的關鍵詞層級
          if (filters.keyword.major.length > 0) {
            kwMatch = kwMatch && filters.keyword.major.includes(kw.大分類);
          }
          if (filters.keyword.mid.length > 0) {
            kwMatch = kwMatch && filters.keyword.mid.includes(kw.中分類);
          }
          if (filters.keyword.minor.length > 0) {
            kwMatch = kwMatch && filters.keyword.minor.includes(kw.小分類);
          }
          
          return kwMatch;
        });
      }
      
      // 標題與關鍵詞之間也是AND邏輯
      return titleMatch && keywordMatch;
    });
  }

  // OR模式篩選邏輯
  function applyOrModeFilters(data, filters) {
    const hasTitleFilters = filters.title.major.length > 0 || filters.title.mid.length > 0;
    const hasKeywordFilters = filters.keyword.major.length > 0 || 
                             filters.keyword.mid.length > 0 || 
                             filters.keyword.minor.length > 0;
    
    // 如果沒有任何篩選條件，返回全部
    if (!hasTitleFilters && !hasKeywordFilters) {
      return data;
    }
    
    return data.filter(item => {
      let matches = false;
      
      // 標題分類匹配（OR邏輯）
      if (hasTitleFilters) {
        let titleMatch = false;
        if (filters.title.major.length > 0) {
          titleMatch = titleMatch || filters.title.major.includes(item.標題大分類);
        }
        if (filters.title.mid.length > 0) {
          titleMatch = titleMatch || filters.title.mid.includes(item.標題中分類);
        }
        matches = matches || titleMatch;
      }
      
      // 關鍵詞分類匹配（OR邏輯）
      if (hasKeywordFilters) {
        const keywordMatch = item.關鍵詞列表.some(kw => {
          return (filters.keyword.major.length > 0 && filters.keyword.major.includes(kw.大分類)) ||
                 (filters.keyword.mid.length > 0 && filters.keyword.mid.includes(kw.中分類)) ||
                 (filters.keyword.minor.length > 0 && filters.keyword.minor.includes(kw.小分類));
        });
        matches = matches || keywordMatch;
      }
      
      return matches;
    });
  }

  // ========================================
  // 公開的 API
  // ========================================
  const StateManager = {
    // 取得完整狀態（只讀）
    getState() {
      return deepClone(appState);
    },

    // 取得特定狀態值
    get(path) {
      const keys = path.split('.');
      let current = appState;
      
      for (const key of keys) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
      }
      
      return deepClone(current);
    },

    // 設定狀態值
    set(path, value) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let current = appState;
      
      for (const key of keys) {
        if (!(key in current) || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
      
      const oldValue = current[lastKey];
      current[lastKey] = deepClone(value);
      
      notifyStateChange({
        path,
        oldValue: deepClone(oldValue),
        newValue: deepClone(value)
      });
    },

    // 更新多個狀態值
    update(updates) {
      const changes = [];
      
      Object.entries(updates).forEach(([path, value]) => {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = appState;
        
        for (const key of keys) {
          if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
        
        const oldValue = current[lastKey];
        current[lastKey] = deepClone(value);
        
        changes.push({
          path,
          oldValue: deepClone(oldValue),
          newValue: deepClone(value)
        });
      });
      
      notifyStateChange(changes);
    },

    // 重設篩選條件
    resetFilters() {
      this.update({
        'filters.startDate': null,
        'filters.endDate': null,
        'filters.dateFilterType': 'western',
        'filters.era': null,
        'filters.eraStartYear': null,
        'filters.eraEndYear': null,
        'filters.title': { major: [], mid: [] },
        'filters.keyword': { major: [], mid: [], minor: [] },
        'rootDimension': null,
        'currentPage': 1,
        'filterMode': 'and'
      });
    },

    // 重設搜尋狀態
    resetSearch() {
      this.update({
        'currentSearchData': null,
        'searchMode': 'smart',
        'traditionalSearchFields': ['all']
      });
    },

    // 重設為初始狀態
    reset() {
      const currentData = this.get('filtered');
      const isDataLoaded = this.get('isDataLoaded');
      
      appState = {
        filtered: currentData,
        filters: {
          startDate: null,
          endDate: null,
          dateFilterType: 'western',
          era: null,
          eraStartYear: null,
          eraEndYear: null,
          title: { major: [], mid: [] },
          keyword: { major: [], mid: [], minor: [] }
        },
        filterMode: 'and',
        rootDimension: null,
        sortOrder: 'relevance',
        currentPage: 1,
        searchMode: 'smart',
        currentSearchData: null,
        traditionalSearchFields: ['all'],
        isInitialized: true,
        isDataLoaded: isDataLoaded
      };
      
      notifyStateChange({ type: 'reset', state: deepClone(appState) });
    },

    // 添加狀態監聽器
    addListener(callback) {
      stateListeners.add(callback);
      return () => {
        stateListeners.delete(callback);
      };
    },

    removeListener(callback) {
      stateListeners.delete(callback);
    },

    clearListeners() {
      stateListeners.clear();
    },

    // 檢查初始化狀態
    isInitialized() {
      return appState.isInitialized;
    },

    isDataLoaded() {
      return appState.isDataLoaded;
    },

    setInitialized(value = true) {
      this.set('isInitialized', value);
    },

    setDataLoaded(value = true) {
      this.set('isDataLoaded', value);
    },

    // 切換篩選模式
    toggleFilterMode() {
      const currentMode = this.get('filterMode');
      const newMode = currentMode === 'and' ? 'or' : 'and';
      this.set('filterMode', newMode);
      return newMode;
    },

    // 取得當前資料集（檢索結果）
    getCurrentDataset() {
      return getBaseDataset();
    },

    // ✅ 核心方法：取得篩選後的資料集
    getFilteredDataset() {
      const baseData = getBaseDataset();
      const filters = this.get('filters');
      const filterMode = this.get('filterMode');

      // 1. 套用日期篩選（兩種模式都適用）
      let filteredData = applyDateFilters(baseData, filters);

      // 2. 根據篩選模式套用分類篩選
      if (filterMode === 'and') {
        filteredData = applyAndModeFilters(filteredData, filters);
      } else {
        filteredData = applyOrModeFilters(filteredData, filters);
      }

      return filteredData;
    },

    // ✅ 核心方法：計算可用選項範圍（漸進式篩選）
    calculateAvailableOptions(dimension, level) {
      const baseData = getBaseDataset();
      const filters = this.get('filters');
      const filterMode = this.get('filterMode');
      
      // 1. 先套用日期篩選
      let availableData = applyDateFilters(baseData, filters);
      
      if (filterMode === 'or') {
        // OR模式：返回完整可用資料
        return availableData;
      }
      
      // AND模式：漸進式篩選
      if (dimension === 'title') {
        // 基於關鍵詞篩選來限制標題選項
        const keywordFilters = filters.keyword;
        if (keywordFilters.major.length > 0 || keywordFilters.mid.length > 0 || keywordFilters.minor.length > 0) {
          availableData = availableData.filter(item => {
            return item.關鍵詞列表.some(kw => {
              const majorMatch = keywordFilters.major.length === 0 || keywordFilters.major.includes(kw.大分類);
              const midMatch = keywordFilters.mid.length === 0 || keywordFilters.mid.includes(kw.中分類);
              const minorMatch = keywordFilters.minor.length === 0 || keywordFilters.minor.includes(kw.小分類);
              return majorMatch && midMatch && minorMatch;
            });
          });
        }
        
        // 如果是標題中分類，還要基於已選的標題大分類
        if (level === 'mid' && filters.title.major.length > 0) {
          availableData = availableData.filter(item => 
            filters.title.major.includes(item.標題大分類)
          );
        }
        
      } else if (dimension === 'keyword') {
        // 基於標題篩選來限制關鍵詞選項
        const titleFilters = filters.title;
        if (titleFilters.major.length > 0 || titleFilters.mid.length > 0) {
          availableData = availableData.filter(item => {
            const majorMatch = titleFilters.major.length === 0 || titleFilters.major.includes(item.標題大分類);
            const midMatch = titleFilters.mid.length === 0 || titleFilters.mid.includes(item.標題中分類);
            return majorMatch && midMatch;
          });
        }
        
        // 基於已選的關鍵詞進行進一步限制
        const kwFilters = filters.keyword;
        if (level === 'mid' && kwFilters.major.length > 0) {
          // 關鍵詞中分類：基於已選大分類
          const relevantItems = [];
          availableData.forEach(item => {
            item.關鍵詞列表.forEach(kw => {
              if (kwFilters.major.includes(kw.大分類)) {
                relevantItems.push(item);
              }
            });
          });
          availableData = [...new Set(relevantItems)];
        } else if (level === 'minor' && (kwFilters.major.length > 0 || kwFilters.mid.length > 0)) {
          // 關鍵詞小分類：基於已選大分類和中分類
          const relevantItems = [];
          availableData.forEach(item => {
            item.關鍵詞列表.forEach(kw => {
              const majorMatch = kwFilters.major.length === 0 || kwFilters.major.includes(kw.大分類);
              const midMatch = kwFilters.mid.length === 0 || kwFilters.mid.includes(kw.中分類);
              if (majorMatch && midMatch) {
                relevantItems.push(item);
              }
            });
          });
          availableData = [...new Set(relevantItems)];
        }
      }
      
      return availableData;
    },

    // 更新根基狀態
    updateRootDimension(dimension) {
      const currentRoot = this.get('rootDimension');
      if (!currentRoot) {
        this.set('rootDimension', dimension);
      }
    },

    // ✅ 取得篩選統計（不包含檢索）
    getFilterStatistics() {
      const filteredData = this.getFilteredDataset();
      const filters = this.get('filters');
      
      const titleFilterCount = (filters.title.major.length || 0) + (filters.title.mid.length || 0);
      const keywordFilterCount = (filters.keyword.major.length || 0) + 
                                 (filters.keyword.mid.length || 0) + 
                                 (filters.keyword.minor.length || 0);
      
      return {
        totalCount: filteredData.length,
        titleFilterCount,
        keywordFilterCount,
        hasActiveFilters: titleFilterCount > 0 || keywordFilterCount > 0,
        hasDateFilter: !!(filters.startDate || filters.endDate || 
                         (filters.dateFilterType === 'japanese' && filters.era)),
        filterMode: this.get('filterMode')
      };
    },

    // ✅ 檢查是否有任何篩選條件（不包含檢索）
    hasAnyFilters() {
      const filters = this.get('filters');
      const stats = this.getFilterStatistics();
      
      return stats.hasActiveFilters || stats.hasDateFilter;
    },

    // 取得篩選模式說明文字
    getFilterModeDescription() {
      const mode = this.get('filterMode');
      return mode === 'and' ? 
        '交集模式：選擇會互相影響，逐步縮小範圍' : 
        '聯集模式：選擇獨立進行，擴大查詢範圍';
    },

    // 取得除錯資訊
    getDebugInfo() {
      return {
        stateSize: JSON.stringify(appState).length,
        listenersCount: stateListeners.size,
        filterMode: appState.filterMode,
        rootDimension: appState.rootDimension,
        hasFilters: this.hasAnyFilters(),
        filterStats: this.getFilterStatistics(),
        currentState: deepClone(appState)
      };
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.StateManager = StateManager;

})(this);