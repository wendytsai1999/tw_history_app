// search.js - 搜尋模組
// 這個模組專門處理智能檢索和傳統檢索功能

(function(global) {
  'use strict';

  // 取得其他模組
  const Utils = global.TaiwanNewsApp.Utils;
  const DataManager = global.TaiwanNewsApp.DataManager;

  // ========================================
  // 私有變數和設定
  // ========================================
  
  // 模擬查詢資料 - 實際上應該來自 AI 服務
  const MOCK_QUERY_DATA = {
    '日治時期高雄港是怎麼建起來的？': { time: '1895-1945', location: ['高雄港', '高雄', '港'], topic: ['高雄港', '港口', '建設'] },
    '日治時期有填海造陸的工程嗎？': { time: '1895-1945', location: ['臺灣'], topic: ['填海造陸', '填海', '工程'] },
    '日治時期如何進行司法審判？': { time: '1895-1945', location: ['臺灣'], topic: ['司法審判', '審判'] },
    '嘉義發生過哪些社會案件？': { time: '1895-1945', location: ['嘉義'], topic: ['社會案件'] },
    '日治時期的台灣，有哪些流行病？': { time: '1895-1945', location: ['臺灣'], topic: ['流行病'] },
    '日治時期的臺灣，有哪些流行病？': { time: '1895-1945', location: ['臺灣'], topic: ['流行病'] },
    '1908年之後，台灣鐵路建設情況': { time: '1908-1945', location: ['臺灣'], topic: ['鐵路建設', '鐵路', '建設'] },
    '1908年之後，臺灣鐵路建設情況': { time: '1908-1945', location: ['臺灣'], topic: ['鐵路建設', '鐵路', '建設'] },
    '日治初期有哪些鎮壓原住民的措施': { time: '1895-1915', location: ['臺灣'], topic: ['鎮壓原住民', '原住民', '鎮壓', '措施'] },
    '大稻埕跟茶業的關係': { time: '1895-1945', location: ['大稻埕', '臺北'], topic: ['茶業', '產業', '貿易'] },
    '製糖公司大多分布在哪些縣市？': { time: '1895-1945', location: ['臺灣'], topic: ['製糖公司', '製糖', '產業分布'] }
  };

  // 搜尋相關緩存
  const searchCache = {
    results: new Map(),
    relevanceScores: new Map()
  };

  // ========================================
  // 私有函數
  // ========================================

  // 模擬 AI 查詢解析
  async function parseQuery(query) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return MOCK_QUERY_DATA[query] || { time: '1895-1945', location: ['臺灣'], topic: ['資料'] };
  }

  // 解析時間範圍
  function parseTimeRange(timeStr) {
    if (timeStr.includes('-')) {
      const [startYear, endYear] = timeStr.split('-').map(y => parseInt(y));
      return { 
        start: new Date(startYear, 0, 1), 
        end: new Date(endYear, 11, 31) 
      };
    } else {
      const year = parseInt(timeStr);
      return { 
        start: new Date(year, 0, 1), 
        end: new Date(year, 11, 31) 
      };
    }
  }

  // 檢查文本是否包含搜尋詞（使用正規化）
  function containsTextNormalized(item, searchTerm) {
    const cacheKey = `${item.資料編號}|${searchTerm}`;
    if (searchCache.results.has(cacheKey)) {
      return searchCache.results.get(cacheKey);
    }

    const normalizedSearchTerm = Utils.normalizeText(searchTerm);
    const searchStr = String(normalizedSearchTerm).toLowerCase();
    
    let result = false;

    // 檢索題名
    if (item.題名) {
      const normalizedTitle = Utils.normalizeText(item.題名);
      if (String(normalizedTitle).toLowerCase().includes(searchStr)) {
        result = true;
      }
    }
    
    // 檢索標題分類
    if (!result && item.標題大分類) {
      const normalizedMajor = Utils.normalizeText(item.標題大分類);
      if (String(normalizedMajor).toLowerCase().includes(searchStr)) {
        result = true;
      }
    }
    if (!result && item.標題中分類) {
      const normalizedMid = Utils.normalizeText(item.標題中分類);
      if (String(normalizedMid).toLowerCase().includes(searchStr)) {
        result = true;
      }
    }
    
    // 檢索關鍵詞
    if (!result && item.關鍵詞列表) {
      result = item.關鍵詞列表.some(kwGroup => {
        const normalizedMajor = Utils.normalizeText(kwGroup.大分類 || '');
        const normalizedMid = Utils.normalizeText(kwGroup.中分類 || '');
        const normalizedMinor = Utils.normalizeText(kwGroup.小分類 || '');
        
        return String(normalizedMajor).toLowerCase().includes(searchStr) ||
               String(normalizedMid).toLowerCase().includes(searchStr) ||
               String(normalizedMinor).toLowerCase().includes(searchStr) ||
               (kwGroup.關鍵詞 && kwGroup.關鍵詞.some(kw => {
                 const normalizedKw = Utils.normalizeText(kw || '');
                 return String(normalizedKw).toLowerCase().includes(searchStr);
               }));
      });
    }
    
    searchCache.results.set(cacheKey, result);
    return result;
  }

  // 計算相關度分數
  function calculateRelevanceScore(item, searchTerms, searchMode) {
    const cacheKey = `${item.資料編號}|${searchMode}|${searchTerms.join('|')}`;
    if (searchCache.relevanceScores.has(cacheKey)) {
      return searchCache.relevanceScores.get(cacheKey);
    }

    let score = 0;
    
    searchTerms.forEach(term => {
      const normalizedTerm = Utils.normalizeText(term);
      const termStr = String(normalizedTerm).toLowerCase();
      
      if (item.題名) {
        const normalizedTitle = Utils.normalizeText(item.題名);
        if (String(normalizedTitle).toLowerCase().includes(termStr)) score += 100;
      }
      if (item.標題大分類) {
        const normalizedMajor = Utils.normalizeText(item.標題大分類);
        if (String(normalizedMajor).toLowerCase().includes(termStr)) score += 50;
      }
      if (item.標題中分類) {
        const normalizedMid = Utils.normalizeText(item.標題中分類);
        if (String(normalizedMid).toLowerCase().includes(termStr)) score += 50;
      }
      
      if (item.關鍵詞列表 && Array.isArray(item.關鍵詞列表)) {
        item.關鍵詞列表.forEach(kwGroup => {
          if (kwGroup.大分類) {
            const normalizedMajor = Utils.normalizeText(kwGroup.大分類);
            if (String(normalizedMajor).toLowerCase().includes(termStr)) score += 10;
          }
          if (kwGroup.中分類) {
            const normalizedMid = Utils.normalizeText(kwGroup.中分類);
            if (String(normalizedMid).toLowerCase().includes(termStr)) score += 10;
          }
          if (kwGroup.小分類) {
            const normalizedMinor = Utils.normalizeText(kwGroup.小分類);
            if (String(normalizedMinor).toLowerCase().includes(termStr)) score += 10;
          }
          if (kwGroup.關鍵詞 && Array.isArray(kwGroup.關鍵詞)) {
            kwGroup.關鍵詞.forEach(kw => {
              if (kw) {
                const normalizedKw = Utils.normalizeText(kw);
                if (String(normalizedKw).toLowerCase().includes(termStr)) score += 5;
              }
            });
          }
        });
      }
    });
    
    searchCache.relevanceScores.set(cacheKey, score);
    return score;
  }

  // 解析傳統檢索查詢
  function parseTraditionalQuery(query) {
    const tokens = query.trim().split(/\s+/);
    const terms = [];
    let currentTerm = { type: 'term', value: '', operator: null };
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].toUpperCase();
      
      if (token === 'AND' || token === 'OR' || token === 'NOT') {
        if (currentTerm.value) {
          terms.push(currentTerm);
          currentTerm = { type: 'term', value: '', operator: token };
        } else {
          currentTerm.operator = token;
        }
      } else {
        if (currentTerm.value) {
          currentTerm.value += ' ' + tokens[i];
        } else {
          currentTerm.value = tokens[i];
        }
      }
    }
    
    if (currentTerm.value) {
      terms.push(currentTerm);
    }
    
    return terms;
  }

  // 檢查項目是否符合傳統檢索條件
  function checkTermMatchNormalized(item, searchTerm, fields) {
    const normalizedSearchTerm = Utils.normalizeText(searchTerm);
    const searchStr = String(normalizedSearchTerm).toLowerCase();
    
    if (fields.includes('all')) {
      return containsTextNormalized(item, normalizedSearchTerm);
    }
    
    let match = false;
    
    if (fields.includes('題名') && item.題名) {
      const normalizedTitle = Utils.normalizeText(item.題名);
      match = match || String(normalizedTitle).toLowerCase().includes(searchStr);
    }
    
    if (fields.includes('標題分類')) {
      if (item.標題大分類) {
        const normalizedMajor = Utils.normalizeText(item.標題大分類);
        match = match || String(normalizedMajor).toLowerCase().includes(searchStr);
      }
      if (item.標題中分類) {
        const normalizedMid = Utils.normalizeText(item.標題中分類);
        match = match || String(normalizedMid).toLowerCase().includes(searchStr);
      }
    }
    
    if (fields.includes('關鍵詞') && item.關鍵詞列表) {
      match = match || item.關鍵詞列表.some(kwGroup => {
        const normalizedMajor = Utils.normalizeText(kwGroup.大分類 || '');
        const normalizedMid = Utils.normalizeText(kwGroup.中分類 || '');
        const normalizedMinor = Utils.normalizeText(kwGroup.小分類 || '');
        
        return String(normalizedMajor).toLowerCase().includes(searchStr) ||
               String(normalizedMid).toLowerCase().includes(searchStr) ||
               String(normalizedMinor).toLowerCase().includes(searchStr) ||
               (kwGroup.關鍵詞 && kwGroup.關鍵詞.some(kw => {
                 const normalizedKw = Utils.normalizeText(kw || '');
                 return String(normalizedKw).toLowerCase().includes(searchStr);
               }));
      });
    }
    
    return match;
  }

  // ========================================
  // 公開的 API
  // ========================================
  const SearchManager = {
    // 智能檢索
    async performNLPSearch(originalQuery, statusCallback, resultCallback) {
      if (!originalQuery || !originalQuery.trim()) {
        throw new Error('請輸入查詢語句');
      }
      
      if (!DataManager.isDataLoaded()) {
        throw new Error('資料尚未載入完成，請稍候');
      }

      const normalizedQuery = Utils.normalizeText(originalQuery);
      
      if (statusCallback) statusCallback(true);

      try {
        const parsedData = await parseQuery(normalizedQuery) || await parseQuery(originalQuery);
        
        // 解析時間範圍
        const timeRange = parseTimeRange(parsedData.time);
        
        // 使用 DataManager 的年份索引快速篩選
        const timeFiltered = DataManager.getDataByYearRange(
          timeRange.start.getFullYear(), 
          timeRange.end.getFullYear()
        ).filter(item => {
          if (!item._日期) return false;
          return item._日期 >= timeRange.start && item._日期 <= timeRange.end;
        });

        // 文本匹配
        const baseFiltered = timeFiltered.filter(item => {
          const locationMatch = parsedData.location.some(locationWord => 
            containsTextNormalized(item, locationWord));
          const topicMatch = parsedData.topic.some(topicWord => 
            containsTextNormalized(item, topicWord));
          return locationMatch && topicMatch;
        });

        // 計算相關度分數
        const searchTerms = [...(parsedData.location || []), ...(parsedData.topic || [])];
        baseFiltered.forEach(item => {
          calculateRelevanceScore(item, searchTerms, 'smart');
        });

        // 排序
        baseFiltered.sort((a, b) => 
          this.getRelevanceScore(b, searchTerms, 'smart') - 
          this.getRelevanceScore(a, searchTerms, 'smart')
        );

        const result = {
          query: originalQuery,
          normalizedQuery: normalizedQuery,
          parsedData: parsedData,
          results: baseFiltered,
          timeRange: timeRange
        };

        if (statusCallback) statusCallback(false);
        if (resultCallback) resultCallback(result);
        
        return result;
      } catch (error) {
        if (statusCallback) statusCallback(false);
        throw error;
      }
    },

    // 傳統檢索
    performTraditionalSearch(originalQuery, selectedFields) {
      if (!originalQuery || !originalQuery.trim()) {
        throw new Error('請輸入檢索詞');
      }
      
      if (!DataManager.isDataLoaded()) {
        throw new Error('資料尚未載入完成，請稍候');
      }

      const normalizedQuery = Utils.normalizeText(originalQuery);

      try {
        const searchTerms = parseTraditionalQuery(normalizedQuery);
        
        const results = DataManager.getAllData().filter(item => {
          let result = true;
          let hasPositiveMatch = false;
          
          for (const term of searchTerms) {
            const termMatch = checkTermMatchNormalized(item, term.value, selectedFields);
            
            if (term.operator === 'NOT') {
              if (termMatch) return false;
            } else if (term.operator === 'OR') {
              if (termMatch) hasPositiveMatch = true;
            } else {
              if (term.operator === 'AND') {
                result = result && termMatch;
              } else {
                result = termMatch;
                if (termMatch) hasPositiveMatch = true;
              }
            }
          }
          
          return result && (hasPositiveMatch || searchTerms.length === 0);
        });

        return {
          query: originalQuery,
          normalizedQuery: normalizedQuery,
          results: results,
          fields: selectedFields
        };
      } catch (error) {
        throw new Error('檢索語法錯誤，請檢查布林邏輯是否正確');
      }
    },

    // 取得相關度分數
    getRelevanceScore(item, searchTerms, searchMode) {
      return calculateRelevanceScore(item, searchTerms, searchMode);
    },

    // 檢查文本是否包含搜尋詞
    containsSearchTerms(text, searchData, searchMode) {
      if (!text) return false;
      
      if (searchMode === 'smart' && searchData.parsedData) {
        const normalizedText = Utils.normalizeText(text);
        const str = String(normalizedText).toLowerCase();
        const searchTerms = [
          ...(searchData.parsedData.location || []), 
          ...(searchData.parsedData.topic || [])
        ];
        return searchTerms.some(term => {
          const normalizedTerm = Utils.normalizeText(term || '');
          return normalizedTerm && str.includes(String(normalizedTerm).toLowerCase());
        });
      }
      
      if (searchMode === 'traditional' && searchData.normalizedQuery) {
        const normalizedText = Utils.normalizeText(text);
        const normalizedQuery = Utils.normalizeText(searchData.normalizedQuery);
        const str = String(normalizedText).toLowerCase();
        const query = String(normalizedQuery).toLowerCase();
        return str.includes(query);
      }
      
      return false;
    },

    // 高亮搜尋詞
    highlightSearchTerms(text, searchData, searchMode) {
      if (!text) return Utils.safe(text);
      
      let highlightedText = Utils.safe(text);
      let searchTerms = [];
      
      if (searchMode === 'smart' && searchData.parsedData) {
        searchTerms = [
          ...(searchData.parsedData.location || []), 
          ...(searchData.parsedData.topic || [])
        ].filter(Boolean);
      } else if (searchMode === 'traditional' && searchData.normalizedQuery) {
        searchTerms = [searchData.normalizedQuery];
      }
      
      if (searchTerms.length === 0) {
        return highlightedText;
      }
      
      const sortedTerms = searchTerms.sort((a, b) => String(b).length - String(a).length);
      
      sortedTerms.forEach(term => {
        if (term) {
          const normalizedTerm = Utils.normalizeText(term);
          if (highlightedText.includes(String(normalizedTerm))) {
            const regex = new RegExp(`(${Utils.escapeRegExp(String(normalizedTerm))})`, 'gi');
            highlightedText = highlightedText.replace(regex, 
              '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
          }
          
          if (String(term) !== String(normalizedTerm) && highlightedText.includes(String(term))) {
            const regex = new RegExp(`(${Utils.escapeRegExp(String(term))})`, 'gi');
            highlightedText = highlightedText.replace(regex, 
              '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
          }
        }
      });
      
      return highlightedText;
    },

    // 清理緩存
    clearCache() {
      const maxCacheSize = 1000;
      
      if (searchCache.results.size > maxCacheSize) {
        const keys = Array.from(searchCache.results.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => searchCache.results.delete(key));
      }
      
      if (searchCache.relevanceScores.size > maxCacheSize) {
        const keys = Array.from(searchCache.relevanceScores.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => searchCache.relevanceScores.delete(key));
      }
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.SearchManager = SearchManager;

})(this);