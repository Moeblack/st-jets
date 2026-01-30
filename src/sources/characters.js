/**
 * JETS 角色数据源
 * 将角色卡数据转换为可索引条目
 */

function getField(char, field) {
    const direct = char?.[field];
    if (typeof direct === 'string' && direct.trim() !== '') {
        return direct;
    }
    if (direct !== undefined && direct !== null && typeof direct !== 'string') {
        return String(direct);
    }

    const nested = char?.data?.[field];
    if (typeof nested === 'string' && nested.trim() !== '') {
        return nested;
    }
    if (nested !== undefined && nested !== null && typeof nested !== 'string') {
        return String(nested);
    }

    return '';
}

function getSTApi() {
    return typeof globalThis !== 'undefined' ? globalThis.ST_API : null;
}

function getContextFromGlobal() {
    if (typeof globalThis === 'undefined') return null;
    if (globalThis.SillyTavern?.getContext) {
        return globalThis.SillyTavern.getContext();
    }
    if (typeof globalThis.getContext === 'function') {
        return globalThis.getContext();
    }
    return null;
}

export class CharacterSource {
    constructor(characters = []) {
        this.characters = characters;
    }

    async load({ full = false } = {}) {
        const api = getSTApi();
        if (api?.character?.list) {
            const result = await api.character.list({ full: !!full });
            this.characters = result?.characters || [];
            return this.characters;
        }

        const context = getContextFromGlobal();
        if (context?.characters) {
            this.characters = context.characters;
            return this.characters;
        }

        if (typeof context?.getCharacters === 'function') {
            this.characters = await context.getCharacters();
            return this.characters;
        }

        this.characters = [];
        return this.characters;
    }

    toIndexItems() {
        return this.characters.map((char, index) => {
            const title = char?.name || char?.data?.name || 'Unknown';
            return {
                id: `character-${char?.avatar || char?.id || index}`,
                type: 'character',
                title,
                content: this.extractContent(char),
                metadata: {
                    avatar: char?.avatar,
                    characterId: char?.id ?? char?.character_id ?? index,
                    tags: char?.data?.tags || [],
                    creator: char?.data?.creator || '',
                },
            };
        });
    }

    extractContent(char) {
        const parts = [];
        const description = getField(char, 'description');
        const personality = getField(char, 'personality');
        const scenario = getField(char, 'scenario');

        if (description) {
            parts.push(description);
        }
        if (personality) {
            parts.push(personality);
        }
        if (scenario) {
            parts.push(scenario);
        }

        return parts.join('\n');
    }
}
