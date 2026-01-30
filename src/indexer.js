/**
 * JETS 索引器
 * 负责管理索引条目的增删改查
 */

export class Indexer {
    constructor() {
        this.items = new Map();
    }

    add(item) {
        if (!item?.id) {
            throw new Error('Item must have an id');
        }
        this.items.set(item.id, item);
        return this;
    }

    addBatch(items = []) {
        items.forEach(item => this.add(item));
        return this;
    }

    get(id) {
        return this.items.get(id);
    }

    remove(id) {
        return this.items.delete(id);
    }

    update(id, updates = {}) {
        const existing = this.items.get(id);
        if (!existing) {
            return false;
        }
        this.items.set(id, { ...existing, ...updates });
        return true;
    }

    clear() {
        this.items.clear();
        return this;
    }

    size() {
        return this.items.size;
    }

    getAll() {
        return Array.from(this.items.values());
    }

    getByType(type) {
        return this.getAll().filter(item => item?.type === type);
    }
}
