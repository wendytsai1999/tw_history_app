// utils.js - 工具函數模組

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

// ========================================
// 快取系統
// ========================================

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
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
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// ========================================
// 工具函數
// ========================================

class UtilsManager {
  constructor() {
    // 快取系統
    this.normalizedCache = new LRUCache(500);
    this.escapeCache = new LRUCache(200);
    this.eraCache = new LRUCache(100);
    
    // 預編譯正則表達式
    this.REGEX = {
      characterNorm: new RegExp([...CHAR_NORM_MAP.keys()].join('|'), 'g'),
      datePatterns: [
        /^(\d{4})-(\d{1,2})-(\d{1,2})/,
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
        /^(\d{4})-(\d{1,2})/,
        /^(\d{4})\/(\d{1,2})/
      ],
      escapeRegex: /[.*+?^${}()|[\]\\]/g,
      whitespace: /\s+/g,
      punctuation: /[，。！？；：「」『』（）]/g
    };

    // DOM 元素快取
    this.domCache = new Map();
  }

  // DOM 操作（帶快取）
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
    return context.querySelectorAll(selector);
  }

  // 安全文字處理
  safe(val) {
    if (val == null) return '';
    return String(val).trim();
  }

  // 文字正規化（帶快取）
  normalizeText(text) {
    if (!text) return '';
    const str = String(text);
    const cached = this.normalizedCache.get(str);
    if (cached !== null) return cached;

    // 1. 字形正規化
    let normalized = str.replace(this.REGEX.characterNorm, match => 
      CHAR_NORM_MAP.get(match) || match
    );
    // 2. 全形空白轉半形
    normalized = normalized.replace(/\u3000/g, ' ');
    // 3. 標點符號去除
    normalized = normalized.replace(this.REGEX.punctuation, '');
    // 4. 連續空白合併
    normalized = normalized.replace(this.REGEX.whitespace, ' ');
    // 5. 去頭尾空白
    normalized = normalized.trim();

    this.normalizedCache.set(str, normalized);
    return normalized;
  }

  // 正則表達式轉義（帶快取）
  escapeRegExp(str) {
    if (!str) return '';
    
    const cached = this.escapeCache.get(str);
    if (cached !== null) return cached;
    
    const escaped = str.replace(this.REGEX.escapeRegex, '\\$&');
    this.escapeCache.set(str, escaped);
    return escaped;
  }

  // 年號轉西元年（帶快取）
  convertEraToWestern(eraName, eraYear) {
    const cacheKey = `${eraName}-${eraYear}`;
    const cached = this.eraCache.get(cacheKey);
    if (cached !== null) return cached;

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

  // 西元年轉年號
  convertWesternToEra(westernYear) {
    const year = parseInt(westernYear);
    if (year < 1895 || year > 1945) return null;

    for (const [eraName, config] of ERA_CONFIG) {
      if (year >= config.twStart && year <= config.twEnd) {
        return { 
          era: eraName, 
          year: year - config.start + 1 
        };
      }
    }
    return null;
  }

  // 日期解析
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    const str = String(dateStr).trim();
    
    for (const pattern of this.REGEX.datePatterns) {
      const match = str.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2] || 1);
        const day = parseInt(match[3] || 1);
        
        if (year >= 1895 && year <= 1945) {
          return new Date(year, month - 1, day);
        }
      }
    }
    return null;
  }

  // 解析年份
  parseYear(yearStr) {
    if (!yearStr) return null;
    const year = parseInt(yearStr);
    return (year >= 1895 && year <= 1945) ? year : null;
  }

  // 日期格式化
  formatDate(date) {
    if (!date || !(date instanceof Date)) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // 關鍵詞解析
  parseKeywords(kw) {
    if (Array.isArray(kw)) return kw;
    if (!kw) return [];
    
    const str = String(kw);
    return str
      .replace(/^\[|\]$/g, '')
      .split(/[,，]/)
      .map(s => s.replace(/^['"]|['"]$/g, '').trim())
      .filter(Boolean);
  }

  // 文字清理
  cleanText(text) {
    if (!text) return '';
    return String(text)
      .replace(this.REGEX.punctuation, ' ')
      .replace(this.REGEX.whitespace, ' ')
      .trim();
  }

  // 陣列去重
  unique(arr) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter(Boolean))];
  }

  // 防抖函數
  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // 節流函數
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function(...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  // 批量處理
  async batchProcess(items, batchSize, processFn) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = [];
      
      for (const item of batch) {
        try {
          const result = processFn(item, i);
          if (result !== undefined) batchResults.push(result);
        } catch (error) {
          console.warn('批量處理錯誤:', error);
        }
      }
      
      results.push(...batchResults);
      
      // 讓出控制權給瀏覽器
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  // 數字格式化
  formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return new Intl.NumberFormat('zh-TW').format(num);
  }

  // 記憶體清理
  cleanup() {
    this.normalizedCache.clear();
    this.escapeCache.clear();
    this.eraCache.clear();
    this.domCache.clear();
  }

  // 取得快取統計
  getCacheStats() {
    return {
      normalized: this.normalizedCache.size(),
      escape: this.escapeCache.size(),
      era: this.eraCache.size(),
      dom: this.domCache.size
    };
  }
}

// 創建單例實例
export const Utils = new UtilsManager();
