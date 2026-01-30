/**
 * JETS 世界书数据源
 * 将世界书条目转换为可索引条目
 */

export class WorldInfoSource {
    constructor(worldbooks = []) {
        this.worldbooks = worldbooks;
    }

    async load({ scope = 'global' } = {}) {
        const api = typeof globalThis !== 'undefined' ? globalThis.ST_API : null;
        if (!api?.worldBook?.list || !api?.worldBook?.get) {
            return this.worldbooks;
        }

        const listResult = await api.worldBook.list({ scope });
        const books = Array.isArray(listResult?.worldBooks) ? listResult.worldBooks : [];
        const fullBooks = [];

        for (const book of books) {
            const name = book?.name;
            if (!name) continue;
            try {
                const result = await api.worldBook.get({ name, scope: book?.scope || scope });
                if (result?.worldBook) {
                    fullBooks.push(result.worldBook);
                }
            } catch (err) {
                console.warn('WorldInfoSource.load: 获取世界书失败', name, err);
            }
        }

        this.worldbooks = fullBooks;
        return this.worldbooks;
    }

    toIndexItems() {
        const items = [];

        for (const book of this.worldbooks) {
            const entries = Array.isArray(book?.entries)
                ? book.entries.map(entry => [entry?.index, entry])
                : Object.entries(book?.data?.entries || {});

            for (const [uid, entry] of entries) {
                const entryIndex = Number.isFinite(entry?.index)
                    ? entry.index
                    : Number.isFinite(uid)
                        ? uid
                        : Number.parseInt(uid, 10);
                const title = entry?.name || entry?.comment || entry?.key?.[0] || `Entry ${uid}`;
                const enabled = entry?.enabled !== undefined ? !!entry.enabled : !entry?.disable;
                items.push({
                    id: `worldinfo-${book?.name}-${entryIndex}`,
                    type: 'worldinfo',
                    title,
                    content: entry?.content || '',
                    metadata: {
                        bookName: book?.name,
                        entryIndex,
                        keywords: entry?.key || entry?.keywords || [],
                        secondaryKeywords: entry?.secondaryKey || entry?.keysecondary || [],
                        enabled,
                        position: entry?.position,
                    },
                });
            }
        }

        return items;
    }

    getBookNames() {
        return this.worldbooks.map(book => book?.name);
    }
}
