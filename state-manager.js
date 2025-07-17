// state-manager.js - 修正版狀態管理模組

// ========================================
// 狀態管理類別
// ========================================

class StateManager {
  constructor() {
    // 狀態監聽器
    this.listeners = new Set();
    
    // 應用狀態
    this.state = {
      // 篩選條件
      filters: {
        startYear: 1895,
        endYear: 1945,
        startDate: null,
        endDate: null,
        dateFilterType: 'western', // 'western' 或 'japanese'
        era: null, // 明治、大正、昭和
        eraStartYear: null,
        eraEndYear: null,
        title: { type: null, value: null, major: null },
        keyword: { userSelected: { selections: [] } },
        category: { level: null, value: null, parent: null },
        publication: null,
        edition: null
      },
      
      // 檢索模式和資料
      searchMode: 'smart',
      currentSearchData: null,
      
      // 顯示模式
      viewMode: 'simple',
      sortOrder: 'relevance',
      currentPage: 1,
      
      // 系統狀態
      isInitialized: false,
      isDataLoaded: false
    };
    
    // 依賴
    this.dataManager = null;
    this.utils = null;
    
    // 快取
    this.filteredDataCache = new Map();
    this.availableDataCache = new Map();
    
    // 防抖通知
    this.notifyTimer = null;
  }

  // 初始化
  init(dataManager, utils) {
    this.dataManager = dataManager;
    this.utils = utils;
    this.state.isInitialized = true;
    this.notifyStateChange({ type: 'init' });
  }

  // ========================================
  // 基本狀態操作
  // ========================================

  getState() {
    return structuredClone(this.state);
  }

  get(path) {
    const keys = path.split('.');
    let current = this.state;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    
    return current;
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = this.state;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    this.clearCaches();
    this.notifyStateChange({ [path]: value });
  }

