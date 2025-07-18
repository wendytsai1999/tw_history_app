// main.js - 修正版主控制器（優化檢索模式切換和高度相關詞互動）

import { Utils } from './utils.js';
import { dataManager } from './data.js';
import { stateManager } from './state-manager.js';
import { searchManager } from './search.js';
import { chartManager } from './chart.js';
import { treeFilterManager as TreeFilterManager } from './filter.js';
import { UIManager } from './ui.js';

// ========================================
// 應用程式主控制器類別
// ========================================

class ApplicationController {
  constructor() {
    // 應用程式狀態
    this._isInitialized = false;
    this._isDataLoaded = false;
    
    // 模組容器
    this._modules = {};
    
    // 錯誤處理
    this._errorHandlers = new Map();
    
    // 效能監控
    this._performanceMetrics = {
      initStartTime: 0,
      initEndTime: 0,
      dataLoadTime: 0
    };

    // 快取系統 - 新增
    this._cache = {
      modeState: new Map(),
      relatedKeywords: new Map()
    };
  }

  // ========================================
  // 初始化流程（優化版）
  // ========================================

  async initialize() {
    console.log('[Main] 開始初始化應用程式');
    this._performanceMetrics.initStartTime = performance.now();
    
    try {
      // 步驟 1: 檢查外部依賴
      await this._checkExternalDependencies();
      
      // 步驟 2: 初始化模組
      this._initializeModules();
      
      // 步驟 3: 建立模組間依賴關係
      this._establishDependencies();
      
      // 步驟 4: 載入資料
      await this._loadApplicationData();
      
      // 步驟 5: 初始化事件系統
      this._initializeEventHandlers();
      
      // 步驟 6: 初始化UI
      this._initializeUserInterface();
      
      // 步驟 7: 設定錯誤處理
      this._setupErrorHandling();
      
      // 完成初始化
      this._isInitialized = true;
      this._performanceMetrics.initEndTime = performance.now();
      
      const totalTime = (this._performanceMetrics.initEndTime - this._performanceMetrics.initStartTime) / 1000;
      console.log(`[Main] 應用程式初始化完成，總耗時: ${totalTime.toFixed(2)}秒`);
      
      // 觸發初始UI更新
      this._triggerInitialUpdate();
      
      // 將模組暴露到全域（僅供調試使用）
      if (typeof window !== 'undefined') {
        window.appModules = this._modules;
      }
      
    } catch (error) {
      console.error('[Main] 應用程式初始化失敗:', error);
      this._showErrorMessage('應用程式初始化失敗', error.message);
      throw error;
    }
  }

  // ========================================
  // 私有方法 - 初始化相關（優化版）
  // ========================================

  async _checkExternalDependencies() {
    console.log('[Main] 檢查外部依賴');
    
    const dependencies = [
      { name: 'Chart.js', check: () => typeof Chart !== 'undefined' },
      { name: 'Flatpickr', check: () => typeof flatpickr !== 'undefined' }
    ];
    
    const missingDeps = dependencies.filter(dep => !dep.check());
    
    if (missingDeps.length > 0) {
      const missingNames = missingDeps.map(dep => dep.name).join(', ');
      console.warn(`[Main] 缺少外部依賴: ${missingNames}`);
    } else {
      console.log('[Main] 所有外部依賴檢查通過');
    }
  }

  _initializeModules() {
    console.log('[Main] 初始化模組');
    
    // 初始化各模組
    this._modules.utils = Utils;
    this._modules.dataManager = dataManager;
    this._modules.stateManager = stateManager;
    this._modules.searchManager = searchManager;
    this._modules.chartManager = chartManager;
    this._modules.treeFilterManager = TreeFilterManager;
    this._modules.uiManager = UIManager;
    
    console.log('[Main] 模組初始化完成');
  }

  _establishDependencies() {
    console.log('[Main] 建立模組間依賴關係');
    
    // 按順序注入依賴
    this._modules.dataManager.init(this._modules.utils);
    
    this._modules.stateManager.init(this._modules.dataManager, this._modules.utils);
    
    this._modules.searchManager.init(this._modules.dataManager, this._modules.utils);
    
    this._modules.chartManager.init(this._modules.stateManager, this._modules.utils);
    
    // TreeFilterManager 需要 searchManager 來進行標亮檢查
    this._modules.treeFilterManager.init(
      this._modules.stateManager, 
      this._modules.utils, 
      this._modules.searchManager
    );
    
    this._modules.uiManager.init(
      this._modules.stateManager,
      this._modules.dataManager,
      this._modules.searchManager,
      this._modules.utils,
      this._modules.chartManager,
      this._modules.treeFilterManager
    );
    
    console.log('[Main] 依賴關係建立完成');
  }

  async _loadApplicationData() {
    console.log('[Main] 開始載入應用程式資料');
    const loadStartTime = performance.now();
    
    try {
      const success = await this._modules.dataManager.loadData({
        progressCallback: (message, type) => {
          this._updateLoadingProgress(message, type);
        },
        onDataLoaded: (data) => {
          console.log(`[Main] 資料載入完成: ${data.length} 筆記錄`);
          
          // 設定初始狀態
          this._modules.stateManager.update({
            'currentSearchData': null,
            'filters.startYear': 1895,
            'filters.endYear': 1945
          });
          this._modules.stateManager.setDataLoaded(true);
          this._isDataLoaded = true;
        }
      });
      
      if (!success) {
        throw new Error('資料載入失敗');
      }
      
      const loadEndTime = performance.now();
      this._performanceMetrics.dataLoadTime = loadEndTime - loadStartTime;
      
      console.log(`[Main] 資料載入流程完成，耗時: ${(this._performanceMetrics.dataLoadTime / 1000).toFixed(2)}秒`);
      
    } catch (error) {
      console.error('[Main] 資料載入過程中發生錯誤:', error);
      throw error;
    }
  }

