/**
 * JETS 数据加载器
 * 统一调度各 Source 的数据加载与缓存
 */

async function withRetry(fn, retries = 0) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

export class DataLoader {
    constructor({ sources = [], maxRetries = 0 } = {}) {
        this.sources = new Map();
        this.cache = new Map();
        this.maxRetries = Math.max(0, Number(maxRetries) || 0);

        sources.forEach(source => this.registerSource(source));
    }

    registerSource(source) {
        if (!source || !source.type) {
            throw new Error('Source 必须包含 type');
        }
        this.sources.set(source.type, source);
    }

    clearCache(type) {
        if (type) {
            this.cache.delete(type);
            return;
        }
        this.cache.clear();
    }

    async loadAll({ force = false } = {}) {
        const tasks = Array.from(this.sources.keys()).map(type =>
            this.loadByType(type, { force }).catch(err => {
                console.warn(`DataLoader: ${type} 加载失败`, err);
                return [];
            }),
        );

        const results = await Promise.all(tasks);
        return results.flat();
    }

    async loadByType(type, { force = false } = {}) {
        if (!force && this.cache.has(type)) {
            return this.cache.get(type) || [];
        }

        const source = this.sources.get(type);
        if (!source) {
            return [];
        }

        const data = typeof source.load === 'function'
            ? await withRetry(() => source.load(), this.maxRetries)
            : undefined;

        let items = [];
        if (typeof source.toIndexItems === 'function') {
            items = await source.toIndexItems(data);
        } else if (Array.isArray(data)) {
            items = data;
        }

        this.cache.set(type, items);
        return items;
    }
}
