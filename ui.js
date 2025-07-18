// ui.js - 優化版UI管理模組（增強渲染效能和互動體驗）

// ========================================
// UI管理類別（優化版）
// ========================================

class UIManager {
  constructor() {
    // 依賴注入
    this._stateManager = null;
    this._dataManager = null;
    this._searchManager = null;
    this._utils = null;
    this._chartManager = null;
    this._treeFilterManager = null;
    
    // 設定
    this._itemsPerPage = 20;
    
    // 高效能快取系統
    this._cache = {
      renderedCards: new Map(),
      highlightedTexts: new Map(),
      filterTags: new Map(),
      generatedHTML: new Map()
    };
    this._maxCacheSize = 100;
    
    // 事件處理器
    this._eventHandlers = new Map();
    this._boundEvents = new Set();
    
    // 虛擬化渲染（針對大量資料）
    this._virtualRender = {
      enabled: false,
      viewportHeight: 0,
      itemHeight: 200,
      buffer: 5
    };
    
    // 防抖和節流控制
    this._debouncedRender = null;
    this._renderQueue = new Set();
    this._isRendering = false;
    
    // 效能監控
    this._performanceMetrics = {
      renderCount: 0,
      totalRenderTime: 0,
      cacheHitCount: 0,
      averageRenderTime: 0
    };
  }

  // ========================================
  // 初始化（優化版）
  // ========================================

  init(stateManager, dataManager, searchManager, utils, chartManager, treeFilterManager) {
    this._stateManager = stateManager;
    this._dataManager = dataManager;
    this._searchManager = searchManager;
    this._utils = utils;
    this._chartManager = chartManager;
    this._treeFilterManager = treeFilterManager;
    
    console.log('[UIManager] 初始化');
    
    try {
      // 初始化防抖渲染
      this._debouncedRender = this._utils.debounce(() => {
        this._processRenderQueue();
      }, 16); // 60fps
      
      // 監聽狀態變更
      if (window.addEventListener) {
        const stateChangeHandler = (event) => {
          console.log('[UIManager] 收到狀態變更事件');
          this._queueRender('stateChange', event.detail);
        };
        
        window.addEventListener('stateChange', stateChangeHandler);
        this._boundEvents.add({ type: 'stateChange', handler: stateChangeHandler });
      }
      
      this._initializeFilterEvents();
      this._bindGlobalClearFunction();
      this._setupVirtualization();
      
      console.log('[UIManager] 初始化完成');
    } catch (error) {
      console.error('[UIManager] 初始化失敗:', error);
    }
  }

  _initializeFilterEvents() {
    try {
      // 延遲綁定，確保DOM準備就緒
      setTimeout(() => {
        this._bindPublicationEvents();
        this._bindEditionEvents();
        this._bindResetButtonEvent();
      }, 100);
    } catch (error) {
      console.error('[UIManager] 初始化篩選器事件失敗:', error);
    }
  }

  _setupVirtualization() {
    // 檢測是否需要啟用虛擬化渲染
    if (typeof window !== 'undefined') {
      this._virtualRender.viewportHeight = window.innerHeight;
      
      // 當資料量大於100筆時啟用虛擬化
      const dataLoadHandler = () => {
        if (this._dataManager?.isDataLoaded()) {
          const totalItems = this._dataManager.getAllData().length;
          this._virtualRender.enabled = totalItems > 100;
          console.log(`[UIManager] 虛擬化渲染: ${this._virtualRender.enabled ? '啟用' : '停用'}`);
        }
      };
      
      window.addEventListener('stateChange', dataLoadHandler);
      this._boundEvents.add({ type: 'stateChange', handler: dataLoadHandler });
    }
  }

  _bindGlobalClearFunction() {
    // 全域清除函數（優化版）
    window.clearAllActiveFilters = () => {
      if (this._stateManager) {
        console.log('[clearAllActiveFilters] 清除所有篩選條件和搜尋資料');
        
        // 批次狀態更新
        this._stateManager.update({
          'currentSearchData': null,
          'currentPage': 1,
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
          'filters.edition': null
        });
        
        // 清除搜尋輸入框
        this._clearAllSearchInputs();
        
        // 重置UI元素
        this._resetUIElements();
        
        // 清除快取
        this._clearCache();
        
        // 觸發UI更新
        this._triggerStateChange();
      }
    };

    // 個別移除檢索條件的函數（優化版）
    window.removeSearchCondition = (conditionIndex) => {
      const searchData = this._stateManager.get('currentSearchData');
      if (!searchData) return;

      if (searchData.mode === 'advanced' && searchData.conditions) {
        const newConditions = searchData.conditions.filter((_, index) => index !== conditionIndex);
        
        if (newConditions.length === 0) {
          // 清除搜尋
          this._clearSearchState();
        } else if (newConditions.length === 1) {
          // 轉換為一般檢索
          this._convertToGeneralSearch(newConditions[0], searchData);
        } else {
          // 更新進階檢索條件
          const updatedSearchData = { ...searchData, conditions: newConditions };
          this._stateManager.set('currentSearchData', updatedSearchData);
        }
        
        this._triggerStateChange();
      }
    };
  }