  _initializeEventHandlers() {
    console.log('[Main] 初始化事件處理器');
    
    try {
      // 檢索模式切換標籤
      this._initializeSearchModeTabs();
      
      // 智能檢索相關事件
      this._initializeSmartSearchEvents();
      
      // 一般檢索相關事件
      this._initializeGeneralSearchEvents();
      
      // 年份篩選事件
      this._initializeYearFilterEvents();
      
      // 視窗調整大小事件
      this._initializeResizeEvents();
      
      console.log('[Main] 事件處理器初始化完成');
      
    } catch (error) {
      console.error('[Main] 事件處理器初始化失敗:', error);
    }
  }

  _initializeUserInterface() {
    console.log('[Main] 初始化用戶界面');
    
    try {
      // 設定初始檢索模式
      const smartTab = document.querySelector('[data-mode="smart"]');
      if (smartTab) {
        smartTab.classList.add('active');
      }
      
      // 設定初始狀態
      this._modules.stateManager.set('viewMode', 'simple');
      this._modules.stateManager.set('searchMode', 'smart');
      this._modules.stateManager.set('currentPage', 1);
      
      // 設定預設年份範圍並更新輸入框
      this._modules.stateManager.update({
        'filters.startYear': 1895,
        'filters.endYear': 1945
      });
      
      // 更新年份輸入框的顯示
      this._updateYearInputs(1895, 1945);
      
      console.log('[Main] 用戶界面初始化完成');
      
    } catch (error) {
      console.error('[Main] 用戶界面初始化失敗:', error);
    }
  }

  _setupErrorHandling() {
    // 全域錯誤處理器
    if (typeof window !== 'undefined') {
      this._errorHandlers.set('error', (event) => {
        console.error('[Main] 全域錯誤:', event.error);
        if (!this._isInitialized) {
          this._showErrorMessage('載入錯誤', '應用程式載入時發生錯誤，請重新整理頁面');
        }
      });
      
      this._errorHandlers.set('unhandledrejection', (event) => {
        console.error('[Main] 未處理的Promise拒絕:', event.reason);
        if (!this._isInitialized) {
          this._showErrorMessage('載入錯誤', '資料載入失敗，請檢查網路連線後重新整理頁面');
        }
      });
      
      window.addEventListener('error', this._errorHandlers.get('error'));
      window.addEventListener('unhandledrejection', this._errorHandlers.get('unhandledrejection'));
    }
  }

  // ========================================
  // 私有方法 - 事件處理相關（優化版）
  // ========================================

