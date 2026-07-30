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
    .pf-bar { max-width: 600px; margin: 12px auto 0; background: var(--card); border: 1px solid var(--sep);
      border-radius: var(--r-sm); padding: 10px 14px; font-size: 13px; color: var(--text-2);
      text-align: center; cursor: pointer; }
    .pf-bar b { color: var(--blue); font-weight: 700; }
    .pf-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      z-index: 1000; align-items: center; justify-content: center; padding: 20px; }
    .pf-modal-overlay.open { display: flex; }
    .pf-modal-card { width: 100%; max-width: 360px; max-height: 80vh; overflow-y: auto;
      background: var(--card); border-radius: var(--r); padding: 20px; box-sizing: border-box;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
    .pf-modal-card h3 { margin: 0 0 14px; font-size: 16px; color: var(--text); }
    .pf-row { display: flex; align-items: center; gap: 8px; padding: 10px 4px; border-bottom: 0.5px solid var(--sep); }
    .pf-row:last-of-type { border-bottom: none; }
    .pf-row-name { flex: 1; font-size: 14.5px; color: var(--text); cursor: pointer; word-break: break-all; }
    .pf-row.active .pf-row-name { color: var(--blue); font-weight: 700; }
    .pf-icon-btn { background: var(--bg); border: 1px solid var(--sep); color: var(--text-2);
      border-radius: 6px; padding: 5px 9px; font-size: 13px; cursor: pointer; flex-shrink: 0; }
    .pf-icon-btn:hover { background: var(--sep); }
    .pf-add-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pf-input { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--sep); border-radius: 6px;
      padding: 8px 10px; font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; }
    .pf-add-btn { background: var(--blue); color: #fff; border: none; border-radius: 6px; padding: 8px 14px;
      font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
    .pf-hint { font-size: 11.5px; color: var(--text-2); line-height: 1.5; margin: 12px 0 0; }
    .pf-close-btn { display: block; width: 100%; margin-top: 16px; background: var(--bg); border: 1px solid var(--sep);
      color: var(--text); border-radius: var(--r-sm); padding: 10px; font-size: 14px; cursor: pointer; }
    .pf-row-input { flex: 1; background: var(--bg); border: 1px solid var(--blue); border-radius: 6px;
      padding: 6px 8px; font-size: 14px; color: var(--text); font-family: inherit; outline: none; box-sizing: border-box; min-width: 0; }
    .pf-row-confirm-text { flex: 1; font-size: 13px; color: var(--text); line-height: 1.4; }
    .pf-row-btn-ok { background: var(--blue); color: #fff; border: none; }
    .pf-row-btn-danger { background: #ff3b30; color: #fff; border: none; }
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
  bar.innerHTML = `🗂️ <b>${escapeHtmlPf(profile.name)}</b> ${pfT('に切替中（タップで切替）', 'active (tap to switch)')}`;
}

function escapeHtmlPf(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// 名前変更中・削除確認中のプロフィールID（ポップアップブロックの影響を受ける
// prompt()/confirm() は使わず、モーダル内にインラインで表示する）
let pfEditingId = null;
let pfDeletingId = null;

function pfOpenModal() {
  pfEditingId = null;
  pfDeletingId = null;
  pfRenderModal();
  document.getElementById('pfModalOverlay').classList.add('open');
}
function pfCloseModal() {
  pfEditingId = null;
  pfDeletingId = null;
  document.getElementById('pfModalOverlay').classList.remove('open');
}

function pfRenderModal() {
  const list = ensureProfilesInit();
  const activeId = getActiveProfileId();
  const rows = list.map(p => {
    const isActive = p.id === activeId;

    if (pfEditingId === p.id) {
      const nameEsc = escapeHtmlPf(p.name);
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <input type="text" class="pf-row-input" id="pfEditInput" value="${nameEsc}" maxlength="30"
            onkeydown="if(event.key==='Enter') pfConfirmRenameInline('${p.id}'); if(event.key==='Escape') pfCancelRowState();">
          <button type="button" class="pf-icon-btn pf-row-btn-ok" onclick="pfConfirmRenameInline('${p.id}')">${pfT('保存','Save')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    if (pfDeletingId === p.id) {
      return `
        <div class="pf-row" style="flex-wrap: wrap;">
          <span class="pf-row-confirm-text">${pfT(
            `「${escapeHtmlPf(p.name)}」を削除しますか？（一覧からの削除のみで、保存済みデータはブラウザ内に残ります）`,
            `Delete "${escapeHtmlPf(p.name)}"? (This only removes it from the list — its saved data stays in this browser.)`
          )}</span>
          <button type="button" class="pf-icon-btn pf-row-btn-danger" onclick="pfConfirmDeleteInline('${p.id}')">${pfT('削除','Delete')}</button>
          <button type="button" class="pf-icon-btn" onclick="pfCancelRowState()">${pfT('取消','Cancel')}</button>
        </div>`;
    }

    return `
      <div class="pf-row ${isActive ? 'active' : ''}">
        <span class="pf-row-name" onclick="switchProfile('${p.id}')">${isActive ? '✅ ' : ''}${escapeHtmlPf(p.name)}</span>
        <button type="button" class="pf-icon-btn" title="${pfT('名前を変更','Rename')}" onclick="pfStartRename('${p.id}')">✏️</button>
        ${list.length > 1 ? `<button type="button" class="pf-icon-btn" title="${pfT('削除','Delete')}" onclick="pfStartDelete('${p.id}')">🗑️</button>` : ''}
      </div>`;
  }).join('');

  document.getElementById('pfModalBody').innerHTML = `<div>${rows}</div>`;

  if (pfEditingId !== null) {
    const input = document.getElementById('pfEditInput');
    if (input) { input.focus(); input.select(); }
  }
}

function pfAddProfile() {
  const input = document.getElementById('pfNewName');
  createProfile(input.value);
}

function pfStartRename(id) {
  pfDeletingId = null;
  pfEditingId = id;
  pfRenderModal();
}

function pfStartDelete(id) {
  pfEditingId = null;
  pfDeletingId = id;
  pfRenderModal();
}

function pfCancelRowState() {
  pfEditingId = null;
  pfDeletingId = null;
  pfRenderModal();
}

function pfConfirmRenameInline(id) {
  const input = document.getElementById('pfEditInput');
  const next = input ? input.value : '';
  pfEditingId = null;
  if (next && next.trim()) {
    renameProfile(id, next);
  } else {
    pfRenderModal();
  }
}

function pfConfirmDeleteInline(id) {
  pfDeletingId = null;
  deleteProfile(id);
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
      <h3>🗂️ ${pfT('プロフィール（保存枠）','Profiles')}</h3>
      <div id="pfModalBody"></div>
      <div class="pf-add-row">
        <input type="text" class="pf-input" id="pfNewName" placeholder="${pfT('例: サブ垢1','e.g. Sub Account 1')}" maxlength="30">
        <button type="button" class="pf-add-btn" onclick="pfAddProfile()">${pfT('追加','Add')}</button>
      </div>
      <div class="pf-hint">${pfT(
        'プロフィールを切り替えると、所持アイテム・マイコーデ・お気に入りが切り替え先のプロフィールのものに入れ替わります（このブラウザ内にすべて保存されます）。',
        'Switching profiles swaps your owned items, My Coords, and favorites to the selected profile\'s data (everything is stored locally in this browser).'
      )}</div>
      <button type="button" class="pf-close-btn" onclick="pfCloseModal()">${pfT('閉じる','Close')}</button>
    </div>`;
  document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', pfInit);
