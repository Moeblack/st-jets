/**
 * JETS 聊天数据源
 * 将聊天记录转换为可索引条目
 */

function stripJsonl(fileName = '') {
    if (!fileName) return '';
    return fileName.endsWith('.jsonl') ? fileName.slice(0, -6) : fileName;
}

function safeString(value) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
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

function getRequestHeaders() {
    const context = getContextFromGlobal();
    if (context?.getRequestHeaders) {
        return context.getRequestHeaders();
    }
    return { 'Content-Type': 'application/json' };
}

async function postJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body || {}),
    });
    if (!response.ok) {
        throw new Error(`${url} ${response.status}`);
    }
    return response.json();
}

function getCharacterName(chat) {
    if (chat?.characterName) return chat.characterName;
    if (chat?.character_name) return chat.character_name;
    if (chat?.name && !chat?.groupId && !chat?.group) return chat.name;
    if (chat?.avatar) return stripJsonl(chat.avatar.replace(/\.png$/i, ''));
    return '';
}

function getGroupId(chat) {
    return chat?.groupId || chat?.group || chat?.group_id || '';
}

function getFileId(chat) {
    return chat?.fileId || chat?.file_id || stripJsonl(chat?.fileName || chat?.file_name || '');
}

function getPreviewMessage(chat) {
    if (chat?.preview_message) return safeString(chat.preview_message);
    if (chat?.mes) return safeString(chat.mes);
    if (chat?.lastMessage?.mes) return safeString(chat.lastMessage.mes);
    if (typeof chat?.lastMessage === 'string') return safeString(chat.lastMessage);

    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const mes = messages[i]?.mes;
        if (typeof mes === 'string' && mes.trim()) {
            return mes;
        }
    }
    return '';
}

function getMessageCount(chat) {
    if (Number.isFinite(chat?.messageCount)) return chat.messageCount;
    if (Number.isFinite(chat?.message_count)) return chat.message_count;
    if (Number.isFinite(chat?.chat_items)) return chat.chat_items;
    return Array.isArray(chat?.messages) ? chat.messages.length : 0;
}

export class ChatSource {
    constructor(chats = [], options = {}) {
        this.chats = Array.isArray(chats) ? chats : [];
        this.options = {
            includeMessages: false,
            includeSystem: false,
            maxMessagesPerChat: Number.POSITIVE_INFINITY,
            listMax: 50,
            ...options,
        };
    }

    async load({ max = this.options.listMax, includeMessages = this.options.includeMessages } = {}) {
        const safeMax = Number.isFinite(max) ? max : this.options.listMax || 50;
        let list = [];

        try {
            const result = await postJson('/api/chats/recent', { max: safeMax });
            list = Array.isArray(result) ? result : [];
        } catch (err) {
            console.warn('ChatSource.load: 获取最近聊天失败', err);
        }

        if (!includeMessages) {
            this.chats = list;
            return this.chats;
        }

        const enriched = [];
        for (const chat of list) {
            const isGroup = !!(chat?.group || chat?.groupId || chat?.group_id);
            try {
                if (isGroup) {
                    const groupId = chat?.group || chat?.groupId || chat?.group_id;
                    const chatId = chat?.file_id || stripJsonl(chat?.file_name || '');
                    const messages = await postJson('/api/chats/group/get', { id: chatId || groupId });
                    enriched.push({ ...chat, messages });
                } else {
                    const avatarUrl = chat?.avatar || '';
                    const fileName = stripJsonl(chat?.file_name || '');
                    const messages = await postJson('/api/chats/get', { avatar_url: avatarUrl, file_name: fileName });
                    enriched.push({ ...chat, messages });
                }
            } catch (err) {
                console.warn('ChatSource.load: 获取聊天消息失败', err);
                enriched.push({ ...chat, messages: [] });
            }
        }

        this.chats = enriched;
        return this.chats;
    }

