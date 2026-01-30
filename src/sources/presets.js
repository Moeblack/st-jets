/**
 * JETS 预设数据源
 * 将预设数据转换为可索引条目
 */

export class PresetSource {
    constructor(presets = [], presetType = 'context') {
        this.presets = presets;
        this.presetType = presetType;
    }

    async load({ type = this.presetType } = {}) {
        const api = typeof globalThis !== 'undefined' ? globalThis.ST_API : null;
        if (api?.preset?.list && (type === 'openai' || type === 'preset' || type === 'chat')) {
            const result = await api.preset.list();
            this.presets = result?.presets || [];
            return this.presets;
        }

        const context = (typeof globalThis !== 'undefined' && globalThis.SillyTavern?.getContext)
            ? globalThis.SillyTavern.getContext()
            : (typeof globalThis !== 'undefined' && typeof globalThis.getContext === 'function'
                ? globalThis.getContext()
                : null);

        if (context?.getPresetManager) {
            const manager = context.getPresetManager(type);
            const list = manager?.getPresetList ? manager.getPresetList() : null;
            if (list?.presets) {
                this.presets = list.presets;
                return this.presets;
            }
        }

        return this.presets;
    }

    toIndexItems() {
        return this.presets.map(preset => ({
            id: `preset-${this.presetType}-${preset?.name}`,
            type: 'preset',
            title: preset?.name,
            content: this.extractContent(preset),
            metadata: {
                presetType: this.presetType,
                presetName: preset?.name,
            },
        }));
    }

    extractContent(preset) {
        const data = preset?.data || preset || {};
        const parts = [];

        const pushText = (value) => {
            if (typeof value === 'string' && value.trim()) {
                parts.push(value);
            }
        };

        if (data.story_string) {
            pushText(data.story_string);
        }
        if (data.system_prompt) {
            pushText(data.system_prompt);
        }
        if (data.input_suffix) {
            pushText(data.input_suffix);
        }
        if (data.output_suffix) {
            pushText(data.output_suffix);
        }

        if (Array.isArray(preset?.prompts)) {
            preset.prompts.forEach(prompt => pushText(prompt?.content));
        }

        if (preset?.utilityPrompts && typeof preset.utilityPrompts === 'object') {
            Object.values(preset.utilityPrompts).forEach(value => pushText(value));
        }

        return parts.join('\n');
    }
}