  update(updates) {
    const changes = {};
    
    Object.entries(updates).forEach(([path, value]) => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let current = this.state;
      
      for (const key of keys) {
        if (!(key in current) || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[lastKey] = value;
      changes[path] = value;
    });
    
    this.clearCaches();
    this.notifyStateChange(changes);
  }

  // ========================================
  // 篩選邏輯 - 增強版
  // ========================================

  getFilteredDataset() {
    const cacheKey = this.generateCacheKey();
    
    if (this.filteredDataCache.has(cacheKey)) {
      return this.filteredDataCache.get(cacheKey);
    }
    
    const result = this.computeFilteredData();
    this.filteredDataCache.set(cacheKey, result);
    
    // 限制快取大小
    if (this.filteredDataCache.size > 50) {
      const firstKey = this.filteredDataCache.keys().next().value;
      this.filteredDataCache.delete(firstKey);
    }
    
    return result;
  }

  computeFilteredData() {
    let data = this.getBaseDataset();
    
    // 依序套用篩選
    data = this.applyYearFilters(data);
    data = this.applyDateFilters(data);
    data = this.applyTitleFilters(data);
    data = this.applyKeywordFilters(data);
    data = this.applyCategoryFilters(data);
    data = this.applyPublicationFilters(data);
    data = this.applyEditionFilters(data);
    
    return data;
  }

  getBaseDataset() {
    const currentSearchData = this.state.currentSearchData;
    if (currentSearchData?.results) {
      return currentSearchData.results;
    }
    return this.dataManager?.getAllData() || [];
  }

  applyYearFilters(data) {
    const { startYear, endYear } = this.state.filters;
    if (!startYear || !endYear) return data;
    
    return data.filter(item => {
      return item._年份 && item._年份 >= startYear && item._年份 <= endYear;
    });
  }

  // 新增：日期篩選邏輯
  applyDateFilters(data) {
    const filters = this.state.filters;
    
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
        if (filters.eraStartYear && this.utils) {
          startYear = this.utils.convertEraToWestern(filters.era, filters.eraStartYear);
        }
        if (filters.eraEndYear && this.utils) {
          endYear = this.utils.convertEraToWestern(filters.era, filters.eraEndYear);
        }
        if (startYear && item._年份 < startYear) return false;
        if (endYear && item._年份 > endYear) return false;
      }
      
      return true;
    });
  }

  applyTitleFilters(data) {
    const titleFilter = this.state.filters.title;
    if (!titleFilter?.type || !titleFilter?.value) return data;
    
    return data.filter(item => {
      if (titleFilter.type === 'major') {
        return item.標題大分類 === titleFilter.value;
      } else if (titleFilter.type === 'mid') {
        return item.標題中分類 === titleFilter.value && 
               item.標題大分類 === titleFilter.major;
      }
      return true;
    });
  }

  applyKeywordFilters(data) {
    const selections = this.state.filters.keyword?.userSelected?.selections;
    if (!selections?.length) return data;
    
    return data.filter(item => {
      if (!item.關鍵詞列表?.length) return false;
      
      return selections.every(selection => {
        return item.關鍵詞列表.some(kw => {
          if (!kw || kw.大分類 !== selection.major) return false;
          
          if (selection.type === 'mid') {
            return kw.中分類 === selection.value;
          } else if (selection.type === 'minor') {
            return kw.中分類 === selection.mid && kw.小分類 === selection.value;
          }
          return false;
        });
      });
    });
  }

  applyCategoryFilters(data) {
    const categoryFilter = this.state.filters.category;
    if (!categoryFilter?.level || !categoryFilter?.value) return data;
    
    return data.filter(item => {
      if (categoryFilter.level === 'category') {
        return item['分類'] === categoryFilter.value;
      }
      return true;
    });
  }

  applyPublicationFilters(data) {
    const publication = this.state.filters.publication;
    if (!publication) return data;
    
    return data.filter(item => item.刊別 === publication);
  }

  applyEditionFilters(data) {
    const edition = this.state.filters.edition;
    if (!edition) return data;
    
    return data.filter(item => String(item.版次) === String(edition));
  }

  // ========================================
  // 協同篩選方法 - 增強版
  // ========================================

  getAvailableData(excludeFilter) {
    const cacheKey = `available-${excludeFilter || 'none'}`;
    
    if (this.availableDataCache.has(cacheKey)) {
      return this.availableDataCache.get(cacheKey);
    }
    
    const baseData = this.getBaseDataset();
    const filters = structuredClone(this.state.filters);
    
    // 排除指定的篩選條件
    if (excludeFilter) {
      switch (excludeFilter) {
        case 'title':
          filters.title = { type: null, value: null, major: null };
          break;
        case 'keyword':
          filters.keyword = { userSelected: { selections: [] } };
          break;
        case 'category':
          filters.category = { level: null, value: null, parent: null };
          break;
        case 'publication':
          filters.publication = null;
          break;
        case 'edition':
          filters.edition = null;
          break;
        case 'year':
          filters.startYear = 1895;
          filters.endYear = 1945;
          break;
        case 'date':
          filters.startDate = null;
          filters.endDate = null;
          filters.era = null;
          filters.eraStartYear = null;
          filters.eraEndYear = null;
          break;
      }
    }
    
    // 套用篩選
    let result = [...baseData];
    
    if (filters.startYear && filters.endYear) {
      result = result.filter(item => 
        item._年份 && item._年份 >= filters.startYear && item._年份 <= filters.endYear
      );
    }
    
    // 日期篩選
    if (filters.startDate || filters.endDate) {
      result = result.filter(item => {
        if (!item._日期) return false;
        if (filters.startDate && item._日期 < filters.startDate) return false;
        if (filters.endDate && item._日期 > filters.endDate) return false;
        return true;
      });
    }
    
    // 日治年號篩選
    if (filters.dateFilterType === 'japanese' && filters.era) {
      result = result.filter(item => {
        if (!item._年份) return false;
        let startYear = null;
        let endYear = null;
        if (filters.eraStartYear && this.utils) {
          startYear = this.utils.convertEraToWestern(filters.era, filters.eraStartYear);
        }
        if (filters.eraEndYear && this.utils) {
          endYear = this.utils.convertEraToWestern(filters.era, filters.eraEndYear);
        }
        if (startYear && item._年份 < startYear) return false;
        if (endYear && item._年份 > endYear) return false;
        return true;
      });
    }
    
    if (filters.title?.type && filters.title?.value) {
      result = result.filter(item => {
        if (filters.title.type === 'major') {
          return item.標題大分類 === filters.title.value;
        } else if (filters.title.type === 'mid') {
          return item.標題中分類 === filters.title.value;
        }
        return true;
      });
    }
    
    if (filters.keyword?.userSelected?.selections?.length) {
      result = result.filter(item => {
        if (!item.關鍵詞列表?.length) return false;
        return filters.keyword.userSelected.selections.every(selection => {
          return item.關鍵詞列表.some(kw => {
            if (!kw || kw.大分類 !== selection.major) return false;
            if (selection.type === 'mid') {
              return kw.中分類 === selection.value;
            } else if (selection.type === 'minor') {
              return kw.中分類 === selection.mid && kw.小分類 === selection.value;
            }
            return false;
          });
        });
      });
    }
    
    if (filters.category?.level && filters.category?.value) {
      result = result.filter(item => {
        if (filters.category.level === 'category') {
          return item['分類'] === filters.category.value;
        }
        return true;
      });
    }
    
    if (filters.publication) {
      result = result.filter(item => item.刊別 === filters.publication);
    }
    
    if (filters.edition) {
      result = result.filter(item => String(item.版次) === String(filters.edition));
    }
    
    this.availableDataCache.set(cacheKey, result);
    
    // 限制快取大小
    if (this.availableDataCache.size > 20) {
      const firstKey = this.availableDataCache.keys().next().value;
      this.availableDataCache.delete(firstKey);
    }
    
    return result;
  }

  // ========================================
  // 篩選器操作方法 - 增強版
  // ========================================

  setTitleFilter(level, value, parent = null) {
    const currentFilter = this.state.filters.title;
    
    if (currentFilter.type === (level === 1 ? 'major' : 'mid') && 
        currentFilter.value === value) {
      this.clearTitleFilter();
      return;
    }
    
    if (level === 1) {
      this.update({
        'filters.title.type': 'major',
        'filters.title.value': value,
        'filters.title.major': null
      });
    } else if (level === 2) {
      this.update({
        'filters.title.type': 'mid',
        'filters.title.value': value,
        'filters.title.major': parent
      });
    }
    
    this.triggerFilterChange();
  }

  clearTitleFilter() {
    this.update({
      'filters.title.type': null,
      'filters.title.value': null,
      'filters.title.major': null
    });
    this.triggerFilterChange();
  }

  toggleKeywordSelection(selection) {
    const selections = this.state.filters.keyword.userSelected.selections || [];
    
    const existingIndex = selections.findIndex(s => 
      s.major === selection.major &&
      s.type === selection.type &&
      s.value === selection.value &&
      (selection.type === 'minor' ? s.mid === selection.mid : true)
    );
    
    let newSelections;
    if (existingIndex >= 0) {
      newSelections = selections.filter((_, index) => index !== existingIndex);
    } else {
      newSelections = [...selections, selection];
    }
    
    this.update({
      'filters.keyword.userSelected.selections': newSelections
    });
    this.triggerFilterChange();
  }

  clearKeywordFilters() {
    this.update({
      'filters.keyword.userSelected.selections': []
    });
    this.triggerFilterChange();
  }

  setCategoryFilter(level, value, parent = null) {
    if (level !== 'category') {
      console.warn('[StateManager] 欄目篩選只支援 category 層級');
      return;
    }
    
    const currentFilter = this.state.filters.category;
    
    if (currentFilter.level === level && currentFilter.value === value) {
      this.clearCategoryFilter();
      return;
    }
    
    this.update({
      'filters.category.level': level,
      'filters.category.value': value,
      'filters.category.parent': parent
    });
    this.triggerFilterChange();
  }

  clearCategoryFilter() {
    this.update({
      'filters.category.level': null,
      'filters.category.value': null,
      'filters.category.parent': null
    });
    this.triggerFilterChange();
  }

  setPublicationFilter(publication) {
    const currentPublication = this.state.filters.publication;
    
    if (currentPublication === publication) {
      this.set('filters.publication', null);
    } else {
      this.set('filters.publication', publication);
    }
    this.triggerFilterChange();
  }

  setEditionFilter(edition) {
    const currentEdition = this.state.filters.edition;
    
    if (String(currentEdition) === String(edition)) {
      this.set('filters.edition', null);
    } else {
      this.set('filters.edition', edition);
    }
    this.triggerFilterChange();
  }

  // 新增：日期篩選操作方法
  setDateFilter(startDate, endDate) {
    this.update({
      'filters.startDate': startDate,
      'filters.endDate': endDate,
      'filters.dateFilterType': 'western'
    });
    this.triggerFilterChange();
  }

  setEraFilter(era, startYear, endYear) {
    this.update({
      'filters.era': era,
      'filters.eraStartYear': startYear,
      'filters.eraEndYear': endYear,
      'filters.dateFilterType': 'japanese'
    });
    this.triggerFilterChange();
  }

  clearDateFilter() {
    this.update({
      'filters.startDate': null,
      'filters.endDate': null,
      'filters.era': null,
      'filters.eraStartYear': null,
      'filters.eraEndYear': null,
      'filters.dateFilterType': 'western'
    });
    this.triggerFilterChange();
  }

  resetFilters() {
    this.update({
      'filters.startYear': 1895,
      'filters.endYear': 1945,
      'filters.startDate': null,
      'filters.endDate': null,
      'filters.dateFilterType': 'western',
      'filters.era': null,
      'filters.eraStartYear': null,
      'filters.eraEndYear': null,
      'filters.title': { type: null, value: null, major: null },
      'filters.keyword': { userSelected: { selections: [] } },
      'filters.category': { level: null, value: null, parent: null },
      'filters.publication': null,
      'filters.edition': null,
      'currentPage': 1
    });
    this.triggerFilterChange();
  }

  // ========================================
  // 選項列表方法
  // ========================================

  getAvailablePublications() {
    const data = this.getAvailableData('publication');
    const publications = new Set();
    
    data.forEach(item => {
      const pub = item.刊別;
      if (pub) publications.add(pub);
    });
    
    return Array.from(publications).sort();
  }

  getAvailableEditions() {
    const data = this.getAvailableData('edition');
    const editions = new Set();
    
    data.forEach(item => {
      const edition = item.版次;
      if (edition) editions.add(String(edition));
    });
    
    return Array.from(editions).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
  }

  // ========================================
  // 狀態檢查方法
  // ========================================

  isDataLoaded() {
    return this.state.isDataLoaded;
  }

  setDataLoaded(value = true) {
    this.set('isDataLoaded', value);
  }

  // ========================================
  // 監聽器管理
  // ========================================

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyStateChange(changes) {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
    }
    
    this.notifyTimer = setTimeout(() => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          this.listeners.forEach(listener => {
            try {
              listener(changes, this.state);
            } catch (error) {
              console.error('狀態監聽器錯誤:', error);
            }
          });
          this.notifyTimer = null;
        });
      } else {
        this.listeners.forEach(listener => {
          try {
            listener(changes, this.state);
          } catch (error) {
            console.error('狀態監聽器錯誤:', error);
          }
        });
        this.notifyTimer = null;
      }
    }, 16);
  }

  triggerFilterChange() {
    this.state.currentPage = 1;
    this.clearCaches();
    
    this.notifyStateChange({
      currentPage: 1,
      filters: this.state.filters,
      type: 'filterChange'
    });
    
    // 也觸發DOM事件
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const event = new CustomEvent('stateChange', {
          detail: {
            type: 'filterChange',
            filters: this.state.filters
          }
        });
        window.dispatchEvent(event);
      }, 0);
    }
  }

  // ========================================
  // 工具方法 - 增強版
  // ========================================

  generateCacheKey() {
    const filters = this.state.filters;
    const searchId = this.state.currentSearchData?.query || 'no-search';
    
    const dateKey = filters.startDate || filters.endDate ? 
      `${filters.startDate?.getTime()}-${filters.endDate?.getTime()}` : 'no-date';
    
    const eraKey = filters.era ? 
      `${filters.era}-${filters.eraStartYear}-${filters.eraEndYear}` : 'no-era';
    
    return `${searchId}-${filters.startYear}-${filters.endYear}-${dateKey}-${eraKey}-${
      filters.title.type || 'no-title'
    }-${filters.keyword.userSelected.selections.length}-${
      filters.category.level || 'no-category'
    }-${filters.publication || 'no-pub'}-${filters.edition || 'no-edition'}`;
  }

  clearCaches() {
    this.filteredDataCache.clear();
    this.availableDataCache.clear();
  }

  cleanup() {
    this.listeners.clear();
    this.clearCaches();
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
  }
}

// 導出單例
export const stateManager = new StateManager();
