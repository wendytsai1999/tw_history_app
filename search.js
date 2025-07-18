// search.js - 搜尋管理模組

// ========================================
// 搜尋管理類別
// ========================================

class SearchManager {
  constructor() {
    // 依賴
    this.dataManager = null;
    this.utils = null;
    
    // 搜尋快取
    this.cache = new Map();
    this.maxCacheSize = 100;
    
    // 檢索欄位配置 - 修正版
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
    
    // 模擬查詢模式庫
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
  }

  // 初始化
  init(dataManager, utils) {
    this.dataManager = dataManager;
    this.utils = utils;
  }

  // ========================================
  // 智能檢索
  // ========================================

  async performSmartSearch(originalQuery, statusCallback, resultCallback) {
    if (!originalQuery?.trim()) {
      throw new Error('請輸入查詢語句');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    try {
      if (statusCallback) statusCallback(true);

      const parsedData = await this.parseSmartQuery(originalQuery);
      const timeRange = this.parseTimeRange(parsedData.time);
      
      const allData = this.dataManager.getAllData();
      
      // 時間篩選
      const timeFiltered = allData.filter(item => {
        if (!item._日期) return false;
        return item._日期 >= timeRange.start && item._日期 <= timeRange.end;
      });

      // 內容篩選
      const searchTerms = [...(parsedData.location || []), ...(parsedData.topic || [])];
      const results = timeFiltered.filter(item => {
        const locationMatch = parsedData.location.some(term => 
          this.containsTextNormalized(item, term));
        const topicMatch = parsedData.topic.some(term => 
          this.containsTextNormalized(item, term));
        return locationMatch && topicMatch;
      });

      // 計算相關度分數
      this.calculateSmartRelevanceScores(results, searchTerms);
      
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
    if (this.cache.has(normalizedQuery)) {
      return this.cache.get(normalizedQuery);
    }

    // 模擬AI解析延遲
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    
    let bestMatch = null;
    let maxScore = 0;
    
    // 查找最佳匹配模式
    for (const [pattern, config] of this.QUERY_PATTERNS) {
      const score = this.calculateSimilarity(normalizedQuery, pattern);
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
        topic: this.extractTopicsFromQuery(normalizedQuery)
      };
    }
    
    // 快取結果
    this.setCache(normalizedQuery, bestMatch);
    
    return bestMatch;
  }

  // ========================================
  // 一般檢索 - 修正版
  // ========================================

  performGeneralSearch(query, fieldType = 'all', operator = 'AND') {
    if (!query?.trim()) {
      throw new Error('請輸入檢索詞');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    try {
      console.log('[SearchManager] 執行一般檢索:', { query, fieldType, operator });
      
      const searchTerms = this.parseGeneralQuery(query, operator);
      const allData = this.dataManager.getAllData();
      
      console.log('[SearchManager] 搜尋條件:', searchTerms);
      console.log('[SearchManager] 資料總數:', allData.length);
      
      const results = allData.filter(item => 
        this.searchInFields(item, searchTerms, fieldType, operator));

      console.log('[SearchManager] 篩選後結果數:', results.length);

      // 計算相關度分數
      this.calculateGeneralRelevanceScores(results, searchTerms, fieldType);
      
      // 排序
      results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

      return {
        query: query,
        normalizedQuery: this.utils ? this.utils.normalizeText(query) : query,
        results: results,
        fieldType: fieldType,
        operator: operator,
        searchTerms: searchTerms,
        mode: 'general'
      };
    } catch (error) {
      console.error('[SearchManager] 一般檢索錯誤:', error);
      throw new Error('檢索語法錯誤，請檢查輸入內容');
    }
  }

  // ========================================
  // 進階檢索 - 修正版邏輯運算
  // ========================================

  performAdvancedSearch(conditions) {
    if (!conditions?.length) {
      throw new Error('請設定檢索條件');
    }
    
    if (!this.dataManager?.isDataLoaded()) {
      throw new Error('資料尚未載入完成，請稍候');
    }

    try {
      console.log('[SearchManager] 執行進階檢索:', conditions);
      
      const allData = this.dataManager.getAllData();
      
      const results = allData.filter(item => {
        return this.evaluateAdvancedConditions(item, conditions);
      });

      console.log('[SearchManager] 進階檢索完成，結果筆數:', results.length);

      // 計算相關度分數
      this.calculateAdvancedRelevanceScores(results, conditions);
      
      // 排序
      results.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

      return {
        query: conditions.map((c, i) => {
          const op = i > 0 ? ` ${conditions[i].operator} ` : '';
          return `${op}${c.field}:${c.value}`;
        }).join(''),
        results: results,
        conditions: conditions,
        mode: 'advanced'
      };
    } catch (error) {
      console.error('[SearchManager] 進階檢索錯誤:', error, error && error.stack);
      throw new Error('進階檢索語法錯誤，請檢查輸入內容: ' + (error && error.message));
    }
  }

  // 評估進階檢索條件 - 修正邏輯運算
  evaluateAdvancedConditions(item, conditions) {
    // 如果全部條件都是不限欄位 AND
    if (conditions.every(c => c.field === 'all' && c.operator === 'AND')) {
      const allTerms = conditions.map(c => c.value).join(' ');
      const searchTerms = this.parseGeneralQuery(allTerms, 'AND');
      return this.searchInFields(item, searchTerms, 'all', 'AND');
    }
    // 其他情況維持原本邏輯
    if (!conditions?.length) return false;
    let result = null;
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const searchTerms = this.parseGeneralQuery(condition.value, 'OR');
      const match = this.searchInFields(item, searchTerms, condition.field, 'OR');
      if (i === 0) {
        result = match;
      } else {
        switch (condition.operator) {
          case 'AND':
            result = result && match;
            break;
          case 'OR':
            result = result || match;
            break;
          case 'NOT':
            result = result && !match;
            break;
          default:
            result = result && match;
        }
      }
      if (!result && i < conditions.length - 1 && conditions[i + 1].operator === 'AND') {
        return false;
      }
    }
    return result || false;
  }

  // ========================================
  // 資料瀏覽模式
  // ========================================

  getBrowseData(sortBy = 'date', order = 'desc') {
    if (!this.dataManager?.isDataLoaded()) {
      return { results: [], mode: 'browse', sortBy, order };
    }
    
    const allData = this.dataManager.getAllData();
    
    const sorted = [...allData].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          if (!a._日期 && !b._日期) return 0;
          if (!a._日期) return 1;
          if (!b._日期) return -1;
          return order === 'desc' ? b._日期 - a._日期 : a._日期 - b._日期;
        
        case 'title':
          const titleA = a.題名 || '';
          const titleB = b.題名 || '';
          return order === 'desc' ? 
            titleB.localeCompare(titleA, 'zh-TW') : 
            titleA.localeCompare(titleB, 'zh-TW');
        
        case 'category':
          const catA = a.標題大分類 || '';
          const catB = b.標題大分類 || '';
          return order === 'desc' ? 
            catB.localeCompare(catA, 'zh-TW') : 
            catA.localeCompare(catB, 'zh-TW');
        
        default:
          return 0;
      }
    });
    
    return {
      results: sorted,
      mode: 'browse',
      sortBy: sortBy,
      order: order
    };
  }

  // ========================================
  // 搜尋核心方法 - 修正版
  // ========================================

  parseGeneralQuery(query, operator = 'AND') {
    if (!query?.trim()) return [];
    
    const normalizedQuery = this.utils ? this.utils.normalizeText(query.trim()) : query.trim();
    
    let terms = [];
    
    if (operator === 'AND') {
      terms = normalizedQuery.split(/\s+AND\s+/i);
      if (terms.length === 1) {
        terms = normalizedQuery.split(/\s+/);
      }
    } else if (operator === 'OR') {
      terms = normalizedQuery.split(/\s+OR\s+/i);
    } else {
      terms = normalizedQuery.split(/\s+/);
    }
    
    return terms.filter(term => term.length > 0).map(term => ({
      value: term.trim(),
      operator: operator,
      type: 'term'
    }));
  }

  searchInFields(item, searchTerms, fieldType, operator = 'AND') {
    if (!item || !searchTerms?.length) return false;
    
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    
    const matches = searchTerms.map(term => {
      const normalizedTerm = this.utils ? 
        this.utils.normalizeText(term.value).toLowerCase() : 
        term.value.toLowerCase();
      let found = false;
      for (const field of fieldConfig.fields) {
        const fieldValue = this.extractFieldValue(item, field);
        const normalizedValue = this.utils ? 
          this.utils.normalizeText(fieldValue).toLowerCase() : 
          fieldValue.toLowerCase();
        const hit = normalizedValue.includes(normalizedTerm);
        if (hit) {
          found = true;
          break;
        }
      }
      return found;
    });
    
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

  // 修正版欄位值提取
  extractFieldValue(item, field) {
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
        if (item.關鍵詞列表 && Array.isArray(item.關鍵詞列表)) {
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
        return '';
      default:
        return '';
    }
  }

  // ========================================
  // 高亮和匹配檢查
  // ========================================

  containsSearchTerms(text, searchData, searchMode) {
    if (!text || !searchData || !searchData.query) {
      return false;
    }
    try {
      const normalizedText = this.utils ? this.utils.normalizeText(text) : text;
      const str = normalizedText.toLowerCase();
      
      if (searchMode === 'smart' && searchData.parsedData) {
        const searchTerms = [
          ...(searchData.parsedData.location || []),
          ...(searchData.parsedData.topic || [])
        ];
        return searchTerms.some(term => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(term || '') : (term || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      }
      
      if (searchMode === 'general' && searchData.searchTerms) {
        return searchData.searchTerms.some(term => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(term.value || '') : (term.value || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      }
      
      if (searchMode === 'advanced' && searchData.conditions) {
        return searchData.conditions.some(condition => {
          const normalizedTerm = this.utils ? this.utils.normalizeText(condition.value || '') : (condition.value || '');
          return normalizedTerm && str.includes(normalizedTerm.toLowerCase());
        });
      }
      
      return false;
    } catch (error) {
      console.warn('[containsSearchTerms] 檢查失敗:', error);
      return false;
    }
  }

  highlightSearchTerms(text, searchData, searchMode) {
    if (!text) return this.utils ? this.utils.safe(text) : String(text || '');
    
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
    
    return highlightedText;
  }

  // ========================================
  // 輔助方法
  // ========================================

  containsTextNormalized(item, searchTerm) {
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

  calculateSimilarity(text1, text2) {
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length < text2.length ? text2 : text1;
    
    if (longer.includes(shorter)) return 0.8;
    
    const commonChars = [...shorter].filter(char => longer.includes(char)).length;
    return commonChars / longer.length;
  }

  extractTopicsFromQuery(query) {
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
  // 相關度計算
  // ========================================

  calculateSmartRelevanceScores(results, searchTerms) {
    results.forEach(item => {
      let score = 0;
      
      searchTerms.forEach(term => {
        const normalizedTerm = this.utils ? this.utils.normalizeText(term) : term;
        const termStr = normalizedTerm.toLowerCase();
        
        if (item.題名) {
          const normalizedTitle = this.utils ? this.utils.normalizeText(item.題名) : item.題名;
          if (normalizedTitle.toLowerCase().includes(termStr)) {
            score += 100;
            if (normalizedTitle.toLowerCase() === termStr) {
              score += 100;
            }
          }
        }
        
        if (item.作者) {
          const normalizedAuthor = this.utils ? this.utils.normalizeText(item.作者) : item.作者;
          if (normalizedAuthor.toLowerCase().includes(termStr)) {
            score += 75;
          }
        }
        
        [item.標題大分類, item.標題中分類, item.分類, item['分類(一)'], item['分類(二)'], item['分類(三)'], item.刊別].forEach(category => {
          if (category) {
            const normalizedCategory = this.utils ? this.utils.normalizeText(category) : category;
            if (normalizedCategory.toLowerCase().includes(termStr)) {
              score += 50;
            }
          }
        });
        
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
    });
  }

  calculateGeneralRelevanceScores(results, searchTerms, fieldType) {
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    
    results.forEach(item => {
      let score = 0;
      
      searchTerms.forEach(term => {
        const normalizedTerm = this.utils ? 
          this.utils.normalizeText(term.value).toLowerCase() : 
          term.value.toLowerCase();
        
        fieldConfig.fields.forEach(field => {
          const fieldValue = this.extractFieldValue(item, field);
          const normalizedValue = this.utils ? 
            this.utils.normalizeText(fieldValue).toLowerCase() : 
            fieldValue.toLowerCase();
          
          if (normalizedValue.includes(normalizedTerm)) {
            let fieldWeight = 1;
            switch (field) {
              case '題名': fieldWeight = 3; break;
              case '作者': fieldWeight = 2; break;
              case '標題大分類': case '標題中分類': case '分類': case '分類(一)': case '分類(二)': case '分類(三)': fieldWeight = 1.5; break;
              default: fieldWeight = 1;
            }
            
            score += fieldConfig.weight * fieldWeight;
            
            if (normalizedValue === normalizedTerm) {
              score += fieldConfig.weight * fieldWeight * 2;
            }
            
            if (normalizedValue.includes(' ' + normalizedTerm + ' ') || 
                normalizedValue.startsWith(normalizedTerm + ' ') ||
                normalizedValue.endsWith(' ' + normalizedTerm)) {
              score += fieldConfig.weight * fieldWeight * 0.5;
            }
          }
        });
      });
      
      item._relevanceScore = score;
    });
  }

  calculateAdvancedRelevanceScores(results, conditions) {
    results.forEach(item => {
      let score = 0;
      
      conditions.forEach(condition => {
        const searchTerms = this.parseGeneralQuery(condition.value, 'AND');
        score += this.calculateGeneralRelevanceScore(item, searchTerms, condition.field);
      });
      
      item._relevanceScore = score;
    });
  }

  calculateGeneralRelevanceScore(item, searchTerms, fieldType) {
    if (!searchTerms?.length) return 0;
    
    const fieldConfig = this.SEARCH_FIELDS[fieldType] || this.SEARCH_FIELDS['all'];
    let score = 0;
    
    searchTerms.forEach(term => {
      const normalizedTerm = this.utils ? 
        this.utils.normalizeText(term.value).toLowerCase() : 
        term.value.toLowerCase();
      
      fieldConfig.fields.forEach(field => {
        const fieldValue = this.extractFieldValue(item, field);
        const normalizedValue = this.utils ? 
          this.utils.normalizeText(fieldValue).toLowerCase() : 
          fieldValue.toLowerCase();
        
        if (normalizedValue.includes(normalizedTerm)) {
          let fieldWeight = 1;
          switch (field) {
            case '題名': fieldWeight = 3; break;
            case '作者': fieldWeight = 2; break;
            case '標題大分類': case '標題中分類': case '分類': fieldWeight = 1.5; break;
            default: fieldWeight = 1;
          }
          
          score += fieldConfig.weight * fieldWeight;
          
          if (normalizedValue === normalizedTerm) {
            score += fieldConfig.weight * fieldWeight * 2;
          }
        }
      });
    });
    
    return score;
  }

  // ========================================
  // 快取管理
  // ========================================

  setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
}

// 導出單例
export const searchManager = new SearchManager();
