import { toggleDrawer } from '../../../utils.js';
import {
    Searcher,
    DataLoader,
    CharacterSource,
    WorldInfoSource,
    PresetSource,
    ChatSource,
} from './src/index.js';

let jetsIdCounter = 0;

function getTextFromElement(element) {
    if (!element) return '';
    const text = element.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
}

function findLabelElement(element) {
    if (!element) return null;
    return element.querySelector('[data-i18n]') || element.querySelector('span, strong, label, h3, h4');
}

function buildContent(parts) {
    return parts.filter(Boolean).join(' | ');
}

function normalizeI18nKey(value) {
    if (!value) return '';
    return value.replace(/^\[[^\]]+\]/, '').trim();
}

function ensureJetsSelector(element, prefix = 'settings') {
    if (!element) return null;
    if (element.id) {
        return { id: element.id, selector: `#${element.id}` };
    }
    let marker = element.getAttribute('data-st-jets-id');
    if (!marker) {
        marker = `${prefix}-${++jetsIdCounter}`;
        element.setAttribute('data-st-jets-id', marker);
    }
    return { id: marker, selector: `[data-st-jets-id="${marker}"]` };
}

const PANEL_CONTAINERS = [
    { id: 'rm_extensions_block', key: 'extensions' },
    { id: 'user-settings-block', key: 'user-settings' },
    { id: 'left-nav-panel', key: 'ai-config' },
    { id: 'right-nav-panel', key: 'character-management' },
    { id: 'WorldInfo', key: 'world-info' },
    { id: 'rm_api_block', key: 'system-settings' },
    { id: 'AdvancedFormatting', key: 'advanced-format' },
    { id: 'Backgrounds', key: 'backgrounds' },
    { id: 'PersonaManagement', key: 'persona-management' },
];

function resolvePanelKey(element, fallback = '') {
    if (!element) return fallback;
    for (const panel of PANEL_CONTAINERS) {
        if (element.closest(`#${panel.id}`)) {
            return panel.key;
        }
    }
    return fallback;
}

function collectOptionsMenuItems(seenSelectors) {
    const menu = document.getElementById('options');
    if (!menu) return [];

    const items = [];
    const seenIds = new Set();
    const nodes = menu.querySelectorAll('a[id], button[id]');
    nodes.forEach(node => {
        const id = node.id;
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);

        const labelNode = findLabelElement(node);
        const title = getTextFromElement(labelNode || node);
        if (!title) return;

        const i18nKey = labelNode?.getAttribute?.('data-i18n') || '';
        const tooltip = node.getAttribute('title') || '';
        const content = buildContent([title, i18nKey, tooltip, id]);
        const selector = `#${id}`;
        if (seenSelectors?.has(selector)) return;
        seenSelectors?.add(selector);

        items.push({
            id: `settings-${id}`,
            type: 'settings',
            title,
            content,
            metadata: {
                action: 'click',
                selector,
                usageKey: `settings::options::click::${id}`,
            },
        });
    });

    return items;
}

function collectExtensionContainers(seenSelectors) {
    const container = document.getElementById('rm_extensions_block');
    if (!container) return [];

    const items = [];
    const seenIds = new Set();
    const nodes = container.querySelectorAll('[id$="_container"]');
    nodes.forEach(node => {
        const id = node.id;
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);

        const labelNode = findLabelElement(node);
        const title = getTextFromElement(labelNode);
        if (!title) return;

        const i18nKey = labelNode?.getAttribute?.('data-i18n') || '';
        const content = buildContent([title, i18nKey, id]);
        const selector = `#${id}`;
        if (seenSelectors?.has(selector)) return;
        seenSelectors?.add(selector);

        items.push({
            id: `settings-${id}`,
            type: 'settings',
            title,
            content,
            metadata: {
                action: 'scroll',
                selector,
                panel: 'extensions',
                usageKey: `settings::extensions::scroll::${id}`,
            },
        });
    });

    return items;
}

function collectPanelItems(containerId, panelKey, idPrefix, seenSelectors) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const items = [];

    const addItem = ({ title, i18nKey, tooltip, target, action = 'reveal' }) => {
        if (!title) return;
        const targetInfo = ensureJetsSelector(target, idPrefix);
        if (!targetInfo || seenSelectors.has(targetInfo.selector)) return;
        seenSelectors.add(targetInfo.selector);

        const stableToken = target?.id || normalizeI18nKey(i18nKey) || title;
        const usageKey = `settings::${panelKey}::${action}::${stableToken}`;

        items.push({
            id: `${idPrefix}-${targetInfo.id}`,
            type: 'settings',
            title,
            content: buildContent([title, i18nKey, tooltip, targetInfo.id]),
            metadata: {
                action,
                selector: targetInfo.selector,
                panel: panelKey,
                usageKey,
            },
        });
    };

    container.querySelectorAll('label').forEach(label => {
        const labelNode = findLabelElement(label) || label;
        const title = getTextFromElement(labelNode);
        if (!title) return;

        const i18nKey = labelNode?.getAttribute?.('data-i18n')
            || label.getAttribute('data-i18n')
            || '';
        const tooltip = label.getAttribute('title') || labelNode?.getAttribute?.('title') || '';

        addItem({ title, i18nKey, tooltip, target: label });
    });

    container.querySelectorAll('span[data-i18n], small[data-i18n], strong[data-i18n], div[data-i18n], h3[data-i18n], h4[data-i18n], p[data-i18n]').forEach(node => {
        if (node.closest('label')) return;
        if (node.closest('.inline-drawer-header, .inline-drawer-toggle')) return;
        const title = getTextFromElement(node);
        if (!title) return;
        const i18nKey = node.getAttribute('data-i18n') || '';
        const tooltip = node.getAttribute('title') || '';

        const wrapper = node.closest('.flex-container, .alignItemsBaseline, .title_restorable, .range-block, .range-block-title, .range-block-input, .checkbox_label, .inline-drawer, .wide100p')
            || node.parentElement;
        const interactive = wrapper?.querySelector?.('input, select, textarea, button, .menu_button, .menu_button_icon') || node;
        addItem({ title, i18nKey, tooltip, target: interactive });
    });

    return items;
}