    async loadMessagesForChat(chat) {
        if (!chat) return [];
        const isGroup = !!(chat?.group || chat?.groupId || chat?.group_id);
        try {
            if (isGroup) {
                const groupId = chat?.group || chat?.groupId || chat?.group_id;
                const chatId = chat?.file_id || stripJsonl(chat?.file_name || '');
                return await postJson('/api/chats/group/get', { id: chatId || groupId });
            }
            const avatarUrl = chat?.avatar || '';
            const fileName = stripJsonl(chat?.file_name || '');
            return await postJson('/api/chats/get', { avatar_url: avatarUrl, file_name: fileName });
        } catch (err) {
            console.warn('ChatSource.loadMessagesForChat: 获取聊天消息失败', err);
            return [];
        }
    }

    toIndexItems(chats = this.chats, options = {}) {
        const list = Array.isArray(chats) ? chats : [];
        const items = [];
        const includeMessages = options.includeMessages ?? this.options.includeMessages;
        const includeSystem = !!this.options.includeSystem;
        const maxMessagesPerChat = Number.isFinite(this.options.maxMessagesPerChat)
            ? this.options.maxMessagesPerChat
            : Number.POSITIVE_INFINITY;

        list.forEach((chat, chatIndex) => {
            const chatItem = this.buildChatItem(chat, chatIndex);
            items.push(chatItem);

            if (!includeMessages) return;

            const messages = Array.isArray(chat?.messages) ? chat.messages : [];
            let added = 0;
            messages.forEach((message, messageIndex) => {
                if (added >= maxMessagesPerChat) {
                    return;
                }
                const content = safeString(message?.mes || '');
                if (!content.trim()) return;
                if (!includeSystem && message?.is_system) return;

                items.push(this.buildMessageItem(chat, message, messageIndex, chatItem));
                added += 1;
            });
        });

        return items;
    }

    buildChatItem(chat, index) {
        const characterName = getCharacterName(chat);
        const groupId = getGroupId(chat);
        const fileId = getFileId(chat);
        const fileName = chat?.fileName || chat?.file_name || '';
        const chatId = fileId || `${groupId || characterName || 'chat'}-${index}`;
        const titleParts = [];

        if (groupId) {
            titleParts.push(`Group ${groupId}`);
        } else if (characterName) {
            titleParts.push(characterName);
        }

        if (fileId && (!titleParts.length || fileId !== titleParts[0])) {
            titleParts.push(fileId);
        }

        const title = titleParts.length ? titleParts.join(' · ') : fileId || fileName || `Chat ${index + 1}`;

        return {
            id: `chat-${chatId}`,
            type: 'chat',
            title,
            content: getPreviewMessage(chat),
            metadata: {
                chatId,
                fileId,
                fileName,
                characterName,
                avatar: chat?.avatar || '',
                groupId: groupId || '',
                isGroup: !!groupId,
                messageCount: getMessageCount(chat),
                lastMessageAt: chat?.last_mes || chat?.lastMessage?.send_date || '',
            },
        };
    }

    buildMessageItem(chat, message, messageIndex, chatItem) {
        const sender = safeString(message?.name || (message?.is_user ? 'User' : 'Assistant'));
        const chatMeta = chatItem?.metadata || {};
        const chatId = chatMeta.chatId || getFileId(chat) || `chat-${sender}`;

        return {
            id: `chatmsg-${chatId}-${messageIndex}`,
            type: 'chat_message',
            title: sender,
            content: safeString(message?.mes || ''),
            metadata: {
                chatId,
                fileId: chatMeta.fileId || getFileId(chat),
                fileName: chatMeta.fileName || chat?.fileName || chat?.file_name || '',
                characterName: chatMeta.characterName || getCharacterName(chat),
                groupId: chatMeta.groupId || getGroupId(chat),
                isGroup: !!(chatMeta.groupId || getGroupId(chat)),
                messageIndex,
                sender,
                isUser: !!message?.is_user,
            },
        };
    }
}