  _initializeSearchModeTabs() {
    console.log('[Main] 初始化檢索模式切換標籤');
    
    document.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = tab.dataset.mode;
        if (mode) {
          this._switchSearchMode(mode);
        }
      });
    });
  }

  _initializeSmartSearchEvents() {
    const searchBtn = document.getElementById('nlp-search-btn');
    const searchInput = document.getElementById('nlp-search-input');
    const clearBtn = document.getElementById('clear-search');
    
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => this._handleSmartSearch());
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !searchBtn.disabled) {
          this._handleSmartSearch();
        }
      });
      
      // 輸入框變更時啟用/禁用搜尋按鈕
      searchInput.addEventListener('input', (e) => {
        const hasValue = e.target.value.trim();
        searchBtn.disabled = !hasValue;
        
        // 清除搜尋狀態和AI分析結果
        if (!hasValue) {
          this._clearSearchResults();
        }
        
        // 顯示/隱藏清除按鈕
        if (clearBtn) {
          clearBtn.style.display = hasValue ? 'flex' : 'none';
        }
      });
      
      console.log('[Main] 智能檢索事件已綁定');
    }
    
    // 清除搜尋按鈕
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        this._clearSearchInputAndResults();
      });
    }
    
    // 範例查詢標籤
    const exampleTags = document.querySelectorAll('.query-tag');
    exampleTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        if (query && searchInput) {
          searchInput.value = query;
          if (searchBtn) {
            searchBtn.disabled = false;
          }
          if (clearBtn) {
            clearBtn.style.display = 'flex';
          }
          
          // 清除之前的搜尋結果
          this._clearSearchResults();
        }
      });
    });
  }

  _initializeGeneralSearchEvents() {
    const generalSearchBtn = document.getElementById('general-search-btn');
    const generalSearchInput = document.getElementById('general-search-input');
    
    if (generalSearchBtn && generalSearchInput) {
      generalSearchBtn.addEventListener('click', () => this._handleGeneralSearch());
      generalSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._handleGeneralSearch();
        }
      });
      
      console.log('[Main] 一般檢索事件已綁定');
    }

    // 進階檢索Enter鍵事件
    this._bindAdvancedSearchEnterEvents();
  }

  _bindAdvancedSearchEnterEvents() {
    const bindAdvancedSearchEnter = () => {
      document.querySelectorAll('.advanced-condition-row .search-input').forEach(input => {
        input.removeEventListener('keypress', this._handleAdvancedSearchEnter);
        input.addEventListener('keypress', this._handleAdvancedSearchEnter.bind(this));
      });
    };

    // Enter鍵處理函數
    this._handleAdvancedSearchEnter = (e) => {
      if (e.key === 'Enter') {
        this._handleGeneralSearch();
      }
    };

    // 初始綁定並設置觀察器
    bindAdvancedSearchEnter();
    const advancedConditions = document.getElementById('advanced-conditions');
    if (advancedConditions) {
      const observer = new MutationObserver(bindAdvancedSearchEnter);
      observer.observe(advancedConditions, { childList: true, subtree: true });
    }
  }

  _initializeYearFilterEvents() {
    const startYearInput = document.getElementById('start-year-input');
    const endYearInput = document.getElementById('end-year-input');
    const applyBtn = document.getElementById('apply-year-filter-btn');
    
    if (startYearInput && endYearInput) {
      const onYearInputChange = () => {
        let startYear = parseInt(startYearInput.value, 10);
        let endYear = parseInt(endYearInput.value, 10);
        
        if (isNaN(startYear)) startYear = 1895;
        if (isNaN(endYear)) endYear = 1945;
        if (startYear < 1895) startYear = 1895;
        if (endYear > 1945) endYear = 1945;
        if (startYear > endYear) endYear = startYear;
        
        startYearInput.value = startYear;
        endYearInput.value = endYear;
        
        this._modules.stateManager.update({
          'filters.startYear': startYear,
          'filters.endYear': endYear
        });
        this._modules.stateManager.triggerFilterChange();
      };
      
      startYearInput.addEventListener('change', onYearInputChange);
      endYearInput.addEventListener('change', onYearInputChange);
      
      if (applyBtn) {
        applyBtn.addEventListener('click', onYearInputChange);
      }
      
      console.log('[Main] 年份篩選事件已綁定');
    }
  }

  _initializeResizeEvents() {
    const debouncedResize = this._modules.utils.debounce(() => {
      if (this._modules.chartManager) {
        this._modules.chartManager.resizeCharts();
      }
    }, 250);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', debouncedResize);
    }
  }

  // ========================================
  // 私有方法 - 模式切換相關（優化版）
  // ========================================

  _switchSearchMode(mode) {
    console.log('[Main] 切換檢索模式到:', mode);
    
    // 快取當前模式狀態
    this._saveModeState();
    
    // 取得所有面板
    const smartPanel = document.getElementById('smart-search-panel');
    const generalPanel = document.getElementById('general-search-panel');
    const browsePanel = document.getElementById('browse-search-panel');
    const searchArea = document.getElementById('search-area');
    
    // 隱藏所有面板
    if (smartPanel) smartPanel.style.display = 'none';
    if (generalPanel) generalPanel.style.display = 'none';
    if (browsePanel) browsePanel.style.display = 'none';
    
    // 更新標籤狀態
    document.querySelectorAll('.search-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`[data-mode="${mode}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
    
    // 顯示對應面板
    switch (mode) {
      case 'smart':
        if (smartPanel) smartPanel.style.display = 'block';
        if (searchArea) searchArea.style.display = 'block';
        break;
      case 'general':
        if (generalPanel) generalPanel.style.display = 'block';
        if (searchArea) searchArea.style.display = 'block';
        // 初始化進階檢索功能
        this._initializeAdvancedSearch();
        break;
      case 'browse':
        // 資料瀏覽模式隱藏整個檢索區域
        if (searchArea) searchArea.style.display = 'none';
        // 自動觸發瀏覽模式
        setTimeout(() => {
          this._handleBrowseData();
        }, 100);
        break;
    }

    // 切換模式時重置狀態（優化版）
    this._resetSearchState(mode);
  }

  _saveModeState() {
    const currentMode = this._modules.stateManager.get('searchMode');
    if (!currentMode) return;

    const state = {
      searchData: this._modules.stateManager.get('currentSearchData'),
      filters: this._modules.stateManager.get('filters'),
      page: this._modules.stateManager.get('currentPage')
    };
    
    this._cache.modeState.set(currentMode, state);
  }

  _resetSearchState(mode) {
    if (this._modules.stateManager) {
      // 清除搜尋資料和篩選條件
      this._modules.stateManager.resetFilters();
      this._modules.stateManager.set('currentSearchData', null);
      this._modules.stateManager.set('currentPage', 1);
      this._modules.stateManager.set('searchMode', mode);
      
      // 保持預設年份範圍
      this._modules.stateManager.update({
        'filters.startYear': 1895,
        'filters.endYear': 1945
      });
    }
    
    // 清空所有檢索 input 欄位
    this._clearAllSearchInputs();
    
    // 清空目前篩選條件區塊
    this._clearActiveFilters();
    
    // 清空高度相關詞區塊
    this._clearRelatedKeywords();
    
    // 重置UI元素
    this._resetUIElements();

    // 強制關閉進階檢索 toggle 並隱藏條件
    this._resetAdvancedSearch();

    // 觸發UI更新（除非是瀏覽模式）
    if (mode !== 'browse') {
      this._triggerStateChange();
    }
  }

  _clearAllSearchInputs() {
    // 清空智能檢索輸入框
    const smartInput = document.getElementById('nlp-search-input');
    if (smartInput) smartInput.value = '';
    
    // 清空一般檢索輸入框
    const generalInput = document.getElementById('general-search-input');
    if (generalInput) generalInput.value = '';
    
    // 清空進階檢索條件
    const advancedConditions = document.getElementById('advanced-conditions');
    if (advancedConditions) {
      advancedConditions.innerHTML = '';
      advancedConditions.style.display = 'none';
    }
    
    console.log('[Main] 所有檢索輸入框已清空');
  }

  _clearActiveFilters() {
    // 隱藏目前篩選條件區塊
    const activeFilters = document.getElementById('active-filters');
    if (activeFilters) {
      activeFilters.classList.add('hidden');
      activeFilters.innerHTML = '';
    }
    
    console.log('[Main] 目前篩選條件區塊已清空');
  }

  _clearRelatedKeywords() {
    // 清空智能檢索的高度相關詞
    const relatedSmart = document.getElementById('related-keywords-smart');
    const relatedSmartList = document.getElementById('related-keywords-list-smart');
    if (relatedSmart) relatedSmart.classList.add('hidden');
    if (relatedSmartList) relatedSmartList.innerHTML = '';
    
    // 清空一般檢索的高度相關詞
    const relatedGeneral = document.getElementById('related-keywords-general');
    const relatedGeneralList = document.getElementById('related-keywords-list-general');
    if (relatedGeneral) relatedGeneral.classList.add('hidden');
    if (relatedGeneralList) relatedGeneralList.innerHTML = '';
    
    console.log('[Main] 高度相關詞區塊已清空');
  }

  _clearSearchResults() {
    this._modules.stateManager.set('currentSearchData', null);
    
    const analysisElement = document.getElementById('query-analysis');
    if (analysisElement) {
      analysisElement.classList.add('hidden');
    }
  }

  _clearSearchInputAndResults() {
    const smartInput = document.getElementById('nlp-search-input');
    const smartBtn = document.getElementById('nlp-search-btn');
    const clearBtn = document.getElementById('clear-search');
    
    if (smartInput) smartInput.value = '';
    if (smartBtn) smartBtn.disabled = true;
    if (clearBtn) clearBtn.style.display = 'none';
    
    this._clearSearchResults();
    this._clearRelatedKeywords();
    
    // 重置頁面
    this._modules.stateManager.set('currentPage', 1);
    
    // 觸發 UI 更新
    this._triggerStateChange();
  }

  _resetUIElements() {
    // 重置按鈕狀態
    const smartSearchBtn = document.getElementById('nlp-search-btn');
    if (smartSearchBtn) {
      smartSearchBtn.disabled = true;
    }
    
    // 隱藏AI分析結果
    const analysisElement = document.getElementById('query-analysis');
    if (analysisElement) {
      analysisElement.classList.add('hidden');
    }
    
    // 隱藏清除按鈕
    const clearBtn = document.getElementById('clear-search');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    
    // 重置年份輸入框到預設值
    const startYearInput = document.getElementById('start-year-input');
    const endYearInput = document.getElementById('end-year-input');
    if (startYearInput) startYearInput.value = '1895';
    if (endYearInput) endYearInput.value = '1945';
    
    // 重置日期篩選
    const dateRangePicker = document.getElementById('date-range-picker');
    if (dateRangePicker) {
      dateRangePicker.value = '1895-01-01 to 1945-12-31';
    }
    
    // 重置日期篩選類型
    const westernRadio = document.querySelector('input[name="general-date-filter-type"][value="western"]');
    if (westernRadio) westernRadio.checked = true;
    
    // 重置下拉選單
    const publicationSelect = document.getElementById('publication-select');
    if (publicationSelect) publicationSelect.value = '';
    
    const editionSelect = document.getElementById('edition-select');
    if (editionSelect) editionSelect.value = '';
  }

  _resetAdvancedSearch() {
    const advancedToggle = document.getElementById('advanced-search-toggle');
    const advancedConditions = document.getElementById('advanced-conditions');
    const addConditionBtn = document.getElementById('add-advanced-condition-btn');
    
    if (advancedToggle) {
      advancedToggle.checked = false;
    }
    if (advancedConditions) {
      advancedConditions.style.display = 'none';
      advancedConditions.innerHTML = '';
    }
    if (addConditionBtn) {
      addConditionBtn.style.display = 'none';
    }
  }

  // ========================================
  // 私有方法 - 搜尋處理相關（優化版）
  // ========================================

  async _handleSmartSearch() {
    console.log('[Main] 處理智能搜尋');
    
    try {
      const input = document.getElementById('nlp-search-input');
      const query = input?.value?.trim();
      
      // 修正：如果檢索框為空，回到預設狀態
      if (!query) {
        console.log('[Main] 檢索框為空，回到預設狀態');
        this._clearSearchResults();
        this._clearRelatedKeywords();
        this._modules.stateManager.set('currentPage', 1);
        this._triggerStateChange();
        return;
      }
      
      if (!this._modules.searchManager) {
        console.error('[Main] SearchManager 不可用');
        return;
      }
      
      // 顯示搜尋狀態
      const statusElement = document.getElementById('search-status');
      const analysisElement = document.getElementById('query-analysis');
      const logicDisplay = document.getElementById('search-logic-display');
      
      if (statusElement) {
        statusElement.classList.remove('hidden');
      }
      if (analysisElement) {
        analysisElement.classList.add('hidden');
      }
      
      // 執行智能搜尋
      await this._modules.searchManager.performSmartSearch(
        query,
        (isSearching) => {
          if (statusElement) {
            if (isSearching) {
              statusElement.classList.remove('hidden');
            } else {
              statusElement.classList.add('hidden');
            }
          }
        },
        (searchResult) => {
          console.log('[Main] 搜尋完成，結果筆數:', searchResult.results.length);
          
          // 更新狀態
          this._modules.stateManager.update({
            'currentSearchData': searchResult,
            'currentPage': 1
          });
          
          // 顯示分析結果
          this._showSmartSearchAnalysis(searchResult, analysisElement, logicDisplay);
          
          // 計算並顯示相關詞
          this._showRelatedKeywords(query, 'smart');
          
          // 觸發 UI 更新
          this._triggerStateChange();
        }
      );
      
    } catch (error) {
      console.error('[Main] 搜尋處理失敗:', error);
      
      // 隱藏搜尋狀態
      const statusElement = document.getElementById('search-status');
      if (statusElement) {
        statusElement.classList.add('hidden');
      }
      
      alert('搜尋失敗，請稍後再試');
    }
  }

  async _handleGeneralSearch() {
    console.log('[Main] 處理一般檢索');
    try {
      const input = document.getElementById('general-search-input');
      const fieldSelect = document.getElementById('general-search-field');
      const advancedToggle = document.getElementById('advanced-search-toggle');
      const query = input?.value?.trim();
      
      // 修正：如果檢索框為空，回到預設狀態
      if (!query && (!advancedToggle?.checked || !this._hasAdvancedConditions())) {
        console.log('[Main] 檢索框為空，回到預設狀態');
        this._clearSearchResults();
        this._clearRelatedKeywords();
        this._modules.stateManager.set('currentPage', 1);
        this._triggerStateChange();
        return;
      }
      
      if (!this._modules.searchManager) {
        console.error('[Main] SearchManager 不可用');
        return;
      }
      
      // 重置所有篩選條件，但保持年份範圍
      this._modules.stateManager.resetFilters();
      this._modules.stateManager.update({
        'filters.startYear': 1895,
        'filters.endYear': 1945
      });
      
      // 處理日期篩選
      const dateFilters = this._getDateFilters();
      if (dateFilters.startDate || dateFilters.endDate) {
        this._modules.stateManager.setDateFilter(dateFilters.startDate, dateFilters.endDate);
      }
      if (dateFilters.era) {
        this._modules.stateManager.setEraFilter(dateFilters.era, dateFilters.eraStartYear, dateFilters.eraEndYear);
      }
      
      let searchResult;
      
      // 檢查是否使用進階檢索
      if (advancedToggle && advancedToggle.checked) {
        searchResult = this._performAdvancedSearch(input, fieldSelect);
        // 顯示高度相關詞（進階模式）
        this._showRelatedKeywords(query, 'advanced');
      } else {
        searchResult = this._performGeneralSearch(input, fieldSelect);
        // 顯示高度相關詞（一般模式）
        this._showRelatedKeywords(query, 'general');
      }
      
      console.log('[Main] 檢索完成，結果筆數:', searchResult.results.length);
      
      // 更新狀態
      this._modules.stateManager.update({
        'currentSearchData': searchResult,
        'currentPage': 1
      });
      
      // 觸發 UI 更新
      this._triggerStateChange();
    } catch (error) {
      console.error('[Main] 一般檢索處理失敗:', error);
      alert('檢索失敗，請稍後再試');
    }
  }

  _hasAdvancedConditions() {
    const advancedConditions = document.getElementById('advanced-conditions');
    if (!advancedConditions) return false;
    
    const rows = advancedConditions.querySelectorAll('.advanced-condition-row');
    return Array.from(rows).some(row => {
      const input = row.querySelector('.search-input');
      return input && input.value.trim();
    });
  }

  _performGeneralSearch(input, fieldSelect) {
    const query = input?.value?.trim();
    const field = fieldSelect?.value || 'all';
    
    if (!query) {
      throw new Error('請輸入檢索詞');
    }
    
    return this._modules.searchManager.performGeneralSearch(query, field, 'AND');
  }

  _performAdvancedSearch(input, fieldSelect) {
    const conditions = [];
    
    // 收集主要檢索條件
    const query = input?.value?.trim();
    const field = fieldSelect?.value || 'all';
    
    if (query) {
      conditions.push({
        operator: 'AND',
        field: field,
        value: query
      });
    }
    
    // 收集進階條件
    const advancedConditions = document.getElementById('advanced-conditions');
    if (advancedConditions) {
      const rows = advancedConditions.querySelectorAll('.advanced-condition-row');
      rows.forEach(row => {
        const operator = row.querySelector('.operator-select')?.value || 'AND';
        const field = row.querySelector('.search-field-select')?.value || 'all';
        const value = row.querySelector('.search-input')?.value?.trim();
        
        if (value) {
          conditions.push({
            operator: operator,
            field: field,
            value: value
          });
        }
      });
    }
    
    if (conditions.length === 0) {
      throw new Error('請輸入檢索條件');
    }
    
    return this._modules.searchManager.performAdvancedSearch(conditions);
  }

  _handleBrowseData() {
    console.log('[Main] 處理資料瀏覽');
    
    try {
      if (!this._modules.searchManager) {
        console.error('[Main] SearchManager 不可用');
        return;
      }
      
      // 執行資料瀏覽 - 預設按日期新到舊排序
      const browseResult = this._modules.searchManager.getBrowseData('date', 'desc');
      
      console.log('[Main] 資料瀏覽完成，結果筆數:', browseResult.results.length);
      
      // 更新狀態
      this._modules.stateManager.update({
        'currentSearchData': browseResult,
        'currentPage': 1
      });
      
      // 觸發 UI 更新
      this._triggerStateChange();
      
    } catch (error) {
      console.error('[Main] 資料瀏覽處理失敗:', error);
      alert('資料瀏覽失敗，請稍後再試');
    }
  }

  // ========================================
  // 私有方法 - 進階檢索相關
  // ========================================

  _initializeAdvancedSearch() {
    console.log('[Main] 初始化進階檢索功能');
    
    const advancedToggle = document.getElementById('advanced-search-toggle');
    const advancedConditions = document.getElementById('advanced-conditions');
    const addConditionBtn = document.getElementById('add-advanced-condition-btn');
    
    if (!advancedToggle || !advancedConditions || !addConditionBtn) return;
    
    // 進階檢索切換事件
    advancedToggle.addEventListener('change', function() {
      if (this.checked) {
        advancedConditions.style.display = 'block';
        addConditionBtn.style.display = 'inline-block';
        
        // 添加預設條件
        if (advancedConditions.children.length === 0) {
          addAdvancedCondition();
        }
      } else {
        advancedConditions.style.display = 'none';
        addConditionBtn.style.display = 'none';
        
        // 清空進階條件
        advancedConditions.innerHTML = '';
      }
    });
    
    // 新增條件按鈕事件
    addConditionBtn.addEventListener('click', addAdvancedCondition);
    
    // 初始化日期篩選功能
    this._initializeDateFilter();
  }

  _initializeDateFilter() {
    const dateFilterRadios = document.querySelectorAll('input[name="general-date-filter-type"]');
    const westernSection = document.getElementById('western-date-section');
    const japaneseSection = document.getElementById('japanese-date-section');
    
    // 日期篩選類型切換
    dateFilterRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.value === 'western') {
          if (westernSection) westernSection.classList.remove('hidden');
          if (japaneseSection) japaneseSection.classList.add('hidden');
        } else if (this.value === 'japanese') {
          if (westernSection) westernSection.classList.add('hidden');
          if (japaneseSection) japaneseSection.classList.remove('hidden');
        }
      });
    });
    
    // 初始化 Flatpickr（如果可用）
    if (typeof flatpickr !== 'undefined') {
      const dateInput = document.getElementById('date-range-picker');
      if (dateInput) {
        flatpickr(dateInput, {
          mode: 'range',
          dateFormat: 'Y-m-d',
          minDate: '1895-01-01',
          maxDate: '1945-12-31',
          locale: 'zh-tw',
          allowInput: true,
          defaultDate: ['1895-01-01', '1945-12-31']
        });
      }
    }
  }

  // ========================================
  // 私有方法 - 工具函數（優化版）
  // ========================================

  _getDateFilters() {
    const selectedType = document.querySelector('input[name="general-date-filter-type"]:checked')?.value;
    
    if (selectedType === 'western') {
      const dateInput = document.getElementById('date-range-picker');
      if (dateInput && dateInput.value) {
        const dateRange = dateInput.value.split(' to ');
        if (dateRange.length === 2) {
          const startDate = new Date(dateRange[0]);
          const endDate = new Date(dateRange[1]);
          return {
            startDate: startDate,
            endDate: endDate
          };
        }
      }
    } else if (selectedType === 'japanese') {
      const eraSelect = document.querySelector('.date-era-select');
      const startYearInput = document.querySelector('.era-year-input:first-child');
      const endYearInput = document.querySelector('.era-year-input:last-child');
      
      if (eraSelect && eraSelect.value) {
        const era = eraSelect.value;
        const eraStartYear = startYearInput ? parseInt(startYearInput.value) : null;
        const eraEndYear = endYearInput ? parseInt(endYearInput.value) : null;
        
        return {
          era: era,
          eraStartYear: eraStartYear,
          eraEndYear: eraEndYear
        };
      }
    }
    
    return {};
  }

  _showSmartSearchAnalysis(searchResult, analysisElement, logicDisplay) {
    if (!analysisElement || !logicDisplay || !searchResult.parsedData) return;
    
    const { parsedData, results } = searchResult;
    const { time, location, topic } = parsedData;
    
    const timeRange = time ? time.replace('-', '-01-01 - ') + '-12-31' : '1895-01-01 - 1945-12-31';
    const locationTerms = location && location.length > 0 ? location.join(' AND ') : '臺灣';
    const topicTerms = topic && topic.length > 0 ? 
      (topic.length > 1 ? `(${topic.join(' OR ')})` : topic[0]) : '';
    
    let searchLogic = `時間範圍 ${timeRange} + ${locationTerms}`;
    if (topicTerms) {
      searchLogic += ` AND ${topicTerms}`;
    }
    
    logicDisplay.innerHTML = `
      <strong>檢索邏輯：</strong>${searchLogic}
      <br>
      <small class="text-green-700">找到 ${results.length.toLocaleString()} 筆相關資料</small>
    `;
    analysisElement.classList.remove('hidden');
  }

  _updateLoadingProgress(message, type) {
    const progressElement = document.getElementById('load-progress');
    if (progressElement) {
      progressElement.textContent = message;
      
      // 更新樣式
      progressElement.className = `px-3 py-1 rounded border text-sm ${
        type === 'error' ? 'bg-red-100 text-red-700 border-red-300' : 
        type === 'ok' ? 'bg-green-100 text-green-700 border-green-300' : 
        'bg-blue-100 text-blue-700 border-blue-300'
      }`;
      
      // 成功時隱藏進度條
      if (type === 'ok') {
        setTimeout(() => {
          progressElement.style.display = 'none';
        }, 3000);
      }
    }
  }

  _updateYearInputs(startYear, endYear) {
    const startYearInput = document.getElementById('start-year-input');
    const endYearInput = document.getElementById('end-year-input');
    if (startYearInput) startYearInput.value = startYear;
    if (endYearInput) endYearInput.value = endYear;
  }

  _triggerStateChange() {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('stateChange'));
    }, 0);
  }

  _triggerInitialUpdate() {
    setTimeout(() => {
      if (this._modules.uiManager) {
        this._modules.uiManager.updateAllUI();
      }
    }, 100);
  }

  _showErrorMessage(title, message) {
    console.error(`[Main] ${title}: ${message}`);
    
    try {
      const container = document.getElementById('data-cards-container');
      if (container) {
        container.innerHTML = `
          <div class="text-center py-8 text-red-500">
            <div class="text-2xl mb-2">⚠️</div>
            <div class="font-semibold mb-2">${title}</div>
            <div class="text-sm">${message}</div>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
              重新載入
            </button>
          </div>
        `;
      }
      
      // 也更新進度條
      const progressElement = document.getElementById('load-progress');
      if (progressElement) {
        progressElement.textContent = `錯誤: ${message}`;
        progressElement.className = 'bg-red-100 text-red-700 px-3 py-1 rounded border text-sm';
      }
    } catch (error) {
      console.error('[Main] 錯誤訊息顯示失敗:', error);
    }
  }

  // ========================================
  // 高度相關詞功能（優化版）
  // ========================================

  _showRelatedKeywords(query, mode = 'general') {
    // 快取檢查
    const cacheKey = `${query}-${mode}`;
    if (this._cache.relatedKeywords.has(cacheKey)) {
      const cachedKeywords = this._cache.relatedKeywords.get(cacheKey);
      this._renderRelatedKeywords(cachedKeywords, mode);
      return;
    }

    // 取得相關詞
    const relatedKeywords = this._modules.searchManager.calculateRelatedKeywords(query, 5);
    
    // 快取結果
    this._cache.relatedKeywords.set(cacheKey, relatedKeywords);
    
    // 渲染相關詞
    this._renderRelatedKeywords(relatedKeywords, mode);
  }

  _renderRelatedKeywords(relatedKeywords, mode) {
    const sectionId = mode === 'smart' ? 'related-keywords-smart' : 'related-keywords-general';
    const listId = mode === 'smart' ? 'related-keywords-list-smart' : 'related-keywords-list-general';
    const section = document.getElementById(sectionId);
    const list = document.getElementById(listId);

    if (!section || !list) {
      return;
    }

    if (!relatedKeywords || relatedKeywords.length === 0) {
      section.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    // 產生標籤 HTML，並加上 data-keyword 屬性
    list.innerHTML = relatedKeywords.map(item => {
      const categoryPath = [item.category.major, item.category.mid, item.category.minor]
        .filter(Boolean).join(' / ');
      return `
        <span class="related-keyword-tag" title="${categoryPath}" data-keyword="${item.keyword}" data-mode="${mode}">
          ${item.keyword}
          <span class="related-keyword-count">${item.count}</span>
        </span>
      `;
    }).join('');

    section.classList.remove('hidden');

    // 綁定點擊事件（優化版）
    this._bindRelatedKeywordEvents(list, mode);
  }

  _bindRelatedKeywordEvents(list, mode) {
    Array.from(list.querySelectorAll('.related-keyword-tag')).forEach(tag => {
      tag.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const keyword = tag.getAttribute('data-keyword');
        const tagMode = tag.getAttribute('data-mode');
        
        console.log('[Main] 高度相關詞點擊:', keyword, '模式:', tagMode);
        
        if (tagMode === 'general') {
          // 一般檢索：直接覆蓋 input
          this._handleGeneralKeywordClick(keyword);
        } else if (tagMode === 'advanced') {
          // 進階檢索：新增一行條件
          this._handleAdvancedKeywordClick(keyword);
        } else if (tagMode === 'smart') {
          // 智能檢索：覆蓋輸入框
          this._handleSmartKeywordClick(keyword);
        }
      };
    });
  }

  _handleGeneralKeywordClick(keyword) {
    const input = document.getElementById('general-search-input');
    if (input) {
      input.value = keyword;
      input.focus();
      console.log('[Main] 一般檢索輸入框已更新:', keyword);
    }
  }

  _handleAdvancedKeywordClick(keyword) {
    // 確保進階檢索模式開啟
    const advancedToggle = document.getElementById('advanced-search-toggle');
    if (advancedToggle && !advancedToggle.checked) {
      advancedToggle.checked = true;
      // 觸發 change 事件
      advancedToggle.dispatchEvent(new Event('change'));
    }
    
    // 新增進階條件行
    const advancedConditions = document.getElementById('advanced-conditions');
    if (advancedConditions) {
      const conditionRow = document.createElement('div');
      conditionRow.className = 'advanced-condition-row';
      conditionRow.innerHTML = `
        <select class="operator-select">
          <option value="AND">AND (且)</option>
          <option value="OR">OR (或)</option>
          <option value="NOT">NOT (非)</option>
        </select>
        <select class="search-field-select">
          <option value="all">不限欄位</option>
          <option value="title">題名</option>
          <option value="author">作者</option>
          <option value="category">分類</option>
          <option value="keyword" selected>關鍵詞</option>
        </select>
        <input type="text" class="search-input" value="${keyword}" placeholder="請輸入檢索詞">
        <button class="delete-condition-btn" onclick="removeAdvancedCondition(this)" title="刪除此條件">×</button>
      `;
      advancedConditions.appendChild(conditionRow);
      
      // 綁定 enter 事件
      const newInput = conditionRow.querySelector('.search-input');
      if (newInput) {
        newInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this._handleGeneralSearch();
          }
        });
      }
      
      console.log('[Main] 進階檢索條件已新增:', keyword);
    }
  }

  _handleSmartKeywordClick(keyword) {
    const input = document.getElementById('nlp-search-input');
    const btn = document.getElementById('nlp-search-btn');
    const clearBtn = document.getElementById('clear-search');
    
    if (input) {
      input.value = keyword;
      input.focus();
      
      if (btn) btn.disabled = false;
      if (clearBtn) clearBtn.style.display = 'flex';
      
      console.log('[Main] 智能檢索輸入框已更新:', keyword);
    }
  }

  // ========================================
  // 公開方法
  // ========================================

  getModules() {
    return this._modules;
  }

  getPerformanceMetrics() {
    return { ...this._performanceMetrics };
  }

  isInitialized() {
    return this._isInitialized;
  }

  isDataLoaded() {
    return this._isDataLoaded;
  }

  // 新增：清除快取方法
  clearCache() {
    this._cache.modeState.clear();
    this._cache.relatedKeywords.clear();
    console.log('[Main] 快取已清除');
  }

  // 新增：取得快取統計
  getCacheStats() {
    return {
      modeState: this._cache.modeState.size,
      relatedKeywords: this._cache.relatedKeywords.size
    };
  }

  cleanup() {
    // 清理事件監聽器
    if (typeof window !== 'undefined') {
      this._errorHandlers.forEach((handler, type) => {
        window.removeEventListener(type, handler);
      });
    }
    
    // 清理快取
    this.clearCache();
    
    // 清理模組
    Object.values(this._modules).forEach(module => {
      if (module && typeof module.cleanup === 'function') {
        module.cleanup();
      }
    });
    
    this._errorHandlers.clear();
    this._modules = {};
    this._isInitialized = false;
    this._isDataLoaded = false;
  }
}