function isLikelyClickable(element) {
    if (!element) return false;
    if (element.matches?.('button, a, input, select, textarea')) return true;
    if (element.getAttribute?.('role') === 'button') return true;
    if (element.hasAttribute?.('onclick')) return true;
    if (element.tabIndex >= 0) return true;
    return element.classList?.contains('menu_button')
        || element.classList?.contains('menu_button_icon')
        || element.classList?.contains('right_menu_button')
        || element.classList?.contains('drawer-icon')
        || element.classList?.contains('interactable');
}

function getHighlightTarget(element) {
    if (!element) return null;
    return element.closest?.('.checkbox_label, .range-block, .inline-drawer, .flex-container, .menu_button, .menu_button_icon, .drawer-icon, .right_menu_button')
        || element;
}

function applyHighlight(element) {
    const target = getHighlightTarget(element);
    if (!target) return;
    target.classList.add('st-jets-target');
    setTimeout(() => target.classList.remove('st-jets-target'), 1200);
}

function scoreItem(item) {
    if (!item) return 0;
    let score = 0;
    const action = item.metadata?.action;
    if (action === 'click') score += 5;
    if (action === 'scroll') score += 3;
    if (action === 'reveal') score += 2;

    const selector = item.metadata?.selector;
    if (selector) {
        const target = document.querySelector(selector);
        if (target) {
            if (isElementVisible(target)) score += 5;
            if (isLikelyClickable(target)) score += 3;
            if (target.matches?.('input, select, textarea, button')) score += 2;
        }
    }

    const contentLength = item.content?.length ?? 0;
    score += Math.min(2, Math.floor(contentLength / 40));

    if (item.metadata?.panel) score += 1;
    return score;
}

function dedupeItems(items) {
    const map = new Map();
    for (const item of items) {
        const title = (item?.title || '').trim();
        if (!title) continue;
        const panel = item?.metadata?.panel || '';
        const key = `${panel}::${title.toLowerCase()}`;
        const existing = map.get(key);
        if (!existing || scoreItem(item) > scoreItem(existing)) {
            map.set(key, item);
        }
    }
    return Array.from(map.values());
}

function extractButtonLabel(element) {
    if (!element) return { title: '', i18nKey: '', tooltip: '' };
    const labelNode = findLabelElement(element);
    const textTitle = getTextFromElement(labelNode || element);
    const rawI18n = element.getAttribute('data-i18n')
        || labelNode?.getAttribute?.('data-i18n')
        || '';
    const i18nKey = rawI18n;
    const i18nLabel = normalizeI18nKey(rawI18n);
    const tooltip = element.getAttribute('title')
        || element.getAttribute('aria-label')
        || '';
    const title = textTitle || tooltip || i18nLabel;
    return { title, i18nKey, tooltip };
}

function collectActionButtons(root, panelKey, idPrefix, seenSelectors) {
    if (!root) return [];
    const items = [];
    const candidates = root.querySelectorAll('.menu_button, .menu_button_icon, .right_menu_button, .drawer-icon, .interactable');

    candidates.forEach(candidate => {
        if (candidate.closest('#st-jets-container')) return;
        const target = candidate.classList.contains('menu_button_icon')
            ? (candidate.closest('.menu_button') || candidate)
            : candidate;
        if (target.id && target.id.startsWith('st-jets')) return;
        if (!isLikelyClickable(target)) return;

        const { title, i18nKey, tooltip } = extractButtonLabel(target);
        if (!title) return;

        const targetInfo = ensureJetsSelector(target, idPrefix);
        if (!targetInfo || seenSelectors.has(targetInfo.selector)) return;
        seenSelectors.add(targetInfo.selector);

        const resolvedPanel = resolvePanelKey(target, panelKey);
        const stableToken = target?.id || normalizeI18nKey(i18nKey) || title;
        const usageKey = `settings::${resolvedPanel || panelKey || ''}::click::${stableToken}`;
        items.push({
            id: `${idPrefix}-${targetInfo.id}`,
            type: 'settings',
            title,
            content: buildContent([title, i18nKey, tooltip, targetInfo.id]),
            metadata: {
                action: 'click',
                selector: targetInfo.selector,
                panel: resolvedPanel || undefined,
                usageKey,
            },
        });
    });

    return items;
}

class SettingsSource {
    constructor(options = {}) {
        this.options = {
            includeOptionsMenu: true,
            includeExtensions: true,
            includeUserSettings: true,
            includeAiConfig: true,
            includeCharacterManagement: true,
            includeWorldInfoPanel: true,
            includeExtensionSettings: true,
            includeSystemSettings: true,
            includeAdvancedFormatting: true,
            includeBackgrounds: true,
            includePersonaManagement: true,
            includeActionButtons: true,
            ...options,
        };
    }

    async load() {
        return this.collectItems();
    }

    toIndexItems(items) {
        if (Array.isArray(items)) {
            return items;
        }
        return this.collectItems();
    }

