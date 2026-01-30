/**
 * JETS 设置/动作数据源
 * 从已渲染的本地化 UI 中提取可点击的设置项
 */

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

function collectOptionsMenuItems() {
function collectOptionsMenuItems() {
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
        const content = [title, i18nKey, tooltip, id].filter(Boolean).join(' | ');

        items.push({
            id: `settings-${id}`,
            type: 'settings',
            title,
            content,
            metadata: {
                action: 'click',
                selector: `#${id}`,
            },
        });
    });

    return items;
}

function collectExtensionContainers() {
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
        const content = [title, i18nKey, id].filter(Boolean).join(' | ');

        items.push({
            id: `settings-${id}`,
            type: 'settings',
            title,
            content,
            metadata: {
                action: 'scroll',
                selector: `#${id}`,
                panel: 'extensions',
            },
        });
    });

    return items;
}

function collectPanelItems(containerId, panelKey, idPrefix) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const items = [];
    const seenSelectors = new Set();

    const addItem = ({ title, i18nKey, tooltip, target, action = 'reveal' }) => {
        if (!title) return;
        const targetInfo = ensureJetsSelector(target, idPrefix);
        if (!targetInfo || seenSelectors.has(targetInfo.selector)) return;
        seenSelectors.add(targetInfo.selector);

        items.push({
            id: `${idPrefix}-${targetInfo.id}`,
            type: 'settings',
            title,
            content: buildContent([title, i18nKey, tooltip, targetInfo.id]),
            metadata: {
                action,
                selector: targetInfo.selector,
                panel: panelKey,
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

export class SettingsSource {
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
        if (this.options.includeOptionsMenu) {
            items.push(...collectOptionsMenuItems());
        }
        if (this.options.includeExtensions) {
            items.push(...collectExtensionContainers());
        }
        if (this.options.includeUserSettings) {
            items.push(...collectPanelItems('user-settings-block', 'user-settings', 'settings-user'));
        }
        if (this.options.includeAiConfig) {
            items.push(...collectPanelItems('left-nav-panel', 'ai-config', 'settings-ai'));
        }
        if (this.options.includeCharacterManagement) {
            items.push(...collectPanelItems('right-nav-panel', 'character-management', 'settings-char'));
        }
        if (this.options.includeWorldInfoPanel) {
            items.push(...collectPanelItems('WorldInfo', 'world-info', 'settings-world'));
        }
        if (this.options.includeExtensionSettings) {
            items.push(...collectPanelItems('rm_extensions_block', 'extensions', 'settings-ext'));
        }
        if (this.options.includeSystemSettings) {
            items.push(...collectPanelItems('rm_api_block', 'system-settings', 'settings-sys'));
        }
        if (this.options.includeAdvancedFormatting) {
            items.push(...collectPanelItems('AdvancedFormatting', 'advanced-format', 'settings-format'));
        }
        if (this.options.includeBackgrounds) {
            items.push(...collectPanelItems('Backgrounds', 'backgrounds', 'settings-bg'));
        }
        if (this.options.includePersonaManagement) {
            items.push(...collectPanelItems('PersonaManagement', 'persona-management', 'settings-persona'));
        }
        return items;
    }
}
