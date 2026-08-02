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
      display: flex; align-items: center; gap: 10px; }
    .pf-bar b { color: var(--blue); font-weight: 700; }
    .pf-bar-text { flex: 1; min-width: 0; cursor: pointer; }
    .pf-search-btn { background: var(--bg); border: 1px solid var(--sep); color: var(--text-2);
      border-radius: 6px; padding: 5px 10px; font-size: 14px; cursor: pointer; flex-shrink: 0; line-height: 1; }
    .pf-search-btn:hover { background: var(--sep); }
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

    .srch-modal-card { max-width: 420px; }
    .srch-input { width: 100%; box-sizing: border-box; background: var(--bg); border: 1px solid var(--sep);
      border-radius: var(--r-sm); padding: 10px 12px; font-size: 15px; font-family: inherit; color: var(--text); outline: none; }
    .srch-input:focus { border-color: var(--blue); }
    .srch-status { font-size: 12px; color: var(--text-2); padding: 8px 2px 0; }
    .srch-group-label { font-size: 12px; font-weight: 700; color: var(--text-2);
      padding: 14px 2px 6px; display: flex; align-items: center; gap: 6px; }
    .srch-count { color: var(--text-2); font-weight: 600; opacity: 0.7; }
    .srch-row { display: flex; align-items: center; gap: 10px; background: var(--bg); border-radius: var(--r-sm);
      padding: 9px 10px; margin-bottom: 6px; text-decoration: none; color: inherit; }
    .srch-row:active { opacity: 0.7; }
    .srch-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; background: var(--card);
      display: flex; align-items: center; justify-content: center; font-size: 16px; overflow: hidden; }
    .srch-icon img { width: 100%; height: 100%; object-fit: contain; padding: 8%; display: block; }
    .srch-info { flex: 1; min-width: 0; }
    .srch-name { font-size: 13.5px; font-weight: 600; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srch-meta { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srch-arrow { color: var(--text-2); font-size: 13px; flex-shrink: 0; }
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
  bar.innerHTML = `
    <span class="pf-bar-text" onclick="pfOpenModal()">🗂️ <b>${escapeHtmlPf(profile.name)}</b> ${pfT('に切替中（タップで切替）', 'active (tap to switch)')}</span>
    <button type="button" class="pf-search-btn" onclick="srchOpen()" title="${pfT('横断検索（アイテム・エモート・精霊・季節）', 'Cross-site search')}">🔍</button>`;
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

  const searchOverlay = document.createElement('div');
  searchOverlay.className = 'pf-modal-overlay';
  searchOverlay.id = 'srchModalOverlay';
  searchOverlay.onclick = (e) => { if (e.target === searchOverlay) srchClose(); };
  searchOverlay.innerHTML = `
    <div class="pf-modal-card srch-modal-card">
      <h3>🔍 ${pfT('横断検索', 'Cross-site Search')}</h3>
      <input type="search" class="srch-input" id="srchInput" placeholder="${pfT('名前で検索（例: ケープ、砕ケル、バイオリン…）', 'Search by name…')}" oninput="srchOnInput()">
      <div class="srch-status" id="srchStatus">${pfT('2文字以上で検索できます', 'Type at least 2 characters')}</div>
      <div id="srchResults"></div>
      <button type="button" class="pf-close-btn" onclick="srchClose()">${pfT('閉じる', 'Close')}</button>
    </div>`;
  document.body.appendChild(searchOverlay);
}

document.addEventListener('DOMContentLoaded', pfInit);

/* ================================================================
   🔍 横断検索（アイテム所持管理サイト内のどのページからでも開ける）
   同じ taipak5000.github.io 上の各ツール（item自身の全カテゴリ・emote・wings）から
   データを読み込んで、アイテム・エモート・精霊・季節/イベントを一括で名前検索する。
   他サイトがまだ公開されていない場合はそのカテゴリの結果が0件になるだけで、
   検索自体は問題なく動作する。
   ================================================================ */
const SITE_ROOT = location.origin;
const SRCH_ITEM_CATS = [
  { key: 'outfit',          name: 'アウトフィット',       file: 'outfit.html' },
  { key: 'shoes',           name: 'シューズ',             file: 'shoes.html' },
  { key: 'mask',            name: 'マスク',               file: 'mask.html' },
  { key: 'face_accessory',  name: 'フェイスアクセサリー', file: 'face_accessory.html' },
  { key: 'necklace',        name: 'ネックレス',           file: 'necklace.html' },
  { key: 'hairstyle',       name: 'ヘアスタイル',         file: 'hairstyle.html' },
  { key: 'hair_accessory',  name: 'ヘアアクセサリー',     file: 'hair_accessory.html' },
  { key: 'head_accessory',  name: 'ヘッドアクセサリー',   file: 'head_accessory.html' },
  { key: 'cape',            name: 'ケープ',               file: 'cape.html' },
  { key: 'portable_item',   name: '持ち運べるアイテム',   file: 'portable_item.html' },
  { key: 'large_placeable', name: '大きい設置アイテム',   file: 'large_placeable.html' },
  { key: 'small_placeable', name: '小さい設置アイテム',   file: 'small_placeable.html' },
];

let srchIndex = null;
let srchLoading = null;

// HTMLに埋め込まれた `const 変数名 = [...]` 配列を安全に取り出す
function srchExtractArray(html, varName) {
  const m = html.match(new RegExp('const ' + varName + '\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);'));
  if (!m) return null;
  try { return new Function('return ' + m[1] + ';')(); } catch (e) { console.error(varName, e); return null; }
}

async function srchBuildIndex() {
  const idx = { items: [], emotes: [], spirits: [], events: [] };

  // 1) アイテム（item自身の12カテゴリページから抽出）
  await Promise.all(SRCH_ITEM_CATS.map(async cat => {
    try {
      const res = await fetch(`${SITE_ROOT}/item/${cat.file}`);
      const html = await res.text();
      const data = srchExtractArray(html, 'ITEMS_DATA') || [];
      data.forEach(it => idx.items.push({
        name: it.name, nameEn: it.nameEn || '', event: it.event || '',
        catName: cat.name, url: `${SITE_ROOT}/item/${cat.file}`,
        img: `${SITE_ROOT}/item/images/${cat.key}/${it.id}.png`
      }));
    } catch (e) { console.error(cat.key, e); }
  }));

  // 2) エモート（他サイトがまだ公開されていなければ0件のまま）
  try {
    const res = await fetch(`${SITE_ROOT}/emote/index.html`);
    const html = await res.text();
    (srchExtractArray(html, 'EMOTES_DATA') || []).forEach(em => idx.emotes.push({
      name: em.name, nameEn: em.nameEn || '', location: em.location || '',
      maxLevel: em.maxLevel, url: `${SITE_ROOT}/emote/`
    }));
  } catch (e) { console.error('emote', e); }

  // 3) 精霊（羽トラッカーの季節別精霊リスト）
  try {
    const res = await fetch(`${SITE_ROOT}/wings/index.html`);
    const html = await res.text();
    (srchExtractArray(html, 'SEASON_SPIRITS') || []).forEach(ss => {
      (ss.spirits || []).forEach(sp => idx.spirits.push({
        name: sp, season: ss.season, url: `${SITE_ROOT}/wings/`
      }));
    });
  } catch (e) { console.error('wings', e); }

  // 4) 季節・イベント名（アイテムに登場する全イベント名）
  const evSet = new Set();
  idx.items.forEach(it => { if (it.event) evSet.add(it.event); });
  idx.events = [...evSet].map(name => ({ name, url: `${SITE_ROOT}/item/index.html` }));

  return idx;
}

async function srchEnsureIndex() {
  if (srchIndex) return srchIndex;
  if (!srchLoading) {
    srchLoading = srchBuildIndex().then(idx => { srchIndex = idx; return idx; });
  }
  return srchLoading;
}

let srchTimer = null;
function srchOnInput() {
  clearTimeout(srchTimer);
  srchTimer = setTimeout(srchRun, 200);
}

async function srchRun() {
  const q = document.getElementById('srchInput').value.trim().toLowerCase();
  const statusEl = document.getElementById('srchStatus');
  const resultsEl = document.getElementById('srchResults');

  if (q.length < 2) {
    statusEl.textContent = pfT('2文字以上で検索できます', 'Type at least 2 characters');
    resultsEl.innerHTML = '';
    return;
  }

  if (!srchIndex) {
    statusEl.textContent = pfT('検索データを読み込み中…（初回のみ数秒かかります）', 'Loading search data… (first time only)');
    await srchEnsureIndex();
  }

  const match = s => (s || '').toLowerCase().includes(q);
  const items   = srchIndex.items.filter(it => match(it.name) || match(it.nameEn) || match(it.event));
  const emotes  = srchIndex.emotes.filter(em => match(em.name) || match(em.nameEn) || match(em.location));
  const spirits = srchIndex.spirits.filter(sp => match(sp.name) || match(sp.season));
  const events  = srchIndex.events.filter(ev => match(ev.name));
  const total = items.length + emotes.length + spirits.length + events.length;

  statusEl.textContent = total === 0
    ? pfT('一致する結果がありません', 'No matches found')
    : pfT(`${total}件ヒット`, `${total} results`);

  const LIMIT = 30;
  const group = (label, icon, rows) => rows.length === 0 ? '' : `
    <div class="srch-group-label">${icon} ${label} <span class="srch-count">${pfT(`${rows.length}件${rows.length > LIMIT ? `（先頭${LIMIT}件を表示）` : ''}`, `${rows.length}${rows.length > LIMIT ? ` (first ${LIMIT})` : ''}`)}</span></div>
    ${rows.slice(0, LIMIT).join('')}`;

  resultsEl.innerHTML =
    group(pfT('アイテム', 'Items'), '🗂️', items.map(it => `
      <a class="srch-row" href="${it.url}">
        <div class="srch-icon"><img src="${it.img}" alt="" loading="lazy" onerror="this.remove()"></div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(it.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(it.catName)} ・ ${escapeHtmlPf(it.event)}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('エモート', 'Emotes'), '🎭', emotes.map(em => `
      <a class="srch-row" href="${em.url}">
        <div class="srch-icon">🎭</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(em.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(em.location || '')}${em.maxLevel ? ` ・ Lv1〜${em.maxLevel}` : ''}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('精霊', 'Spirits'), '✨', spirits.map(sp => `
      <a class="srch-row" href="${sp.url}">
        <div class="srch-icon">✨</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(sp.name)}</div>
          <div class="srch-meta">${escapeHtmlPf(sp.season)}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`)) +
    group(pfT('季節・イベント', 'Seasons/Events'), '🍁', events.map(ev => `
      <a class="srch-row" href="${ev.url}">
        <div class="srch-icon">🍁</div>
        <div class="srch-info">
          <div class="srch-name">${escapeHtmlPf(ev.name)}</div>
          <div class="srch-meta">${pfT('アイテム検索で絞り込みができます', 'Refine in item search')}</div>
        </div>
        <span class="srch-arrow">›</span>
      </a>`));
}

function srchOpen() {
  document.getElementById('srchModalOverlay').classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('srchInput');
    if (input) input.focus();
  }, 50);
}
function srchClose() {
  document.getElementById('srchModalOverlay').classList.remove('open');
}