    collectItems() {
        if (typeof document === 'undefined') {
            return [];
        }

        const items = [];
        const seenSelectors = new Set();
        if (this.options.includeOptionsMenu) {
            items.push(...collectOptionsMenuItems(seenSelectors));
        }
        if (this.options.includeExtensions) {
            items.push(...collectExtensionContainers(seenSelectors));
        }
        if (this.options.includeUserSettings) {
            items.push(...collectPanelItems('user-settings-block', 'user-settings', 'settings-user', seenSelectors));
        }
        if (this.options.includeAiConfig) {
            items.push(...collectPanelItems('left-nav-panel', 'ai-config', 'settings-ai', seenSelectors));
        }
        if (this.options.includeCharacterManagement) {
            items.push(...collectPanelItems('right-nav-panel', 'character-management', 'settings-char', seenSelectors));
        }
        if (this.options.includeWorldInfoPanel) {
            items.push(...collectPanelItems('WorldInfo', 'world-info', 'settings-world', seenSelectors));
        }
        if (this.options.includeExtensionSettings) {
            items.push(...collectPanelItems('rm_extensions_block', 'extensions', 'settings-ext', seenSelectors));
        }
        if (this.options.includeSystemSettings) {
            items.push(...collectPanelItems('rm_api_block', 'system-settings', 'settings-sys', seenSelectors));
        }
        if (this.options.includeAdvancedFormatting) {
            items.push(...collectPanelItems('AdvancedFormatting', 'advanced-format', 'settings-format', seenSelectors));
        }
        if (this.options.includeBackgrounds) {
            items.push(...collectPanelItems('Backgrounds', 'backgrounds', 'settings-bg', seenSelectors));
        }
        if (this.options.includePersonaManagement) {
            items.push(...collectPanelItems('PersonaManagement', 'persona-management', 'settings-persona', seenSelectors));
        }
        if (this.options.includeActionButtons) {
            items.push(...collectActionButtons(document, '', 'settings-action', seenSelectors));
        }
        return dedupeItems(items);
    }
}

const TYPE_LABELS = {
    character: 'Characters',
    chat: 'Chats',
    chat_message: 'Messages',
    worldinfo: 'World Info',
    preset: 'Presets',
    quickreply: 'Quick Reply',
    regex: 'Regex',
    settings: 'Settings',
    other: 'Other',
};

const FALLBACK_ITEMS = [
    {
        id: 'character-1',
        type: 'character',
        title: 'Character Alice',
        content: 'A friendly character for testing.',
        metadata: { characterId: 0 },
    },
    {
        id: 'character-2',
        type: 'character',
        title: 'Character Bob',
        content: 'Another test character.',
        metadata: { characterId: 1 },
    },
    {
        id: 'worldinfo-1',
        type: 'worldinfo',
        title: 'World Entry Alpha',
        content: 'A world entry for JETS tests.',
        metadata: { bookName: 'TestBook', entryIndex: 0 },
    },
    {
        id: 'preset-context-default',
        type: 'preset',
        title: 'Default Preset',
        content: 'Default preset content.',
        metadata: { presetType: 'context', presetName: 'Default' },
    },
];

const STATIC_ITEMS = [
    {
        id: 'quickreply-1',
        type: 'quickreply',
        title: 'Quick Reply Settings',
        content: 'quick reply extension 快捷回复 设置',
        metadata: {},
    },
    {
        id: 'regex-1',
        type: 'regex',
        title: 'Regex Settings',
        content: 'regex scripts and presets 正则 设置',
        metadata: {},
    },
];

const USAGE_STORAGE_KEY = 'st-jets-usage';
const USAGE_MAX_ENTRIES = 500;
let usageStatsCache = null;

function loadUsageStats() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(USAGE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveUsageStats(stats) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(stats || {}));
    } catch {
        // ignore
    }
}

function getUsageStats() {
    if (!usageStatsCache) {
        usageStatsCache = loadUsageStats();
    }
    return usageStatsCache;
}

function getUsageKey(item) {
    const explicit = item?.metadata?.usageKey;
    if (explicit) return String(explicit);
    if (!item?.id) return '';
    return `${item?.type || 'unknown'}::${item.id}`;
}

function trimUsageStats(stats) {
    const entries = Object.entries(stats || {});
    if (entries.length <= USAGE_MAX_ENTRIES) return stats || {};
    entries.sort((a, b) => (Number(b[1]?.lastUsed) || 0) - (Number(a[1]?.lastUsed) || 0));
    return Object.fromEntries(entries.slice(0, USAGE_MAX_ENTRIES));
}

function recordUsage(item) {
    const key = getUsageKey(item);
    if (!key) return;
    const stats = getUsageStats();
    const now = Date.now();
    const prev = stats[key];
    const count = Math.max(0, Number(prev?.count) || 0);
    stats[key] = { count: count + 1, lastUsed: now };
    const trimmed = trimUsageStats(stats);
    usageStatsCache = trimmed;
    saveUsageStats(trimmed);
}

function getUsageExtraScore(item) {
    const key = getUsageKey(item);
    if (!key) return 0;
    const stats = getUsageStats();
    const usage = stats[key];
    if (!usage) return 0;

    const count = Math.max(0, Number(usage?.count) || 0);
    const lastUsed = Number(usage?.lastUsed) || 0;
    let score = Math.min(20, count * 2);

    const age = Date.now() - lastUsed;
    if (Number.isFinite(age) && age >= 0) {
        if (age < 3600000) score += 10;
        else if (age < 86400000) score += 5;
    }

    return score;
}

const searcher = new Searcher({
    maxResults: 50,
    getExtraScore: (item) => getUsageExtraScore(item),
});
searcher.addBatch([...STATIC_ITEMS, ...FALLBACK_ITEMS]);

function registerTestApi() {
    if (typeof window === 'undefined') return;
    if (!window.__stJetsTest) {
        window.__stJetsTest = {};
    }
    if (typeof window.__stJetsTest.addItems !== 'function') {
        window.__stJetsTest.addItems = (items = []) => {
            searcher.addBatch(items);
        };
    }
}

const characterSource = new CharacterSource();
characterSource.type = 'character';

const worldInfoSource = new WorldInfoSource();
worldInfoSource.type = 'worldinfo';

const presetContextSource = new PresetSource([], 'context');
presetContextSource.type = 'preset:context';

