// data.js - 資料管理模組

// ========================================
// 資料管理類別
// ========================================

class DataManager {
  constructor() {
    // 資料儲存
    this.rawData = null;
    this.processedData = [];
    this.isLoading = false;
    this._isDataLoaded = false;
    
    // 載入配置
    this.config = {
      timeout: 20000,
      retryCount: 2,
      retryDelay: 1000,
      batchSize: 1000,
      maxConcurrentRequests: 3
    };
    
    // 資料來源URLs
    this.dataUrls = {
      keywords: [1, 2, 3, 4].map(i => 
        `https://wendytsai1999.github.io/tw-history-data/keywords/split_keywords${i}.json`
      ),
      titles: [1, 2].map(i => 
        `https://wendytsai1999.github.io/tw-history-data/titles/split_titles${i}.json`
      )
    };
    
    // 快速查找索引（只保留必要的）
    this.indexes = {
      byId: new Map(),
      yearStats: new Map(),
      publicationList: new Set(),
      editionList: new Set()
    };
    
    // 效能監控
    this.metrics = {
      loadStartTime: 0,
      loadEndTime: 0,
      totalRecords: 0
    };
    
    // Utils 依賴
    this.utils = null;
  }

  // 初始化
  init(utils) {
    this.utils = utils;
  }

  // ========================================
  // 網路請求方法
  // ========================================

