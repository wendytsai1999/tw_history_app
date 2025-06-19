// data.js - 資料處理模組
// 最終修正版：確保正確的初始化

(function(global) {
  'use strict';

  // 取得 Utils 模組
  const Utils = global.TaiwanNewsApp.Utils;

  // ========================================
  // 私有變數 - 只有這個模組內部能使用
  // ========================================
  let rawData = [];
  let processedData = [];
  let indexes = {
    titleMajor: new Map(),
    titleMid: new Map(),
    keywordsByCategory: new Map(),
    yearIndex: new Map()
  };

  // 資料來源 URLs
  const DATA_URLS = {
    keywords: [1, 2, 3, 4].map(i => 
      `https://wendytsai1999.github.io/tw-history-data/keywords/split_keywords${i}.json`
    ),
    titles: [1, 2].map(i => 
      `https://wendytsai1999.github.io/tw-history-data/titles/split_titles${i}.json`
    )
  };

  // ========================================
  // 私有函數 - 只供內部使用
  // ========================================
  
  // 安全載入 JSON 檔案
  async function safeLoadJson(url) {
    try {
      console.log(`開始載入：${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log(`載入完成：${url}，大小：${text.length} 字元`);
      
      if (!text.trim()) {
        console.warn(`檔案為空：${url}`);
        return [];
      }
      
      const data = JSON.parse(text);
      console.log(`解析完成：${url}，資料筆數：${Array.isArray(data) ? data.length : '非陣列'}`);
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`載入失敗 ${url}:`, error);
      
      // 如果是網路錯誤，提供更詳細的資訊
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('可能的網路連線問題或 CORS 錯誤');
      }
      
      return [];
    }
  }

  // 建立快速查找索引
  function buildIndexes() {
    // 清空現有索引
    indexes.titleMajor.clear();
    indexes.titleMid.clear();
    indexes.keywordsByCategory.clear();
    indexes.yearIndex.clear();

    processedData.forEach((item, index) => {
      // 建立標題分類索引
      if (item.標題大分類) {
        if (!indexes.titleMajor.has(item.標題大分類)) {
          indexes.titleMajor.set(item.標題大分類, []);
        }
        indexes.titleMajor.get(item.標題大分類).push(index);
      }

      if (item.標題中分類) {
        if (!indexes.titleMid.has(item.標題中分類)) {
          indexes.titleMid.set(item.標題中分類, []);
        }
        indexes.titleMid.get(item.標題中分類).push(index);
      }

      // 建立年份索引
      if (item._年份) {
        if (!indexes.yearIndex.has(item._年份)) {
          indexes.yearIndex.set(item._年份, []);
        }
        indexes.yearIndex.get(item._年份).push(index);
      }

      // 建立關鍵詞分類索引
      if (item.關鍵詞列表) {
        item.關鍵詞列表.forEach(kw => {
          const key = `${kw.大分類}|${kw.中分類}|${kw.小分類}`;
          if (!indexes.keywordsByCategory.has(key)) {
            indexes.keywordsByCategory.set(key, []);
          }
          indexes.keywordsByCategory.get(key).push(index);
        });
      }
    });
  }

  // 處理和合併資料
  function processRawData(keywords, titles) {
    // 使用 Map 來提高查找效能
    const titleMap = new Map();
    const kwMap = new Map();

    // 處理標題資料
    const titleBatch = titles.filter(t => Number(t.資料編號) > 0);
    titleBatch.forEach(t => {
      const id = Number(t.資料編號);
      titleMap.set(id, {
        資料編號: t.資料編號, 
        時間: t.時間 || t.日期 || '', 
        題名: t.題名 || '',
        標題大分類: t.標題大分類 || '(未分類)', 
        標題中分類: t.標題中分類 || '',
        _日期: Utils.parseDate(t.時間 || t.日期), 
        _年份: Utils.parseYear(t._年份 || t.時間 || t.日期)
      });
    });

    // 處理關鍵詞資料
    const keywordBatch = keywords.filter(k => Number(k.資料編號) > 0);
    keywordBatch.forEach(k => {
      const id = Number(k.資料編號);
      if (!kwMap.has(id)) kwMap.set(id, []);
      kwMap.get(id).push({
        關鍵詞: Utils.parseKeywords(k.關鍵詞), 
        大分類: k.大分類 || '(未分類)', 
        中分類: k.中分類 || '', 
        小分類: k.小分類 || ''
      });
    });

    // 合併資料
    return Array.from(titleMap.values()).map(t => ({ 
      ...t, 
      關鍵詞列表: kwMap.get(Number(t.資料編號)) || [] 
    }));
  }

  // ========================================
  // 公開的 API - 外部可以使用的函數
  // ========================================
  const DataManager = {
    // 初始化並載入所有資料
    async loadData(progressCallback) {
      try {
        // 通知開始載入
        if (progressCallback) progressCallback('初始化載入程序...', 'info');

        // 重置狀態
        rawData = [];
        processedData = [];
        indexes = {
          titleMajor: new Map(),
          titleMid: new Map(),
          keywordsByCategory: new Map(),
          yearIndex: new Map()
        };

        // 載入關鍵詞資料
        if (progressCallback) progressCallback('載入關鍵詞資料...', 'info');
        
        const keywordPromises = DATA_URLS.keywords.map(url => safeLoadJson(url));
        const keywordArrays = await Promise.all(keywordPromises);
        const keywords = keywordArrays.flat().filter(Boolean);
        
        console.log(`關鍵詞資料載入完成：${keywords.length} 筆`);
        
        // 載入標題資料
        if (progressCallback) progressCallback('載入標題資料...', 'info');
        
        const titlePromises = DATA_URLS.titles.map(url => safeLoadJson(url));
        const titleArrays = await Promise.all(titlePromises);
        const titles = titleArrays.flat().filter(Boolean);
        
        console.log(`標題資料載入完成：${titles.length} 筆`);

        // 檢查是否有載入到資料
        if (keywords.length === 0 && titles.length === 0) {
          throw new Error('無法載入任何資料，請檢查網路連線或資料來源');
        }

        if (titles.length === 0) {
          throw new Error('標題資料載入失敗');
        }

        // 處理資料
        if (progressCallback) progressCallback('處理資料中...', 'info');
        rawData = { keywords, titles };
        processedData = processRawData(keywords, titles);
        
        console.log(`資料處理完成：${processedData.length} 筆`);
        
        if (processedData.length === 0) {
          throw new Error('資料處理後為空，可能資料格式有問題');
        }
        
        // 建立索引
        if (progressCallback) progressCallback('建立索引中...', 'info');
        buildIndexes();
        
        console.log('索引建立完成');
        
        // 載入完成
        if (progressCallback) {
          progressCallback(`載入完成：${processedData.length.toLocaleString()} 筆資料`, 'ok');
        }

        return true;
        
      } catch (error) {
        console.error('資料載入失敗:', error);
        
        if (progressCallback) {
          progressCallback(`載入失敗：${error.message}`, 'error');
        }
        
        return false;
      }
    },

    // 取得所有處理過的資料
    getAllData() {
      return processedData;
    },

    // 取得原始資料
    getRawData() {
      return rawData;
    },

    // 取得索引
    getIndexes() {
      return indexes;
    },

    // 取得資料統計
    getStats() {
      return {
        total: processedData.length,
        hasTitle: processedData.filter(item => item.題名).length,
        hasKeywords: processedData.filter(item => item.關鍵詞列表.length > 0).length,
        dateRange: {
          start: Math.min(...processedData.map(item => item._年份).filter(Boolean)),
          end: Math.max(...processedData.map(item => item._年份).filter(Boolean))
        }
      };
    },

    // 根據年份範圍取得資料
    getDataByYearRange(startYear, endYear) {
      let result = [];
      for (let year = startYear; year <= endYear; year++) {
        if (indexes.yearIndex.has(year)) {
          const yearIndices = indexes.yearIndex.get(year);
          result.push(...yearIndices.map(i => processedData[i]));
        }
      }
      return result;
    },

    // 根據標題分類取得資料
    getDataByTitleCategory(major, mid) {
      const result = [];
      
      if (major && indexes.titleMajor.has(major)) {
        const indices = indexes.titleMajor.get(major);
        const items = indices.map(i => processedData[i]);
        
        if (mid) {
          return items.filter(item => item.標題中分類 === mid);
        }
        return items;
      }
      
      return result;
    },

    // 根據關鍵詞分類取得資料
    getDataByKeywordCategory(major, mid, minor) {
      const result = [];
      const searchKey = `${major || ''}|${mid || ''}|${minor || ''}`;
      
      // 找到所有符合條件的組合
      for (const [key, indices] of indexes.keywordsByCategory.entries()) {
        const [keyMajor, keyMid, keyMinor] = key.split('|');
        
        const majorMatch = !major || keyMajor === major;
        const midMatch = !mid || keyMid === mid;
        const minorMatch = !minor || keyMinor === minor;
        
        if (majorMatch && midMatch && minorMatch) {
          result.push(...indices.map(i => processedData[i]));
        }
      }
      
      // 去除重複項目
      const uniqueResult = [];
      const seenIds = new Set();
      
      result.forEach(item => {
        if (!seenIds.has(item.資料編號)) {
          seenIds.add(item.資料編號);
          uniqueResult.push(item);
        }
      });
      
      return uniqueResult;
    },

    // 重新載入資料
    async reload(progressCallback) {
      processedData = [];
      indexes = {
        titleMajor: new Map(),
        titleMid: new Map(),
        keywordsByCategory: new Map(),
        yearIndex: new Map()
      };
      
      return await this.loadData(progressCallback);
    },

    // 檢查資料是否已載入
    isDataLoaded() {
      return processedData.length > 0;
    },

    // 取得處理過的資料數量
    getDataCount() {
      return processedData.length;
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.DataManager = DataManager;

})(this);