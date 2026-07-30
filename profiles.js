/* ================================================================
   複数プロフィール（保存枠）管理ユーティリティ
   サブアカウントなど複数アカウントを持つユーザー向けに、
   カテゴリの所持データ・マイコーデ・お気に入り等を
   プロフィールごとに切り替えて保存できるようにする。

   全ページから <script src="profiles.js"></script> で読み込んで使う
   （i18n.js の後に読み込むこと）。
   ================================================================ */

const PROFILES_KEY        = 'skyProfiles_v1';       // [{ id, name }, ...]（taipak5000.github.io 配下の各ツール共通）
const ACTIVE_PROFILE_KEY   = 'skyActiveProfile_v1';  // 現在選択中のプロフィールID（共通）
const DEFAULT_PROFILE_ID   = 'default';

function pfDefaultName() {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? 'Main' : 'メイン';
}

function loadProfiles() {
  try {
    const list = JSON.parse(localStorage.getItem(PROFILES_KEY));
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (_) {}
  return null;
}

function saveProfiles(list) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

// 初回アクセス時、プロフィールが1件も無ければ「メイン」を作成する。
// 「メイン」は既存ユーザーのデータをそのまま引き継げるよう、
// キーに接尾辞を付けない特別なプロフィールとして扱う（nsKey参照）。
function ensureProfilesInit() {
  let list = loadProfiles();
  if (!list) {
    list = [{ id: DEFAULT_PROFILE_ID, name: pfDefaultName() }];
    saveProfiles(list);
  }
  if (!localStorage.getItem(ACTIVE_PROFILE_KEY)) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID);
  }
  return list;
}

function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE_ID;
}

function getActiveProfile() {
  const list = ensureProfilesInit();
  return list.find(p => p.id === getActiveProfileId()) || list[0];
}

// 保存キーをプロフィールごとに名前空間化する。
// 「メイン」プロフィールの場合は元のキーをそのまま返すため、
// このプロフィール機能を追加する前からのユーザーデータは無改造で引き継がれる。
function nsKey(rawKey) {
  const id = getActiveProfileId();
  return id === DEFAULT_PROFILE_ID ? rawKey : `${rawKey}__p_${id}`;
}

function switchProfile(id) {
  if (id === getActiveProfileId()) return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  location.reload();
}

function createProfile(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  list.push({ id, name: trimmed });
  saveProfiles(list);
  switchProfile(id);
}

function renameProfile(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const p = list.find(pr => pr.id === id);
  if (!p) return;
  p.name = trimmed;
  saveProfiles(list);
  pfRenderModal();
  pfRenderBar();
}

function deleteProfile(id) {
  const list = ensureProfilesInit();
  if (list.length <= 1) return; // 最後の1件は削除させない
  const remaining = list.filter(p => p.id !== id);
  saveProfiles(remaining);
  if (getActiveProfileId() === id) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, remaining[0].id);
    location.reload();
    return;
  }
  pfRenderModal();
}

/* ── UI: プロフィールバー + 切替モーダル（自己完結CSSを注入） ── */

function pfInjectStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .pf-bar { background: var(--card); border-bottom: 0.5px solid var(--sep); padding: 8px 20px;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 12.5px; font-weight: 600; color: var(--text-2); cursor: pointer; }
    .pf-bar:hover { background: var(--bg); }
    .pf-bar .pf-name { color: var(--text); }
    .pf-bar .pf-caret { font-size: 10px; opacity: 0.6; }
    .pf-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      z-index: 1000; align-items: flex-end; justify-content: center; }
    .pf-modal-overlay.open { display: flex; }
    .pf-modal-card { background: var(--card); border-radius: 16px 16px 0 0; width: 100%; max-width: 600px;
      max-height: 80vh; overflow-y: auto; padding: 20px 20px 28px; box-sizing: border-box; }
    .pf-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .pf-modal-title { font-size: 17px; font-weight: 700; }
    .pf-modal-close { font-size: 22px; color: var(--text-2); padding: 2px 6px; background: none; border: none; cursor: pointer; }
    .pf-row { display: flex; align-items: center; gap: 8px; padding: 10px 4px; border-bottom: 0.5px solid var(--sep); }
    .pf-row-name { flex: 1; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--text); }
    .pf-row.active .pf-row-name { color: var(--blue); }
    .pf-row-badge { font-size: 10px; font-weight: 700; color: #fff; background: var(--blue); border-radius: 999px; padding: 2px 8px; flex-shrink: 0; }
    .pf-icon-btn { font-size: 15px; padding: 5px 6px; border-radius: 8px; color: var(--text-2); background: none; border: none; cursor: pointer; flex-shrink: 0; }
    .pf-icon-btn:hover { background: var(--bg); }
    .pf-add-row { display: flex; gap: 8px; margin-top: 14px; }
    .pf-input { flex: 1; background: var(--bg); border: none; border-radius: 10px; padding: 10px 12px;
      font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; }
    .pf-add-btn { background: var(--blue); color: #fff; border-radius: 10px; padding: 10px 16px;
      font-size: 14px; font-weight: 600; font-family: inherit; border: none; cursor: pointer; white-space: nowrap; }
    .pf-hint { font-size: 11.5px; color: var(--text-2); line-height: 1.6; margin-top: 12px; }
  `;
  document.head.appendChild(style);
}

function pfT(ja, en) {
  return (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'en') ? en : ja;
}

function pfRenderBar() {
  const bar = document.getElementById('pfBar');
  if (!bar) return;
  const profile = getActiveProfile();
  bar.innerHTML = `👤 <span class="pf-name">${escapeHtmlPf(profile.name)}</span> <span class="pf-caret">▾</span>`;
}

function escapeHtmlPf(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function pfOpenModal() {
  pfRenderModal();
  document.getElementById('pfModalOverlay').classList.add('open');
}
function pfCloseModal() {
  document.getElementById('pfModalOverlay').classList.remove('open');
}

function pfRenderModal() {
  const list = ensureProfilesInit();
  const activeId = getActiveProfileId();
  const rows = list.map(p => {
    const isActive = p.id === activeId;
    return `
      <div class="pf-row ${isActive ? 'active' : ''}">
        <span class="pf-row-name" onclick="switchProfile('${p.id}')">${escapeHtmlPf(p.name)}</span>
        ${isActive ? `<span class="pf-row-badge">${pfT('使用中','Active')}</span>` : ''}
        <button type="button" class="pf-icon-btn" title="${pfT('名前を変更','Rename')}" onclick="pfPromptRename('${p.id}', '${escapeHtmlPf(p.name).replace(/'/g, "\\'")}')">✏️</button>
        ${list.length > 1 ? `<button type="button" class="pf-icon-btn" title="${pfT('削除','Delete')}" onclick="pfConfirmDelete('${p.id}', '${escapeHtmlPf(p.name).replace(/'/g, "\\'")}')">🗑</button>` : ''}
      </div>`;
  }).join('');

  document.getElementById('pfModalBody').innerHTML = `
    <div>${rows}</div>
    <div class="pf-add-row">
      <input type="text" class="pf-input" id="pfNewName" placeholder="${pfT('例: サブ垢1','e.g. Sub Account 1')}" maxlength="30">
      <button type="button" class="pf-add-btn" onclick="pfAddProfile()">${pfT('＋ 追加','+ Add')}</button>
    </div>
    <div class="pf-hint">${pfT(
      'プロフィールを切り替えると、所持アイテム・マイコーデ・お気に入りが切り替え先のプロフィールのものに入れ替わります（このブラウザ内にすべて保存されます）。',
      'Switching profiles swaps your owned items, My Coords, and favorites to the selected profile\'s data (everything is stored locally in this browser).'
    )}</div>
  `;
}

function pfAddProfile() {
  const input = document.getElementById('pfNewName');
  createProfile(input.value);
}

function pfPromptRename(id, currentName) {
  const next = prompt(pfT('新しいプロフィール名を入力してください', 'Enter a new profile name'), currentName);
  if (next === null) return;
  renameProfile(id, next);
}

function pfConfirmDelete(id, name) {
  const ok = confirm(pfT(
    `プロフィール「${name}」を削除しますか？（このプロフィールの選択自体を削除するだけで、保存済みデータはブラウザ内に残ります）`,
    `Delete profile "${name}"? (This only removes it from the list — its saved data stays in this browser.)`
  ));
  if (ok) deleteProfile(id);
}

function pfInit() {
  ensureProfilesInit();
  pfInjectStyle();

  const nav = document.querySelector('nav');
  if (!nav) return;

  const bar = document.createElement('div');
  bar.className = 'pf-bar';
  bar.id = 'pfBar';
  bar.onclick = pfOpenModal;
  nav.insertAdjacentElement('afterend', bar);
  pfRenderBar();

  const overlay = document.createElement('div');
  overlay.className = 'pf-modal-overlay';
  overlay.id = 'pfModalOverlay';
  overlay.onclick = (e) => { if (e.target === overlay) pfCloseModal(); };
  overlay.innerHTML = `
    <div class="pf-modal-card">
      <div class="pf-modal-header">
        <span class="pf-modal-title">👤 ${pfT('プロフィール切り替え','Switch Profile')}</span>
        <button type="button" class="pf-modal-close" onclick="pfCloseModal()">✕</button>
      </div>
      <div id="pfModalBody"></div>
    </div>`;
  document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', pfInit);