const presetInstructSource = new PresetSource([], 'instruct');
presetInstructSource.type = 'preset:instruct';

const presetSyspromptSource = new PresetSource([], 'sysprompt');
presetSyspromptSource.type = 'preset:sysprompt';

const chatSource = new ChatSource([], {
    includeMessages: false,
    maxMessagesPerChat: Number.POSITIVE_INFINITY,
    listMax: Number.MAX_SAFE_INTEGER,
});
chatSource.type = 'chat';

const settingsSource = new SettingsSource();
settingsSource.type = 'settings';

const dataLoader = new DataLoader({
    sources: [
        characterSource,
        worldInfoSource,
        presetContextSource,
        presetInstructSource,
        presetSyspromptSource,
        chatSource,
        settingsSource,
    ],
    maxRetries: 1,
});

let indexLoadPromise = null;

async function refreshIndex({ force = false } = {}) {
    const items = await dataLoader.loadAll({ force });
    searcher.clear();
    searcher.addBatch([...STATIC_ITEMS, ...FALLBACK_ITEMS, ...items]);
    startBackgroundChatIndexing();
    return items;
}

function ensureBaseItems() {
    const existingIds = new Set(searcher.items.map(item => item?.id).filter(Boolean));
    const baseItems = [...STATIC_ITEMS, ...FALLBACK_ITEMS];
    const missing = baseItems.filter(item => item?.id && !existingIds.has(item.id));
    if (missing.length) {
        searcher.addBatch(missing);
    }
}

async function refreshSettingsIndex() {
    const items = await dataLoader.loadByType('settings', { force: true });
    searcher.replaceByType('settings', items);
    ensureBaseItems();
    return items;
}

function ensureDataLoaded() {
    if (!indexLoadPromise) {
        indexLoadPromise = refreshIndex();
    }
    return indexLoadPromise;
}

const BACKGROUND_CHAT_BATCH_SIZE = 2;
const BACKGROUND_CHAT_DELAY = 80;
let backgroundChatQueue = [];
let backgroundChatRunning = false;
let backgroundChatTimer = null;

function resetBackgroundChatIndexing() {
    backgroundChatQueue = [];
    backgroundChatRunning = false;
    if (backgroundChatTimer) {
        clearTimeout(backgroundChatTimer);
        backgroundChatTimer = null;
    }
}

async function indexChatMessagesBatch(chats = []) {
    const includeSystem = !!chatSource.options?.includeSystem;
    const maxMessagesPerChat = Number.isFinite(chatSource.options?.maxMessagesPerChat)
        ? chatSource.options.maxMessagesPerChat
        : Number.POSITIVE_INFINITY;

    await Promise.all(chats.map(async ({ chat, index }) => {
        if (!chat) return;
        try {
            const messages = await chatSource.loadMessagesForChat(chat);
            const chatItem = chatSource.buildChatItem(chat, index);
            const chatId = chatItem?.metadata?.chatId;
            if (!chatId) return;

            const messageItems = [];
            let added = 0;
            messages.forEach((message, messageIndex) => {
                if (added >= maxMessagesPerChat) {
                    return;
                }
                const content = message?.mes;
                if (!content || !String(content).trim()) return;
                if (!includeSystem && message?.is_system) return;
                messageItems.push(chatSource.buildMessageItem(chat, message, messageIndex, chatItem));
                added += 1;
            });

            searcher.replaceByFilter(item => {
                return item?.type === 'chat_message' && item?.metadata?.chatId === chatId;
            }, messageItems);
            ensureBaseItems();
        } catch (err) {
            console.warn('JETS: 背景索引聊天失败', err);
        }
    }));
}

function processBackgroundChatQueue() {
    if (!backgroundChatQueue.length) {
        backgroundChatRunning = false;
        return;
    }
    const batch = backgroundChatQueue.splice(0, BACKGROUND_CHAT_BATCH_SIZE);
    indexChatMessagesBatch(batch).finally(() => {
        backgroundChatTimer = setTimeout(processBackgroundChatQueue, BACKGROUND_CHAT_DELAY);
    });
}

function startBackgroundChatIndexing() {
    if (backgroundChatRunning) {
        return;
    }
    const chats = Array.isArray(chatSource.chats) ? chatSource.chats : [];
    if (!chats.length) {
        return;
    }
    resetBackgroundChatIndexing();
    backgroundChatQueue = chats.map((chat, index) => ({ chat, index }));
    backgroundChatRunning = true;
    processBackgroundChatQueue();
}

let liveChatIndexBound = false;
let liveChatIndexInitAttempts = 0;
let liveChatIndexTimer = null;

function buildLiveChatSnapshot(context) {
    if (!context) return null;
    const messages = Array.isArray(context.chat) ? context.chat : [];
    const isGroup = !!context.groupId;
    const groupId = context.groupId || '';
    let characterName = '';
    let avatar = '';
    let fileId = '';
    let fileName = '';

    if (isGroup) {
        const group = context.groups?.find(item => String(item?.id) === String(groupId));
        fileId = group?.chat_id || context.chatId || '';
        fileName = fileId || '';
    } else {
        const character = context.characters?.[context.characterId];
        characterName = character?.name || character?.data?.name || '';
        avatar = character?.avatar || '';
        fileId = context.chatId || character?.chat || '';
        fileName = fileId || '';
    }

    const lastMessage = messages.length ? messages[messages.length - 1] : null;
    return {
        characterName,
        avatar,
        groupId,
        group: groupId,
        group_id: groupId,
        fileId,
        file_id: fileId,
        fileName,
        file_name: fileName,
        preview_message: lastMessage?.mes || '',
        lastMessage,
        messages,
    };
}

