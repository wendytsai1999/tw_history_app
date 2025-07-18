// search.js - 優化版搜尋管理模組（增強效能和高度相關詞計算）

// ========================================
// 搜尋管理類別（優化版）
// ========================================

class SearchManager {
  constructor() {
    // 依賴
    this.dataManager = null;
    this.utils = null;
    
    // 高效能快取系統
    this.cache = new Map();
    this.relatedKeywordsCache = new Map();
    this.searchResultsCache = new Map();
    this.maxCacheSize = 200;
    
    // 檢索欄位配置 - 優化版
    this.SEARCH_FIELDS = {
      'all': {
        name: '不限欄位',
        fields: ['題名', '作者', '標題大分類', '標題中分類', '分類', '分類(一)', '分類(二)', '分類(三)', '刊別', '版次', '關鍵詞'],
        weight: 1
      },
      'title': {
        name: '題名',
        fields: ['題名', '標題大分類', '標題中分類'],
        weight: 3
      },
      'author': {
        name: '作者',
        fields: ['作者'],
        weight: 2
      },
      'category': {
        name: '分類',
        fields: ['分類', '分類(一)', '分類(二)', '分類(三)'],
        weight: 2
      },
      'keyword': {
        name: '關鍵詞',
        fields: ['關鍵詞'],
        weight: 1.5
      }
    };
    
    // 模擬查詢模式庫（優化版）
    this.QUERY_PATTERNS = new Map([
      ['高雄港', { time: '1895-1945', location: ['高雄港', '高雄'], topic: ['港口', '建設'] }],
      ['填海造陸', { time: '1895-1945', location: ['臺灣'], topic: ['填海造陸', '工程'] }],
      ['司法審判', { time: '1895-1945', location: ['臺灣'], topic: ['司法', '法院', '審判'] }],
      ['嘉義', { time: '1895-1945', location: ['嘉義'], topic: ['社會', '案件'] }],
      ['流行病', { time: '1895-1945', location: ['臺灣'], topic: ['疾病', '醫療'] }],
      ['鐵路', { time: '1908-1945', location: ['臺灣'], topic: ['鐵路', '交通'] }],
      ['原住民', { time: '1895-1915', location: ['臺灣'], topic: ['原住民', '政策'] }],
      ['茶業', { time: '1895-1945', location: ['大稻埕'], topic: ['茶業', '貿易'] }],
      ['製糖', { time: '1895-1945', location: ['臺灣'], topic: ['製糖', '產業'] }]
    ]);

    // 效能監控
    this.performanceMetrics = {
      searchCount: 0,
      averageSearchTime: 0,
      cacheHitRate: 0,
      relatedKeywordsComputeTime: 0
    };

    // 預編譯正則表達式
    this.compiledRegex = {
      andSplit: /\s+AND\s+/i,
      orSplit: /\s+OR\s+/i,
      whitespace: /\s+/
    };
  }

  // 初始化
  init(dataManager, utils) {
    this.dataManager = dataManager;
    this.utils = utils;
  }

  // ========================================
  // 智能檢索（優化版）
  // ========================================

