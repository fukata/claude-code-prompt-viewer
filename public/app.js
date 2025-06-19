let currentProject = null;
let currentSession = null;
let allMessages = [];
let filteredMessages = [];

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        
        const projectList = document.getElementById('projectList');
        projectList.innerHTML = '';
        
        projects.forEach(project => {
            const li = document.createElement('li');
            li.className = 'project-item';
            li.dataset.projectId = project.id;
            li.innerHTML = `
                <div class="project-name">${project.name}</div>
                <div class="project-path">${project.path}</div>
            `;
            li.onclick = () => selectProject(project);
            projectList.appendChild(li);
        });
        
        // URLパラメータからプロジェクトとセッションを復元
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project');
        const sessionId = urlParams.get('session');
        
        if (projectId) {
            const projectToSelect = projects.find(p => p.id === projectId);
            if (projectToSelect) {
                const projectElement = document.querySelector(`[data-project-id="${projectId}"]`);
                if (projectElement) {
                    projectElement.classList.add('active');
                    currentProject = projectToSelect;
                    document.getElementById('welcomePanel').style.display = 'none';
                    document.getElementById('sessionPanel').style.display = 'block';
                    await loadSessions(projectId, sessionId);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        document.getElementById('projectList').innerHTML = '<li>プロジェクトの読み込みに失敗しました</li>';
    }
}

async function selectProject(project) {
    currentProject = project;
    
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    document.getElementById('welcomePanel').style.display = 'none';
    document.getElementById('sessionPanel').style.display = 'block';
    document.getElementById('messagePanel').style.display = 'none';
    
    // URLを更新
    updateURL();
    
    await loadSessions(project.id);
}

async function loadSessions(projectId, sessionIdToSelect = null) {
    try {
        const response = await fetch(`/api/project/${projectId}/sessions`);
        const sessions = await response.json();
        
        const sessionList = document.getElementById('sessionList');
        sessionList.innerHTML = '';
        
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = 'session-item';
            li.dataset.sessionId = session.id;
            
            const startTime = session.startTime ? new Date(session.startTime).toLocaleString('ja-JP') : '不明';
            const lastModified = new Date(session.lastModified).toLocaleString('ja-JP');
            
            li.innerHTML = `
                <div class="session-id">${session.id}</div>
                <div class="session-info">
                    <span>開始: ${startTime}</span>
                    <span>最終更新: ${lastModified}</span>
                </div>
            `;
            li.onclick = () => selectSession(projectId, session);
            sessionList.appendChild(li);
        });
        
        // URLパラメータからセッションを復元
        if (sessionIdToSelect) {
            const sessionToSelect = sessions.find(s => s.id === sessionIdToSelect);
            if (sessionToSelect) {
                const sessionElement = document.querySelector(`[data-session-id="${sessionIdToSelect}"]`);
                if (sessionElement) {
                    sessionElement.classList.add('active');
                    currentSession = sessionToSelect;
                    document.getElementById('messagePanel').style.display = 'block';
                    await loadMessages(projectId, sessionIdToSelect);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
        document.getElementById('sessionList').innerHTML = '<li>セッションの読み込みに失敗しました</li>';
    }
}

async function selectSession(projectId, session) {
    currentSession = session;
    
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    document.getElementById('messagePanel').style.display = 'block';
    
    // URLを更新
    updateURL();
    
    await loadMessages(projectId, session.id);
}

function updateURL() {
    const params = new URLSearchParams();
    
    if (currentProject) {
        params.set('project', currentProject.id);
    }
    
    if (currentSession) {
        params.set('session', currentSession.id);
    }
    
    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', newURL);
}

async function loadMessages(projectId, sessionId) {
    try {
        const response = await fetch(`/api/project/${projectId}/session/${sessionId}`);
        allMessages = await response.json();
        
        // 検索入力をリセット（フィルター設定は保持）
        document.getElementById('searchInput').value = '';
        
        filterAndDisplayMessages();
    } catch (error) {
        console.error('Failed to load messages:', error);
        document.getElementById('messageList').innerHTML = '<div>メッセージの読み込みに失敗しました</div>';
    }
}

function filterAndDisplayMessages() {
    const searchKeyword = document.getElementById('searchInput').value.toLowerCase();
    const hideToolMessages = document.getElementById('hideToolMessages').checked;
    
    filteredMessages = allMessages.filter(msg => {
        // ツール関連メッセージを非表示にする場合のフィルタリング
        if (hideToolMessages) {
            // ツール結果メッセージを除外
            if (msg.toolUseResult) return false;
            
            // アシスタントメッセージでtool_useのみを含むメッセージを除外
            if (msg.type === 'assistant' && msg.message.content) {
                const hasOnlyToolUse = msg.message.content.every(item => item.type === 'tool_use');
                if (hasOnlyToolUse) return false;
            }
            
            // ユーザーメッセージでtool_resultを含むメッセージを除外
            if (msg.type === 'user' && Array.isArray(msg.message.content)) {
                const hasToolResult = msg.message.content.some(item => 
                    item.type === 'tool_result' || item.tool_use_id
                );
                if (hasToolResult) return false;
            }
        }
        
        // キーワード検索フィルタリング
        if (searchKeyword) {
            const messageText = getMessageText(msg).toLowerCase();
            return messageText.includes(searchKeyword);
        }
        
        return true;
    });
    
    displayMessages(filteredMessages);
}

function getMessageText(msg) {
    let text = '';
    
    if (msg.type === 'user') {
        if (typeof msg.message.content === 'string') {
            text = msg.message.content;
        } else if (Array.isArray(msg.message.content)) {
            msg.message.content.forEach(item => {
                if (typeof item === 'string') {
                    text += item;
                } else if (item.type === 'text') {
                    text += item.text;
                } else if (item.type === 'tool_result' && item.content) {
                    text += item.content;
                }
            });
        } else {
            text = JSON.stringify(msg.message.content);
        }
    } else if (msg.type === 'assistant' && msg.message.content) {
        msg.message.content.forEach(item => {
            if (item.type === 'text') {
                text += item.text;
            } else if (item.type === 'tool_use') {
                text += `ツール: ${item.name} ${JSON.stringify(item.input)}`;
            }
        });
    } else if (msg.toolUseResult) {
        text = msg.toolUseResult.stdout || '';
    }
    
    return text;
}

function displayMessages(messages) {
    const messageList = document.getElementById('messageList');
    messageList.innerHTML = '';
    
    if (messages.length === 0) {
        messageList.innerHTML = '<div class="no-results">該当するメッセージがありません</div>';
        return;
    }
    
    messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.type}`;
            
            const timestamp = new Date(msg.timestamp).toLocaleString('ja-JP');
            
            if (msg.type === 'user') {
                let content = '';
                if (typeof msg.message.content === 'string') {
                    content = escapeHtml(msg.message.content);
                } else if (Array.isArray(msg.message.content)) {
                    // contentが配列の場合の処理
                    msg.message.content.forEach(item => {
                        if (typeof item === 'string') {
                            content += escapeHtml(item);
                        } else if (item.type === 'text') {
                            content += escapeHtml(item.text);
                        } else if (item.type === 'tool_result') {
                            content += `<div class="tool-result-in-message">
                                <div class="tool-result-label">ツール結果:</div>
                                <pre>${escapeHtml(item.content || '')}</pre>
                            </div>`;
                        }
                    });
                } else {
                    // オブジェクトの場合はJSON形式で表示
                    content = `<pre>${escapeHtml(JSON.stringify(msg.message.content, null, 2))}</pre>`;
                }
                
                messageDiv.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">ユーザー</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    <div class="message-content">${content}</div>
                `;
            } else if (msg.type === 'assistant') {
                let content = '';
                if (msg.message.content) {
                    msg.message.content.forEach(item => {
                        if (item.type === 'text') {
                            content += `<div class="text-content">${escapeHtml(item.text)}</div>`;
                        } else if (item.type === 'tool_use') {
                            content += `<div class="tool-use">
                                <div class="tool-name">ツール: ${item.name}</div>
                                <pre class="tool-input">${JSON.stringify(item.input, null, 2)}</pre>
                            </div>`;
                        }
                    });
                }
                
                messageDiv.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">アシスタント</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    <div class="message-content">${content}</div>
                `;
            } else if (msg.toolUseResult) {
                messageDiv.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">ツール結果</span>
                        <span class="message-time">${timestamp}</span>
                    </div>
                    <div class="message-content">
                        <pre class="tool-result">${escapeHtml(msg.toolUseResult.stdout || '')}</pre>
                    </div>
                `;
            }
            
            messageList.appendChild(messageDiv);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// テーマ管理
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// フィルター設定の保存と復元
function saveFilterSettings() {
    localStorage.setItem('hideToolMessages', document.getElementById('hideToolMessages').checked);
}

function loadFilterSettings() {
    const hideToolMessages = localStorage.getItem('hideToolMessages') === 'true';
    document.getElementById('hideToolMessages').checked = hideToolMessages;
}

window.addEventListener('DOMContentLoaded', () => {
    // テーマ初期化
    initTheme();
    
    // フィルター設定を復元
    loadFilterSettings();
    
    loadProjects();
    
    // テーマ切り替えボタン
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // 検索とフィルターのイベントリスナー
    document.getElementById('searchInput').addEventListener('input', () => {
        if (allMessages.length > 0) {
            filterAndDisplayMessages();
        }
    });
    
    document.getElementById('hideToolMessages').addEventListener('change', () => {
        saveFilterSettings();
        if (allMessages.length > 0) {
            filterAndDisplayMessages();
        }
    });
});