// ========================================
// 全域函數（供HTML調用）
// ========================================

// 添加進階檢索條件
function addAdvancedCondition() {
  const advancedConditions = document.getElementById('advanced-conditions');
  if (!advancedConditions) return;
  
  const conditionRow = document.createElement('div');
  conditionRow.className = 'advanced-condition-row';
  conditionRow.innerHTML = `
    <select class="operator-select">
      <option value="AND">AND (且)</option>
      <option value="OR">OR (或)</option>
      <option value="NOT">NOT (非)</option>
    </select>
    <select class="search-field-select">
      <option value="all">不限欄位</option>
      <option value="title">題名</option>
      <option value="author">作者</option>
      <option value="category">分類</option>
      <option value="keyword">關鍵詞</option>
    </select>
    <input type="text" class="search-input" placeholder="請輸入檢索詞">
    <button class="delete-condition-btn" onclick="removeAdvancedCondition(this)" title="刪除此條件">×</button>
  `;
  
  advancedConditions.appendChild(conditionRow);
  
  // 為新增的輸入框綁定Enter鍵事件
  const newInput = conditionRow.querySelector('.search-input');
  if (newInput && window.appController) {
    newInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        window.appController._handleGeneralSearch();
      }
    });
  }
}

// 移除進階檢索條件
function removeAdvancedCondition(button) {
  const row = button.closest('.advanced-condition-row');
  const container = row?.parentElement;
  
  if (row && container) {
    row.remove();
  }
}

// 將函數暴露到全域
window.addAdvancedCondition = addAdvancedCondition;
window.removeAdvancedCondition = removeAdvancedCondition;

// ========================================
// 應用程式啟動
// ========================================

// 創建應用程式控制器實例
const appController = new ApplicationController();

// 當 DOM 載入完成後啟動應用程式
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Main] DOM載入完成，準備啟動應用程式');
  
  try {
    // 短暫延遲確保所有外部資源載入完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 啟動應用程式
    await appController.initialize();
    
    // 將控制器暴露到全域（供調試使用）
    window.appController = appController;
    window.appModules = appController.getModules();
    
    console.log('[Main] 應用程式啟動完成');
    
  } catch (error) {
    console.error('[Main] 應用程式啟動失敗:', error);
    appController._showErrorMessage('啟動失敗', '應用程式無法正常啟動，請重新整理頁面');
  }
});

// 導出控制器（供測試使用）
export { appController };