  _clearAllSearchInputs() {
    const searchInputs = [
      'nlp-search-input',
      'general-search-input'
    ];
    
    searchInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) input.value = '';
    });
    
    // 清除進階檢索條件
    const advancedConditions = document.getElementById('advanced-conditions');
    if (advancedConditions) {
      advancedConditions.innerHTML = '';
      advancedConditions.style.display = 'none';
    }
    
    const advancedToggle = document.getElementById('advanced-search-toggle');
    if (advancedToggle) {
      advancedToggle.checked = false;
    }
    
    const addConditionBtn = document.getElementById('add-advanced-condition-btn');
    if (addConditionBtn) {
      addConditionBtn.style.display = 'none';
    }
  }

  _clearSearchState() {
    this._stateManager.set('currentSearchData', null);
    this._stateManager.set('currentPage', 1);
    this._clearAllSearchInputs();
  }

  _convertToGeneralSearch(condition, originalSearchData) {
    const newSearchData = {
      query: condition.value,
      normalizedQuery: this._utils ? this._utils.normalizeText(condition.value) : condition.value,
      results: originalSearchData.results,
      fieldType: condition.field,
      operator: 'AND',
      searchTerms: [{ value: condition.value, operator: 'AND', type: 'term' }],
      mode: 'general'
    };
    
    this._stateManager.set('currentSearchData', newSearchData);
    
    // 更新一般檢索輸入框
    const generalInput = document.getElementById('general-search-input');
    const fieldSelect = document.getElementById('general-search-field');
    if (generalInput) generalInput.value = condition.value;
    if (fieldSelect) fieldSelect.value = condition.field;
  }

  _resetUIElements() {
    // 批次重置UI元素
    const resets = [
      { id: 'start-year-input', value: '1895' },
      { id: 'end-year-input', value: '1945' },
      { id: 'date-range-picker', value: '1895-01-01 to 1945-12-31' },
      { id: 'publication-select', value: '' },
      { id: 'edition-select', value: '' }
    ];
    
    resets.forEach(({ id, value }) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });
    
    // 重置按鈕狀態
    const smartSearchBtn = document.getElementById('nlp-search-btn');
    if (smartSearchBtn) smartSearchBtn.disabled = true;
    
    // 隱藏元素
    const elementsToHide = [
      'query-analysis',
      'clear-search',
      'related-keywords-smart',
      'related-keywords-general'
    ];
    
    elementsToHide.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('hidden');
        if (id.includes('list')) element.innerHTML = '';
      }
    });
    
    // 重置日期篩選類型
    const westernRadio = document.querySelector('input[name="general-date-filter-type"][value="western"]');
    if (westernRadio) westernRadio.checked = true;
  }

  // ========================================
  // 高效能渲染系統
  // ========================================

  _queueRender(type, data) {
    this._renderQueue.add({ type, data, timestamp: Date.now() });
    if (this._debouncedRender) {
      this._debouncedRender();
    }
  }

  async _processRenderQueue() {
    if (this._isRendering || this._renderQueue.size === 0) return;
    
    this._isRendering = true;
    const startTime = performance.now();
    
    try {
      // 處理所有排隊的渲染任務
      const tasks = Array.from(this._renderQueue);
      this._renderQueue.clear();
      
      // 按優先級處理任務
      const prioritizedTasks = this._prioritizeTasks(tasks);
      
      for (const task of prioritizedTasks) {
        await this._executeRenderTask(task);
      }
      
      // 更新效能指標
      this._updatePerformanceMetrics(startTime);
      
    } catch (error) {
      console.error('[UIManager] 渲染隊列處理失敗:', error);
    } finally {
      this._isRendering = false;
    }
  }

  _prioritizeTasks(tasks) {
    const priority = {
      'stateChange': 1,
      'filterChange': 2,
      'pageChange': 3,
      'viewModeChange': 4
    };
    
    return tasks.sort((a, b) => {
      const priorityA = priority[a.type] || 999;
      const priorityB = priority[b.type] || 999;
      return priorityA - priorityB;
    });
  }

  async _executeRenderTask(task) {
    switch (task.type) {
      case 'stateChange':
        await this.updateAllUI();
        break;
      case 'filterChange':
        await this._updateFilterDisplay();
        break;
      case 'pageChange':
        await this._updatePageContent();
        break;
      case 'viewModeChange':
        await this._updateViewMode();
        break;
      default:
        console.warn('[UIManager] 未知的渲染任務類型:', task.type);
    }
  }

  // ========================================
  // 私有方法 - 匹配檢查（優化版）
  // ========================================

  _checkSearchMatch(text, searchData, searchMode) {
    if (!text || !searchData || !this._searchManager || !searchData.query) {
      return false;
    }
    
    // 快取檢查
    const cacheKey = `match_${text}_${searchData.query}_${searchMode}`;
    if (this._cache.highlightedTexts.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.highlightedTexts.get(cacheKey);
    }
    
    try {
      const result = this._searchManager.containsSearchTerms(text, searchData, searchMode);
      this._setCacheItem('highlightedTexts', cacheKey, result);
      return result;
    } catch (error) {
      console.warn('[checkSearchMatch] 搜尋匹配檢查錯誤:', error);
      return false;
    }
  }

  _checkFieldSearchMatch(text, searchData, fieldType) {
    if (!text || !searchData || !this._searchManager || !searchData.query) {
      return false;
    }
    
    const cacheKey = `fieldMatch_${text}_${searchData.query}_${fieldType}`;
    if (this._cache.highlightedTexts.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.highlightedTexts.get(cacheKey);
    }
    
    let result = false;
    
    // 智能檢索：檢查所有欄位
    if (searchData.mode === 'smart') {
      result = this._searchManager.containsSearchTerms(text, searchData, 'smart');
    }
    // 一般檢索：檢查指定欄位
    else if (searchData.mode === 'general') {
      const isTargetField = searchData.fieldType === fieldType || searchData.fieldType === 'all';
      if (isTargetField) {
        result = this._searchManager.containsSearchTerms(text, searchData, 'general');
      }
    }
    // 進階檢索：檢查條件中是否包含該欄位
    else if (searchData.mode === 'advanced' && searchData.conditions) {
      const hasTargetField = searchData.conditions.some(condition => 
        condition.field === fieldType || condition.field === 'all'
      );
      if (hasTargetField) {
        result = this._searchManager.containsSearchTerms(text, searchData, 'advanced');
      }
    }
    
    this._setCacheItem('highlightedTexts', cacheKey, result);
    return result;
  }

  _checkFilterMatch(item, filters, field, value = null) {
    const cacheKey = `filter_${item.資料編號}_${field}_${JSON.stringify(value)}`;
    if (this._cache.highlightedTexts.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.highlightedTexts.get(cacheKey);
    }
    
    let result = false;
    
    switch (field) {
      case 'title':
        result = this._checkTitleFilterMatch(item, filters.title);
        break;
      case 'keyword':
        result = value ? this._checkKeywordFilterMatch(value, filters.keyword) : false;
        break;
      case 'category':
        result = this._checkCategoryFilterMatch(item, filters.category);
        break;
      case 'publication':
        result = this._checkPublicationFilterMatch(item, filters.publication);
        break;
      case 'edition':
        result = this._checkEditionFilterMatch(item, filters.edition);
        break;
    }
    
    this._setCacheItem('highlightedTexts', cacheKey, result);
    return result;
  }

  _checkTitleFilterMatch(item, titleFilter) {
    if (!titleFilter || !titleFilter.type || !titleFilter.value) return false;
    
    if (titleFilter.type === 'major') {
      return item.標題大分類 === titleFilter.value;
    } else if (titleFilter.type === 'mid') {
      return item.標題中分類 === titleFilter.value;
    }
    return false;
  }

  _checkKeywordFilterMatch(kw, keywordFilters) {
    if (!keywordFilters || !kw) return false;
    
    const selections = keywordFilters.userSelected?.selections || [];
    
    return selections.some(selection => {
      if (kw.大分類 !== selection.major) return false;
      
      if (selection.type === 'mid') {
        return kw.中分類 === selection.value;
      } else if (selection.type === 'minor') {
        return kw.中分類 === selection.mid && kw.小分類 === selection.value;
      }
      
      return false;
    });
  }

  _checkCategoryFilterMatch(item, categoryFilter) {
    if (!categoryFilter || !categoryFilter.level || !categoryFilter.value) return false;
    
    if (categoryFilter.level === 'category') {
      return item['分類'] === categoryFilter.value;
    }
    return false;
  }

  _checkPublicationFilterMatch(item, publication) {
    if (!publication) return false;
    return item.刊別 === publication;
  }

  _checkEditionFilterMatch(item, edition) {
    if (!edition) return false;
    return String(item.版次) === String(edition);
  }

  _getHighlightClass(searchMatch, filterMatch) {
    if (searchMatch) return 'search-highlight';
    if (filterMatch) return 'filter-highlight';
    return '';
  }

  _highlightSearchTerms(text, searchData, searchMode) {
    if (!text) return '';
    
    const cacheKey = `highlight_${text}_${searchData?.query}_${searchMode}`;
    if (this._cache.highlightedTexts.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.highlightedTexts.get(cacheKey);
    }
    
    const safeText = this._utils ? this._utils.safe(text) : String(text);
    
    if (!this._searchManager || !searchData || !searchData.query) {
      this._setCacheItem('highlightedTexts', cacheKey, safeText);
      return safeText;
    }
    
    try {
      const result = this._searchManager.highlightSearchTerms(safeText, searchData, searchMode);
      this._setCacheItem('highlightedTexts', cacheKey, result);
      return result;
    } catch (error) {
      console.warn('[highlightSearchTerms] 搜尋詞高亮錯誤:', error);
      this._setCacheItem('highlightedTexts', cacheKey, safeText);
      return safeText;
    }
  }

  // ========================================
  // 私有方法 - 高效能卡片生成
  // ========================================

  _generateSimpleCard(item, index, searchData, searchMode, filters) {
    const cacheKey = `simple_${item.資料編號}_${searchData?.query || 'none'}_${searchMode}`;
    if (this._cache.renderedCards.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.renderedCards.get(cacheKey);
    }
    
    try {
      const startIndex = this._getCurrentPageStartIndex();
      const cardIndex = startIndex + index + 1;
      
      // 安全取得項目資料
      const title = item.題名 || '(無標題)';
      const author = item.作者 || '';
      const publishDate = item._日期 ? 
        (this._utils.formatDate ? this._utils.formatDate(item._日期) : item._日期.toLocaleDateString()) : 
        (item.時間 || '');
      
      // 檢查匹配狀態
      const titleSearchMatch = this._checkFieldSearchMatch(title, searchData, 'title');
      const titleFilterMatch = this._checkFilterMatch(item, filters, 'title');
      
      // 生成各部分內容
      const categoryText = this._generateSimpleCategoryText(item, searchData, searchMode, filters);
      const columnText = this._generateSimpleColumnText(item, searchData, searchMode, filters);
      const keywordSection = this._generateSimpleKeywordSection(item, searchData, searchMode, filters);
      
      const html = `
        <div class="data-card simple-card">
          <div class="simple-card-header">
            <div class="card-number">${cardIndex}</div>
            <div class="simple-card-content">
              <div class="simple-title-row">
                <div class="simple-title ${this._getHighlightClass(titleSearchMatch, titleFilterMatch)}">
                  ${this._highlightSearchTerms(title, searchData, searchMode)}
                </div>
                <div class="simple-category-inline">
                  ${categoryText}
                </div>
              </div>
              <div class="simple-info-row">
                <span class="simple-date">
                  出版日期：${publishDate}
                </span>
                ${author ? `<span class="simple-author simple-date">作者：${this._utils ? this._utils.safe(author) : author}</span>` : ''}
                ${columnText}
              </div>
              ${keywordSection ? `<div class="simple-keywords">
                <div class="simple-keywords-header">
                  <span class="simple-keywords-label">關鍵詞：</span>
                  ${keywordSection}
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>
      `;
      
      this._setCacheItem('renderedCards', cacheKey, html);
      return html;
    } catch (error) {
      console.error('[generateSimpleCard] 卡片生成錯誤:', error, item);
      return `
        <div class="data-card error-card">
          <div class="p-4">
            <div class="text-red-600">卡片 ${index + 1} 生成錯誤</div>
            <div class="text-sm text-gray-500">資料編號：${item.資料編號 || 'N/A'}</div>
          </div>
        </div>
      `;
    }
  }

  _generateDetailedCard(item, index, searchData, searchMode, filters) {
    const cacheKey = `detailed_${item.資料編號}_${searchData?.query || 'none'}_${searchMode}`;
    if (this._cache.renderedCards.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.renderedCards.get(cacheKey);
    }
    
    try {
      const startIndex = this._getCurrentPageStartIndex();
      const cardIndex = startIndex + index + 1;
      
      // 安全取得項目資料
      const title = item.題名 || '(無標題)';
      const author = item.作者 || '';
      const publishDate = item._日期 ? 
        (this._utils.formatDate ? this._utils.formatDate(item._日期) : item._日期.toLocaleDateString()) : 
        (item.時間 || '');
      
      const titleSearchMatch = this._checkFieldSearchMatch(title, searchData, 'title');
      const titleFilterMatch = this._checkFilterMatch(item, filters, 'title');
      const categoryText = this._generateSimpleCategoryText(item, searchData, searchMode, filters);
      const columnText = this._generateSimpleColumnText(item, searchData, searchMode, filters);
      
      // 詳目關鍵詞區域
      const detailedKeywordSection = this._generateDetailedKeywordSection(item, searchData, searchMode, filters);
      
      // 檢查其他欄位的篩選匹配
      const publicationFilterMatch = this._checkFilterMatch(item, filters, 'publication');
      const editionFilterMatch = this._checkFilterMatch(item, filters, 'edition');
      
      const html = `
        <div class="data-card detailed-card">
          <div class="simple-card-header">
            <div class="card-number">${cardIndex}</div>
            <div class="simple-card-content">
              <div class="simple-title-row">
                <div class="simple-title ${this._getHighlightClass(titleSearchMatch, titleFilterMatch)}">
                  ${this._highlightSearchTerms(title, searchData, searchMode)}
                </div>
                <div class="simple-category-inline">
                  ${categoryText}
                </div>
              </div>
              <div class="simple-info-row">
                <span class="simple-date">出版日期：${publishDate}</span>
                ${author ? `<span class="simple-author simple-date">作者：${this._utils ? this._utils.safe(author) : author}</span>` : ''}
                ${columnText}
                ${item.刊別 ? `<span class='card-publication simple-date ${this._getHighlightClass(false, publicationFilterMatch)}'>刊別：${this._utils ? this._utils.safe(item.刊別) : item.刊別}</span>` : ''}
                ${item.語文 ? `<span class='card-language simple-date'>語文：${this._utils ? this._utils.safe(item.語文) : item.語文}</span>` : ''}
                ${item.版次 ? `<span class='card-edition simple-date ${this._getHighlightClass(false, editionFilterMatch)}'>版次：${this._utils ? this._utils.safe(item.版次) : item.版次}</span>` : ''}
              </div>
              ${detailedKeywordSection ? `<div class="simple-keywords">
                <div class="simple-keywords-header">
                  <span class="simple-keywords-label">關鍵詞：</span>
                  ${detailedKeywordSection}
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>
      `;
      
      this._setCacheItem('renderedCards', cacheKey, html);
      return html;
    } catch (error) {
      console.error('[generateDetailedCard] 卡片生成錯誤:', error, item);
      return `
        <div class="data-card error-card">
          <div class="p-4">
            <div class="text-red-600">詳目卡片 ${index + 1} 生成錯誤</div>
            <div class="text-sm text-gray-500">資料編號：${item.資料編號 || 'N/A'}</div>
          </div>
        </div>
      `;
    }
  }

  _generateSimpleCategoryText(item, searchData, searchMode, filters) {
    try {
      const majorClass = item.標題大分類 || '';
      const midClass = item.標題中分類 || '';
      if (!majorClass) return '<span class="text-gray-400">無分類</span>';
      
      // 檢查題名篩選匹配
      const titleFilterMatch = this._checkFilterMatch(item, filters, 'title');
      
      // 檢查題名欄位的檢索匹配
      const majorSearchMatch = this._checkFieldSearchMatch(majorClass, searchData, 'title');
      const midSearchMatch = midClass ? this._checkFieldSearchMatch(midClass, searchData, 'title') : false;
      
      // 分別標亮大分類與中分類
      const majorHighlighted = `<span class="${this._getHighlightClass(majorSearchMatch, titleFilterMatch)}">
        ${this._highlightSearchTerms(majorClass, searchData, searchMode)}
      </span>`;
      
      const midHighlighted = midClass ? `<span class="${this._getHighlightClass(midSearchMatch, titleFilterMatch)}">
        ${this._highlightSearchTerms(midClass, searchData, searchMode)}
      </span>` : '';
      
      const categoryText = midHighlighted ? `${majorHighlighted} / ${midHighlighted}` : majorHighlighted;
      return `<span class="simple-category-text">${categoryText}</span>`;
    } catch (error) {
      console.error('[generateSimpleCategoryText] 錯誤:', error);
      return '<span class="text-gray-400">分類錯誤</span>';
    }
  }

  _generateSimpleColumnText(item, searchData, searchMode, filters) {
    try {
      const column = item['分類'] || '';
      if (!column) return '';
      
      // 檢查欄目篩選匹配
      const columnFilterMatch = this._checkFilterMatch(item, filters, 'category');
      
      // 檢查欄目欄位的檢索匹配
      const columnSearchMatch = this._checkFieldSearchMatch(column, searchData, 'category');
      
      const highlightClass = this._getHighlightClass(columnSearchMatch, columnFilterMatch);
      const highlightedColumn = `<span class="${highlightClass}">
        ${this._highlightSearchTerms(column, searchData, searchMode)}
      </span>`;
      
      return `<span class="simple-class-text simple-date">欄目: ${highlightedColumn}</span>`;
    } catch (error) {
      console.error('[generateSimpleColumnText] 錯誤:', error);
      return '';
    }
  }

  _generateSimpleKeywordSection(item, searchData, searchMode, filters) {
    try {
      if (!item.關鍵詞列表 || item.關鍵詞列表.length === 0) {
        return '';
      }

      // 安全提取關鍵詞
      const allKeywords = [];
      item.關鍵詞列表.forEach(kwGroup => {
        if (kwGroup && kwGroup.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
          kwGroup.關鍵詞.forEach(keyword => {
            if (keyword) {
              allKeywords.push({
                keyword: keyword,
                kwGroup: kwGroup
              });
            }
          });
        }
      });

      if (allKeywords.length === 0) {
        return '';
      }

      // 限制顯示的關鍵詞數量
      const displayKeywords = allKeywords.slice(0, 10);
      
      const keywordTags = displayKeywords.map(({ keyword, kwGroup }, idx) => {
        // 檢查關鍵詞篩選匹配
        const kwFilterMatch = this._checkFilterMatch(item, filters, 'keyword', kwGroup);
        
        // 檢查關鍵詞欄位的檢索匹配
        const kwSearchMatch = this._checkFieldSearchMatch(keyword, searchData, 'keyword');
        
        const highlightClass = this._getHighlightClass(kwSearchMatch, kwFilterMatch);
        
        const categoryParts = [kwGroup.大分類, kwGroup.中分類, kwGroup.小分類].filter(Boolean);
        const categoryPath = categoryParts.length > 0 ? categoryParts.join(' / ') : '無分類';
        
        const dropdownId = `keyword-dropdown-${item.資料編號}-${idx}`;
        const safeKeyword = this._utils ? this._utils.safe(keyword) : String(keyword);
        
        return `
          <div class="simple-keyword-item">
            <span class="simple-keyword-tag ${highlightClass}" onclick="toggleKeywordDropdown('${dropdownId}')">
              ${this._highlightSearchTerms(safeKeyword, searchData, searchMode)}
            </span>
            <div id="${dropdownId}" class="keyword-dropdown-content hidden">
              <div class="keyword-category-info">
                <div class="category-label">分類路徑：</div>
                <div class="category-path ${this._getHighlightClass(kwSearchMatch, kwFilterMatch)}">
                  ${this._highlightSearchTerms(categoryPath, searchData, searchMode)}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      const moreCount = allKeywords.length - displayKeywords.length;
      const moreText = moreCount > 0 ? `<span class="simple-keyword-more">+${moreCount}個</span>` : '';

      return `
        <div class="simple-keywords-container">
          <div class="simple-keywords-tags">
            ${keywordTags}
            ${moreText}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('[generateSimpleKeywordSection] 錯誤:', error);
      return '';
    }
  }

  _generateDetailedKeywordSection(item, searchData, searchMode, filters) {
    try {
      if (!item.關鍵詞列表 || item.關鍵詞列表.length === 0) {
        return '';
      }

      // 安全提取關鍵詞
      const allKeywords = [];
      item.關鍵詞列表.forEach(kwGroup => {
        if (kwGroup && kwGroup.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
          kwGroup.關鍵詞.forEach(keyword => {
            if (keyword) {
              allKeywords.push({
                keyword: keyword,
                kwGroup: kwGroup
              });
            }
          });
        }
      });

      if (allKeywords.length === 0) {
        return '';
      }

      const keywordItems = allKeywords.map(({ keyword, kwGroup }) => {
        // 檢查關鍵詞篩選匹配
        const kwFilterMatch = this._checkFilterMatch(item, filters, 'keyword', kwGroup);
        
        // 檢查關鍵詞欄位的檢索匹配
        const kwSearchMatch = this._checkFieldSearchMatch(keyword, searchData, 'keyword') || 
                             this._checkFieldSearchMatch(kwGroup.大分類, searchData, 'keyword') || 
                             this._checkFieldSearchMatch(kwGroup.中分類, searchData, 'keyword') || 
                             this._checkFieldSearchMatch(kwGroup.小分類, searchData, 'keyword');
        
        const highlightClass = this._getHighlightClass(kwSearchMatch, kwFilterMatch);
        
        const categoryParts = [kwGroup.大分類, kwGroup.中分類, kwGroup.小分類].filter(Boolean);
        const categoryPath = categoryParts.length > 0 ? categoryParts.join(' / ') : '無分類';
        
        const safeKeyword = this._utils ? this._utils.safe(keyword) : String(keyword);
        
        return `
          <div class="dropdown-keyword-item ${highlightClass}">
            <div class="dropdown-keyword-name">
              ${this._highlightSearchTerms(safeKeyword, searchData, searchMode)}
            </div>
            <div class="dropdown-keyword-category">
              ${this._highlightSearchTerms(categoryPath, searchData, searchMode)}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="simple-keywords-dropdown">
          <div class="keywords-dropdown-content">
            ${keywordItems}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('[generateDetailedKeywordSection] 錯誤:', error);
      return '';
    }
  }

  // ========================================
  // 私有方法 - 篩選條件顯示（優化版）
  // ========================================

  _generateFilterTags(filters) {
    const cacheKey = `filterTags_${JSON.stringify(filters)}`;
    if (this._cache.filterTags.has(cacheKey)) {
      this._performanceMetrics.cacheHitCount++;
      return this._cache.filterTags.get(cacheKey);
    }
    
    const tags = [];
    
    // 年份篩選標籤 - 只有非預設值才顯示
    if (filters.startYear && filters.endYear && 
        !(filters.startYear === 1895 && filters.endYear === 1945)) {
      if (filters.startYear === filters.endYear) {
        tags.push({
          type: 'year',
          label: `年份：<strong>${filters.startYear}年</strong>`,
          value: { startYear: filters.startYear, endYear: filters.endYear },
          removable: true
        });
      } else {
        tags.push({
          type: 'year',
          label: `年份：<strong>${filters.startYear}-${filters.endYear}年</strong>`,
          value: { startYear: filters.startYear, endYear: filters.endYear },
          removable: true
        });
      }
    }
    
    // 標題篩選標籤
    if (filters.title?.type && filters.title?.value) {
      let pathParts = [];
      
      if (filters.title.type === 'major') {
        pathParts = [`<strong>${filters.title.value}</strong>`];
      } else if (filters.title.type === 'mid' && filters.title.major) {
        pathParts = [filters.title.major, `<strong>${filters.title.value}</strong>`];
      }
      
      const pathDisplay = pathParts.join(' / ');
      tags.push({
        type: 'title',
        label: `題名：${pathDisplay}`,
        value: filters.title,
        removable: true
      });
    }
    
    // 關鍵詞篩選標籤
    if (filters.keyword?.userSelected?.selections?.length > 0) {
      const selections = filters.keyword.userSelected.selections;
      selections.forEach(selection => {
        let pathParts = [selection.major];
        
        if (selection.type === 'mid') {
          pathParts.push(`<strong>${selection.value}</strong>`);
        } else if (selection.type === 'minor') {
          pathParts.push(selection.mid);
          pathParts.push(`<strong>${selection.value}</strong>`);
        }
        
        const pathDisplay = pathParts.join(' / ');
        tags.push({
          type: 'keyword',
          label: `關鍵詞：${pathDisplay}`,
          value: selection,
          removable: true
        });
      });
    }
    
    // 欄目篩選標籤
    if (filters.category?.level && filters.category?.value) {
      tags.push({
        type: 'category',
        label: `欄目：<strong>${filters.category.value}</strong>`,
        value: filters.category,
        removable: true
      });
    }
    
    // 刊別篩選標籤
    if (filters.publication) {
      tags.push({
        type: 'publication',
        label: `刊別：<strong>${filters.publication}</strong>`,
        value: filters.publication,
        removable: true
      });
    }
    
    // 版次篩選標籤
    if (filters.edition) {
      tags.push({
        type: 'edition',
        label: `版次：第 <strong>${filters.edition}</strong> 版`,
        value: filters.edition,
        removable: true
      });
    }
    
    this._setCacheItem('filterTags', cacheKey, tags);
    return tags;
  }

  _renderActiveFilters(filters, searchData) {
    const container = this._utils.$('active-filters');
    if (!container) return;
    
    const filterTags = this._generateFilterTags(filters);
    const hasSearchData = searchData && searchData.query;
    
    if (filterTags.length === 0 && !hasSearchData) {
      container.classList.add('hidden');
      return;
    }
    
    container.classList.remove('hidden');
    
    let html = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 class="font-semibold text-blue-800 mb-3 text-sm flex items-center">
          <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          目前篩選條件
        </h4>
        <div class="flex flex-wrap gap-2 items-center">
    `;
    
    // 顯示搜尋欄位和關鍵字（優化版）
    if (hasSearchData && searchData.query) {
      if (searchData.mode === 'advanced' && searchData.conditions) {
        searchData.conditions.forEach((cond, i) => {
          const fieldName = this._getFieldDisplayName(cond.field);
          const operator = i > 0 ? ` <span class='font-bold text-amber-700'>${cond.operator}</span> ` : '';
          html += `${operator}<div class="filter-tag search-tag">
            <span>${fieldName}: ${this._utils ? this._utils.safe(cond.value) : cond.value}</span>
            <span class="remove-btn" onclick="removeSearchCondition(${i})" title="移除此檢索條件">×</span>
          </div>`;
        });
      } else {
        const fieldName = this._getFieldDisplayName(searchData.fieldType || 'all');
        html += `<div class="filter-tag search-tag">
          <span>${fieldName}: ${this._utils ? this._utils.safe(searchData.query) : searchData.query}</span>
          <span class="remove-btn" onclick="clearAllActiveFilters()" title="清除檢索">×</span>
        </div>`;
      }
    }
    
    // 添加篩選標籤
    filterTags.forEach(tag => {
      html += `
        <div class="filter-tag" data-type="${tag.type}" data-value='${JSON.stringify(tag.value)}'>
          <span>${tag.label}</span>
          ${tag.removable ? '<span class="remove-btn" title="移除此篩選">×</span>' : ''}
        </div>
      `;
    });
    
    // 添加清除所有按鈕
    if (filterTags.length > 1 || (filterTags.length > 0 && hasSearchData)) {
      html += `
        <button class="clear-all-btn" onclick="clearAllActiveFilters()" title="清除所有篩選">
          清除全部
        </button>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 綁定移除篩選事件
    container.querySelectorAll('.filter-tag .remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = e.target.closest('.filter-tag');
        const type = tag.dataset.type;
        if (type) {
          const value = JSON.parse(tag.dataset.value);
          this._removeFilterTag(type, value);
        }
      });
    });
  }

  _removeFilterTag(type, value) {
    if (!this._stateManager) return;
    
    switch (type) {
      case 'year':
        this._stateManager.update({
          'filters.startYear': 1895,
          'filters.endYear': 1945
        });
        // 同時更新年份輸入框
        const startYearInput = document.getElementById('start-year-input');
        const endYearInput = document.getElementById('end-year-input');
        if (startYearInput) startYearInput.value = '1895';
        if (endYearInput) endYearInput.value = '1945';
        this._stateManager.triggerFilterChange();
        break;
      case 'title':
        this._stateManager.clearTitleFilter();
        break;
      case 'keyword':
        this._stateManager.toggleKeywordSelection(value);
        break;
      case 'category':
        this._stateManager.clearCategoryFilter();
        break;
      case 'publication':
        this._stateManager.setPublicationFilter(null);
        break;
      case 'edition':
        this._stateManager.setEditionFilter(null);
        break;
    }
  }

  _getFieldDisplayName(fieldType) {
    const fieldNames = {
      'all': '不限欄位',
      'title': '題名',
      'author': '作者',
      'category': '欄目',
      'keyword': '關鍵詞'
    };
    return fieldNames[fieldType] || fieldType;
  }

  // ========================================
  // 私有方法 - 工具函數
  // ========================================

  _getCurrentPageStartIndex() {
    const currentPage = this._stateManager ? this._stateManager.get('currentPage') : 1;
    return (currentPage - 1) * this._itemsPerPage;
  }

  _triggerStateChange() {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('stateChange'));
    }, 0);
  }

  // ========================================
  // 快取管理（優化版）
  // ========================================

  _setCacheItem(cacheType, key, value) {
    const cache = this._cache[cacheType];
    if (!cache) return;
    
    if (cache.size >= this._maxCacheSize) {
      // 清理最舊的項目
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, value);
  }

  _clearCache() {
    Object.values(this._cache).forEach(cache => {
      if (cache && typeof cache.clear === 'function') {
        cache.clear();
      }
    });
    console.log('[UIManager] 快取已清除');
  }

  _updatePerformanceMetrics(startTime) {
    const duration = performance.now() - startTime;
    this._performanceMetrics.renderCount++;
    this._performanceMetrics.totalRenderTime += duration;
    this._performanceMetrics.averageRenderTime = 
      this._performanceMetrics.totalRenderTime / this._performanceMetrics.renderCount;
  }

  // ========================================
  // 事件綁定方法（優化版）
  // ========================================

  _bindPublicationEvents() {
    const select = this._utils.$('publication-select');
    if (!select) return;
    
    // 清除舊的事件監聽器
    if (this._eventHandlers.has('publication')) {
      const oldHandler = this._eventHandlers.get('publication');
      if (oldHandler && oldHandler.element && oldHandler.listener) {
        oldHandler.element.removeEventListener('change', oldHandler.listener);
      }
    }
    
    const listener = (e) => {
      if (this._stateManager && this._stateManager.setPublicationFilter) {
        const value = e.target.value || null;
        console.log('[UIManager] 刊別篩選變更:', value);
        this._stateManager.setPublicationFilter(value);
        this._triggerStateChange();
      }
    };
    
    select.addEventListener('change', listener);
    this._eventHandlers.set('publication', { element: select, listener: listener });
    console.log('[UIManager] 刊別事件綁定完成');
  }

  _bindEditionEvents() {
    const editionSelect = this._utils.$('edition-select');
    if (!editionSelect) return;
    
    // 清除舊的事件監聽器
    if (this._eventHandlers.has('edition')) {
      const oldHandler = this._eventHandlers.get('edition');
      if (oldHandler && oldHandler.element && oldHandler.listener) {
        oldHandler.element.removeEventListener('change', oldHandler.listener);
      }
    }
    
    const listener = (e) => {
      if (this._stateManager && this._stateManager.setEditionFilter) {
        const value = e.target.value || null;
        console.log('[UIManager] 版次篩選變更:', value);
        this._stateManager.setEditionFilter(value);
        this._triggerStateChange();
      }
    };
    
    editionSelect.addEventListener('change', listener);
    this._eventHandlers.set('edition', { element: editionSelect, listener: listener });
    console.log('[UIManager] 版次事件綁定完成');
  }

  _bindResetButtonEvent() {
    const resetBtn = this._utils.$('reset-filters-btn');
    if (!resetBtn) return;
    
    // 清除舊的事件監聽器
    if (this._eventHandlers.has('reset')) {
      const oldHandler = this._eventHandlers.get('reset');
      if (oldHandler && oldHandler.element && oldHandler.listener) {
        oldHandler.element.removeEventListener('click', oldHandler.listener);
      }
    }
    
    const listener = () => {
      if (this._stateManager && this._stateManager.resetFilters) {
        console.log('[UIManager] 重設所有篩選');
        this._clearCache(); // 清除快取
        this._stateManager.resetFilters();
        
        // 保持預設年份範圍
        this._stateManager.update({
          'filters.startYear': 1895,
          'filters.endYear': 1945
        });
        
        this._triggerStateChange();
      }
    };
    
    resetBtn.addEventListener('click', listener);
    this._eventHandlers.set('reset', { element: resetBtn, listener: listener });
    console.log('[UIManager] 重設按鈕事件綁定完成');
  }

  _rebindEventListeners() {
    // 分頁按鈕
    this._bindPaginationEvents();

    // 視圖模式切換
    const viewToggle = document.getElementById('viewmode-toggle');
    if (viewToggle) {
      viewToggle.onchange = () => {
        if (this._stateManager) {
          this._stateManager.set('viewMode', viewToggle.checked ? 'detailed' : 'simple');
          this._clearCache(); // 切換視圖模式時清除快取
          this._triggerStateChange();
        }
      };
    }
    
    // 排序選擇器
    const sortSelect = document.getElementById('sort-order');
    if (sortSelect) {
      sortSelect.onchange = () => {
        if (this._stateManager) {
          this._stateManager.set('sortOrder', sortSelect.value);
          this._applySorting();
          this._triggerStateChange();
        }
      };
    }

    // 關鍵詞下拉選單
    this._bindKeywordDropdowns();
  }

  _bindKeywordDropdowns() {
    // 全域關鍵詞彈窗函數
    if (!window.toggleKeywordDropdown) {
      window.toggleKeywordDropdown = (dropdownId) => {
        console.log('[UIManager] 切換關鍵詞彈窗:', dropdownId);
        
        // 先關閉所有其他彈窗
        document.querySelectorAll('.keyword-dropdown-content').forEach(dropdown => {
          if (dropdown.id !== dropdownId) {
            dropdown.classList.add('hidden');
          }
        });
        
        // 切換目標彈窗
        const targetDropdown = document.getElementById(dropdownId);
        if (targetDropdown) {
          targetDropdown.classList.toggle('hidden');
        }
      };

      // 點擊外部關閉彈窗
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.simple-keyword-item')) {
          document.querySelectorAll('.keyword-dropdown-content').forEach(dropdown => {
            dropdown.classList.add('hidden');
          });
        }
      });
    }
  }

  _bindPaginationEvents() {
    const prevBtn = this._utils.$('prev-page-btn');
    const nextBtn = this._utils.$('next-page-btn');
    const pageInput = this._utils.$('page-input');
    
    if (prevBtn) {
      prevBtn.onclick = null;
      
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this._stateManager && !prevBtn.disabled) {
          const currentPage = this._stateManager.get('currentPage') || 1;
          if (currentPage > 1) {
            this._stateManager.set('currentPage', currentPage - 1);
            console.log('[UIManager] 切換到上一頁:', currentPage - 1);
            this._triggerStateChange();
          }
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.onclick = null;
      
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this._stateManager && !nextBtn.disabled) {
          const currentPage = this._stateManager.get('currentPage') || 1;
          const filteredData = this._stateManager.getFilteredDataset();
          const maxPages = Math.ceil(filteredData.length / this._itemsPerPage) || 1;
          if (currentPage < maxPages) {
            this._stateManager.set('currentPage', currentPage + 1);
            console.log('[UIManager] 切換到下一頁:', currentPage + 1);
            this._triggerStateChange();
          }
        }
      });
    }
    
    if (pageInput) {
      pageInput.onchange = null;
      pageInput.onkeypress = null;
      
      const handlePageChange = () => {
        if (this._stateManager && !pageInput.disabled) {
          const newPage = parseInt(pageInput.value) || 1;
          const filteredData = this._stateManager.getFilteredDataset();
          const maxPages = Math.ceil(filteredData.length / this._itemsPerPage) || 1;
          const validPage = Math.max(1, Math.min(newPage, maxPages));
          
          pageInput.value = validPage;
          this._stateManager.set('currentPage', validPage);
          console.log('[UIManager] 跳轉到頁面:', validPage);
          this._triggerStateChange();
        }
      };
      
      pageInput.addEventListener('change', handlePageChange);
      pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handlePageChange();
        }
      });
    }
    
    console.log('[UIManager] 分頁事件綁定完成');
  }

  _applySorting() {
    const sortOrder = this._stateManager.get('sortOrder');
    const searchData = this._stateManager.get('currentSearchData');
    
    if (!searchData || !searchData.results) return;
    
    const results = [...searchData.results];
    
    switch (sortOrder) {
      case 'date-asc':
        results.sort((a, b) => {
          if (!a._日期 && !b._日期) return 0;
          if (!a._日期) return 1;
          if (!b._日期) return -1;
          return a._日期 - b._日期;
        });
        break;
      case 'date-desc':
        results.sort((a, b) => {
          if (!a._日期 && !b._日期) return 0;
          if (!a._日期) return 1;
          if (!b._日期) return -1;
          return b._日期 - a._日期;
        });
        break;
      case 'relevance':
      default:
        results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
        break;
    }
    
    const updatedSearchData = { ...searchData, results };
    this._stateManager.set('currentSearchData', updatedSearchData);
    
    // 清除相關快取
    this._cache.renderedCards.clear();
  }

  // ========================================
  // 公開方法（優化版）
  // ========================================

  renderTable(filteredData, currentPage, searchData, searchMode, filters) {
    const startTime = performance.now();
    
    console.log('[UIManager] renderTable 被調用', { 
      filteredDataCount: filteredData.length, 
      currentPage, 
      searchMode,
      hasSearchData: !!(searchData && searchData.query),
      filterCount: Object.keys(filters).length
    });
    
    if (!this._dataManager || !this._dataManager.isDataLoaded()) {
      console.log('[UIManager] 資料未載入，顯示初始狀態');
      this._renderInitialState();
      return;
    }
    
    const start = (currentPage - 1) * this._itemsPerPage;
    const pageData = filteredData.slice(start, start + this._itemsPerPage);
    const viewMode = this._stateManager.get('viewMode') || 'simple';
    
    console.log('[UIManager] 渲染參數:', {
      totalData: filteredData.length,
      start,
      pageDataCount: pageData.length,
      viewMode,
      cacheSize: this._cache.renderedCards.size
    });
    
    const resultContainer = document.querySelector('.bg-white.rounded-lg.shadow.border.overflow-hidden');
    if (!resultContainer) {
      console.error('[UIManager] 找不到結果容器');
      return;
    }
    
    console.log('[UIManager] 找到結果容器，開始渲染');
    
    try {
      // 渲染篩選條件區域
      this._renderActiveFilters(filters, searchData);
      console.log('[UIManager] 篩選條件區域渲染完成');
      
      // 生成標題列
      const headerHtml = this._generateResultHeader(filteredData, viewMode);
      
      // 生成內容（使用虛擬化或標準渲染）
      let cardsHtml;
      if (filteredData.length === 0) {
        cardsHtml = this._generateEmptyState('沒有符合條件的資料', '請嘗試調整篩選條件或搜尋關鍵字');
      } else if (pageData.length === 0) {
        cardsHtml = this._generateEmptyState('載入中...', '請稍候');
      } else {
        cardsHtml = this._generateCardsHTML(pageData, viewMode, searchData, searchMode, filters);
      }
      
      // 生成分頁
      const totalPages = Math.ceil(filteredData.length / this._itemsPerPage) || 1;
      const paginationHtml = this._generatePaginationHtml(currentPage, totalPages);
      
      // 更新DOM
      resultContainer.innerHTML = headerHtml + cardsHtml + paginationHtml;
      
      // 重新綁定事件
      this._rebindEventListeners();
      
      // 更新效能指標
      this._updatePerformanceMetrics(startTime);
      
      console.log('[UIManager] 渲染完成，耗時:', performance.now() - startTime, 'ms');
      
    } catch (error) {
      console.error('[UIManager] 渲染失敗:', error);
      resultContainer.innerHTML = this._generateEmptyState('渲染錯誤', '請重新整理頁面');
    }
  }

  _generateCardsHTML(pageData, viewMode, searchData, searchMode, filters) {
    const cards = pageData.map((item, index) => {
      try {
        return viewMode === 'simple' ? 
          this._generateSimpleCard(item, index, searchData, searchMode, filters) :
          this._generateDetailedCard(item, index, searchData, searchMode, filters);
      } catch (err) {
        console.error('[UIManager] 卡片生成錯誤', { item: item.資料編號, index, err });
        return `<div class='error-card'>卡片 ${index + 1} 生成錯誤: ${err.message}</div>`;
      }
    }).join('');
    
    return `
      <div class="result-content">
        <div class="cards-container" id="data-cards-container">
          ${cards}
        </div>
      </div>
    `;
  }

  _generateEmptyState(title, subtitle) {
    return `
      <div class="result-content">
        <div class="text-center py-8 text-gray-500">
          <div class="empty-icon">📋</div>
          <div class="empty-title">${title}</div>
          <div class="empty-subtitle">${subtitle}</div>
        </div>
      </div>
    `;
  }

  _generateResultHeader(filteredData, viewMode) {
    const count = filteredData?.length || 0;
    const sortOrder = this._stateManager ? this._stateManager.get('sortOrder') : 'relevance';
    
    return `
      <div class="p-4 border-b bg-gray-50">
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-lg font-semibold text-gray-800">結果列表</h4>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="toggle-switch-viewmode">
                <input type="checkbox" id="viewmode-toggle" class="toggle-checkbox" ${viewMode === 'detailed' ? 'checked' : ''}>
                <label class="toggle-label" for="viewmode-toggle">
                  <span class="toggle-simple">簡目</span>
                  <span class="toggle-slider"></span>
                  <span class="toggle-detailed">詳目</span>
                </label>
              </div>
              <label class="text-sm text-gray-700 ml-4">排序：</label>
              <select id="sort-order" class="border border-gray-300 p-1 text-sm rounded" ${count === 0 ? 'disabled' : ''}>
                <option value="relevance" ${sortOrder === 'relevance' ? 'selected' : ''}>相關度</option>
                <option value="date-asc" ${sortOrder === 'date-asc' ? 'selected' : ''}>日期（舊→新）</option>
                <option value="date-desc" ${sortOrder === 'date-desc' ? 'selected' : ''}>日期（新→舊）</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-600">符合條件：<span id="filtered-count">${count.toLocaleString()}</span> 筆資料</p>
        </div>
      </div>
    `;
  }

  _generatePaginationHtml(currentPage, totalPages) {
    const isFirstPage = currentPage <= 1;
    const isLastPage = currentPage >= totalPages;
    
    return `
      <div class="p-4 border-t bg-gray-50">
        <div class="flex justify-between items-center">
          <button id="prev-page-btn" class="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm transition-colors ${isFirstPage ? 'opacity-50 cursor-not-allowed' : ''}" ${isFirstPage ? 'disabled' : ''}>
            上一頁
          </button>
          <span class="text-sm text-gray-700">
            第 <input id="page-input" type="number" value="${currentPage}" min="1" max="${totalPages}" class="border border-gray-300 w-16 text-center mx-2 rounded text-sm" ${totalPages <= 1 ? 'disabled' : ''} /> / <span id="total-pages">${totalPages}</span> 頁
          </span>
          <button id="next-page-btn" class="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm transition-colors ${isLastPage ? 'opacity-50 cursor-not-allowed' : ''}" ${isLastPage ? 'disabled' : ''}>
            下一頁
          </button>
        </div>
      </div>
    `;
  }

  _renderInitialState() {
    const container = this._utils.$('data-cards-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <div class="empty-icon">📋</div>
        <div class="empty-title">等待載入資料</div>
        <div class="empty-subtitle">系統正在初始化中...</div>
      </div>
    `;
  }

  // 更新方法（優化版）
  updateEditionSelect() {
    if (!this._stateManager) return;
    
    const editionSelect = this._utils.$('edition-select');
    if (!editionSelect) return;
    
    try {
      const availableEditions = this._stateManager.getAvailableEditions();
      const currentEdition = this._stateManager.get('filters.edition');
      
      editionSelect.innerHTML = '<option value="">全部版次</option>';
      
      availableEditions.forEach(edition => {
        const option = document.createElement('option');
        option.value = edition;
        option.textContent = `第 ${edition} 版`;
        if (String(currentEdition) === String(edition)) {
          option.selected = true;
        }
        editionSelect.appendChild(option);
      });
      
      editionSelect.disabled = false;
      this._bindEditionEvents();
      
      console.log('[UIManager] 版次下拉選單更新完成，可用版次:', availableEditions.length);
    } catch (error) {
      console.error('[UIManager] 更新版次下拉選單失敗:', error);
    }
  }

  updatePublicationOptions() {
    const select = this._utils.$('publication-select');
    if (!select) return;
    
    const stats = this._dataManager && this._dataManager.getStats ? this._dataManager.getStats() : { publications: [] };
    const publications = stats.publications || [];
    
    select.innerHTML = '<option value="">全部</option>' +
      publications.map(pub => `<option value="${pub}">${pub}</option>`).join('');
    
    const filters = this._stateManager ? this._stateManager.get('filters') : {};
    select.value = filters.publication || '';
  }

  updateResetButton() {
    if (!this._stateManager) return;
    
    try {
      const resetBtn = this._utils.$('reset-filters-btn');
      if (!resetBtn) return;
      
      resetBtn.disabled = false;
      this._bindResetButtonEvent();
      
      console.log('[UIManager] 重設按鈕更新完成');
    } catch (error) {
      console.error('[UIManager] 更新重設按鈕失敗:', error);
    }
  }

  updateCharts(filteredData) {
    try {
      if (this._chartManager && this._chartManager.updateCharts) {
        console.log('[UIManager] 更新圖表，資料筆數:', filteredData.length);
        this._chartManager.updateCharts(filteredData);
      }
    } catch (error) {
      console.error('[UIManager] 更新圖表失敗:', error);
    }
  }

  async updateAllUI() {
    console.log('[UIManager] updateAllUI 被調用');
    
    try {
      if (!this._dataManager.isDataLoaded()) {
        console.log('[UIManager] 資料未載入，跳過更新');
        return;
      }
      
      // 取得當前狀態
      const filteredData = this._stateManager.getFilteredDataset();
      const currentPage = this._stateManager.get('currentPage') || 1;
      const searchData = this._stateManager.get('currentSearchData') || null;
      const filters = this._stateManager.get('filters') || {};
      const searchMode = this._stateManager.get('searchMode') || 'smart';
      
      console.log('[UIManager] 當前狀態:', {
        filteredDataCount: filteredData.length,
        currentPage,
        hasSearchData: !!(searchData && searchData.query),
        cacheHitRate: this._performanceMetrics.cacheHitCount / Math.max(1, this._performanceMetrics.renderCount)
      });
      
      // 首先更新篩選器選項
      this.updateEditionSelect();
      this.updatePublicationOptions();
      this.updateResetButton();
      this._bindPublicationEvents();
      
      // 更新樹狀篩選器
      if (this._treeFilterManager && typeof this._treeFilterManager.updateAllTrees === 'function') {
        this._treeFilterManager.updateAllTrees();
      }
      
      // 渲染主要內容
      this.renderTable(filteredData, currentPage, searchData, searchMode, filters);
      
      // 更新圖表
      this.updateCharts(filteredData);
      
      console.log('[UIManager] updateAllUI 完成，顯示', filteredData.length, '筆資料');
    } catch (error) {
      console.error('[UIManager] updateAllUI 失敗:', error);
    }
  }

  // 新增：效能報告
  getPerformanceReport() {
    return {
      ...this._performanceMetrics,
      cacheStats: {
        renderedCards: this._cache.renderedCards.size,
        highlightedTexts: this._cache.highlightedTexts.size,
        filterTags: this._cache.filterTags.size,
        generatedHTML: this._cache.generatedHTML.size,
        totalCacheSize: Object.values(this._cache).reduce((sum, cache) => sum + cache.size, 0)
      },
      virtualRender: this._virtualRender
    };
  }

  // 清理方法
  cleanup() {
    // 清理快取
    this._clearCache();
    
    // 清理事件監聽器
    this._eventHandlers.forEach(({ element, listener }) => {
      if (element && listener) {
        element.removeEventListener('change', listener);
        element.removeEventListener('click', listener);
      }
    });
    this._eventHandlers.clear();
    
    // 清理全域事件
    this._boundEvents.forEach(({ type, handler }) => {
      if (window.removeEventListener) {
        window.removeEventListener(type, handler);
      }
    });
    this._boundEvents.clear();
    
    // 清理防抖函數
    if (this._debouncedRender && this._debouncedRender.cancel) {
      this._debouncedRender.cancel();
    }
    
    console.log('[UIManager] 清理完成');
  }
}

// 創建並導出單例
const uiManager = new UIManager();
export { uiManager as UIManager };
