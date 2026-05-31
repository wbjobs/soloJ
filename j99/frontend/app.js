const API_BASE = '';

function $(id) {
    return document.getElementById(id);
}

function scrollToBottom() {
    const el = $('chatMessages');
    el.scrollTop = el.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const highlighted = lang && hljs.getLanguage(lang)
            ? hljs.highlight(code.trim(), { language: lang }).value
            : escapeHtml(code.trim());
        return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function addUserMessage(text) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = 'message message-user';
    div.innerHTML = `<div class="bubble"><p>${escapeHtml(text)}</p></div>`;
    $('chatMessages').appendChild(div);
    scrollToBottom();
}

function addBotMessage(answer, sources) {
    const div = document.createElement('div');
    div.className = 'message message-bot';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        const tags = sources.map(s => `<span class="source-tag">${escapeHtml(s)}</span>`).join('');
        sourcesHtml = `<div class="sources"><div class="sources-title">📂 相关文件</div>${tags}</div>`;
    }

    div.innerHTML = `<div class="bubble">${renderMarkdown(answer)}${sourcesHtml}</div>`;
    $('chatMessages').appendChild(div);
    scrollToBottom();
}

function addErrorMessage(text) {
    const div = document.createElement('div');
    div.className = 'message message-bot';
    div.innerHTML = `<div class="bubble"><p class="error-text">❌ ${escapeHtml(text)}</p></div>`;
    $('chatMessages').appendChild(div);
    scrollToBottom();
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'message message-bot';
    div.id = 'typingMessage';
    div.innerHTML = `<div class="bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    $('chatMessages').appendChild(div);
    scrollToBottom();
}

function hideTyping() {
    const el = $('typingMessage');
    if (el) el.remove();
}

async function sendQuestion() {
    const input = $('questionInput');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    input.style.height = 'auto';
    $('btnSend').disabled = true;
    addUserMessage(question);
    showTyping();

    try {
        const res = await fetch(`${API_BASE}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
        });
        hideTyping();

        if (!res.ok) {
            const err = await res.json();
            addErrorMessage(err.detail || `请求失败 (${res.status})`);
            return;
        }

        const data = await res.json();
        addBotMessage(data.answer, data.sources);
    } catch (e) {
        hideTyping();
        addErrorMessage(`网络错误: ${e.message}`);
    } finally {
        $('btnSend').disabled = false;
        input.focus();
    }
}

function askExample(question) {
    $('questionInput').value = question;
    sendQuestion();
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
    }
}

async function buildIndex() {
    const codeDir = $('codeDir').value.trim() || undefined;
    const btn = $('btnIndex');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 索引中...';

    try {
        const res = await fetch(`${API_BASE}/api/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code_dir: codeDir }),
        });
        const data = await res.json();
        if (res.ok) {
            alert(`✅ 索引完成！共 ${data.chunks} 个代码片段`);
        } else {
            alert(`❌ 索引失败: ${data.detail}`);
        }
    } catch (e) {
        alert(`❌ 网络错误: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '⚡ 建立索引';
        refreshStatus();
    }
}

async function clearIndex() {
    if (!confirm('确定要清除索引吗？')) return;
    const btn = $('btnClearIndex');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/index`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert('✅ 索引已清除');
        } else {
            alert(`❌ 清除失败: ${data.detail}`);
        }
    } catch (e) {
        alert(`❌ 网络错误: ${e.message}`);
    } finally {
        btn.disabled = false;
        refreshStatus();
    }
}

async function refreshStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();

        const statusEl = $('statusIndexed');
        if (data.indexed) {
            statusEl.textContent = '已索引';
            statusEl.className = 'status-value indexed';
        } else {
            statusEl.textContent = '未索引';
            statusEl.className = 'status-value not-indexed';
        }

        $('statusCodeDir').textContent = data.code_dir_exists ? data.code_dir.split(/[\\/]/).pop() || data.code_dir : '不存在';
        $('statusCodeDir').title = data.code_dir;
        $('statusFileCount').textContent = data.file_count;
    } catch (e) {
        $('statusIndexed').textContent = '检测失败';
        $('statusIndexed').className = 'status-value not-indexed';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const textarea = $('questionInput');
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    refreshStatus();
});
