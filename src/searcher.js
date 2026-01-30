/**
 * JETS 搜索器
 * 负责在索引条目中进行匹配和排序
 */

const DEFAULT_OPTIONS = {
    maxResults: 200,
    getExtraScore: null,
};

function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
}

function getMatchPositions(text, query) {
    const matches = [];
    if (!text || !query) return matches;

    const lowerText = normalizeText(text);
    const lowerQuery = normalizeText(query);

    let index = lowerText.indexOf(lowerQuery);
    while (index !== -1) {
        matches.push({ start: index, end: index + lowerQuery.length });
        index = lowerText.indexOf(lowerQuery, index + lowerQuery.length);
    }

    return matches;
}

function isSubsequence(query, text) {
    if (!query || !text) return false;
    let qi = 0;
    for (let ti = 0; ti < text.length; ti += 1) {
        if (text[ti] === query[qi]) {
            qi += 1;
            if (qi >= query.length) {
                return true;
            }
        }
    }
    return false;
}

export class Searcher {
    constructor(options = {}) {
        this.items = [];
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    add(item) {
        if (item) {
            this.items.push(item);
        }
        return this;
    }

    addBatch(items = []) {
        items.forEach(item => this.add(item));
        return this;
    }

    replaceByType(type, items = []) {
        if (!type) {
            return this;
        }
        const remaining = this.items.filter(item => item?.type !== type);
        this.items = remaining;
        this.addBatch(items);
        return this;
    }

    replaceByFilter(predicate, items = []) {
        if (typeof predicate !== 'function') {
            return this;
        }
        this.items = this.items.filter(item => !predicate(item));
        this.addBatch(items);
        return this;
    }

    clear() {
        this.items = [];
        return this;
    }

    search(query) {
        const normalizedQuery = normalizeText(query).trim();
        if (!normalizedQuery) {
            return [];
        }

        const getExtraScore = typeof this.options.getExtraScore === 'function'
            ? this.options.getExtraScore
            : null;

        const results = [];
        for (const item of this.items) {
            const title = item?.title ?? '';
            const content = item?.content ?? '';

            const titleMatches = getMatchPositions(title, normalizedQuery);
            const contentMatches = getMatchPositions(content, normalizedQuery);

            let score = 0;
            if (titleMatches.length > 0) {
                score += 100 + titleMatches.length * 10;
            }
            if (contentMatches.length > 0) {
                score += 50 + contentMatches.length * 5;
            }

            if (score === 0) {
                const lowerTitle = normalizeText(title);
                const lowerContent = normalizeText(content);
                if (isSubsequence(normalizedQuery, lowerTitle)) {
                    score = 30;
                } else if (isSubsequence(normalizedQuery, lowerContent)) {
                    score = 15;
                }
            }

            if (score <= 0) {
                continue;
            }

            if (getExtraScore) {
                const extraScore = Number(getExtraScore(item, normalizedQuery));
                if (Number.isFinite(extraScore) && extraScore !== 0) {
                    score += extraScore;
                    if (score <= 0) {
                        continue;
                    }
                }
            }

            const matches = [
                ...titleMatches.map(match => ({ field: 'title', ...match })),
                ...contentMatches.map(match => ({ field: 'content', ...match })),
            ];

            results.push({ item, score, matches });
        }

        results.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            const titleA = String(a.item?.title ?? '');
            const titleB = String(b.item?.title ?? '');
            return titleA.localeCompare(titleB);
        });

        if (this.options.maxResults && results.length > this.options.maxResults) {
            return results.slice(0, this.options.maxResults);
        }

        return results;
    }
}