  async fetchWithTimeout(url, timeout = this.config.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async loadJsonWithRetry(url, retryCount = this.config.retryCount) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        if (!text.trim()) {
          throw new Error('空檔案');
        }
        
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
        
      } catch (error) {
        if (attempt === retryCount) {
          console.error(`[DataManager] 載入失敗: ${url}`, error.message);
          return [];
        }
        
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * attempt)
        );
      }
    }
    return [];
  }

  async loadMultipleFiles(urls, fileType) {
    const loadPromises = urls.map(async (url, index) => {
      try {
        const data = await this.loadJsonWithRetry(url);
        return { index, data, success: true };
      } catch (error) {
        console.warn(`[DataManager] ${fileType} 檔案 ${index + 1} 載入失敗:`, error);
        return { index, data: [], success: false };
      }
    });
    
    const results = await Promise.all(loadPromises);
    
    // 按順序合併結果
    return results
      .sort((a, b) => a.index - b.index)
      .flatMap(result => result.data);
  }

  // ========================================
  // 資料處理方法
  // ========================================

  async processRawData(keywords, titles) {
    console.log(`[DataManager] 開始處理資料 - 關鍵詞: ${keywords.length}, 標題: ${titles.length}`);
    
    const titleMap = new Map();
    const kwMap = new Map();

    // 處理標題資料
    const validTitles = titles.filter(t => {
      const id = Number(t.資料編號);
      return id > 0 && !isNaN(id) && t.題名;
    });
    
    for (const t of validTitles) {
      const id = Number(t.資料編號);
      const processedTitle = {
        資料編號: t.資料編號,
        時間: t.時間 || t.日期 || '',
        題名: t.題名 || '',
        作者: t.作者 || '',
        標題大分類: t.標題大分類 || '(未分類)',
        標題中分類: t.標題中分類 || '',
        分類: t.分類 || '',
        '分類(一)': t['分類(一)'] || t.分類一 || '',
        '分類(二)': t['分類(二)'] || t.分類二 || '',
        '分類(三)': t['分類(三)'] || t.分類三 || '',
        刊別: t.刊別 || t.版面類型 || '',
        語文: t.語文 || t.語言 || '',
        版次: t.版次 || t.版面 || '',
        _日期: this.utils?.parseDate(t.時間 || t.日期) || null,
        _年份: this.utils?.parseYear(t._年份 || t.時間 || t.日期) || null
      };
      
      titleMap.set(id, processedTitle);
      
      // 建立統計索引
      if (processedTitle._年份) {
        const count = this.indexes.yearStats.get(processedTitle._年份) || 0;
        this.indexes.yearStats.set(processedTitle._年份, count + 1);
      }
      if (processedTitle.刊別) this.indexes.publicationList.add(processedTitle.刊別);
      if (processedTitle.版次) this.indexes.editionList.add(processedTitle.版次);
    }

    // 處理關鍵詞資料
    const validKeywords = keywords.filter(k => {
      const id = Number(k.資料編號);
      return id > 0 && !isNaN(id);
    });
    
    for (const k of validKeywords) {
      const id = Number(k.資料編號);
      if (!kwMap.has(id)) kwMap.set(id, []);
      
      kwMap.get(id).push({
        關鍵詞: this.utils?.parseKeywords(k.關鍵詞) || [k.關鍵詞 || ''],
        大分類: k.大分類 || '(未分類)',
        中分類: k.中分類 || '',
        小分類: k.小分類 || ''
      });
    }

    // 合併資料
    const mergedData = [];
    for (const [id, titleData] of titleMap) {
      const item = {
        ...titleData,
        關鍵詞列表: kwMap.get(id) || []
      };
      mergedData.push(item);
      this.indexes.byId.set(id, item);
    }

    this.metrics.totalRecords = mergedData.length;
    console.log(`[DataManager] 資料處理完成: ${mergedData.length} 筆記錄`);
    
    return mergedData;
  }

  // ========================================
  // 公開方法
  // ========================================

  async loadData(callbacks = {}) {
    if (this.isLoading) {
      return this.processedData.length > 0;
    }
    
    this.isLoading = true;
    
    try {
      this.metrics.loadStartTime = performance.now();
      
      if (callbacks.progressCallback) {
        callbacks.progressCallback('初始化載入程序...', 'info');
      }

      // 重置狀態
      this.processedData = [];
      this._isDataLoaded = false;
      this.indexes.byId.clear();
      this.indexes.yearStats.clear();
      this.indexes.publicationList.clear();
      this.indexes.editionList.clear();

      // 載入關鍵詞資料
      if (callbacks.progressCallback) {
        callbacks.progressCallback('載入關鍵詞資料...', 'info');
      }
      const keywords = await this.loadMultipleFiles(this.dataUrls.keywords, '關鍵詞');
      
      // 載入標題資料
      if (callbacks.progressCallback) {
        callbacks.progressCallback('載入標題資料...', 'info');
      }
      const titles = await this.loadMultipleFiles(this.dataUrls.titles, '標題');

      // 處理資料
      if (callbacks.progressCallback) {
        callbacks.progressCallback('處理並合併資料...', 'info');
      }
      this.rawData = { keywords, titles };
      this.processedData = await this.processRawData(keywords, titles);
      
      this.metrics.loadEndTime = performance.now();
      const totalTime = (this.metrics.loadEndTime - this.metrics.loadStartTime) / 1000;
      
      this._isDataLoaded = true;
      
      console.log(`[DataManager] 載入完成 - 總耗時: ${totalTime.toFixed(2)}秒`);
      
      if (callbacks.progressCallback) {
        callbacks.progressCallback(`載入完成：${this.processedData.length.toLocaleString()} 筆資料`, 'ok');
      }
      
      if (callbacks.onDataLoaded) {
        callbacks.onDataLoaded(this.processedData);
      }
      
      return true;
      
    } catch (error) {
      console.error('[DataManager] 載入失敗:', error);
      
      if (callbacks.progressCallback) {
        callbacks.progressCallback(`載入失敗：${error.message}`, 'error');
      }
      
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  // 取得所有資料
  getAllData() {
    return this.processedData;
  }

  // 檢查資料是否已載入
  isDataLoaded() {
    return this._isDataLoaded && this.processedData.length > 0;
  }

  // 檢查是否正在載入
  isLoading() {
    return this.isLoading;
  }

  // 取得統計資訊
  getStats() {
    if (!this.isDataLoaded) {
      return {
        total: 0,
        hasTitle: 0,
        hasKeywords: 0,
        hasAuthor: 0,
        publications: [],
        editions: [],
        dateRange: { start: null, end: null }
      };
    }

    const validYears = Array.from(this.indexes.yearStats.keys())
      .filter(year => year >= 1895 && year <= 1945)
      .sort((a, b) => a - b);

    return {
      total: this.processedData.length,
      hasTitle: this.processedData.filter(item => item.題名).length,
      hasKeywords: this.processedData.filter(item => item.關鍵詞列表?.length > 0).length,
      hasAuthor: this.processedData.filter(item => item.作者).length,
      publications: Array.from(this.indexes.publicationList).sort(),
      editions: Array.from(this.indexes.editionList)
        .map(String)
        .sort((a, b) => {
          const numA = parseInt(a) || 0;
          const numB = parseInt(b) || 0;
          return numA - numB;
        }),
      dateRange: validYears.length > 0 ? {
        start: validYears[0],
        end: validYears[validYears.length - 1]
      } : { start: null, end: null },
      yearStats: Object.fromEntries(this.indexes.yearStats),
      metrics: { ...this.metrics }
    };
  }

  // 根據年份範圍取得資料
  getDataByYearRange(startYear, endYear) {
    if (!this.isDataLoaded) return [];
    
    return this.processedData.filter(item => {
      return item._年份 && item._年份 >= startYear && item._年份 <= endYear;
    });
  }

  // 根據ID取得資料
  getDataById(id) {
    return this.indexes.byId.get(Number(id)) || null;
  }

  // 取得可用的刊別
  getAvailablePublications() {
    return Array.from(this.indexes.publicationList).sort();
  }

  // 取得可用的版次
  getAvailableEditions() {
    return Array.from(this.indexes.editionList)
      .map(String)
      .sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
      });
  }

  // 重新載入資料
  async reload(callbacks = {}) {
    console.log('[DataManager] 重新載入資料');
    this._isDataLoaded = false;
    this.processedData = [];
    return await this.loadData(callbacks);
  }

  // 記憶體清理
  cleanup() {
    this.rawData = null;
    this.indexes.byId.clear();
    this.indexes.yearStats.clear();
    this.indexes.publicationList.clear();
    this.indexes.editionList.clear();
    
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }

  // 取得記憶體使用情況
  getMemoryUsage() {
    const estimate = {
      processedDataSize: JSON.stringify(this.processedData).length,
      indexSize: this.indexes.byId.size * 100, // 估算
      totalSize: 0
    };
    
    estimate.totalSize = estimate.processedDataSize + estimate.indexSize;
    estimate.totalSizeMB = (estimate.totalSize / 1024 / 1024).toFixed(2);
    
    return estimate;
  }
}

// 導出單例
export const dataManager = new DataManager();
