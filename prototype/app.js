/* RaiseTimeLine プロトタイプ（使い捨て）
 * 基本の考え方：「データ（S）を変える → 保存する → 画面を作り直す（render）」
 * データは localStorage にだけ保存する。サーバー・DB は使わない。
 * サンプルのユーザー・投稿は、すべて架空。 */
(() => {
  'use strict';

  const KEY = 'rtl-proto-state-v1';       // 投稿・ユーザーなどのデータ
  const AUTH_KEY = 'rtl-proto-auth-v1';   // ログイン中の札（アクセストークン・リフレッシュトークン）
  const PAGE = 5;                         // 1 回に読み込む件数（本番は 20。試作では、増える様子が見えるよう、少なくしている）
  const MIN = 60000, DAY = 24 * 60 * MIN;
  const ACCESS_LIFE = 15 * MIN;           // アクセストークン：15 分
  const REFRESH_LIFE = 7 * DAY;           // リフレッシュトークン：7 日

  // ---------- ヘルパー ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  // 見せかけのハッシュ（本物の BCrypt ではない。パスワードを、そのままの形で保存しないことを、まねしているだけ）
  const fakeHash = (pw) => { let h = 5381; const s = 'salt:' + pw; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'proto-hash$' + (h >>> 0).toString(16); };
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (iso) => { const d = new Date(iso); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtClock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

  // ---------- データ ----------
  function seed() {
    const now = Date.now();
    const ago = (m) => new Date(now - m * MIN).toISOString();
    const pw = fakeHash('password1');
    const mk = (id, n, username, displayName, bio) => ({ id, email: `user${n}@example.com`, username, displayName, bio, pwHash: pw, createdAt: ago(5000) });
    return {
      nextId: 100,
      users: [
        mk(1, 1, 'hanako_demo', 'はなこ（デモ）', '架空のユーザーです。散歩と読書が好き。'),
        mk(2, 2, 'taro_sample', 'たろう', 'プロトタイプを作っています。'),
        mk(3, 3, 'mika_test', 'みか', 'パンとコーヒーの記録。'),
        mk(4, 4, 'ken_example', 'けん', ''),
        mk(5, 5, 'yuki_dummy', 'ゆき', '短い文章を、少しずつ。'),
      ],
      posts: [
        { id: 1, userId: 1, body: 'はじめまして！RaiseTimeLine のデモです。今日は天気がよくて、散歩をしました。', hasImage: false, createdAt: ago(300), updatedAt: null },
        { id: 2, userId: 2, body: '新しいアプリのプロトタイプを作っています。まずは画面から。', hasImage: false, createdAt: ago(240), updatedAt: null },
        { id: 3, userId: 3, body: 'お昼ごはんは、手作りのサンドイッチでした。パンが焼けるいい匂い。', hasImage: true, createdAt: ago(200), updatedAt: null },
        { id: 4, userId: 4, body: 'ユーザー名は英数字だけ、表示名は日本語もOK。X と同じ形ですね。', hasImage: false, createdAt: ago(180), updatedAt: null },
        { id: 5, userId: 5, body: '読書メモ：短い文章でも、続けると、あとで読み返せる記録になる。', hasImage: false, createdAt: ago(150), updatedAt: null },
        { id: 6, userId: 1, body: '280 文字までの投稿です。短くても、気持ちは伝わります。', hasImage: false, createdAt: ago(120), updatedAt: ago(100) },
        { id: 7, userId: 2, body: 'コメントへの返信は 1 段だけ。シンプルなのが好き。', hasImage: false, createdAt: ago(90), updatedAt: null },
        { id: 8, userId: 3, body: '週末は、近所のカフェで、ゆっくり本を読みたい。', hasImage: false, createdAt: ago(60), updatedAt: null },
        { id: 9, userId: 4, body: 'いいねの数を押すと、いいねした人の一覧が見られます。', hasImage: false, createdAt: ago(40), updatedAt: null },
        { id: 10, userId: 5, body: 'ログインしなくても、タイムラインは見られます。投稿やいいねは、ログインが必要。', hasImage: false, createdAt: ago(25), updatedAt: null },
        { id: 11, userId: 1, body: '検索は、ユーザー名と表示名の両方で探せます。「たろう」で試してみてください。', hasImage: false, createdAt: ago(10), updatedAt: null },
        { id: 12, userId: 2, body: '「フォロー中」のタイムラインには、フォローした人の投稿だけが出ます。自分の投稿は、「全体」とプロフィールで見られます。', hasImage: false, createdAt: ago(3), updatedAt: null },
      ],
      comments: [
        { id: 20, postId: 1, userId: 2, parentId: null, body: 'はじめまして！', createdAt: ago(280) },
        { id: 21, postId: 1, userId: 3, parentId: null, body: 'いい天気ですね。', createdAt: ago(270) },
        { id: 22, postId: 1, userId: 1, parentId: 20, body: 'ありがとうございます！', createdAt: ago(260) },
        { id: 23, postId: 6, userId: 4, parentId: null, body: '「編集済み」の表示、いいですね。', createdAt: ago(90) },
        { id: 24, postId: 11, userId: 3, parentId: null, body: 'たろうさんを検索してみます。', createdAt: ago(5) },
      ],
      likes: [
        { postId: 1, userId: 2 }, { postId: 1, userId: 3 }, { postId: 1, userId: 4 },
        { postId: 3, userId: 1 }, { postId: 6, userId: 5 }, { postId: 9, userId: 1 },
        { postId: 11, userId: 2 }, { postId: 12, userId: 1 },
      ].map((l, i) => ({ ...l, createdAt: ago(200 - i) })),
      follows: [[1, 2], [1, 3], [2, 1], [3, 1], [3, 2], [4, 1], [5, 1], [5, 2], [5, 3]]
        .map(([a, b], i) => ({ followerId: a, followeeId: b, createdAt: ago(1000 - i) })),
      refreshTokens: [], // 本番では、DB の REFRESH_TOKEN 表になる
    };
  }
  function load(key, fallback) {
    try { const r = localStorage.getItem(key); if (r) { const v = JSON.parse(r); if (v && (key !== KEY || v.users)) return v; } } catch (e) { /* 読めなければ、初期値 */ }
    return fallback();
  }
  function persist(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 保存できなくても、動かす */ } }

  let S = load(KEY, seed);
  let A = load(AUTH_KEY, () => null);   // { accessToken, accessExp, refreshToken, userInfo:{id,username,displayName} }
  const save = () => persist(KEY, S);
  const saveAuth = () => { try { if (A) localStorage.setItem(AUTH_KEY, JSON.stringify(A)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* 同上 */ } };
  const nextId = () => S.nextId++;

  // 画面の一時的な状態（保存しない）
  const ui = { tab: 'all', limit: PAGE, editingPost: null, replyTo: null, flash: '', modalFns: [] };
  let observer = null;

  // ---------- 取り出す ----------
  const user = (id) => S.users.find((u) => u.id === id);
  const userByName = (name) => S.users.find((u) => u.username === name);
  const me = () => (A ? user(A.userInfo.id) || null : null);
  const post = (id) => S.posts.find((p) => p.id === id);
  const likesOf = (pid) => S.likes.filter((l) => l.postId === pid);
  const commentsOf = (pid) => S.comments.filter((c) => c.postId === pid);
  const isFollowing = (a, b) => S.follows.some((f) => f.followerId === a && f.followeeId === b);
  const followingOf = (uid) => S.follows.filter((f) => f.followerId === uid).map((f) => f.followeeId);
  const followersOf = (uid) => S.follows.filter((f) => f.followeeId === uid).map((f) => f.followerId);
  const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

  // ---------- 札（トークン）のまね ----------
  function issueTokens(u) {
    const now = Date.now();
    const rt = { id: nextId(), userId: u.id, token: uuid(), expiresAt: new Date(now + REFRESH_LIFE).toISOString(), revoked: false, createdAt: new Date(now).toISOString() };
    S.refreshTokens.push(rt); save();
    A = { accessToken: 'proto-access.' + uuid(), accessExp: now + ACCESS_LIFE, refreshToken: rt.token, userInfo: { id: u.id, username: u.username, displayName: u.displayName } };
    saveAuth();
  }
  // 操作の前に呼ぶ。アクセストークンが切れていたら、リフレッシュトークンで、自動で更新する（まね）
  function ensureAuth() {
    if (!A) return true;
    const now = Date.now();
    if (A.accessExp > now) return true;
    const rt = S.refreshTokens.find((t) => t.token === A.refreshToken);
    if (rt && !rt.revoked && new Date(rt.expiresAt).getTime() > now) {
      A.accessToken = 'proto-access.' + uuid(); A.accessExp = now + ACCESS_LIFE; saveAuth();
      toast('アクセストークン（15 分）が切れたので、リフレッシュトークンで、自動で更新しました');
      return true;
    }
    A = null; saveAuth();
    ui.flash = 'ログインの有効期限が切れました。もう一度、ログインしてください。';
    if (location.hash === '#/login') setTimeout(render, 0); else go('/login');   // すでにログイン画面なら、画面を作り直す
    return false;
  }
  function requireLogin() {
    if (!ensureAuth()) return false;
    if (!me()) { ui.flash = 'この操作には、ログインが必要です。'; go('/login'); return false; }
    return true;
  }

  // ---------- ルーティング ----------
  const go = (path) => { location.hash = '#' + path; };
  function route() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '') };
  }

  // ---------- 部品 ----------
  const avatar = (u, size = 40) => `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:hsl(${(u.id * 67) % 360},50%,48%)">${esc([...u.displayName][0] || '?')}</span>`;
  const nameLink = (u) => `<a class="uname" href="#/user/${encodeURIComponent(u.username)}"><b>${esc(u.displayName)}</b> <span class="muted">@${esc(u.username)}</span></a>`;
  const counter = (n, max) => `<span class="counter ${n > max ? 'over' : ''}">${n} / ${max}</span>`;

  function postCard(p, opts = {}) {
    const u = user(p.userId); if (!u) return '';
    const mine = me() && me().id === p.userId;
    const liked = me() && likesOf(p.id).some((l) => l.userId === me().id);
    const nLike = likesOf(p.id).length, nCmt = commentsOf(p.id).length;
    const editing = ui.editingPost === p.id;
    return `<article class="card post">
      <div class="post-head">
        <a href="#/user/${encodeURIComponent(u.username)}">${avatar(u)}</a>
        <div class="who">${nameLink(u)}<br><span class="time">${fmt(p.createdAt)}</span>${p.updatedAt ? ' <span class="edited">・編集済み</span>' : ''}</div>
        ${mine ? `<div class="menu"><button class="btn text small" data-action="edit-post" data-id="${p.id}">編集</button><button class="btn text small danger" data-action="del-post" data-id="${p.id}">削除</button></div>` : ''}
      </div>
      ${editing
        ? `<div class="compose"><textarea id="edit-body" data-counter="280" rows="3">${esc(p.body)}</textarea>
           <div class="compose-foot"><span class="spacer"></span>${counter([...p.body].length, 280)}<button class="btn text" data-action="edit-cancel">キャンセル</button><button class="btn contained" data-action="edit-save" data-id="${p.id}">保存</button></div>
           <div class="error" id="edit-err"></div></div>`
        : `<div class="post-body ${opts.detail ? '' : 'clickable'}" ${opts.detail ? '' : `data-action="open" data-id="${p.id}"`}>${esc(p.body)}</div>`}
      ${p.hasImage ? '<div class="img-box">（画像の枠。保存先 S3 は、未決のため、枠だけ）</div>' : ''}
      <div class="actions">
        <button class="act ${liked ? 'liked' : ''}" data-action="like" data-id="${p.id}" title="いいね">${liked ? '♥' : '♡'}</button>
        <button class="act" data-action="likes" data-id="${p.id}" ${nLike ? '' : 'disabled'} title="いいねした人の一覧">${nLike}</button>
        <button class="act" data-action="open" data-id="${p.id}" title="コメント">💬 ${nCmt}</button>
      </div></article>`;
  }
  const userRow = (u) => {
    const m = me();
    const btn = m && m.id !== u.id ? `<button class="btn small ${isFollowing(m.id, u.id) ? 'outlined' : 'contained'}" data-action="follow" data-id="${u.id}">${isFollowing(m.id, u.id) ? 'フォロー解除' : 'フォロー'}</button>` : '';
    return `<div class="user-row"><a href="#/user/${encodeURIComponent(u.username)}">${avatar(u)}</a><div class="who">${nameLink(u)}<div class="muted small">${esc(u.bio ? [...u.bio].slice(0, 40).join('') : '')}</div></div>${btn}</div>`;
  };
  const composeBox = (id, placeholder, label) => `<div class="compose"><textarea id="${id}" data-counter="280" rows="3" placeholder="${placeholder}"></textarea>
    <div class="compose-foot"><button class="btn text small" data-action="toggle-img" id="img-toggle">🖼 画像（枠だけ）</button><span class="spacer"></span>${counter(0, 280)}<button class="btn contained" data-action="${id}-submit">${label}</button></div>
    <div class="error" id="${id}-err"></div></div>`;

  // ---------- 画面 ----------
  function viewTimeline() {
    const m = me();
    let html = `<div class="tabs"><button class="tab ${ui.tab === 'all' ? 'active' : ''}" data-action="tab" data-tab="all">全体</button><button class="tab ${ui.tab === 'following' ? 'active' : ''}" data-action="tab" data-tab="following">フォロー中</button></div>`;
    if (ui.tab === 'following' && !m) {
      return html + `<div class="card empty">「フォロー中」を見るには、ログインが必要です。<br><br><a class="btn contained" href="#/login">ログイン</a></div>`;
    }
    if (m) html += `<div class="card">${composeBox('post', 'いまどうしてる？（280 文字まで）', '投稿する')}</div>`;
    else html += `<div class="notice">ログインしなくても、見るだけはできます。投稿・いいね・コメント・フォローは、<a href="#/login">ログイン</a>が必要です。</div>`;
    return html + '<div id="list"></div>';
  }
  function timelinePosts() {
    const m = me();
    let list = S.posts.slice();
    if (ui.tab === 'following' && m) { const ids = new Set(followingOf(m.id)); list = list.filter((p) => ids.has(p.userId)); }   // フォローした人の投稿だけ（自分の投稿は入れない。TL-1）
    return list.sort(byNewest);
  }
  function listHtml(posts) {
    const shown = posts.slice(0, ui.limit);
    if (!posts.length) return ui.tab === 'following' && ui.mode === 'timeline'
      ? '<div class="card empty">フォローしている人の投稿は、まだありません。<br>気になる人を、ユーザー検索で探して、フォローしてみましょう。</div>'
      : '<div class="card empty">まだ投稿がありません</div>';
    return shown.map((p) => postCard(p)).join('') + (posts.length > shown.length ? '<div id="sentinel"></div><div class="empty small">読み込み中…</div>' : '<div class="empty small">これ以上ありません</div>');
  }

  function viewPost(id, sub) {
    const p = post(id);
    if (!p) return '<div class="card empty">投稿が見つかりません</div>';
    if (sub === 'likes') {
      const us = likesOf(id).sort(byNewest).map((l) => user(l.userId)).filter(Boolean);
      return `<a class="back" href="#/post/${id}">← 投稿にもどる</a><div class="card"><h2>いいねした人（${us.length}）</h2>${us.length ? us.map(userRow).join('') : '<div class="empty">まだいいねがありません</div>'}</div>`;
    }
    const m = me();
    const top = commentsOf(id).filter((c) => !c.parentId).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    const cm = (c, isReply) => {
      const u = user(c.userId); if (!u) return '';
      const canDel = m && (m.id === c.userId || m.id === p.userId);
      return `<div class="comment"><div class="post-head"><a href="#/user/${encodeURIComponent(u.username)}">${avatar(u, 32)}</a><div class="who">${nameLink(u)}<br><span class="time">${fmt(c.createdAt)}</span></div>
        ${canDel ? `<button class="btn text small danger" data-action="del-comment" data-id="${c.id}">削除</button>` : ''}</div>
        <div class="comment-body">${esc(c.body)}</div>
        ${isReply ? '' : `<button class="btn text small" data-action="reply-open" data-id="${c.id}">返信</button>`}
        ${ui.replyTo === c.id ? `<div class="compose"><textarea id="reply" data-counter="280" rows="2" placeholder="返信を書く"></textarea><div class="compose-foot"><span class="spacer"></span>${counter(0, 280)}<button class="btn text" data-action="reply-cancel">キャンセル</button><button class="btn contained" data-action="reply-submit" data-id="${c.id}">返信する</button></div><div class="error" id="reply-err"></div></div>` : ''}
        ${isReply ? '' : `<div class="replies">${S.comments.filter((r) => r.parentId === c.id).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)).map((r) => cm(r, true)).join('')}</div>`}</div>`;
    };
    return `<a class="back" href="#/">← タイムラインへ</a>${postCard(p, { detail: true })}
      <div class="card"><h2>コメント（${commentsOf(id).length}）</h2>
      ${m ? composeBox('comment', 'コメントを書く（280 文字まで）', 'コメントする').replace('<button class="btn text small" data-action="toggle-img" id="img-toggle">🖼 画像（枠だけ）</button>', '') : '<div class="notice">コメントするには、<a href="#/login">ログイン</a>が必要です。</div>'}
      ${top.length ? top.map((c) => cm(c, false)).join('') : '<div class="empty">まだコメントがありません</div>'}</div>`;
  }

  function viewUser(name, sub) {
    const u = userByName(name);
    if (!u) return '<div class="card empty">ユーザーが見つかりません</div>';
    const m = me();
    if (sub === 'following' || sub === 'followers') {
      const ids = sub === 'following' ? followingOf(u.id) : followersOf(u.id);
      const us = ids.map(user).filter(Boolean);
      return `<a class="back" href="#/user/${encodeURIComponent(u.username)}">← ${esc(u.displayName)} さんのプロフィール</a><div class="card"><h2>${sub === 'following' ? 'フォロー中' : 'フォロワー'}（${us.length}）</h2>${us.length ? us.map(userRow).join('') : '<div class="empty">まだいません</div>'}</div>`;
    }
    const mine = m && m.id === u.id;
    const btn = mine ? '<button class="btn outlined" data-action="edit-profile">プロフィールを編集</button>'
      : `<button class="btn ${m && isFollowing(m.id, u.id) ? 'outlined' : 'contained'}" data-action="follow" data-id="${u.id}">${m && isFollowing(m.id, u.id) ? 'フォロー解除' : 'フォロー'}</button>`;
    return `<div class="card"><div class="profile-top">${avatar(u, 72)}<div class="info"><h1>${esc(u.displayName)}</h1><div class="muted">@${esc(u.username)}</div>
      ${u.bio ? `<div class="profile-bio">${esc(u.bio)}</div>` : '<div class="profile-bio muted">自己紹介は、まだありません</div>'}
      <div class="counts"><button data-action="nav" data-to="/user/${encodeURIComponent(u.username)}/following"><b>${followingOf(u.id).length}</b> フォロー中</button><button data-action="nav" data-to="/user/${encodeURIComponent(u.username)}/followers"><b>${followersOf(u.id).length}</b> フォロワー</button></div></div>${btn}</div></div>
      <h2 class="small muted" style="margin:16px 4px 8px">投稿</h2><div id="list"></div>`;
  }
  const profilePosts = (name) => { const u = userByName(name); return u ? S.posts.filter((p) => p.userId === u.id).sort(byNewest) : []; };

  function viewSearch(q) {
    const s = q.trim().toLowerCase();
    let body = '';
    if (!s) body = '<div class="empty">ユーザー名か、表示名を入力して、検索してください</div>';
    else {
      const hit = S.users.filter((u) => u.username.toLowerCase().includes(s) || u.displayName.toLowerCase().includes(s)).sort((a, b) => (a.username > b.username ? 1 : -1));
      body = hit.length ? hit.slice(0, 20).map(userRow).join('') + (hit.length > 20 ? '<div class="empty small">結果が多いので、20 件までです。条件をしぼってください</div>' : '') : '<div class="empty">見つかりません</div>';
    }
    return `<div class="card"><h2>検索結果：${esc(q)}</h2>${body}</div>`;
  }

  function viewLogin() {
    const flash = ui.flash ? `<div class="notice">${esc(ui.flash)}</div>` : ''; ui.flash = '';
    return `<div class="card narrow"><h1>RaiseTimeLine</h1>${flash}
      <div class="field"><label>メールアドレス</label><input id="li-email" type="email" data-enter="login" autocomplete="off" placeholder="user1@example.com"></div>
      <div class="field"><label>パスワード</label><input id="li-pw" type="password" data-enter="login" autocomplete="off" placeholder="password1"></div>
      <div class="error" id="li-err"></div>
      <button class="btn contained block" data-action="login">ログイン</button>
      <p class="muted small" style="text-align:center">アカウントをお持ちでない方は <a href="#/register">新規登録</a></p></div>`;
  }
  function viewRegister() {
    return `<div class="card narrow"><h1>RaiseTimeLine</h1>
      <div class="field"><label>メールアドレス *</label><input id="rg-email" type="email" autocomplete="off" placeholder="例：user9@example.com"></div>
      <div class="field"><label>パスワード *</label><input id="rg-pw" type="password" autocomplete="off"><div class="hint">8 文字以上。英字と数字を、それぞれ 1 文字以上</div></div>
      <div class="field"><label>パスワード確認 *</label><input id="rg-pw2" type="password" autocomplete="off"></div>
      <div class="field"><label>ユーザー名 *</label><input id="rg-name" autocomplete="off"><div class="hint">2〜30 文字。英数字とアンダースコア（_）だけ。登録後は変えられません</div></div>
      <div class="field"><label>表示名 *</label><input id="rg-disp" autocomplete="off"><div class="hint">50 文字まで。日本語もOK。あとで変えられます</div></div>
      <div class="error" id="rg-err"></div>
      <button class="btn contained block" data-action="register">登録する</button>
      <p class="muted small" style="text-align:center">アカウントをお持ちの方は <a href="#/login">ログイン</a></p></div>`;
  }

  // ---------- 描画 ----------
  function renderHeader() {
    const m = me();
    $('#auth-area').innerHTML = m
      ? `<a class="me" href="#/user/${encodeURIComponent(m.username)}">${avatar(m, 28)}<span>${esc(m.displayName)}</span></a><button class="btn text" data-action="logout">ログアウト</button>`
      : '<a class="btn text" href="#/login">ログイン</a><a class="btn outlined" href="#/register">ユーザー登録</a>';
  }
  function renderDev() {
    const rt = A && S.refreshTokens.find((t) => t.token === A.refreshToken);
    $('#dev').innerHTML = `<details class="dev"><summary>開発用：札（トークン）の状態を見る（学習用）</summary>
      ${A ? `<dl><dt>ログイン中の人</dt><dd>${esc(A.userInfo.displayName)}（@${esc(A.userInfo.username)}）</dd>
        <dt>アクセストークン</dt><dd>${esc(A.accessToken.slice(0, 22))}…<br>期限：${fmtClock(A.accessExp)}${A.accessExp > Date.now() ? '' : '（切れています）'}</dd>
        <dt>リフレッシュトークン</dt><dd>${esc(A.refreshToken.slice(0, 13))}…<br>期限：${rt ? fmt(rt.expiresAt) : '?'} ／ 無効にしたか（revoked）：${rt ? rt.revoked : '?'}</dd></dl>
        <div class="row"><button class="btn outlined small" data-action="dev-expire-access">15 分たったことにする</button><button class="btn outlined small" data-action="dev-expire-refresh">7 日たったことにする</button></div>
        <p class="small">DevTools の「Application」→「Local Storage」で、<code>rtl-proto-auth-v1</code>（札）と、<code>rtl-proto-state-v1</code>（データ。refreshTokens に、DB の表のまね）を、見られます。</p>`
        : '<p class="small">ログインしていません。</p>'}
      <div class="row"><button class="btn outlined small danger" data-action="dev-reset">データを、最初の状態にもどす</button></div></details>`;
  }
  function render() {
    if (!ensureAuth()) return;
    const { parts, q } = route();
    let html = '', title = 'RaiseTimeLine プロトタイプ';
    ui.mode = null;
    const [a, b, c] = parts;
    if (!a) { html = viewTimeline(); ui.mode = 'timeline'; }
    else if (a === 'login') { html = viewLogin(); }
    else if (a === 'register') { html = viewRegister(); }
    else if (a === 'post' && b) { html = viewPost(Number(b), c); }
    else if (a === 'user' && b) { html = viewUser(b, c); if (!c && userByName(b)) ui.mode = 'profile'; }
    else if (a === 'search') { html = viewSearch(q.get('q') || ''); $('#search-input').value = q.get('q') || ''; }
    else html = '<div class="card empty">ページが見つかりません。<a href="#/">タイムラインへ</a></div>';
    renderHeader();
    $('#view').innerHTML = html;
    if (ui.mode) updateList();
    renderDev();
    document.title = title;
  }
  // タイムライン・プロフィールの、投稿の並びだけを作り直す（下へ進むと、増える）
  function updateList() {
    const el = $('#list'); if (!el) return;
    const posts = ui.mode === 'profile' ? profilePosts(route().parts[1]) : timelinePosts();
    el.innerHTML = listHtml(posts);
    if (observer) observer.disconnect();
    const s = $('#sentinel');
    if (s && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { ui.limit += PAGE; updateList(); } }, { rootMargin: '120px' });
      observer.observe(s);
    }
  }

  // ---------- 窓・通知 ----------
  function modal(title, bodyHtml, buttons) {
    ui.modalFns = buttons.map((b) => b.fn);
    $('#modal').innerHTML = `<h3>${esc(title)}</h3>${bodyHtml}<div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || 'text'}" data-modal="${i}">${esc(b.label)}</button>`).join('')}</div>`;
    $('#overlay').hidden = false;
  }
  const closeModal = () => { $('#overlay').hidden = true; ui.modalFns = []; };
  const confirmModal = (title, text, okLabel, fn) => modal(title, `<p>${text}</p>`, [{ label: 'キャンセル', fn: closeModal }, { label: okLabel, cls: 'contained danger', fn: () => { closeModal(); fn(); } }]);
  let toastTimer = null;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500); }

  // ---------- 操作 ----------
  const val = (id) => ($(`#${id}`) ? $(`#${id}`).value : '');
  const setErr = (id, msg) => { const e = $(`#${id}`); if (e) e.textContent = msg; };
  let withImage = false;

  const actions = {
    search() { const q = $('#search-input').value.trim(); if (q) go('/search?q=' + encodeURIComponent(q)); },
    nav(el) { go(el.dataset.to); },
    open(el) { go('/post/' + el.dataset.id); },
    likes(el) { go(`/post/${el.dataset.id}/likes`); },
    tab(el) { ui.tab = el.dataset.tab; ui.limit = PAGE; render(); },
    'toggle-img'(el) { withImage = !withImage; el.textContent = withImage ? '🖼 画像あり（枠だけ）' : '🖼 画像（枠だけ）'; },

    login() {
      const email = val('li-email').trim().toLowerCase(), pw = val('li-pw');
      const u = S.users.find((x) => x.email.toLowerCase() === email);
      if (!u || u.pwHash !== fakeHash(pw)) { setErr('li-err', 'メールアドレスかパスワードが違います'); return; }  // どちらが違うかは、教えない
      issueTokens(u); ui.tab = 'all'; ui.limit = PAGE; go('/'); render(); toast(`ようこそ、${u.displayName} さん`);
    },
    register() {
      const email = val('rg-email').trim(), pw = val('rg-pw'), pw2 = val('rg-pw2'), name = val('rg-name').trim(), disp = val('rg-disp').trim();
      let err = '';
      if (!email || !pw || !pw2 || !name || !disp) err = 'すべての項目を、入力してください';
      else if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err = 'メールアドレスの形が正しくありません（255 文字まで）';
      else if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) err = 'パスワードは、8 文字以上で、英字と数字を含めてください';
      else if (pw !== pw2) err = 'パスワードと、パスワード確認が、違います';
      else if (!/^[A-Za-z0-9_]{2,30}$/.test(name)) err = 'ユーザー名は、2〜30 文字の、英数字とアンダースコア（_）だけです';
      else if ([...disp].length > 50) err = '表示名は、50 文字までです';
      else if (S.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) err = 'このメールアドレスは、すでに使われています';
      else if (S.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) err = 'このユーザー名は、すでに使われています';
      if (err) { setErr('rg-err', err); return; }
      S.users.push({ id: nextId(), email, username: name, displayName: disp, bio: '', pwHash: fakeHash(pw), createdAt: new Date().toISOString() });
      save();
      modal('登録が完了しました', '<p>登録が完了しました。ログインしてください。</p>', [{ label: 'OK', cls: 'contained', fn: () => { closeModal(); go('/login'); } }]);   // 自動ログインは、しない
    },
    logout() {
      const rt = A && S.refreshTokens.find((t) => t.token === A.refreshToken);
      if (rt) rt.revoked = true;            // サーバー側で、リフレッシュトークンを無効にする（まね）
      save(); A = null; saveAuth(); ui.tab = 'all'; go('/login'); render(); toast('ログアウトしました');
    },

    'post-submit'() {
      if (!requireLogin()) return;
      const body = val('post').trim();
      if (!body) { setErr('post-err', '本文を入力してください'); return; }
      if ([...body].length > 280) { setErr('post-err', '280 文字までです'); return; }
      S.posts.push({ id: nextId(), userId: me().id, body, hasImage: withImage, createdAt: new Date().toISOString(), updatedAt: null });
      withImage = false; save(); render();
      // 「フォロー中」は、自分の投稿を入れないので、投稿したのに見えない。そこで、お知らせを出す
      if (ui.tab === 'following') toast('投稿しました。「全体」と、自分のプロフィールで見られます');
    },
    'edit-post'(el) { ui.editingPost = Number(el.dataset.id); render(); },
    'edit-cancel'() { ui.editingPost = null; render(); },
    'edit-save'(el) {
      if (!requireLogin()) return;
      const p = post(Number(el.dataset.id)), body = val('edit-body').trim();
      if (!p || p.userId !== me().id) return;
      if (!body) { setErr('edit-err', '本文を入力してください'); return; }
      if ([...body].length > 280) { setErr('edit-err', '280 文字までです'); return; }
      if (body !== p.body) { p.body = body; p.updatedAt = new Date().toISOString(); }   // 編集したら「編集済み」
      ui.editingPost = null; save(); render();
    },
    'del-post'(el) {
      if (!requireLogin()) return;
      const id = Number(el.dataset.id);
      confirmModal('投稿を削除しますか？', 'この投稿と、付いているコメント・いいね・画像も、消えます。元に戻せません。', '削除する', () => {
        S.posts = S.posts.filter((p) => p.id !== id); S.comments = S.comments.filter((c) => c.postId !== id); S.likes = S.likes.filter((l) => l.postId !== id);
        save(); if (route().parts[0] === 'post') go('/'); render(); toast('投稿を削除しました');
      });
    },
    like(el) {
      if (!requireLogin()) return;
      const pid = Number(el.dataset.id), m = me();
      const i = S.likes.findIndex((l) => l.postId === pid && l.userId === m.id);
      if (i >= 0) S.likes.splice(i, 1); else S.likes.push({ postId: pid, userId: m.id, createdAt: new Date().toISOString() });   // 自分の投稿にも、できる
      save(); render();
    },

    'comment-submit'() {
      if (!requireLogin()) return;
      const body = val('comment').trim();
      if (!body) { setErr('comment-err', '本文を入力してください'); return; }
      if ([...body].length > 280) { setErr('comment-err', '280 文字までです'); return; }
      S.comments.push({ id: nextId(), postId: Number(route().parts[1]), userId: me().id, parentId: null, body, createdAt: new Date().toISOString() });
      save(); render();
    },
    'reply-open'(el) { if (!requireLogin()) return; ui.replyTo = Number(el.dataset.id); render(); },
    'reply-cancel'() { ui.replyTo = null; render(); },
    'reply-submit'(el) {
      if (!requireLogin()) return;
      const body = val('reply').trim();
      if (!body) { setErr('reply-err', '本文を入力してください'); return; }
      if ([...body].length > 280) { setErr('reply-err', '280 文字までです'); return; }
      S.comments.push({ id: nextId(), postId: Number(route().parts[1]), userId: me().id, parentId: Number(el.dataset.id), body, createdAt: new Date().toISOString() });   // 返信は 1 段だけ
      ui.replyTo = null; save(); render();
    },
    'del-comment'(el) {
      if (!requireLogin()) return;
      const id = Number(el.dataset.id), c = S.comments.find((x) => x.id === id);
      if (!c) return;
      const hasReply = S.comments.some((r) => r.parentId === id);
      confirmModal('コメントを削除しますか？', hasReply ? 'このコメントと、付いている返信も、消えます。元に戻せません。' : 'このコメントを、消します。元に戻せません。', '削除する', () => {
        S.comments = S.comments.filter((x) => x.id !== id && x.parentId !== id); save(); render();
      });
    },

    follow(el) {
      if (!requireLogin()) return;
      const m = me(), id = Number(el.dataset.id);
      if (m.id === id) return;   // 自分は、フォローできない
      const i = S.follows.findIndex((f) => f.followerId === m.id && f.followeeId === id);
      if (i >= 0) S.follows.splice(i, 1); else S.follows.push({ followerId: m.id, followeeId: id, createdAt: new Date().toISOString() });
      save(); render();
    },
    'edit-profile'() {
      if (!requireLogin()) return;
      const m = me();
      modal('プロフィールを編集', `<div class="field"><label>表示名（50 文字まで）</label><input id="pf-disp" value="${esc(m.displayName)}"></div>
        <div class="field"><label>自己紹介（160 文字まで）</label><textarea id="pf-bio" rows="3">${esc(m.bio)}</textarea></div>
        <div class="hint muted small">ユーザー名（@${esc(m.username)}）は、変えられません。アイコン画像は、S3 が未決のため、まだ変えられません。</div><div class="error" id="pf-err"></div>`,
        [{ label: 'キャンセル', fn: closeModal }, { label: '保存', cls: 'contained', fn: () => {
          const d = val('pf-disp').trim(), b = val('pf-bio').trim();
          if (!d) { setErr('pf-err', '表示名を入力してください'); return; }
          if ([...d].length > 50) { setErr('pf-err', '表示名は、50 文字までです'); return; }
          if ([...b].length > 160) { setErr('pf-err', '自己紹介は、160 文字までです'); return; }
          m.displayName = d; m.bio = b; A.userInfo.displayName = d; save(); saveAuth(); closeModal(); render();
        } }]);
    },

    'dev-expire-access'() { if (A) { A.accessExp = Date.now() - 1000; saveAuth(); render(); toast('アクセストークンを、期限切れにしました。何か操作すると、自動で更新されます'); } },
    'dev-expire-refresh'() { if (A) { const rt = S.refreshTokens.find((t) => t.token === A.refreshToken); if (rt) rt.expiresAt = new Date(Date.now() - 1000).toISOString(); A.accessExp = Date.now() - 1000; save(); saveAuth(); render(); toast('リフレッシュトークンも、期限切れにしました。何か操作すると、ログイン画面へ戻ります'); } },
    'dev-reset'() { confirmModal('データを最初の状態にもどしますか？', 'このプロトタイプのデータ（投稿・ユーザー・ログイン）が、すべて初期化されます。', 'もどす', () => { S = seed(); A = null; save(); saveAuth(); ui.tab = 'all'; ui.limit = PAGE; go('/'); render(); }); },
  };

  // ---------- イベント ----------
  document.addEventListener('click', (e) => {
    const mb = e.target.closest('[data-modal]');
    if (mb) { const fn = ui.modalFns[Number(mb.dataset.modal)]; if (fn) fn(); return; }
    if (e.target.id === 'overlay') { closeModal(); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.counter) return;
    const max = Number(t.dataset.counter), n = [...t.value].length;
    const c = t.parentElement.querySelector('.counter');
    if (c) { c.textContent = `${n} / ${max}`; c.classList.toggle('over', n > max); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.key !== 'Enter') return;   // 日本語の変換中の Enter は、使わない
    if (e.target.id === 'search-input') { actions.search(); return; }
    if (e.target.dataset && e.target.dataset.enter && actions[e.target.dataset.enter]) { e.preventDefault(); actions[e.target.dataset.enter](); }
  });
  window.addEventListener('hashchange', () => { ui.limit = PAGE; ui.editingPost = null; ui.replyTo = null; closeModal(); render(); window.scrollTo(0, 0); });

  render();
})();