function refreshLiveChatIndex() {
    const context = getContextFromGlobal();
    if (!context?.chat) return false;
    const snapshot = buildLiveChatSnapshot(context);
    if (!snapshot) return false;

    const items = chatSource.toIndexItems([snapshot], { includeMessages: true });
    const chatItem = items.find(item => item?.type === 'chat');
    const chatId = chatItem?.metadata?.chatId;
    if (!chatId) return false;

    searcher.replaceByFilter(item => {
        if (!item) return false;
        if (item.type !== 'chat' && item.type !== 'chat_message') return false;
        return item?.metadata?.chatId === chatId;
    }, items);
    ensureBaseItems();
    return true;
}

function scheduleLiveChatIndexRefresh(delay = 120) {
    if (liveChatIndexTimer) {
        clearTimeout(liveChatIndexTimer);
    }
    liveChatIndexTimer = setTimeout(() => {
        liveChatIndexTimer = null;
        refreshLiveChatIndex();
    }, delay);
}

function bindLiveChatIndexing() {
    if (liveChatIndexBound) return;
    const context = getContextFromGlobal();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes;
    if (!eventSource || !eventTypes) {
        liveChatIndexInitAttempts += 1;
        if (liveChatIndexInitAttempts < 10) {
            setTimeout(bindLiveChatIndexing, 500);
        }
        return;
    }

    const handler = () => scheduleLiveChatIndexRefresh();
    const events = [
        eventTypes.MESSAGE_SENT,
        eventTypes.MESSAGE_RECEIVED,
        eventTypes.MESSAGE_EDITED,
        eventTypes.MESSAGE_UPDATED,
        eventTypes.MESSAGE_DELETED,
        eventTypes.MESSAGE_SWIPED,
        eventTypes.MESSAGE_SWIPE_DELETED,
        eventTypes.MORE_MESSAGES_LOADED,
        eventTypes.CHAT_CHANGED,
    ];
    events.forEach(type => eventSource.on(type, handler));
    liveChatIndexBound = true;
    scheduleLiveChatIndexRefresh(0);
}

let isOpen = false;
let selectedIndex = -1;
let currentResults = [];
let searchTimer = null;
let queryWatcher = null;
let lastQuery = '';

let container;
let overlay;
let modal;
let input;
let results;

function ensureDom() {
    if (document.getElementById('st-jets-container')) {
        container = document.getElementById('st-jets-container');
        overlay = document.getElementById('st-jets-overlay');
        modal = document.getElementById('st-jets-modal');
        input = document.getElementById('st-jets-input');
        results = document.getElementById('st-jets-results');
        return;
    }

    container = document.createElement('div');
    container.id = 'st-jets-container';
    container.setAttribute('aria-hidden', 'true');

    overlay = document.createElement('div');
    overlay.id = 'st-jets-overlay';

    modal = document.createElement('div');
    modal.id = 'st-jets-modal';

    input = document.createElement('input');
    input.id = 'st-jets-input';
    input.type = 'text';
    input.placeholder = 'Search anything...';
    input.autocomplete = 'off';

    results = document.createElement('div');
    results.id = 'st-jets-results';

    modal.appendChild(input);
    modal.appendChild(results);
    container.appendChild(overlay);
    container.appendChild(modal);
    document.body.appendChild(container);

    overlay.addEventListener('click', closeJets);
    input.addEventListener('input', handleSearchInput);
}

function ensureMobileEntry() {
    if (document.getElementById('st-jets-mobile-button')) {
        return;
    }
    const topSettings = document.getElementById('top-settings-holder');
    const topBar = document.getElementById('top-bar');
    const host = topSettings || topBar;
    if (!host) return;
    const button = document.createElement('div');
    button.id = 'st-jets-mobile-button';
    button.className = 'drawer-icon fa-solid fa-magnifying-glass';
    button.title = 'Search (JETS)';
    button.setAttribute('data-i18n', '[title]Search (JETS)');
    button.addEventListener('click', toggleJets);
    host.appendChild(button);
}

function openJets() {
    if (isOpen) return;
    ensureDom();
    ensureDataLoaded();
    void refreshSettingsIndex();
    isOpen = true;
    container.classList.add('is-open');
    container.setAttribute('aria-hidden', 'false');
    lastQuery = input.value.trim();
    if (!queryWatcher) {
        queryWatcher = setInterval(() => {
            if (!isOpen) return;
            const current = input.value.trim();
            if (current !== lastQuery) {
                lastQuery = current;
                runSearch();
            }
        }, 100);
    }
    input.focus();
    setTimeout(() => {
        if (isOpen) {
            input.focus();
        }
    }, 0);
}

function closeJets() {
    if (!isOpen) return;
    isOpen = false;
    container.classList.remove('is-open');
    container.setAttribute('aria-hidden', 'true');
    input.value = '';
    clearResults();
    hideResults();
    if (queryWatcher) {
        clearInterval(queryWatcher);
        queryWatcher = null;
    }
}

function toggleJets() {
    if (isOpen) {
        closeJets();
    } else {
        openJets();
    }
}

function handleSearchInput() {
    if (searchTimer) {
        clearTimeout(searchTimer);
    }
    const query = input.value.trim();
    if (!query) {
        clearResults();
        hideResults();
        return;
    }
    showResults();
    searchTimer = setTimeout(runSearch, 200);
}

function runSearch() {
    const query = input.value.trim();
    if (!query) {
        clearResults();
        hideResults();
        return;
    }

    if (!searcher.items.length) {
        searcher.addBatch([...STATIC_ITEMS, ...FALLBACK_ITEMS]);
    }

    let found = searcher.search(query);
    if (!found.length && query.length <= 1) {
        const limit = searcher.options?.maxResults || 50;
        const fallbackItems = [...STATIC_ITEMS, ...FALLBACK_ITEMS];
        found = fallbackItems.slice(0, limit).map(item => ({ item, score: 0, matches: [] }));
    }
    renderResults(found);
    showResults();
}

