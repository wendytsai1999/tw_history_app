// utils.js - 優化版工具函數模組（增強快取系統和效能）

// ========================================
// 常數定義
// ========================================

const CHAR_NORM_MAP = new Map([
  ['台', '臺'], ['台灣', '臺灣'], ['台北', '臺北'], 
  ['台中', '臺中'], ['台南', '臺南'], ['台東', '臺東'],
  ['裡', '裏'], ['着', '著'], ['国', '國'],
  ['学', '學'], ['会', '會']
]);

const ERA_CONFIG = new Map([
  ['明治', { start: 1868, end: 1912, twStart: 1895, twEnd: 1912 }],
  ['大正', { start: 1912, end: 1926, twStart: 1912, twEnd: 1926 }],
  ['昭和', { start: 1926, end: 1989, twStart: 1926, twEnd: 1945 }]
]);

// 預編譯常用正則表達式
const COMPILED_REGEX = {
  characterNorm: new RegExp([...CHAR_NORM_MAP.keys()].join('|'), 'g'),
  datePatterns: [
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    /^(\d{4})-(\d{1,2})/,
    /^(\d{4})\/(\d{1,2})/
  ],
  escapeRegex: /[.*+?^${}()|[\]\\]/g,
  whitespace: /\s+/g,
  punctuation: /[，。！？；：「」『』（）]/g,
  fullWidthSpace: /\u3000/g,
  quotes: /^['"]|['"]$/g,
  brackets: /^\[|\]$/g,
  separators: /[,，]/g
};

// ========================================
// 高效能 LRU 快取系統
// ========================================

class HighPerformanceLRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessCount = 0;
    this.hitCount = 0;
  }

  get(key) {
    this.accessCount++;
    if (this.cache.has(key)) {
      this.hitCount++;
      const value = this.cache.get(key);
      // 將項目移到最後（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 移除最久未使用的項目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
    this.accessCount = 0;
    this.hitCount = 0;
  }

  size() {
    return this.cache.size;
  }

  getHitRate() {
    return this.accessCount > 0 ? (this.hitCount / this.accessCount) : 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      accessCount: this.accessCount,
      hitCount: this.hitCount,
      hitRate: this.getHitRate(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  estimateMemoryUsage() {
    // 粗略估算記憶體使用量（字節）
    let totalSize = 0;
    for (const [key, value] of this.cache) {
      totalSize += (typeof key === 'string' ? key.length * 2 : 50);
      totalSize += (typeof value === 'string' ? value.length * 2 : 
                   typeof value === 'object' ? JSON.stringify(value).length * 2 : 50);
    }
    return totalSize;
  }
}

// ========================================
// 批次處理器
// ========================================

class BatchProcessor {
  constructor() {
    this.pendingTasks = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async addTask(key, taskFn, priority = 0) {
    return new Promise((resolve, reject) => {
      if (this.pendingTasks.has(key)) {
        // 如果任務已存在，返回現有的 Promise
        return this.pendingTasks.get(key);
      }

      const task = {
        key,
        taskFn,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.pendingTasks.set(key, { resolve, reject });
      this.processingQueue.push(task);
      
      // 根據優先級排序
      this.processingQueue.sort((a, b) => b.priority - a.priority);

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const task = this.processingQueue.shift();
        
        try {
          const result = await task.taskFn();
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        } finally {
          this.pendingTasks.delete(task.key);
        }

        // 讓出控制權給瀏覽器
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  clear() {
    this.processingQueue.forEach(task => {
      task.reject(new Error('批次處理器已清除'));
    });
    this.processingQueue = [];
    this.pendingTasks.clear();
    this.isProcessing = false;
  }
}

// ========================================
// 工具函數管理器（優化版）
// ========================================

class UtilsManager {
  constructor() {
    // 高效能快取系統
    this.normalizedCache = new HighPerformanceLRUCache(1000);
    this.escapeCache = new HighPerformanceLRUCache(500);
    this.eraCache = new HighPerformanceLRUCache(200);
    this.dateCache = new HighPerformanceLRUCache(300);
    this.keywordCache = new HighPerformanceLRUCache(500);
    
    // DOM 元素快取
    this.domCache = new Map();
    this.domObserver = null;
    
    // 批次處理器
    this.batchProcessor = new BatchProcessor();
    
    // 效能監控
    this.perfMetrics = {
      normalizeCallCount: 0,
      escapeCallCount: 0,
      dateParseCallCount: 0,
      keywordParseCallCount: 0,
      totalProcessingTime: 0
    };

    // 初始化 DOM 觀察器
    this._initializeDOMObserver();
  }

  // ========================================
  // DOM 操作（優化版）
  // ========================================

  $(id) {
    if (this.domCache.has(id)) {
      const element = this.domCache.get(id);
      if (element && element.isConnected) {
        return element;
      }
      this.domCache.delete(id);
    }
    
    const element = document.getElementById(id);
    if (element) {
      this.domCache.set(id, element);
    }
    return element;
  }

  $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }

  _initializeDOMObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    this.domObserver = new MutationObserver((mutations) => {
      let shouldClearCache = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldClearCache = true;
            }
          });
        }
      });

      if (shouldClearCache) {
        this._clearInvalidDOMCache();
      }
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  _clearInvalidDOMCache() {
    for (const [id, element] of this.domCache) {
      if (!element.isConnected) {
        this.domCache.delete(id);
      }
    }
  }

  // ========================================
  // 文字處理（高效能版）
  // ========================================

  safe(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
  }

  normalizeText(text) {
    if (!text) return '';
    
    const str = typeof text === 'string' ? text : String(text);
    if (str.length === 0) return '';
    
    const startTime = performance.now();
    
    // 檢查快取
    const cached = this.normalizedCache.get(str);
    if (cached !== null) {
      return cached;
    }

    this.perfMetrics.normalizeCallCount++;

    try {
      // 1. 字形正規化（使用預編譯正則）
      let normalized = str.replace(COMPILED_REGEX.characterNorm, match => 
        CHAR_NORM_MAP.get(match) || match
      );
      
      // 2. 全形空白轉半形
      normalized = normalized.replace(COMPILED_REGEX.fullWidthSpace, ' ');
      
      // 3. 標點符號去除
      normalized = normalized.replace(COMPILED_REGEX.punctuation, '');
      
      // 4. 連續空白合併
      normalized = normalized.replace(COMPILED_REGEX.whitespace, ' ');
      
      // 5. 去頭尾空白
      normalized = normalized.trim();

      // 快取結果
      this.normalizedCache.set(str, normalized);
      
      this.perfMetrics.totalProcessingTime += performance.now() - startTime;
      return normalized;
    } catch (error) {
      console.warn('[Utils] 文字正規化錯誤:', error);
      return str;
    }
  }

  escapeRegExp(str) {
    if (!str) return '';
    
    const startTime = performance.now();
    
    // 檢查快取
    const cached = this.escapeCache.get(str);
    if (cached !== null) {
      return cached;
    }
    
    this.perfMetrics.escapeCallCount++;
    
    const escaped = str.replace(COMPILED_REGEX.escapeRegex, '\\$&');
    this.escapeCache.set(str, escaped);
    
    this.perfMetrics.totalProcessingTime += performance.now() - startTime;
    return escaped;
  }

  cleanText(text) {
    if (!text) return '';
    
    const str = typeof text === 'string' ? text : String(text);
    
    return str
      .replace(COMPILED_REGEX.punctuation, ' ')
      .replace(COMPILED_REGEX.whitespace, ' ')
      .trim();
  }

  // ========================================
  // 日期處理（優化版）
  // ========================================

  parseDate(dateStr) {
    if (!dateStr) return null;
    
    const str = typeof dateStr === 'string' ? dateStr.trim() : String(dateStr).trim();
    if (str.length === 0) return null;
    
    const startTime = performance.now();
    
    // 檢查快取
    const cached = this.dateCache.get(str);
    if (cached !== null) {
      return cached;
    }
    
    this.perfMetrics.dateParseCallCount++;
    
    try {
      let result = null;
      
      // 使用預編譯的正則表達式
      for (const pattern of COMPILED_REGEX.datePatterns) {
        const match = str.match(pattern);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2] || 1);
          const day = parseInt(match[3] || 1);
          
          if (year >= 1895 && year <= 1945) {
            result = new Date(year, month - 1, day);
            break;
          }
        }
      }
      
      // 快取結果（包括 null）
      this.dateCache.set(str, result);
      
      this.perfMetrics.totalProcessingTime += performance.now() - startTime;
      return result;
    } catch (error) {
      console.warn('[Utils] 日期解析錯誤:', error);
      this.dateCache.set(str, null);
      return null;
    }
  }

  parseYear(yearStr) {
    if (!yearStr) return null;
    
    const year = parseInt(yearStr);
    if (isNaN(year)) return null;
    
    return (year >= 1895 && year <= 1945) ? year : null;
  }

  formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // ========================================
  // 年號轉換（快取優化版）
  // ========================================

  convertEraToWestern(eraName, eraYear) {
    const cacheKey = `${eraName}-${eraYear}`;
    
    // 檢查快取
    const cached = this.eraCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const config = ERA_CONFIG.get(eraName);
    if (!config) {
      this.eraCache.set(cacheKey, null);
      return null;
    }

    const westernYear = config.start + eraYear - 1;
    const result = (westernYear >= config.twStart && westernYear <= config.twEnd) ? westernYear : null;
    
    this.eraCache.set(cacheKey, result);
    return result;
  }

  convertWesternToEra(westernYear) {
    const year = parseInt(westernYear);
    if (year < 1895 || year > 1945) return null;

    const cacheKey = `western-${year}`;
    const cached = this.eraCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    let result = null;
    for (const [eraName, config] of ERA_CONFIG) {
      if (year >= config.twStart && year <= config.twEnd) {
        result = { 
          era: eraName, 
          year: year - config.start + 1 
        };
        break;
      }
    }
    
    this.eraCache.set(cacheKey, result);
    return result;
  }

  // ========================================
  // 關鍵詞處理（優化版）
  // ========================================

  parseKeywords(kw) {
    if (Array.isArray(kw)) return kw.filter(Boolean);
    if (!kw) return [];
    
    const str = typeof kw === 'string' ? kw : String(kw);
    
    // 檢查快取
    const cached = this.keywordCache.get(str);
    if (cached !== null) {
      return cached;
    }
    
    const startTime = performance.now();
    this.perfMetrics.keywordParseCallCount++;
    
    try {
      const result = str
        .replace(COMPILED_REGEX.brackets, '')
        .split(COMPILED_REGEX.separators)
        .map(s => s.replace(COMPILED_REGEX.quotes, '').trim())
        .filter(Boolean);
      
      this.keywordCache.set(str, result);
      
      this.perfMetrics.totalProcessingTime += performance.now() - startTime;
      return result;
    } catch (error) {
      console.warn('[Utils] 關鍵詞解析錯誤:', error);
      this.keywordCache.set(str, []);
      return [];
    }
  }

  // ========================================
  // 陣列和物件工具（優化版）
  // ========================================

  unique(arr) {
    if (!Array.isArray(arr)) return [];
    if (arr.length === 0) return [];
    if (arr.length === 1) return arr.slice();
    
    // 針對小陣列使用更快的去重方法
    if (arr.length < 100) {
      return arr.filter((item, index, array) => 
        item != null && array.indexOf(item) === index
      );
    }
    
    // 大陣列使用 Set
    return [...new Set(arr.filter(Boolean))];
  }

  // ========================================
  // 效能工具（優化版）
  // ========================================

  debounce(func, delay) {
    let timeoutId;
    let lastArgs;
    
    const debounced = function(...args) {
      lastArgs = args;
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        func.apply(this, lastArgs);
      }, delay);
    };
    
    debounced.cancel = () => {
      clearTimeout(timeoutId);
    };
    
    debounced.flush = function() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        func.apply(this, lastArgs);
      }
    };
    
    return debounced;
  }

  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    let lastArgs;
    
    const throttled = function(...args) {
      const currentTime = Date.now();
      lastArgs = args;
      
      if (currentTime - lastExecTime >= delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else if (!timeoutId) {
        timeoutId = setTimeout(() => {
          func.apply(this, lastArgs);
          lastExecTime = Date.now();
          timeoutId = null;
        }, delay - (currentTime - lastExecTime));
      }
    };
    
    throttled.cancel = () => {
      clearTimeout(timeoutId);
      timeoutId = null;
    };
    
    return throttled;
  }

  async batchProcess(items, batchSize = 100, processFn) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * batchSize;
      const endIndex = Math.min(startIndex + batchSize, items.length);
      const batch = items.slice(startIndex, endIndex);
      
      const batchResults = [];
      
      // 處理批次中的每個項目
      for (let j = 0; j < batch.length; j++) {
        try {
          const result = await processFn(batch[j], startIndex + j);
          if (result !== undefined) {
            batchResults.push(result);
          }
        } catch (error) {
          console.warn(`[Utils] 批次處理項目 ${startIndex + j} 錯誤:`, error);
        }
      }
      
      results.push(...batchResults);
      
      // 報告進度
      if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage({
          type: 'batchProgress',
          completed: i + 1,
          total: totalBatches,
          processedItems: results.length
        }, '*');
      }
      
      // 讓出控制權給瀏覽器（每批次後）
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  // 新增：高效能批次處理
  async efficientBatchProcess(items, processFn, options = {}) {
    const {
      batchSize = 50,
      concurrency = 3,
      priority = 0,
      progressCallback = null
    } = options;

    const key = `batch_${Date.now()}_${Math.random()}`;
    
    return this.batchProcessor.addTask(key, async () => {
      const results = [];
      const chunks = [];
      
      // 將項目分割成批次
      for (let i = 0; i < items.length; i += batchSize) {
        chunks.push(items.slice(i, i + batchSize));
      }
      
      // 並行處理批次
      for (let i = 0; i < chunks.length; i += concurrency) {
        const concurrentChunks = chunks.slice(i, i + concurrency);
        
        const chunkPromises = concurrentChunks.map(async (chunk, chunkIndex) => {
          const chunkResults = [];
          
          for (let j = 0; j < chunk.length; j++) {
            try {
              const globalIndex = (i + chunkIndex) * batchSize + j;
              const result = await processFn(chunk[j], globalIndex);
              if (result !== undefined) {
                chunkResults.push(result);
              }
            } catch (error) {
              console.warn(`[Utils] 高效能批次處理錯誤:`, error);
            }
          }
          
          return chunkResults;
        });
        
        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach(chunk => results.push(...chunk));
        
        // 報告進度
        if (progressCallback) {
          progressCallback({
            completed: Math.min(i + concurrency, chunks.length),
            total: chunks.length,
            processedItems: results.length
          });
        }
        
        // 讓出控制權
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      return results;
    }, priority);
  }

  // ========================================
  // 數字格式化（快取版）
  // ========================================

  formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    
    // 簡單數字直接返回
    if (num < 1000) return num.toString();
    
    try {
      return new Intl.NumberFormat('zh-TW').format(num);
    } catch (error) {
      return num.toLocaleString();
    }
  }

  // ========================================
  // 記憶體管理和統計
  // ========================================

  getMemoryUsage() {
    const stats = {
      normalizedCache: this.normalizedCache.getStats(),
      escapeCache: this.escapeCache.getStats(),
      eraCache: this.eraCache.getStats(),
      dateCache: this.dateCache.getStats(),
      keywordCache: this.keywordCache.getStats(),
      domCache: {
        size: this.domCache.size,
        memoryUsage: this.domCache.size * 100 // 粗略估算
      },
      totalMemoryUsage: 0
    };
    
    // 計算總記憶體使用量
    stats.totalMemoryUsage = 
      stats.normalizedCache.memoryUsage +
      stats.escapeCache.memoryUsage +
      stats.eraCache.memoryUsage +
      stats.dateCache.memoryUsage +
      stats.keywordCache.memoryUsage +
      stats.domCache.memoryUsage;
    
    return stats;
  }

  getPerformanceMetrics() {
    return {
      ...this.perfMetrics,
      cacheStats: this.getCacheStats(),
      averageProcessingTime: this.perfMetrics.normalizeCallCount > 0 ? 
        this.perfMetrics.totalProcessingTime / this.perfMetrics.normalizeCallCount : 0
    };
  }

  getCacheStats() {
    return {
      normalized: this.normalizedCache.size(),
      escape: this.escapeCache.size(),
      era: this.eraCache.size(),
      date: this.dateCache.size(),
      keyword: this.keywordCache.size(),
      dom: this.domCache.size,
      hitRates: {
        normalized: this.normalizedCache.getHitRate(),
        escape: this.escapeCache.getHitRate(),
        era: this.eraCache.getHitRate(),
        date: this.dateCache.getHitRate(),
        keyword: this.keywordCache.getHitRate()
      }
    };
  }

  // 智能清理：根據記憶體使用量決定清理策略
  smartCleanup() {
    const memUsage = this.getMemoryUsage();
    const totalMB = memUsage.totalMemoryUsage / (1024 * 1024);
    
    console.log(`[Utils] 當前記憶體使用量: ${totalMB.toFixed(2)}MB`);
    
    if (totalMB > 50) { // 超過 50MB 時進行激進清理
      this.normalizedCache.clear();
      this.escapeCache.clear();
      this.dateCache.clear();
      this.keywordCache.clear();
      this._clearInvalidDOMCache();
      console.log('[Utils] 執行激進記憶體清理');
    } else if (totalMB > 20) { // 超過 20MB 時進行保守清理
      // 清理命中率低的快取
      const stats = this.getCacheStats();
      if (stats.hitRates.normalized < 0.5) this.normalizedCache.clear();
      if (stats.hitRates.escape < 0.3) this.escapeCache.clear();
      if (stats.hitRates.date < 0.4) this.dateCache.clear();
      if (stats.hitRates.keyword < 0.4) this.keywordCache.clear();
      console.log('[Utils] 執行保守記憶體清理');
    }
  }

  cleanup() {
    // 清理快取
    this.normalizedCache.clear();
    this.escapeCache.clear();
    this.eraCache.clear();
    this.dateCache.clear();
    this.keywordCache.clear();
    this.domCache.clear();
    
    // 清理批次處理器
    this.batchProcessor.clear();
    
    // 清理 DOM 觀察器
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    
    // 重置效能指標
    this.perfMetrics = {
      normalizeCallCount: 0,
      escapeCallCount: 0,
      dateParseCallCount: 0,
      keywordParseCallCount: 0,
      totalProcessingTime: 0
    };
    
    console.log('[Utils] 清理完成');
  }
}

// 創建單例實例
export const Utils = new UtilsManager();
