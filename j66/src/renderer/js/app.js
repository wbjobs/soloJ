const { ipcRenderer } = require('electron');

let currentNote = null;
let notes = [];
let folders = ['默认文件夹'];
let currentFolder = '默认文件夹';
let editorMode = 'edit';
let md = null;
let pendingConflictData = null;

document.addEventListener('DOMContentLoaded', () => {
  md = window.markdownit({
    html: false,
    xhtmlOut: true,
    breaks: true,
    linkify: true,
    typographer: true
  });
  initApp();
});

async function initApp() {
  bindEvents();
  await loadNotes();
  await loadFolders();
  renderFolders();
  
  if (notes.length > 0) {
    selectNote(notes[0]._id);
  } else {
    createNewNote();
  }
}

function bindEvents() {
  document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
  document.getElementById('saveBtn').addEventListener('click', saveCurrentNote);
  document.getElementById('deleteBtn').addEventListener('click', deleteCurrentNote);
  document.getElementById('newFolderBtn').addEventListener('click', showNewFolderModal);
  document.getElementById('syncBtn').addEventListener('click', syncToCloud);
  document.getElementById('searchInput').addEventListener('input', filterNotes);
  
  document.getElementById('editModeBtn').addEventListener('click', () => setEditorMode('edit'));
  document.getElementById('previewModeBtn').addEventListener('click', () => setEditorMode('preview'));
  document.getElementById('splitModeBtn').addEventListener('click', () => setEditorMode('split'));
  
  document.getElementById('editor').addEventListener('input', updatePreview);
  document.getElementById('tagInput').addEventListener('keydown', handleTagInput);
  
  document.getElementById('modalCancel').addEventListener('click', hideModal);
  document.getElementById('modalConfirm').addEventListener('click', handleModalConfirm);
  
  document.getElementById('conflictCancel').addEventListener('click', hideConflictModal);
  document.getElementById('conflictUseServer').addEventListener('click', handleConflictUseServer);
  document.getElementById('conflictOverwrite').addEventListener('click', handleConflictOverwrite);
  
  ipcRenderer.on('create-new-note', createNewNote);
  ipcRenderer.on('save-note', saveCurrentNote);
  ipcRenderer.on('sync-to-cloud', syncToCloud);
  ipcRenderer.on('open-note', (event, noteId) => {
    selectNote(noteId);
  });
}

async function loadNotes() {
  try {
    notes = await noteAPI.getNotes();
    renderNotes();
  } catch (error) {
    showToast('加载笔记失败', 'error');
  }
}

async function loadFolders() {
  try {
    const serverFolders = await noteAPI.getFolders();
    if (serverFolders && serverFolders.length > 0) {
      folders = [...new Set([...folders, ...serverFolders])];
    }
  } catch (error) {
    console.log('使用默认文件夹列表');
  }
}

function renderNotes() {
  const noteList = document.getElementById('noteList');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  const filteredNotes = notes.filter(note => 
    (currentFolder === '全部' || note.folder === currentFolder) &&
    (note.title.toLowerCase().includes(searchTerm) || 
     note.content.toLowerCase().includes(searchTerm))
  );
  
  noteList.innerHTML = filteredNotes.map(note => `
    <div class="note-item ${currentNote && currentNote._id === note._id ? 'active' : ''}" 
         data-id="${note._id}">
      <div class="note-item-title">${escapeHtml(note.title) || '无标题'}</div>
      <div class="note-item-date">${formatDate(note.updatedAt)}</div>
    </div>
  `).join('');
  
  noteList.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', () => selectNote(item.dataset.id));
  });
}

function renderFolders() {
  const folderList = document.getElementById('folderList');
  folderList.innerHTML = folders.map(folder => `
    <div class="folder-item ${folder === currentFolder ? 'active' : ''}" data-folder="${folder}">
      <span>${folder}</span>
    </div>
  `).join('');
  
  folderList.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      currentFolder = item.dataset.folder;
      renderFolders();
      renderNotes();
    });
  });
}

function selectNote(id) {
  const note = notes.find(n => n._id === id);
  if (note) {
    currentNote = note;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('editor').value = note.content;
    document.getElementById('noteDate').textContent = `更新于 ${formatDate(note.updatedAt)}`;
    updateSyncIndicator(note.isSynced);
    renderTags(note.tags);
    updatePreview();
    renderNotes();
  }
}