function clearResults() {
    currentResults = [];
    selectedIndex = -1;
    if (results) {
        results.innerHTML = '';
    }
}

function showResults() {
    if (!results) return;
    results.classList.add('is-visible');
    results.style.display = 'block';
}

function hideResults() {
    if (!results) return;
    results.classList.remove('is-visible');
    results.style.display = '';
}

const SNIPPET_RADIUS = 48;
const SNIPPET_MAX = 140;
const MAX_SNIPPETS = 3;

function normalizeRanges(ranges = [], length = 0) {
    const filtered = ranges
        .filter(range => Number.isFinite(range?.start) && Number.isFinite(range?.end))
        .map(range => ({
            start: Math.max(0, Math.min(length, range.start)),
            end: Math.max(0, Math.min(length, range.end)),
        }))
        .filter(range => range.end > range.start)
        .sort((a, b) => a.start - b.start);

    const merged = [];
    for (const range of filtered) {
        const last = merged[merged.length - 1];
        if (!last || range.start > last.end) {
            merged.push({ ...range });
        } else {
            last.end = Math.max(last.end, range.end);
        }
    }
    return merged;
}

function buildSingleSnippet(text, ranges) {
    if (!text) return { snippet: '', ranges: [], prefix: '', suffix: '' };
    const normalized = normalizeRanges(ranges, text.length);
    if (!normalized.length) {
        const clipped = text.length > SNIPPET_MAX ? text.slice(0, SNIPPET_MAX) : text;
        return { snippet: clipped, ranges: [], prefix: '', suffix: text.length > SNIPPET_MAX ? '…' : '' };
    }

    const first = normalized[0];
    let start = Math.max(0, first.start - SNIPPET_RADIUS);
    let end = Math.min(text.length, first.end + SNIPPET_RADIUS);

    if (end - start > SNIPPET_MAX) {
        const center = Math.floor((first.start + first.end) / 2);
        start = Math.max(0, Math.min(text.length - SNIPPET_MAX, center - Math.floor(SNIPPET_MAX / 2)));
        end = Math.min(text.length, start + SNIPPET_MAX);
    }

    const snippet = text.slice(start, end);
    const snippetRanges = normalized
        .filter(range => range.end > start && range.start < end)
        .map(range => ({
            start: Math.max(0, range.start - start),
            end: Math.min(end, range.end) - start,
        }));

    return {
        snippet,
        ranges: normalizeRanges(snippetRanges, snippet.length),
        prefix: start > 0 ? '…' : '',
        suffix: end < text.length ? '…' : '',
    };
}

function buildSnippetWindow(range, length) {
    let start = Math.max(0, range.start - SNIPPET_RADIUS);
    let end = Math.min(length, range.end + SNIPPET_RADIUS);
    if (end - start > SNIPPET_MAX) {
        const center = Math.floor((range.start + range.end) / 2);
        start = Math.max(0, Math.min(length - SNIPPET_MAX, center - Math.floor(SNIPPET_MAX / 2)));
        end = Math.min(length, start + SNIPPET_MAX);
    }
    return { start, end };
}

function mergeWindows(windows = []) {
    const ordered = windows
        .filter(win => Number.isFinite(win?.start) && Number.isFinite(win?.end))
        .sort((a, b) => a.start - b.start);
    const merged = [];
    const gap = 8;
    for (const win of ordered) {
        const last = merged[merged.length - 1];
        if (!last || win.start > last.end + gap) {
            merged.push({ ...win });
        } else {
            last.end = Math.max(last.end, win.end);
        }
    }
    return merged;
}

function buildSnippets(text, ranges) {
    if (!text) return [];
    const normalized = normalizeRanges(ranges, text.length);
    if (!normalized.length) return [];

    const windows = normalized.map(range => buildSnippetWindow(range, text.length));
    const merged = mergeWindows(windows);

    return merged.map(window => {
        const snippet = text.slice(window.start, window.end);
        const snippetRanges = normalized
            .filter(range => range.end > window.start && range.start < window.end)
            .map(range => ({
                start: Math.max(0, range.start - window.start),
                end: Math.min(window.end, range.end) - window.start,
            }));
        return {
            snippet,
            ranges: normalizeRanges(snippetRanges, snippet.length),
            prefix: window.start > 0 ? '…' : '',
            suffix: window.end < text.length ? '…' : '',
        };
    });
}

function appendHighlightedText(container, text, ranges, { prefix = '', suffix = '' } = {}) {
    if (!container) return;
    if (prefix) container.appendChild(document.createTextNode(prefix));

    if (!ranges.length) {
        container.appendChild(document.createTextNode(text));
        if (suffix) container.appendChild(document.createTextNode(suffix));
        return;
    }

    let cursor = 0;
    ranges.forEach(range => {
        if (range.start > cursor) {
            container.appendChild(document.createTextNode(text.slice(cursor, range.start)));
        }
        const mark = document.createElement('span');
        mark.className = 'st-jets-highlight';
        mark.textContent = text.slice(range.start, range.end);
        container.appendChild(mark);
        cursor = range.end;
    });

    if (cursor < text.length) {
        container.appendChild(document.createTextNode(text.slice(cursor)));
    }
    if (suffix) container.appendChild(document.createTextNode(suffix));
}

