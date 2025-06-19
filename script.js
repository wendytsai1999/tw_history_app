// script.js - 主控制器

(function() {
  'use strict';

  // 等待所有模組載入完成
  function waitForModules() {
    return new Promise((resolve) => {
      const checkModules = () => {
        const requiredModules = [
          'Utils', 'DataManager', 'SearchManager', 'ChartManager', 
          'UIManager', 'TreeFilterManager', 'StateManager'
        ];
        
        const allLoaded = requiredModules.every(module => 
          window.TaiwanNewsApp && window.TaiwanNewsApp[module]
        );
        
        if (allLoaded) {
          resolve();
        } else {
          setTimeout(checkModules, 50);
        }
      };
      checkModules();
    });
  }

  // 主應用程式
  async function initApp() {
    // 等待模組載入
    await waitForModules();

    // 取得所有模組
    const { Utils, DataManager, SearchManager, ChartManager, UIManager, TreeFilterManager, StateManager } = window.TaiwanNewsApp;

    // ========================================
    // 核心業務邏輯
    // ========================================

    // 套用排序
    function applySorting(data) {
      const sortOrder = StateManager.get('sortOrder') || 'relevance';
      const currentSearchData = StateManager.get('currentSearchData');
      const searchMode = StateManager.get('searchMode') || 'smart';
      
      const sortFunctions = {
        relevance: (a, b) => {
          if (currentSearchData?.parsedData) {
            const searchTerms = searchMode === 'smart' 
              ? [...(currentSearchData.parsedData.location || []), ...(currentSearchData.parsedData.topic || [])]
              : [currentSearchData.normalizedQuery || ''];
            return SearchManager.getRelevanceScore(b, searchTerms, searchMode) - 
                   SearchManager.getRelevanceScore(a, searchTerms, searchMode);
          }
          return 0;
        },
        'date-asc': (a, b) => compareByDate(a, b, true),
        'date-desc': (a, b) => compareByDate(a, b, false)
      };
      
      if (sortFunctions[sortOrder]) {
        data.sort(sortFunctions[sortOrder]);
      }
      
      return data;
    }

    // 日期比較輔助函數
    function compareByDate(a, b, ascending = true) {
      if (!a._日期 && !b._日期) return 0;
      if (!a._日期) return 1;
      if (!b._日期) return -1;
      return ascending ? a._日期 - b._日期 : b._日期 - a._日期;
    }

    // 更新整個應用程式狀態
    function updateApp() {
      console.log('正在更新應用程式狀態...');
      
      // 取得篩選後的資料
      const filteredData = StateManager.getFilteredDataset();
      console.log(`篩選後的資料量: ${filteredData.length}`);
      
      // 套用排序
      applySorting(filteredData);
      
      // 更新狀態
      StateManager.update({
        'filtered': filteredData,
        'currentPage': 1  // 重設到第一頁
      });
      
      // 更新所有 UI 組件
      updateAllUI();
    }

    // 更新所有 UI 組件
    function updateAllUI() {
      const filteredData = StateManager.get('filtered') || [];
      const currentPage = StateManager.get('currentPage') || 1;
      const currentSearchData = StateManager.get('currentSearchData');
      const searchMode = StateManager.get('searchMode') || 'smart';
      const filters = StateManager.get('filters') || {};
      
      console.log(`正在更新 UI，資料量: ${filteredData.length}`);
      
      // 批量更新所有組件
      requestAnimationFrame(() => {
        UIManager.updateResultCount(filteredData.length);
        UIManager.updateFilterStatistics();
        UIManager.updateFilterModeDescription();
        UIManager.updateFilterModeToggle();
        TreeFilterManager.updateTitleTree();
        TreeFilterManager.updateKeywordTree();
        // 修正：不傳遞檢索資料到篩選條件顯示
        UIManager.updateActiveFilters(filters, null, null, removeFilter);
        UIManager.renderTable(filteredData, currentPage, currentSearchData, searchMode, filters);
      });
      
      // 延遲更新圖表以避免阻塞
      requestAnimationFrame(() => {
        ChartManager.renderAllCharts(filteredData);
      });
    }

    // 強制初始化顯示
    function forceInitialDisplay() {
      console.log('執行強制初始化顯示...');
      
      const allData = DataManager.getAllData();
      if (allData?.length > 0) {
        console.log(`設定初始資料: ${allData.length} 筆`);
        
        StateManager.update({
          'filtered': allData,
          'isDataLoaded': true,
          'isInitialized': true
        });
        
        updateAllUI();
        return true;
      }
      
      console.warn('沒有可用的資料進行初始化');
      return false;
    }

    // 重置到預設狀態
    function resetToDefault() {
      console.log('重置到預設狀態...');
      
      // 重設所有狀態
      StateManager.reset();
      ChartManager.resetBarState();
      TreeFilterManager.clearExpandedState();

      // 清空 UI 狀態
      clearUIState();

      // 確保顯示所有資料
      const allData = DataManager.getAllData();
      if (allData?.length > 0) {
        StateManager.set('filtered', allData);
        updateAllUI();
      } else {
        setTimeout(forceInitialDisplay, 500);
      }
    }

    // 清空 UI 狀態
    function clearUIState() {
      const dateInput = Utils.$('date-range');
      if (dateInput?._flatpickr) dateInput._flatpickr.clear();
      
      const sortSelect = Utils.$('sort-order');
      if (sortSelect) sortSelect.value = 'relevance';

      // 重設日期篩選類型
      const westernRadio = document.querySelector('input[name="date-filter-type"][value="western"]');
      const japaneseRadio = document.querySelector('input[name="date-filter-type"][value="japanese"]');
      if (westernRadio) westernRadio.checked = true;
      if (japaneseRadio) japaneseRadio.checked = false;
      
      // 重設年號篩選
      resetJapaneseDateFilter();
      
      // 切換日期篩選面板
      switchDateFilterPanel('western');
    }

    // 處理篩選選擇變更
    function handleFilterChange(dimension, level, values) {
      console.log(`篩選變更: ${dimension}.${level}`, values);
      
      // 更新篩選狀態
      StateManager.set(`filters.${dimension}.${level}`, values);
      StateManager.updateRootDimension(dimension);
      
      // 更新應用程式
      updateApp();
    }

    // ========================================
    // 搜尋功能
    // ========================================

    // 執行智能檢索
    async function performNLPSearch() {
      const query = Utils.$('nlp-search-input')?.value?.trim();
      if (!query) {
        alert('請輸入查詢語句');
        return;
      }
      
      try {
        showSearchStatus(true);
        Utils.$('query-analysis')?.classList.add('hidden');
        
        const result = await SearchManager.performNLPSearch(
          query,
          showSearchStatus,
          handleSearchResult
        );
      } catch (error) {
        console.error('智能檢索失敗:', error);
        showSearchStatus(false);
        alert(error.message || '檢索失敗，請稍後再試');
      }
    }

    // 處理搜尋結果
    function handleSearchResult(searchResult) {
      // 更新狀態
      StateManager.update({
        'currentSearchData': searchResult,
        'searchMode': 'smart',
        'filters.startDate': searchResult.timeRange.start,
        'filters.endDate': searchResult.timeRange.end,
        'filters.dateFilterType': 'western',
        'filters.era': null,
        'filters.eraStartYear': null,
        'filters.eraEndYear': null,
        'filters.title': { major: [], mid: [] },
        'filters.keyword': { major: [], mid: [], minor: [] },
        'rootDimension': null,
        'sortOrder': 'relevance'
      });
      
      // 更新 UI 元素
      updateDatePicker(searchResult.timeRange);
      updateSortSelect('relevance');
      displayQueryAnalysis(searchResult);
      
      // 更新應用程式
      updateApp();
    }

    // 執行傳統檢索
    function performTraditionalSearch() {
      const query = Utils.$('traditional-search-input')?.value?.trim();
      if (!query) {
        alert('請輸入檢索詞');
        return;
      }
      
      try {
        const traditionalSearchFields = StateManager.get('traditionalSearchFields') || ['all'];
        const result = SearchManager.performTraditionalSearch(query, traditionalSearchFields);
        
        // 更新狀態
        StateManager.update({
          'currentSearchData': result,
          'searchMode': 'traditional',
          'filters': createEmptyFilters(),
          'rootDimension': null,
          'sortOrder': 'relevance'
        });
        
        // 更新 UI
        clearDatePicker();
        updateSortSelect('relevance');
        displayTraditionalResult(result);
        
        // 更新應用程式
        updateApp();
      } catch (error) {
        console.error('傳統檢索失敗:', error);
        alert(error.message || '檢索失敗，請稍後再試');
      }
    }

    // 創建空的篩選器結構
    function createEmptyFilters() {
      return {
        startDate: null,
        endDate: null,
        dateFilterType: 'western',
        era: null,
        eraStartYear: null,
        eraEndYear: null,
        title: { major: [], mid: [] },
        keyword: { major: [], mid: [], minor: [] }
      };
    }

    // 更新日期選擇器
    function updateDatePicker(timeRange) {
      const dateInput = Utils.$('date-range');
      if (dateInput?._flatpickr && timeRange) {
        dateInput._flatpickr.setDate([timeRange.start, timeRange.end]);
      }
    }

    // 清空日期選擇器
    function clearDatePicker() {
      const dateInput = Utils.$('date-range');
      if (dateInput?._flatpickr) dateInput._flatpickr.clear();
    }

    // 更新排序選擇器
    function updateSortSelect(value) {
      const sortSelect = Utils.$('sort-order');
      if (sortSelect) sortSelect.value = value;
    }

    // 顯示搜尋狀態
    function showSearchStatus(show) {
      const statusElement = Utils.$('search-status');
      if (statusElement) {
        statusElement.classList.toggle('hidden', !show);
      }
    }

    // 顯示查詢分析結果
    function displayQueryAnalysis(searchResult) {
      const analysisElement = Utils.$('query-analysis');
      if (!analysisElement || !searchResult?.parsedData) return;
      
      analysisElement.classList.remove('hidden');
      
      const timeRangeText = `${Utils.formatDate(searchResult.timeRange.start)} - ${Utils.formatDate(searchResult.timeRange.end)}`;
      let logicText = `時間範圍 ${timeRangeText}`;
      
      if (searchResult.parsedData.location?.length > 0) {
        const locationText = searchResult.parsedData.location.length === 1 
          ? searchResult.parsedData.location[0]
          : `(${searchResult.parsedData.location.join(' OR ')})`;
        logicText += ` + ${locationText}`;
      }
      
      if (searchResult.parsedData.topic?.length > 0) {
        logicText += ` AND (${searchResult.parsedData.topic.join(' OR ')})`;
      }
      
      const displayElement = Utils.$('search-logic-display');
      if (displayElement) {
        displayElement.textContent = logicText;
      }
    }

    // 顯示傳統檢索結果
    function displayTraditionalResult(searchResult) {
      const resultElement = Utils.$('traditional-result');
      if (!resultElement) return;
      
      resultElement.classList.remove('hidden');
      
      const displayHtml = `
        <strong>檢索語句：</strong>${Utils.safe(searchResult.query)}<br>
        <strong>檢索欄位：</strong>${searchResult.fields.join(', ')}<br>
        <strong>符合結果：</strong>${searchResult.results.length.toLocaleString()} 筆資料
      `;
      
      const displayElement = Utils.$('traditional-result-display');
      if (displayElement) {
        displayElement.innerHTML = displayHtml;
      }
    }

    // ========================================
    // 日治年號篩選功能
    // ========================================

    // 切換日期篩選面板
    function switchDateFilterPanel(type) {
      const westernPanel = Utils.$('western-date-filter');
      const japanesePanel = Utils.$('japanese-date-filter');
      
      if (westernPanel && japanesePanel) {
        if (type === 'western') {
          westernPanel.classList.remove('hidden');
          japanesePanel.classList.add('hidden');
        } else {
          westernPanel.classList.add('hidden');
          japanesePanel.classList.remove('hidden');
        }
      }
      
      // 更新狀態
      StateManager.set('filters.dateFilterType', type);
      
      // 如果切換到日治年號但沒有選擇年號，清除現有的日期篩選
      if (type === 'japanese' && !StateManager.get('filters.era')) {
        StateManager.update({
          'filters.startDate': null,
          'filters.endDate': null
        });
        updateApp();
      }
    }

    // 重設年號篩選
    function resetJapaneseDateFilter() {
      const eraSelect = Utils.$('era-select');
      const eraStartYear = Utils.$('era-start-year');
      const eraEndYear = Utils.$('era-end-year');
      
      if (eraSelect) eraSelect.value = '';
      if (eraStartYear) eraStartYear.value = '';
      if (eraEndYear) eraEndYear.value = '';
      
      StateManager.update({
        'filters.era': null,
        'filters.eraStartYear': null,
        'filters.eraEndYear': null
      });
    }

    // 年號選擇變更處理
    function handleEraSelectChange(selectedEra) {
      const eraStartYear = Utils.$('era-start-year');
      const eraEndYear = Utils.$('era-end-year');
      
      if (selectedEra) {
        const range = Utils.getEraYearRange(selectedEra);
        if (range) {
          // 設定年份輸入範圍
          if (eraStartYear) {
            eraStartYear.min = range.minYear;
            eraStartYear.max = range.maxYear;
            eraStartYear.placeholder = `${range.minYear}-${range.maxYear}`;
          }
          if (eraEndYear) {
            eraEndYear.min = range.minYear;
            eraEndYear.max = range.maxYear;
            eraEndYear.placeholder = `${range.minYear}-${range.maxYear}`;
          }
        }
        
        StateManager.set('filters.era', selectedEra);
      } else {
        // 清空年號篩選
        resetJapaneseDateFilter();
        updateApp();
      }
    }

    // 套用年號篩選
    function applyEraFilter() {
      const era = StateManager.get('filters.era');
      const eraStartYear = parseInt(Utils.$('era-start-year')?.value) || null;
      const eraEndYear = parseInt(Utils.$('era-end-year')?.value) || null;
      
      if (!era) {
        alert('請先選擇年號');
        return;
      }
      
      // 驗證年份
      if (eraStartYear && !Utils.validateEraYear(era, eraStartYear)) {
        alert(`${era}年號的年份範圍不正確`);
        return;
      }
      
      if (eraEndYear && !Utils.validateEraYear(era, eraEndYear)) {
        alert(`${era}年號的年份範圍不正確`);
        return;
      }
      
      if (eraStartYear && eraEndYear && eraStartYear > eraEndYear) {
        alert('起始年不能大於結束年');
        return;
      }
      
      // 轉換為西元年並設定日期篩選
      let startDate = null;
      let endDate = null;
      
      if (eraStartYear) {
        const westernStartYear = Utils.convertEraToWestern(era, eraStartYear);
        if (westernStartYear) {
          startDate = new Date(westernStartYear, 0, 1);
        }
      }
      
      if (eraEndYear) {
        const westernEndYear = Utils.convertEraToWestern(era, eraEndYear);
        if (westernEndYear) {
          endDate = new Date(westernEndYear, 11, 31);
        }
      }
      
      // 更新狀態
      StateManager.update({
        'filters.eraStartYear': eraStartYear,
        'filters.eraEndYear': eraEndYear,
        'filters.startDate': startDate,
        'filters.endDate': endDate
      });
      
      // 更新應用程式
      updateApp();
    }

    // ========================================
    // 篩選和重置功能（修正：不處理檢索）
    // ========================================

    // 移除篩選條件
    function removeFilter(filterType, filterValue = null) {
      if (filterType === 'date') {
        StateManager.update({
          'filters.startDate': null,
          'filters.endDate': null
        });
        clearDatePicker();
      } else if (filterType === 'era') {
        resetJapaneseDateFilter();
      } else {
        // 處理樹狀篩選移除
        handleTreeFilterRemoval(filterType, filterValue);
      }
      
      updateApp();
    }

    // 處理樹狀篩選移除
    function handleTreeFilterRemoval(filterType, filterValue) {
      const filterMap = {
        'titleMajor': ['title', 'major'],
        'titleMid': ['title', 'mid'],
        'keywordMajor': ['keyword', 'major'],
        'keywordMid': ['keyword', 'mid'],
        'keywordMinor': ['keyword', 'minor']
      };
      
      const mapping = filterMap[filterType];
      if (!mapping) return;
      
      const [dimension, level] = mapping;
      const currentValues = StateManager.get(`filters.${dimension}.${level}`) || [];
      
      if (filterValue) {
        // 移除特定值
        const newValues = currentValues.filter(v => v !== filterValue);
        StateManager.set(`filters.${dimension}.${level}`, newValues);
      } else {
        // 清空該層級
        StateManager.set(`filters.${dimension}.${level}`, []);
        
        // 檢查是否需要重置根基狀態
        const rootDimension = StateManager.get('rootDimension');
        if (rootDimension === dimension) {
          const allEmpty = Object.values(StateManager.get(`filters.${dimension}`))
            .every(arr => Array.isArray(arr) && arr.length === 0);
          if (allEmpty) {
            StateManager.set('rootDimension', null);
          }
        }
      }
    }

    // 清除所有搜尋
    function clearAllSearches() {
      StateManager.set('currentSearchData', null);
      
      // 清除智能檢索 UI
      clearSearchUI('nlp', ['nlp-search-input', 'clear-search', 'search-status', 'query-analysis']);
      
      // 清除傳統檢索 UI
      clearSearchUI('traditional', ['traditional-search-input', 'clear-traditional-search', 'traditional-result']);
      
      // 重設傳統檢索欄位
      resetTraditionalSearchFields();
    }

    // 清除搜尋 UI 輔助函數
    function clearSearchUI(type, elementIds) {
      elementIds.forEach(id => {
        const element = Utils.$(id);
        if (!element) return;
        
        if (element.tagName === 'INPUT') {
          element.value = '';
        } else {
          element.classList.add('hidden');
        }
        
        if (id.includes('clear')) {
          element.style.display = 'none';
        }
      });
    }

    // 重設傳統檢索欄位
    function resetTraditionalSearchFields() {
      document.querySelectorAll('#field-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.value === 'all';
      });
      StateManager.set('traditionalSearchFields', ['all']);
    }

    // ========================================
    // 事件處理和初始化
    // ========================================

    // 設定日期選擇器
    function setupDatePicker() {
      const dateInput = Utils.$('date-range');
      if (!dateInput || typeof flatpickr === 'undefined') return;
      
      flatpickr('#date-range', {
        locale: 'zh_tw',
        mode: 'range',
        dateFormat: 'Y-m-d',
        minDate: '1895-01-01',
        maxDate: '1945-12-31',
        onClose: (dates) => {
          const updates = {};
          
          if (dates.length === 2) {
            updates['filters.startDate'] = dates[0];
            updates['filters.endDate'] = dates[1];
          } else if (dates.length === 1) {
            updates['filters.startDate'] = dates[0];
            updates['filters.endDate'] = dates[0];
          } else {
            updates['filters.startDate'] = null;
            updates['filters.endDate'] = null;
          }
          
          StateManager.update(updates);
          updateApp();
        }
      });
    }

    // 設定所有事件監聽器
    function setupEvents() {
      // 導航標籤
      setupNavigationTabs();
      
      // 搜尋模式切換
      setupSearchTabs();
      
      // 智能檢索
      setupSmartSearch();
      
      // 傳統檢索
      setupTraditionalSearch();
      
      // 日期篩選
      setupDateFilters();
      
      // 篩選模式切換器
      setupFilterModeToggle();
      
      // 重設按鈕
      setupResetButton();
      
      // 狀態變更監聽
      setupStateListeners();
    }

    // 設定導航標籤
    function setupNavigationTabs() {
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          
          // 更新導航標籤狀態
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // 處理不同標籤
          const tabType = tab.dataset.tab;
          switch(tabType) {
            case 'home':
              window.open('https://wendytsai1999.github.io/tw_history_exhibition/demo-02.html', '_blank');
              break;
            case 'browse':
              resetToDefault();
              break;
            case 'search':
              // 當前頁面就是檢索頁面
              break;
          }
        });
      });
    }

    // 設定搜尋標籤
    function setupSearchTabs() {
      document.querySelectorAll('.search-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const newSearchMode = tab.dataset.mode;
          StateManager.set('searchMode', newSearchMode);
          
          // 更新標籤狀態
          document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // 切換面板
          const smartPanel = Utils.$('smart-search-panel');
          const traditionalPanel = Utils.$('traditional-search-panel');
          
          if (smartPanel) smartPanel.classList.toggle('hidden', newSearchMode !== 'smart');
          if (traditionalPanel) traditionalPanel.classList.toggle('hidden', newSearchMode !== 'traditional');
          
          // 清除搜尋並重置
          clearAllSearches();
          resetToDefault();
        });
      });
    }

    // 設定智能檢索事件
    function setupSmartSearch() {
      const nlpBtn = Utils.$('nlp-search-btn');
      const nlpInput = Utils.$('nlp-search-input');
      const clearSearch = Utils.$('clear-search');
      
      if (nlpBtn) nlpBtn.addEventListener('click', performNLPSearch);
      
      if (nlpInput) {
        nlpInput.addEventListener('keypress', e => {
          if (e.key === 'Enter') performNLPSearch();
        });
        
        nlpInput.addEventListener('input', function() {
          if (clearSearch) {
            clearSearch.style.display = this.value.trim() ? 'block' : 'none';
          }
        });
      }
      
      if (clearSearch) {
        clearSearch.addEventListener('click', () => {
          if (nlpInput) nlpInput.value = '';
          clearSearch.style.display = 'none';
          clearAllSearches();
          resetToDefault();
        });
      }

      // 範例查詢
      document.querySelectorAll('#example-queries .query-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          if (nlpInput) {
            nlpInput.value = tag.dataset.query;
            if (clearSearch) clearSearch.style.display = 'block';
          }
        });
      });
    }

    // 設定傳統檢索事件
    function setupTraditionalSearch() {
      const traditionalBtn = Utils.$('traditional-search-btn');
      const traditionalInput = Utils.$('traditional-search-input');
      const clearTraditional = Utils.$('clear-traditional-search');
      
      if (traditionalBtn) traditionalBtn.addEventListener('click', performTraditionalSearch);
      
      if (traditionalInput) {
        traditionalInput.addEventListener('keypress', e => {
          if (e.key === 'Enter') performTraditionalSearch();
        });
        
        traditionalInput.addEventListener('input', function() {
          if (clearTraditional) {
            clearTraditional.style.display = this.value.trim() ? 'block' : 'none';
          }
        });
      }
      
      if (clearTraditional) {
        clearTraditional.addEventListener('click', () => {
          if (traditionalInput) traditionalInput.value = '';
          clearTraditional.style.display = 'none';
          clearAllSearches();
          resetToDefault();
        });
      }

      // 欄位選擇
      setupFieldCheckboxes();
    }

    // 設定欄位選擇事件
    function setupFieldCheckboxes() {
      document.querySelectorAll('#field-checkboxes input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const allCheckbox = document.querySelector('input[value="all"]');
          const fieldCheckboxes = document.querySelectorAll('input[type="checkbox"]:not([value="all"])');
          
          let traditionalSearchFields = StateManager.get('traditionalSearchFields') || ['all'];
          
          if (checkbox.value === 'all') {
            if (checkbox.checked) {
              fieldCheckboxes.forEach(cb => cb.checked = false);
              traditionalSearchFields = ['all'];
            } else {
              traditionalSearchFields = [];
            }
          } else {
            if (checkbox.checked) {
              if (allCheckbox) allCheckbox.checked = false;
              traditionalSearchFields = traditionalSearchFields.filter(f => f !== 'all');
              if (!traditionalSearchFields.includes(checkbox.value)) {
                traditionalSearchFields.push(checkbox.value);
              }
            } else {
              traditionalSearchFields = traditionalSearchFields.filter(f => f !== checkbox.value);
              if (traditionalSearchFields.length === 0) {
                if (allCheckbox) allCheckbox.checked = true;
                traditionalSearchFields = ['all'];
              }
            }
          }
          
          StateManager.set('traditionalSearchFields', traditionalSearchFields);
        });
      });
    }

    // 設定日期篩選事件
    function setupDateFilters() {
      // 日期篩選類型切換
      document.querySelectorAll('input[name="date-filter-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
          switchDateFilterPanel(radio.value);
        });
      });

      // 年號選擇
      const eraSelect = Utils.$('era-select');
      if (eraSelect) {
        eraSelect.addEventListener('change', () => {
          handleEraSelectChange(eraSelect.value);
        });
      }

      // 年號篩選套用按鈕
      const applyEraBtn = Utils.$('apply-era-filter');
      if (applyEraBtn) {
        applyEraBtn.addEventListener('click', applyEraFilter);
      }

      // 年號年份輸入
      const eraStartYear = Utils.$('era-start-year');
      const eraEndYear = Utils.$('era-end-year');
      
      [eraStartYear, eraEndYear].forEach(input => {
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              applyEraFilter();
            }
          });
        }
      });
    }

    // 設定篩選模式切換器
    function setupFilterModeToggle() {
      const modeToggle = Utils.$('filter-mode-toggle');
      if (modeToggle) {
        modeToggle.addEventListener('change', () => {
          StateManager.toggleFilterMode();
          updateAllUI();
        });
      }
    }

    // 設定重設按鈕
    function setupResetButton() {
      const resetBtn = Utils.$('reset-filters-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', resetToDefault);
      }
    }

    // 設定狀態監聽器
    function setupStateListeners() {
      StateManager.addListener((changes) => {
        // 當排序方式變更時，重新更新
        if (Array.isArray(changes)) {
          const sortChange = changes.find(c => c.path === 'sortOrder');
          if (sortChange) updateApp();
          
          // 檢查篩選模式變更
          const filterModeChange = changes.find(c => c.path === 'filterMode');
          if (filterModeChange) {
            UIManager.updateFilterModeDescription();
            UIManager.updateFilterModeToggle();
          }
        } else if (changes.path === 'sortOrder') {
          updateApp();
        } else if (changes.path === 'filterMode') {
          UIManager.updateFilterModeDescription();
          UIManager.updateFilterModeToggle();
        }
      });
      
      // 自定義狀態變更事件
      window.addEventListener('stateChange', updateApp);
    }

    // 設定全域函數供其他模組使用
    window.handleFilterChange = handleFilterChange;

    // 初始化應用程式
    async function init() {
      console.log('開始初始化應用程式...');
      
      const progress = createProgressCallback();

      try {
        // 驗證必要模組
        validateModules();

        // 禁用所有控制項
        toggleControls(false);

        // 載入資料
        progress('正在載入資料...', 'info');
        const success = await DataManager.loadData(progress);

        if (!success) throw new Error('資料載入失敗');

        // 驗證資料
        const allData = DataManager.getAllData();
        if (!allData?.length) throw new Error('載入的資料為空');

        progress(`資料載入成功，共 ${allData.length} 筆`, 'ok');
        
        // 啟用控制項並設定 UI
        toggleControls(true);
        setupDatePicker();
        setupEvents();
        TreeFilterManager.init();

        progress('系統準備就緒', 'ok');

        // 強制初始化顯示
        if (!forceInitialDisplay()) {
          setTimeout(forceInitialDisplay, 1000);
        }
        
        // 3秒後隱藏進度訊息
        setTimeout(() => {
          const loadProgress = Utils.$('load-progress');
          if (loadProgress) loadProgress.style.display = 'none';
        }, 3000);

        console.log('應用程式初始化完成');
      } catch (error) {
        handleInitError(error, progress);
      }
    }

    // 創建進度回調函數
    function createProgressCallback() {
      return (text, type = 'info') => {
        console.log(`進度: ${text} (${type})`);
        const colors = {
          info: 'bg-blue-100 text-blue-700',
          ok: 'bg-green-100 text-green-700',
          error: 'bg-red-100 text-red-700'
        };
        const loadProgress = Utils.$('load-progress');
        if (loadProgress) {
          loadProgress.className = `px-3 py-1 rounded border ${colors[type]}`;
          loadProgress.textContent = text;
        }
      };
    }

    // 驗證必要模組
    function validateModules() {
      const requiredModules = ['DataManager', 'TreeFilterManager', 'StateManager'];
      requiredModules.forEach(module => {
        if (!window.TaiwanNewsApp[module]) {
          throw new Error(`${module} 模組未載入`);
        }
      });
    }

    // 切換控制項狀態
    function toggleControls(enabled) {
      document.querySelectorAll('select, button, input').forEach(el => {
        el.disabled = !enabled;
      });
    }

    // 處理初始化錯誤
    function handleInitError(error, progress) {
      console.error('初始化錯誤:', error);
      progress(`初始化失敗：${error.message}`, 'error');
      
      const loadProgress = Utils.$('load-progress');
      if (loadProgress) {
        loadProgress.innerHTML = `
          <div class="text-red-700">
            <div>載入失敗：${error.message}</div>
            <button onclick="location.reload()" 
                    class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
              重新載入
            </button>
          </div>
        `;
      }
    }

    // ========================================
    // 記憶體管理
    // ========================================
    
    // 定期清理快取
    setInterval(() => {
      try {
        Utils.clearCache();
        SearchManager.clearCache();
        UIManager.clearCache();
      } catch (error) {
        console.warn('清理快取時發生錯誤:', error);
      }
    }, 300000); // 每5分鐘清理一次

    // 啟動應用程式
    init();
  }

  // ========================================
  // 應用程式啟動
  // ========================================
  document.addEventListener('DOMContentLoaded', initApp);

})();