async function createNewNote() {
  try {
    const newNote = await noteAPI.createNote({
      title: '新笔记',
      content: '',
      folder: currentFolder,
      tags: []
    });
    notes.unshift(newNote);
    selectNote(newNote._id);
    renderNotes();
    showToast('新笔记已创建', 'success');
    ipcRenderer.send('note-saved');
  } catch (error) {
    showToast('创建笔记失败', 'error');
  }
}

async function saveCurrentNote() {
  if (!currentNote) return;
  
  try {
    const title = document.getElementById('noteTitle').value || '无标题';
    const content = document.getElementById('editor').value;
    
    const updatedNote = await noteAPI.updateNote(currentNote._id, {
      title,
      content,
      isSynced: false,
      version: currentNote.version
    });
    
    const index = notes.findIndex(n => n._id === currentNote._id);
    if (index !== -1) {
      notes[index] = updatedNote;
    }
    currentNote = updatedNote;
    
    document.getElementById('noteDate').textContent = `更新于 ${formatDate(updatedNote.updatedAt)}`;
    updateSyncIndicator(false);
    renderNotes();
    showToast('笔记已保存', 'success');
    ipcRenderer.send('note-saved');
  } catch (error) {
    if (error.status === 409 && error.data && error.data.serverNote) {
      showConflictDialog(error.data);
    } else {
      showToast('保存失败', 'error');
    }
  }
}

async function deleteCurrentNote() {
  if (!currentNote) return;
  
  if (!confirm('确定要删除这篇笔记吗？')) return;
  
  try {
    await noteAPI.deleteNote(currentNote._id);
    notes = notes.filter(n => n._id !== currentNote._id);
    currentNote = null;
    
    if (notes.length > 0) {
      selectNote(notes[0]._id);
    } else {
      clearEditor();
    }
    
    renderNotes();
    showToast('笔记已删除', 'success');
    ipcRenderer.send('note-saved');
  } catch (error) {
    showToast('删除失败', 'error');
  }
}

function clearEditor() {
  document.getElementById('noteTitle').value = '';
  document.getElementById('editor').value = '';
  document.getElementById('noteDate').textContent = '';
  document.getElementById('preview').innerHTML = '';
  document.getElementById('tagsContainer').innerHTML = '';
  updateSyncIndicator(false);
}

function setEditorMode(mode) {
  editorMode = mode;
  const editorPane = document.getElementById('editorPane');
  const previewPane = document.getElementById('previewPane');
  
  document.querySelectorAll('.btn-mode').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`${mode}ModeBtn`).classList.add('active');
  
  switch (mode) {
    case 'edit':
      editorPane.style.display = 'block';
      previewPane.style.display = 'none';
      break;
    case 'preview':
      editorPane.style.display = 'none';
      previewPane.style.display = 'block';
      break;
    case 'split':
      editorPane.style.display = 'block';
      previewPane.style.display = 'block';
      break;
  }
}

function updatePreview() {
  const content = document.getElementById('editor').value;
  const preview = document.getElementById('preview');
  preview.innerHTML = md.render(content);
}

function renderTags(tags) {
  const container = document.getElementById('tagsContainer');
  container.innerHTML = (tags || []).map(tag => `
    <span class="tag">
      ${escapeHtml(tag)}
      <span class="tag-remove" data-tag="${escapeHtml(tag)}">×</span>
    </span>
  `).join('');
  
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => removeTag(btn.dataset.tag));
  });
}

function handleTagInput(e) {
  if (e.key === 'Enter' && e.target.value.trim()) {
    addTag(e.target.value.trim());
    e.target.value = '';
  }
}

async function addTag(tag) {
  if (!currentNote) return;
  
  if (!currentNote.tags) {
    currentNote.tags = [];
  }
  
  if (!currentNote.tags.includes(tag)) {
    currentNote.tags.push(tag);
    renderTags(currentNote.tags);
    await saveCurrentNote();
  }
}