function renderResults(found) {
    clearResults();

    if (!found.length) {
        const empty = document.createElement('div');
        empty.className = 'st-jets-empty';
        empty.textContent = 'No results';
        results.appendChild(empty);
        return;
    }

    const grouped = new Map();
    for (const result of found) {
        const type = result.item?.type || 'other';
        if (!grouped.has(type)) {
            grouped.set(type, []);
        }
        grouped.get(type).push(result);
    }

    const order = ['character', 'chat', 'chat_message', 'worldinfo', 'preset', 'settings', 'quickreply', 'regex', 'other'];
    for (const type of order) {
        if (!grouped.has(type)) continue;
        const header = document.createElement('div');
        header.className = 'st-jets-group-header';
        header.textContent = TYPE_LABELS[type] || type;
        results.appendChild(header);

        for (const result of grouped.get(type)) {
            const item = result.item;
            const row = document.createElement('div');
            row.className = 'st-jets-result-item';
            row.dataset.type = item.type || 'other';
            row.dataset.id = item.id || '';

            if (item?.metadata?.entryIndex !== undefined) {
                const entrySelector = `.world_entry[uid="${item.metadata.entryIndex}"]`;
                if (document.querySelector(entrySelector)) {
                    row.dataset.entryIndex = String(item.metadata.entryIndex);
                }
            }

            const title = document.createElement('div');
            title.className = 'st-jets-result-title';
            const titleText = item.title || 'Untitled';
            const titleRanges = normalizeRanges(
                (result.matches || []).filter(match => match.field === 'title'),
                titleText.length,
            );
            if (titleRanges.length) {
                appendHighlightedText(title, titleText, titleRanges);
            } else {
                title.textContent = titleText;
            }

            const subtitle = document.createElement('div');
            subtitle.className = 'st-jets-result-subtitle';
            const contentText = item.content || '';
            const contentRanges = (result.matches || []).filter(match => match.field === 'content');
            const snippets = buildSnippets(contentText, contentRanges);
            const snippetItems = snippets.length ? snippets : [buildSingleSnippet(contentText, [])];
            const snippetList = document.createElement('div');
            snippetList.className = 'st-jets-snippet-list';

            const applyExpandedState = expanded => {
                snippetList.dataset.expanded = expanded ? 'true' : 'false';
                const hidden = snippetList.querySelectorAll('.st-jets-snippet');
                hidden.forEach((node, index) => {
                    if (index >= MAX_SNIPPETS) {
                        node.classList.toggle('is-hidden', !expanded);
                    }
                });
            };

            snippetItems.forEach((snippet, index) => {
                const line = document.createElement('div');
                line.className = 'st-jets-snippet';
                if (index >= MAX_SNIPPETS) {
                    line.classList.add('is-hidden');
                }
                appendHighlightedText(line, snippet.snippet, snippet.ranges, {
                    prefix: snippet.prefix,
                    suffix: snippet.suffix,
                });
                snippetList.appendChild(line);
            });

            if (snippetItems.length > MAX_SNIPPETS) {
                const toggle = document.createElement('div');
                toggle.className = 'st-jets-snippet-toggle';
                toggle.textContent = '展开更多';
                toggle.addEventListener('click', event => {
                    event.stopPropagation();
                    const expanded = snippetList.dataset.expanded !== 'true';
                    applyExpandedState(expanded);
                    toggle.textContent = expanded ? '收起' : '展开更多';
                });
                snippetList.appendChild(toggle);
                applyExpandedState(false);
            }

            subtitle.appendChild(snippetList);

            row.appendChild(title);
            row.appendChild(subtitle);
            row.addEventListener('click', () => void executeResult(result));

            results.appendChild(row);
            currentResults.push({ result, element: row });
        }
    }
}

function updateSelection(nextIndex) {
    if (!currentResults.length) return;
    const total = currentResults.length;
    const normalized = ((nextIndex % total) + total) % total;

    if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        currentResults[selectedIndex].element.classList.remove('selected');
    }

    selectedIndex = normalized;
    const entry = currentResults[selectedIndex];
    if (entry) {
        entry.element.classList.add('selected');
        entry.element.scrollIntoView({ block: 'nearest' });
    }
}