  async performSmartSearch(originalQuery, statusCallback, resultCallback) {
    if (!originalQuery?.trim()) {
      throw new Error('請輸入查詢語句');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    const startTime = performance.now();
    
    try {
      if (statusCallback) statusCallback(true);

      // 檢查快取
      const cacheKey = `smart_${originalQuery}`;
      const cachedResult = this.searchResultsCache.get(cacheKey);
      if (cachedResult) {
        console.log('[SearchManager] 使用快取的智能檢索結果');
        if (statusCallback) statusCallback(false);
        if (resultCallback) resultCallback(cachedResult);
        return cachedResult;
      }

      const parsedData = await this.parseSmartQuery(originalQuery);
      const timeRange = this.parseTimeRange(parsedData.time);
      
      const allData = this.dataManager.getAllData();
      
      // 時間篩選（優化版）
      const timeFiltered = this._filterByTimeRange(allData, timeRange);

      // 內容篩選（優化版）
      const searchTerms = [...(parsedData.location || []), ...(parsedData.topic || [])];
      const results = this._filterByContent(timeFiltered, searchTerms);

      // 計算相關度分數（批次處理）
      await this._calculateSmartRelevanceScores(results, searchTerms);
      
      // 排序
      results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

      const result = {
        query: originalQuery,
        normalizedQuery: this.utils ? this.utils.normalizeText(originalQuery) : originalQuery,
        parsedData: parsedData,
        results: results,
        timeRange: timeRange,
        mode: 'smart'
      };

      // 快取結果
      this._setCache(cacheKey, result, this.searchResultsCache);

      // 更新效能指標
      this._updatePerformanceMetrics(startTime);

      if (statusCallback) statusCallback(false);
      if (resultCallback) resultCallback(result);
      
      return result;
    } catch (error) {
      if (statusCallback) statusCallback(false);
      throw error;
    }
  }

  async parseSmartQuery(query) {
    const normalizedQuery = this.utils ? this.utils.normalizeText(query) : query;
    
    // 檢查快取
    const cacheKey = `parse_${normalizedQuery}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 模擬AI解析延遲（優化版）
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
    
    let bestMatch = null;
    let maxScore = 0;
    
    // 查找最佳匹配模式（優化算法）
    for (const [pattern, config] of this.QUERY_PATTERNS) {
      const score = this._calculatePatternSimilarity(normalizedQuery, pattern);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = config;
      }
    }
    
    // 如果沒有好的匹配，創建默認配置
    if (maxScore < 0.3) {
      bestMatch = {
        time: '1895-1945',
        location: ['臺灣'],
        topic: this._extractTopicsFromQuery(normalizedQuery)
      };
    }
    
    // 快取結果
    this._setCache(cacheKey, bestMatch);
    
    return bestMatch;
  }

  // ========================================
  // 一般檢索（優化版）
  // ========================================

  performGeneralSearch(query, fieldType = 'all', operator = 'AND') {
    if (!query?.trim()) {
      throw new Error('請輸入檢索詞');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    const startTime = performance.now();

    try {
      console.log('[SearchManager] 執行一般檢索:', { query, fieldType, operator });
      
      // 檢查快取
      const cacheKey = `general_${query}_${fieldType}_${operator}`;
      const cachedResult = this.searchResultsCache.get(cacheKey);
      if (cachedResult) {
        console.log('[SearchManager] 使用快取的一般檢索結果');
        return cachedResult;
      }
      
      const searchTerms = this._parseGeneralQuery(query, operator);
      const allData = this.dataManager.getAllData();
      
      console.log('[SearchManager] 搜尋條件:', searchTerms);
      console.log('[SearchManager] 資料總數:', allData.length);
      
      // 高效能篩選
      const results = this._performFieldSearch(allData, searchTerms, fieldType, operator);

      console.log('[SearchManager] 篩選後結果數:', results.length);

      // 計算相關度分數（批次處理）
      this._calculateGeneralRelevanceScores(results, searchTerms, fieldType);
      
      // 排序
      results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

      const result = {
        query: query,
        normalizedQuery: this.utils ? this.utils.normalizeText(query) : query,
        results: results,
        fieldType: fieldType,
        operator: operator,
        searchTerms: searchTerms,
        mode: 'general'
      };

      // 快取結果
      this._setCache(cacheKey, result, this.searchResultsCache);

      // 更新效能指標
      this._updatePerformanceMetrics(startTime);

      return result;
    } catch (error) {
      console.error('[SearchManager] 一般檢索錯誤:', error);
      throw new Error('檢索語法錯誤，請檢查輸入內容');
    }
  }

  // ========================================
  // 進階檢索（優化版邏輯運算）
  // ========================================

  performAdvancedSearch(conditions) {
    if (!conditions?.length) {
      throw new Error('請設定檢索條件');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    const startTime = performance.now();

    try {
      console.log('[SearchManager] 執行進階檢索:', conditions);
      
      // 檢查快取
      const cacheKey = `advanced_${JSON.stringify(conditions)}`;
      const cachedResult = this.searchResultsCache.get(cacheKey);
      if (cachedResult) {
        console.log('[SearchManager] 使用快取的進階檢索結果');
        return cachedResult;
      }
      
      const allData = this.dataManager.getAllData();
      
      // 高效能進階條件評估
      const results = this._evaluateAdvancedConditions(allData, conditions);

      console.log('[SearchManager] 進階檢索完成，結果筆數:', results.length);

      // 計算相關度分數（批次處理）
      this._calculateAdvancedRelevanceScores(results, conditions);
      
      // 排序
      results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

      const result = {
        query: conditions.map((c, i) => {
          const op = i > 0 ? ` ${conditions[i].operator} ` : '';
          return `${op}${c.field}:${c.value}`;
        }).join(''),
        results: results,
        conditions: conditions,
        mode: 'advanced'
      };

      // 快取結果
      this._setCache(cacheKey, result, this.searchResultsCache);

      // 更新效能指標
      this._updatePerformanceMetrics(startTime);

      return result;
    } catch (error) {
      console.error('[SearchManager] 進階檢索錯誤:', error, error && error.stack);
      throw new Error('進階檢索語法錯誤，請檢查輸入內容: ' + (error && error.message));
    }
  }

  // ========================================
  // 資料瀏覽模式（優化版）
  // ========================================

  getBrowseData(sortBy = 'date', order = 'desc') {
    if (!this.dataManager?.isDataLoaded()) {
      return { results: [], mode: 'browse', sortBy, order };
    }
    
    // 檢查快取
    const cacheKey = `browse_${sortBy}_${order}`;
    const cachedResult = this.searchResultsCache.get(cacheKey);
    if (cachedResult) {
      console.log('[SearchManager] 使用快取的瀏覽資料');
      return cachedResult;
    }
    
    const allData = this.dataManager.getAllData();
    
    // 高效能排序
    const sorted = this._performSort([...allData], sortBy, order);
    
    const result = {
      results: sorted,
      mode: 'browse',
      sortBy: sortBy,
      order: order
    };

    // 快取結果
    this._setCache(cacheKey, result, this.searchResultsCache);
    
    return result;
  }

  // ========================================
  // 私有方法 - 高效能搜尋核心
  // ========================================

  _filterByTimeRange(data, timeRange) {
    return data.filter(item => {
      if (!item._日期) return false;
      return item._日期 >= timeRange.start && item._日期 <= timeRange.end;
    });
  }

  _filterByContent(data, searchTerms) {
    if (!searchTerms.length) return data;
    
    return data.filter(item => {
      const locationMatch = searchTerms.some(term => 
        this._containsTextNormalized(item, term));
      return locationMatch;
    });
  }

  _performFieldSearch(data, searchTerms, fieldType, operator) {
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    
    return data.filter(item => {
      const matches = searchTerms.map(term => {
        const normalizedTerm = this.utils ? 
          this.utils.normalizeText(term.value).toLowerCase() : 
          term.value.toLowerCase();
        
        return fieldConfig.fields.some(field => {
          const fieldValue = this._extractFieldValue(item, field);
          const normalizedValue = this.utils ? 
            this.utils.normalizeText(fieldValue).toLowerCase() : 
            fieldValue.toLowerCase();
          return normalizedValue.includes(normalizedTerm);
        });
      });
      
      return this._evaluateOperator(matches, operator);
    });
  }

  _evaluateAdvancedConditions(data, conditions) {
    // 優化版：如果全部條件都是不限欄位 AND
    if (conditions.every(c => c.field === 'all' && c.operator === 'AND')) {
      const allTerms = conditions.map(c => c.value).join(' ');
      const searchTerms = this._parseGeneralQuery(allTerms, 'AND');
      return this._performFieldSearch(data, searchTerms, 'all', 'AND');
    }
    
    // 標準進階檢索邏輯
    return data.filter(item => {
      if (!conditions?.length) return false;
      
      let result = null;
      for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const searchTerms = this._parseGeneralQuery(condition.value, 'OR');
        const match = this._evaluateConditionForItem(item, searchTerms, condition.field);
        
        if (i === 0) {
          result = match;
        } else {
          result = this._applyLogicalOperator(result, match, condition.operator);
        }
        
        // 短路求值優化
        if (!result && i < conditions.length - 1 && conditions[i + 1].operator === 'AND') {
          return false;
        }
      }
      return result || false;
    });
  }

  _evaluateConditionForItem(item, searchTerms, fieldType) {
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    
    return searchTerms.some(term => {
      const normalizedTerm = this.utils ? 
        this.utils.normalizeText(term.value).toLowerCase() : 
        term.value.toLowerCase();
      
      return fieldConfig.fields.some(field => {
        const fieldValue = this._extractFieldValue(item, field);
        const normalizedValue = this.utils ? 
          this.utils.normalizeText(fieldValue).toLowerCase() : 
          fieldValue.toLowerCase();
        return normalizedValue.includes(normalizedTerm);
      });
    });
  }

  _applyLogicalOperator(result, match, operator) {
    switch (operator) {
      case 'AND':
        return result && match;
      case 'OR':
        return result || match;
      case 'NOT':
        return result && !match;
      default:
        return result && match;
    }
  }

  _evaluateOperator(matches, operator) {
    switch (operator) {
      case 'AND':
        return matches.every(match => match);
      case 'OR':
        return matches.some(match => match);
      case 'NOT':
        return !matches.some(match => match);
      default:
        return matches.every(match => match);
    }
  }

  _performSort(data, sortBy, order) {
    const compareFn = this._getCompareFn(sortBy, order);
    
    // 使用穩定排序
    return data.sort(compareFn);
  }

  _getCompareFn(sortBy, order) {
    const direction = order === 'desc' ? -1 : 1;
    
    switch (sortBy) {
      case 'date':
        return (a, b) => {
          if (!a._日期 && !b._日期) return 0;
          if (!a._日期) return 1;
          if (!b._日期) return -1;
          return direction * (a._日期 - b._日期);
        };
      
      case 'title':
        return (a, b) => {
          const titleA = a.題名 || '';
          const titleB = b.題名 || '';
          return direction * titleA.localeCompare(titleB, 'zh-TW');
        };
      
      case 'category':
        return (a, b) => {
          const catA = a.標題大分類 || '';
          const catB = b.標題大分類 || '';
          return direction * catA.localeCompare(catB, 'zh-TW');
        };
      
      default:
        return (a, b) => direction * ((b._relevanceScore || 0) - (a._relevanceScore || 0));
    }
  }

  // ========================================
  // 私有方法 - 查詢解析（優化版）
  // ========================================

  _parseGeneralQuery(query, operator = 'AND') {
    if (!query?.trim()) return [];
    
    const normalizedQuery = this.utils ? this.utils.normalizeText(query.trim()) : query.trim();
    
    let terms = [];
    
    if (operator === 'AND') {
      terms = normalizedQuery.split(this.compiledRegex.andSplit);
      if (terms.length === 1) {
        terms = normalizedQuery.split(this.compiledRegex.whitespace);
      }
    } else if (operator === 'OR') {
      terms = normalizedQuery.split(this.compiledRegex.orSplit);
    } else {
      terms = normalizedQuery.split(this.compiledRegex.whitespace);
    }
    
    return terms.filter(term => term.length > 0).map(term => ({
      value: term.trim(),
      operator: operator,
      type: 'term'
    }));
  }

  _extractFieldValue(item, field) {
    switch (field) {
      case '題名':
        return item.題名 || '';
      case '作者':
        return item.作者 || '';
      case '標題大分類':
        return item.標題大分類 || '';
      case '標題中分類':
        return item.標題中分類 || '';
      case '分類':
        return item.分類 || '';
      case '分類(一)':
        return item['分類(一)'] || '';
      case '分類(二)':
        return item['分類(二)'] || '';
      case '分類(三)':
        return item['分類(三)'] || '';
      case '刊別':
        return item.刊別 || '';
      case '版次':
        return String(item.版次 || '');
      case '關鍵詞':
        return this._extractKeywordsText(item);
      default:
        return '';
    }
  }

  _extractKeywordsText(item) {
    if (!item.關鍵詞列表 || !Array.isArray(item.關鍵詞列表)) {
      return '';
    }
    
    const allKeywords = [];
    item.關鍵詞列表.forEach(kwGroup => {
      if (kwGroup) {
        // 包含所有關鍵詞相關欄位
        if (kwGroup.大分類) allKeywords.push(kwGroup.大分類);
        if (kwGroup.中分類) allKeywords.push(kwGroup.中分類);
        if (kwGroup.小分類) allKeywords.push(kwGroup.小分類);
        if (kwGroup.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
          allKeywords.push(...kwGroup.關鍵詞.filter(Boolean));
        }
      }
    });
    return allKeywords.join(' ');
  }

  // ========================================
  // 高亮和匹配檢查（優化版）
  // ========================================

  containsSearchTerms(text, searchData, searchMode) {
    if (!text || !searchData || !searchData.query) {
      return false;
    }
    
    // 快取檢查
    const cacheKey = `contains_${text}_${searchData.query}_${searchMode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const normalizedText = this.utils ? this.utils.normalizeText(text) : text;
      const str = normalizedText.toLowerCase();
      let result = false;
      
      if (searchMode === 'smart' && searchData.parsedData) {
        const searchTerms = [
          ...(searchData.parsedData.location || []),
          ...(searchData.parsedData.topic || [])
        ];
        result = searchTerms.some(term => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(term || '') : (term || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      } else if (searchMode === 'general' && searchData.searchTerms) {
        result = searchData.searchTerms.some(term => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(term.value || '') : (term.value || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      } else if (searchMode === 'advanced' && searchData.conditions) {
        result = searchData.conditions.some(condition => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(condition.value || '') : (condition.value || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      }
      
      // 快取結果
      this._setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('[containsSearchTerms] 檢查失敗:', error);
      return false;
    }
  }

  highlightSearchTerms(text, searchData, searchMode) {
    if (!text) return this.utils ? this.utils.safe(text) : String(text || '');
    
    // 快取檢查
    const cacheKey = `highlight_${text}_${searchData?.query}_${searchMode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    let highlightedText = this.utils ? this.utils.safe(text) : String(text);
    let searchTerms = [];
    
    if (searchMode === 'smart' && searchData.parsedData) {
      searchTerms = [
        ...(searchData.parsedData.location || []),
        ...(searchData.parsedData.topic || [])
      ].filter(Boolean);
    } else if (searchMode === 'general' && searchData.searchTerms) {
      searchTerms = searchData.searchTerms.map(term => term.value).filter(Boolean);
    } else if (searchMode === 'advanced' && searchData.conditions) {
      searchTerms = searchData.conditions.map(condition => condition.value).filter(Boolean);
    }
    
    if (searchTerms.length === 0) {
      this._setCache(cacheKey, highlightedText);
      return highlightedText;
    }
    
    const sortedTerms = searchTerms.sort((a, b) => String(b).length - String(a).length);
    
    sortedTerms.forEach(term => {
      if (term) {
        const normalizedTerm = this.utils ? this.utils.normalizeText(term) : term;
        const escapedTerm = this.utils ? this.utils.escapeRegExp(normalizedTerm) : 
          String(normalizedTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        try {
          const regex = new RegExp(`(${escapedTerm})`, 'gi');
          highlightedText = highlightedText.replace(regex, 
            '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
        } catch (error) {
          console.warn('正則表達式錯誤:', error);
        }
      }
    });
    
    // 快取結果
    this._setCache(cacheKey, highlightedText);
    return highlightedText;
  }

  // ========================================
  // 輔助方法（優化版）
  // ========================================

  _containsTextNormalized(item, searchTerm) {
    const normalizedTerm = this.utils ? this.utils.normalizeText(searchTerm) : searchTerm;
    const searchStr = normalizedTerm.toLowerCase();
    
    const fields = [
      { value: item.題名, weight: 3 },
      { value: item.標題大分類, weight: 2 },
      { value: item.標題中分類, weight: 2 },
      { value: item.作者, weight: 1.5 },
      { value: item.分類, weight: 1.5 },
      { value: item['分類(一)'], weight: 1.5 },
      { value: item['分類(二)'], weight: 1.5 },
      { value: item['分類(三)'], weight: 1.5 },
      { value: item.刊別, weight: 1 }
    ];
    
    for (const field of fields) {
      if (field.value) {
        const normalizedValue = this.utils ? this.utils.normalizeText(field.value) : field.value;
        if (normalizedValue.toLowerCase().includes(searchStr)) {
          return true;
        }
      }
    }
    
    if (item.關鍵詞列表) {
      return item.關鍵詞列表.some(kwGroup => {
        const parts = [
          kwGroup.大分類,
          kwGroup.中分類,
          kwGroup.小分類,
          ...(kwGroup.關鍵詞 || [])
        ];
        
        return parts.some(part => {
          if (!part) return false;
          const normalizedPart = this.utils ? this.utils.normalizeText(part) : part;
          return normalizedPart.toLowerCase().includes(searchStr);
        });
      });
    }
    
    return false;
  }

  _calculatePatternSimilarity(text1, text2) {
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length < text2.length ? text2 : text1;
    
    if (longer.includes(shorter)) return 0.8;
    
    const commonChars = [...shorter].filter(char => longer.includes(char)).length;
    return commonChars / longer.length;
  }

  _extractTopicsFromQuery(query) {
    const topicKeywords = [
      '政治', '經濟', '社會', '文化', '教育', '醫療', '交通', '產業',
      '建設', '法律', '軍事', '宗教', '農業', '商業', '工業', '港口',
      '鐵路', '學校', '醫院', '工廠', '市場', '銀行', '警察', '法院'
    ];
    
    const topics = topicKeywords.filter(topic => query.includes(topic));
    
    if (topics.length === 0) {
      const words = query.replace(/[，。！？；：「」『』（）]/g, ' ')
                         .split(/\s+/)
                         .filter(word => word.length > 1);
      topics.push(...words.slice(0, 3));
    }
    
    return topics.length > 0 ? topics : ['資料'];
  }

  parseTimeRange(timeStr) {
    const parts = timeStr.split('-');
    const startYear = parseInt(parts[0]);
    const endYear = parseInt(parts[1]);
    
    return {
      start: new Date(startYear, 0, 1),
      end: new Date(endYear, 11, 31)
    };
  }

  // ========================================
  // 相關度計算（批次處理優化版）
  // ========================================

  async _calculateSmartRelevanceScores(results, searchTerms) {
    if (!results.length || !searchTerms.length) return;
    
    // 使用批次處理提升效能
    await this.utils.efficientBatchProcess(results, (item) => {
      let score = 0;
      
      searchTerms.forEach(term => {
        const normalizedTerm = this.utils ? this.utils.normalizeText(term) : term;
        const termStr = normalizedTerm.toLowerCase();
        
        // 題名匹配（高分）
        if (item.題名) {
          const normalizedTitle = this.utils ? this.utils.normalizeText(item.題名) : item.題名;
          if (normalizedTitle.toLowerCase().includes(termStr)) {
            score += 100;
            if (normalizedTitle.toLowerCase() === termStr) {
              score += 100;
            }
          }
        }
        
        // 作者匹配
        if (item.作者) {
          const normalizedAuthor = this.utils ? this.utils.normalizeText(item.作者) : item.作者;
          if (normalizedAuthor.toLowerCase().includes(termStr)) {
            score += 75;
          }
        }
        
        // 分類匹配
        [item.標題大分類, item.標題中分類, item.分類, item['分類(一)'], item['分類(二)'], item['分類(三)'], item.刊別].forEach(category => {
          if (category) {
            const normalizedCategory = this.utils ? this.utils.normalizeText(category) : category;
            if (normalizedCategory.toLowerCase().includes(termStr)) {
              score += 50;
            }
          }
        });
        
        // 關鍵詞匹配
        if (item.關鍵詞列表) {
          item.關鍵詞列表.forEach(kwGroup => {
            const parts = [
              kwGroup.大分類,
              kwGroup.中分類,
              kwGroup.小分類,
              ...(kwGroup.關鍵詞 || [])
            ];
            
            parts.forEach(part => {
              if (part) {
                const normalizedPart = this.utils ? this.utils.normalizeText(part) : part;
                if (normalizedPart.toLowerCase().includes(termStr)) {
                  score += 20;
                }
              }
            });
          });
        }
      });
      
      item._relevanceScore = score;
    }, { batchSize: 100, concurrency: 2 });
  }

  _calculateGeneralRelevanceScores(results, searchTerms, fieldType) {
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    
    results.forEach(item => {
      let score = 0;
      
      searchTerms.forEach(term => {
        const normalizedTerm = this.utils ? 
          this.utils.normalizeText(term.value).toLowerCase() : 
          term.value.toLowerCase();
        
        fieldConfig.fields.forEach(field => {
          const fieldValue = this._extractFieldValue(item, field);
          const normalizedValue = this.utils ? 
            this.utils.normalizeText(fieldValue).toLowerCase() : 
            fieldValue.toLowerCase();
          
          if (normalizedValue.includes(normalizedTerm)) {
            const fieldWeight = this._getFieldWeight(field);
            score += fieldConfig.weight * fieldWeight;
            
            // 完全匹配加分
            if (normalizedValue === normalizedTerm) {
              score += fieldConfig.weight * fieldWeight * 2;
            }
            
            // 詞邊界匹配加分
            if (this._isWordBoundaryMatch(normalizedValue, normalizedTerm)) {
              score += fieldConfig.weight * fieldWeight * 0.5;
            }
          }
        });
      });
      
      item._relevanceScore = score;
    });
  }

  _calculateAdvancedRelevanceScores(results, conditions) {
    results.forEach(item => {
      let score = 0;
      
      conditions.forEach(condition => {
        const searchTerms = this._parseGeneralQuery(condition.value, 'AND');
        score += this._calculateGeneralRelevanceScore(item, searchTerms, condition.field);
      });
      
      item._relevanceScore = score;
    });
  }

  _calculateGeneralRelevanceScore(item, searchTerms, fieldType) {
    if (!searchTerms?.length) return 0;
    
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    let score = 0;
    
    searchTerms.forEach(term => {
      const normalizedTerm = this.utils ? 
        this.utils.normalizeText(term.value).toLowerCase() : 
        term.value.toLowerCase();
      
      fieldConfig.fields.forEach(field => {
        const fieldValue = this._extractFieldValue(item, field);
        const normalizedValue = this.utils ? 
          this.utils.normalizeText(fieldValue).toLowerCase() : 
          fieldValue.toLowerCase();
        
        if (normalizedValue.includes(normalizedTerm)) {
          const fieldWeight = this._getFieldWeight(field);
          score += fieldConfig.weight * fieldWeight;
          
          if (normalizedValue === normalizedTerm) {
            score += fieldConfig.weight * fieldWeight * 2;
          }
        }
      });
    });
    
    return score;
  }

  _getFieldWeight(field) {
    switch (field) {
      case '題名': return 3;
      case '作者': return 2;
      case '標題大分類': case '標題中分類': case '分類': return 1.5;
      default: return 1;
    }
  }

  _isWordBoundaryMatch(text, term) {
    return text.includes(' ' + term + ' ') || 
           text.startsWith(term + ' ') ||
           text.endsWith(' ' + term);
  }

  // ========================================
  // 高度相關詞計算（大幅優化版）
  // ========================================

  calculateRelatedKeywords(searchQuery, maxResults = 5) {
    if (!searchQuery?.trim() || !this.dataManager?.isDataLoaded()) {
      return [];
    }

    const startTime = performance.now();

    // 檢查快取
    const cacheKey = `related_${searchQuery}_${maxResults}`;
    const cached = this.relatedKeywordsCache.get(cacheKey);
    if (cached) {
      console.log('[SearchManager] 使用快取的相關詞結果');
      return cached;
    }

    const normalizedQuery = this.utils ? this.utils.normalizeText(searchQuery) : searchQuery;
    const queryTerms = normalizedQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    if (queryTerms.length === 0) {
      this._setCache(cacheKey, [], this.relatedKeywordsCache);
      return [];
    }

    const allData = this.dataManager.getAllData();
    const keywordCooccurrence = new Map();
    
    // 優化版：批次處理關鍵詞共現計算
    allData.forEach(item => {
      if (!item.關鍵詞列表?.length) return;
      
      // 檢查該條記錄是否包含搜尋詞
      const hasQueryTerm = this._itemContainsQueryOptimized(item, queryTerms);
      if (!hasQueryTerm) return;
      
      // 收集該條記錄的所有關鍵詞
      const itemKeywords = this._extractItemKeywords(item, queryTerms);
      
      // 增加共現計數
      itemKeywords.forEach(kw => {
        const key = kw.normalized;
        if (!keywordCooccurrence.has(key)) {
          keywordCooccurrence.set(key, {
            keyword: kw.original,
            count: 0,
            category: kw.category
          });
        }
        keywordCooccurrence.get(key).count++;
      });
    });

    // 按出現次數排序並返回前N個
    const result = Array.from(keywordCooccurrence.values())
      .filter(item => item.count > 1) // 至少出現2次
      .sort((a, b) => b.count - a.count)
      .slice(0, maxResults)
      .map(item => ({
        keyword: item.keyword,
        count: item.count,
        category: item.category
      }));

    // 快取結果
    this._setCache(cacheKey, result, this.relatedKeywordsCache);

    // 更新效能指標
    this.performanceMetrics.relatedKeywordsComputeTime = performance.now() - startTime;

    console.log(`[SearchManager] 相關詞計算完成，耗時: ${this.performanceMetrics.relatedKeywordsComputeTime.toFixed(2)}ms`);
    
    return result;
  }

  _itemContainsQueryOptimized(item, queryTerms) {
    // 預先建立搜尋文本
    const searchTexts = [
      item.題名 || '',
      item.作者 || '',
      item.標題大分類 || '',
      item.標題中分類 || '',
      item.分類 || '',
      item['分類(一)'] || '',
      item['分類(二)'] || '',
      item['分類(三)'] || '',
      item.刊別 || ''
    ];
    
    // 加入關鍵詞文本
    if (item.關鍵詞列表?.length) {
      item.關鍵詞列表.forEach(kwGroup => {
        if (kwGroup) {
          searchTexts.push(kwGroup.大分類 || '');
          searchTexts.push(kwGroup.中分類 || '');
          searchTexts.push(kwGroup.小分類 || '');
          if (kwGroup.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
            searchTexts.push(...kwGroup.關鍵詞.filter(Boolean));
          }
        }
      });
    }
    
    const combinedText = this.utils ? 
      this.utils.normalizeText(searchTexts.join(' ')).toLowerCase() : 
      searchTexts.join(' ').toLowerCase();
    
    return queryTerms.some(term => combinedText.includes(term));
  }

  _extractItemKeywords(item, queryTerms) {
    const keywords = [];
    
    item.關鍵詞列表.forEach(kwGroup => {
      if (kwGroup?.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
        kwGroup.關鍵詞.forEach(keyword => {
          if (keyword) {
            const normalizedKeyword = this.utils ? 
              this.utils.normalizeText(keyword).toLowerCase() : 
              keyword.toLowerCase();
            
            // 排除與搜尋詞相同的關鍵詞
            const isDifferent = !queryTerms.some(term => 
              normalizedKeyword.includes(term) || term.includes(normalizedKeyword)
            );
            
            if (isDifferent) {
              keywords.push({
                original: keyword,
                normalized: normalizedKeyword,
                category: {
                  major: kwGroup.大分類 || '',
                  mid: kwGroup.中分類 || '',
                  minor: kwGroup.小分類 || ''
                }
              });
            }
          }
        });
      }
    });
    
    return keywords;
  }

  // ========================================
  // 快取管理（優化版）
  // ========================================

  _setCache(key, value, cacheMap = this.cache) {
    if (cacheMap.size >= this.maxCacheSize) {
      // 清理最舊的項目
      const firstKey = cacheMap.keys().next().value;
      cacheMap.delete(firstKey);
    }
    cacheMap.set(key, value);
  }

  clearCache() {
    this.cache.clear();
    this.relatedKeywordsCache.clear();
    this.searchResultsCache.clear();
    console.log('[SearchManager] 所有快取已清除');
  }

  getCacheStats() {
    return {
      mainCacheSize: this.cache.size,
      relatedKeywordsCacheSize: this.relatedKeywordsCache.size,
      searchResultsCacheSize: this.searchResultsCache.size,
      maxCacheSize: this.maxCacheSize,
      performanceMetrics: this.performanceMetrics
    };
  }

  // ========================================
  // 效能監控
  // ========================================

  _updatePerformanceMetrics(startTime) {
    const duration = performance.now() - startTime;
    this.performanceMetrics.searchCount++;
    
    // 計算平均搜尋時間
    const currentAvg = this.performanceMetrics.averageSearchTime;
    const count = this.performanceMetrics.searchCount;
    this.performanceMetrics.averageSearchTime = 
      (currentAvg * (count - 1) + duration) / count;
    
    // 計算快取命中率
    const totalCacheAccess = this.cache.size + this.relatedKeywordsCache.size + this.searchResultsCache.size;
    const estimatedHits = Math.max(0, this.performanceMetrics.searchCount - totalCacheAccess);
    this.performanceMetrics.cacheHitRate = totalCacheAccess > 0 ? 
      estimatedHits / this.performanceMetrics.searchCount : 0;
  }

  getPerformanceReport() {
    return {
      ...this.performanceMetrics,
      cacheStats: this.getCacheStats(),
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  _estimateMemoryUsage() {
    let totalSize = 0;
    
    // 估算各快取的記憶體使用量
    [this.cache, this.relatedKeywordsCache, this.searchResultsCache].forEach(cache => {
      for (const [key, value] of cache) {
        totalSize += (typeof key === 'string' ? key.length * 2 : 50);
        totalSize += this._estimateObjectSize(value);
      }
    });
    
    return {
      totalBytes: totalSize,
      totalMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  }

  _estimateObjectSize(obj) {
    if (typeof obj === 'string') return obj.length * 2;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'object') return JSON.stringify(obj).length * 2;
    return 50; // 預設估算
  }
}

// 導出單例
export const searchManager = new SearchManager();