async function removeTag(tag) {
  if (!currentNote) return;
  
  currentNote.tags = currentNote.tags.filter(t => t !== tag);
  renderTags(currentNote.tags);
  await saveCurrentNote();
}

function filterNotes() {
  renderNotes();
}

function showNewFolderModal() {
  document.getElementById('modalTitle').textContent = '新建文件夹';
  document.getElementById('modalInput').value = '';
  document.getElementById('modalInput').placeholder = '文件夹名称';
  document.getElementById('modal').classList.add('active');
}

function hideModal() {
  document.getElementById('modal').classList.remove('active');
}

function handleModalConfirm() {
  const value = document.getElementById('modalInput').value.trim();
  if (value && !folders.includes(value)) {
    folders.push(value);
    renderFolders();
    showToast('文件夹已创建', 'success');
  }
  hideModal();
}

async function syncToCloud() {
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.textContent = '正在同步...';
  
  try {
    const result = await noteAPI.syncToCloud();
    syncStatus.textContent = result.message;
    showToast(result.message, 'success');
    
    await loadNotes();
    if (currentNote) {
      const updatedNote = notes.find(n => n._id === currentNote._id);
      if (updatedNote) {
        updateSyncIndicator(updatedNote.isSynced);
      }
    }
    
    setTimeout(() => {
      syncStatus.textContent = '';
    }, 3000);
  } catch (error) {
    syncStatus.textContent = '同步失败';
    showToast('同步失败', 'error');
  }
}

function updateSyncIndicator(isSynced) {
  const indicator = document.getElementById('syncIndicator');
  if (isSynced) {
    indicator.textContent = '☁️ 已同步';
    indicator.className = 'sync-indicator synced';
  } else {
    indicator.textContent = '⚠️ 未同步';
    indicator.className = 'sync-indicator unsynced';
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function showConflictDialog(conflictData) {
  pendingConflictData = conflictData;
  const serverNote = conflictData.serverNote;
  
  const currentTitle = document.getElementById('noteTitle').value;
  const currentContent = document.getElementById('editor').value;
  
  document.getElementById('clientVersionPreview').textContent = 
    `标题: ${currentTitle}\n\n${currentContent.substring(0, 500)}${currentContent.length > 500 ? '...' : ''}`;
  
  document.getElementById('serverVersionPreview').textContent = 
    `标题: ${serverNote.title}\n\n${serverNote.content.substring(0, 500)}${serverNote.content.length > 500 ? '...' : ''}`;
  
  document.getElementById('conflictModal').classList.add('active');
}

function hideConflictModal() {
  pendingConflictData = null;
  document.getElementById('conflictModal').classList.remove('active');
}

function handleConflictUseServer() {
  if (!pendingConflictData) return;
  
  const serverNote = pendingConflictData.serverNote;
  currentNote = serverNote;
  
  document.getElementById('noteTitle').value = serverNote.title;
  document.getElementById('editor').value = serverNote.content;
  document.getElementById('noteDate').textContent = `更新于 ${formatDate(serverNote.updatedAt)}`;
  updateSyncIndicator(serverNote.isSynced);
  renderTags(serverNote.tags);
  updatePreview();
  
  const index = notes.findIndex(n => n._id === serverNote._id);
  if (index !== -1) {
    notes[index] = serverNote;
  }
  renderNotes();
  
  hideConflictModal();
  showToast('已加载服务器版本', 'success');
}

async function handleConflictOverwrite() {
  if (!pendingConflictData || !currentNote) return;
  
  try {
    const title = document.getElementById('noteTitle').value || '无标题';
    const content = document.getElementById('editor').value;
    
    const updatedNote = await noteAPI.updateNote(currentNote._id, {
      title,
      content,
      isSynced: false
    });
    
    const index = notes.findIndex(n => n._id === currentNote._id);
    if (index !== -1) {
      notes[index] = updatedNote;
    }
    currentNote = updatedNote;
    
    document.getElementById('noteDate').textContent = `更新于 ${formatDate(updatedNote.updatedAt)}`;
    updateSyncIndicator(false);
    renderNotes();
    
    hideConflictModal();
    showToast('已覆盖服务器版本', 'success');
  } catch (error) {
    showToast('保存失败', 'error');
    hideConflictModal();
  }
}