function ensureResultsReady() {
    if (!currentResults.length && input?.value?.trim()) {
        runSearch();
    }
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

function getSTApi() {
    return typeof globalThis !== 'undefined' ? globalThis.ST_API : null;
}

function resolveCharacterIndex(context, metadata) {
    if (Number.isInteger(metadata?.characterId)) {
        return metadata.characterId;
    }
    const characters = context?.characters || [];
    const avatar = metadata?.avatar;
    const name = metadata?.characterName;
    let index = -1;

    if (avatar) {
        index = characters.findIndex(char => char?.avatar === avatar);
    }
    if (index < 0 && name) {
        index = characters.findIndex(char => char?.name === name || char?.data?.name === name);
    }

    return index >= 0 ? index : null;
}

async function selectCharacterForItem(item) {
    const context = getContextFromGlobal();
    if (!context?.selectCharacterById) return;
    const index = resolveCharacterIndex(context, item?.metadata);
    if (index !== null) {
        await context.selectCharacterById(index, { switchMenu: true });
    }
}

async function openChatTarget(item) {
    const context = getContextFromGlobal();
    if (!context) return;

    const meta = item?.metadata || {};
    if (meta.isGroup && context.openGroupChat) {
        await context.openGroupChat(meta.groupId);
        return;
    }

    const index = resolveCharacterIndex(context, meta);
    if (index !== null && context.selectCharacterById) {
        await context.selectCharacterById(index, { switchMenu: true });
    }
    if (meta.fileId && context.openCharacterChat) {
        await context.openCharacterChat(meta.fileId);
    }
}

async function scrollToMessage(messageIndex) {
    if (!Number.isFinite(messageIndex)) return;
    const api = getSTApi();
    if (api?.ui?.scrollChat) {
        await api.ui.scrollChat({ target: messageIndex, behavior: 'smooth' });
        return;
    }
    const target = document.querySelector(`.mes[mesid="${messageIndex}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'center' });
    target.classList.add('st-jets-target');
    setTimeout(() => target.classList.remove('st-jets-target'), 1200);
}

async function executeResult(result) {
    const item = result?.item;
    if (!item) {
        closeJets();
        return;
    }

    recordUsage(item);

    switch (item.type) {
        case 'character':
            openPanel('#right-nav-panel');
            await selectCharacterForItem(item);
            break;
        case 'worldinfo':
            openPanel('#WorldInfo');
            focusWorldEntry(item?.metadata?.entryIndex);
            break;
        case 'preset':
            openPanel('#left-nav-panel');
            break;
        case 'chat':
            await openChatTarget(item);
            break;
        case 'chat_message':
            await openChatTarget(item);
            setTimeout(() => {
                void scrollToMessage(item?.metadata?.messageIndex);
            }, 200);
            break;
        case 'settings': {
            const action = item?.metadata?.action;
            if (item?.metadata?.panel === 'extensions') {
                openPanel('#rm_extensions_block');
            }
            if (item?.metadata?.panel === 'user-settings') {
                openPanel('#user-settings-block');
            }
            if (item?.metadata?.panel === 'ai-config') {
                openPanel('#left-nav-panel');
            }
            if (item?.metadata?.panel === 'character-management') {
                openPanel('#right-nav-panel');
            }
            if (item?.metadata?.panel === 'world-info') {
                openPanel('#WorldInfo');
            }
            if (item?.metadata?.panel === 'system-settings') {
                openPanel('#rm_api_block');
            }
            if (item?.metadata?.panel === 'advanced-format') {
                openPanel('#AdvancedFormatting');
            }
            if (item?.metadata?.panel === 'backgrounds') {
                openPanel('#Backgrounds');
            }
            if (item?.metadata?.panel === 'persona-management') {
                openPanel('#PersonaManagement');
            }
            if (action === 'click' && item?.metadata?.selector) {
                focusElementBySelector(item.metadata.selector);
                clickBySelector(item.metadata.selector);
            } else if (action === 'scroll' && item?.metadata?.selector) {
                const targetId = item.metadata.selector.replace('#', '');
                focusExtensionContainer(targetId);
            } else if (action === 'reveal' && item?.metadata?.selector) {
                focusElementBySelector(item.metadata.selector);
            }
            break;
        }
        case 'quickreply':
            openPanel('#rm_extensions_block');
            focusExtensionContainer('qr_container');
            break;
        case 'regex':
            openPanel('#rm_extensions_block');
            focusExtensionContainer('regex_container');
            break;
        default:
            break;
    }

    closeJets();
}

function openPanel(selector) {
    const panel = document.querySelector(selector);
    if (panel) {
        panel.classList.add('openDrawer');
    }
}

function isElementVisible(element) {
    return !!(element && (element.offsetParent || element.getClientRects().length));
}

function clickBySelector(selector) {
    const nodes = document.querySelectorAll(selector);
    if (!nodes.length) return false;
    for (const node of nodes) {
        if (isElementVisible(node)) {
            if (node.scrollIntoView) {
                node.scrollIntoView({ block: 'center' });
            }
            applyHighlight(node);
            node.click();
            return true;
        }
    }
    const fallback = nodes[0];
    if (fallback.scrollIntoView) {
        fallback.scrollIntoView({ block: 'center' });
    }
    applyHighlight(fallback);
    fallback.click();
    return true;
}

function focusExtensionContainer(containerId) {
    if (!containerId) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    expandInlineDrawer(container);
    container.scrollIntoView({ block: 'center' });
    applyHighlight(container);
}

function focusElementBySelector(selector) {
    if (!selector) return;
    const target = document.querySelector(selector);
    if (!target) return;
    const drawer = target.closest('.inline-drawer');
    if (drawer) {
        toggleDrawer(drawer, true);
    }
    target.scrollIntoView({ block: 'center' });
    applyHighlight(target);
    const focusable = target.matches?.('input, select, textarea, button')
        ? target
        : target.querySelector?.('input, select, textarea, button');
    if (focusable?.focus) {
        focusable.focus();
    }
}

function expandInlineDrawer(container) {
    if (!container) return;
    const drawer = container.querySelector('.inline-drawer');
    if (!drawer) return;
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content && content.style.display !== 'none' && content.getClientRects().length) {
        return;
    }
    toggleDrawer(drawer, true);
}

function focusWorldEntry(entryIndex) {
    if (entryIndex === undefined || entryIndex === null) return;
    const entry = document.querySelector(`.world_entry[uid="${entryIndex}"]`);
    if (!entry) return;
    entry.scrollIntoView({ block: 'center' });
    entry.classList.add('st-jets-target');
    setTimeout(() => entry.classList.remove('st-jets-target'), 1200);
}

function handleGlobalKeydown(event) {
    const keyLower = String(event?.key || '').toLowerCase();
    const code = event?.code;
    const isAltKHotkey = !!event?.altKey
        && !event?.metaKey
        && !event?.shiftKey
        && (code === 'KeyK' || keyLower === 'k');

    if (isAltKHotkey) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
        toggleJets();
        return;
    }

    if (!isOpen) {
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeJets();
        return;
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        ensureResultsReady();
        updateSelection(selectedIndex + 1);
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        ensureResultsReady();
        updateSelection(selectedIndex - 1);
        return;
    }

    if (event.key === 'Enter') {
        ensureResultsReady();
        if (currentResults.length && selectedIndex < 0) {
            updateSelection(0);
        }
        if (selectedIndex >= 0 && currentResults[selectedIndex]) {
            event.preventDefault();
            void executeResult(currentResults[selectedIndex].result);
        }
    }
}

function initJets() {
    if (window.__stJetsInitialized) {
        return;
    }
    window.__stJetsInitialized = true;
    registerTestApi();
    ensureDom();
    ensureMobileEntry();
    ensureDataLoaded();
    bindLiveChatIndexing();
    document.addEventListener('keydown', handleGlobalKeydown, true);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJets);
} else {
    initJets();
}
