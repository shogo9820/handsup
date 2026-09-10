// ===================================================
// グローバルアプリ状態
// ===================================================
const appState = {
  settings: {
    timeLimitSec: 60,
    difficulty: "all"
  },
  selectedCategory: "all",
  currentGameWords: [],
  currentWordIndex: 0,
  timerInterval: null,
  timeLeftSec: 0,
  isPaused: false,
  activeGame: null // 'gesture' | 'taboo' | null
};

// DOM要素
const menuScreen = document.getElementById('menu-screen');
const gestureSetupScreen = document.getElementById('gesture-setup-screen');
const tabooSetupScreen = document.getElementById('taboo-setup-screen');
const gestureScreen = document.getElementById('gesture-screen');
const tabooScreen = document.getElementById('taboo-screen');

const settingsModal = document.getElementById('settings-modal');
const ruleModal = document.getElementById('rule-modal');

const pickerMin = document.getElementById('picker-min');
const pickerSec = document.getElementById('picker-sec');
const wheelMin = document.getElementById('wheel-min');
const wheelSec = document.getElementById('wheel-sec');
const ITEM_HEIGHT = 32;

// ===================================================
// 画面切り替え & 基本遷移ナビゲーション
// ===================================================
function showScreen(screenElement) {
  // 文字列（ID）で渡された場合の互換対応
  if (typeof screenElement === 'string') {
    screenElement = document.getElementById(screenElement);
  }
  if (!screenElement) return;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screenElement.classList.add('active');

  // テーマ切り替えクラスの制御
  document.body.classList.remove('theme-gesture', 'theme-taboo');
  if (screenElement.id.includes('gesture')) {
    document.body.classList.add('theme-gesture');
  } else if (screenElement.id.includes('taboo')) {
    document.body.classList.add('theme-taboo');
  }
}

// トップメニューへ戻るボタン一括設定
document.querySelectorAll('.btn-to-menu').forEach(btn => {
  btn.addEventListener('click', () => {
    stopCommonGame();
    showScreen(menuScreen);
  });
});

// トップ画面からの遷移
document.getElementById('btn-to-gesture-setup').addEventListener('click', () => {
  appState.activeGame = 'gesture';
  showScreen(gestureSetupScreen);
});

document.getElementById('btn-to-taboo-setup').addEventListener('click', () => {
  appState.activeGame = 'taboo';
  showScreen(tabooSetupScreen);
});

// ===================================================
// 単語フィルタ ＆ シャッフル処理
// ===================================================
function prepareWords() {
  // masterWords が読み込まれる前にボタンが押されてもクラッシュしない安全策
  const wordsData = window.masterWords || (typeof masterWords !== 'undefined' ? masterWords : null);

  if (!wordsData) {
    console.error("お題データ（masterWords）がまだ読み込まれていないか、定義されていません。");
    // 安全策として画面が止まらないよう一時的なデータを入れます
    appState.currentGameWords = [{ text: "データ読み込みエラー", difficulty: 1, category1: "all" }];
    appState.currentWordIndex = 0;
    return;
  }

  let filtered = wordsData;
  
  // 1. 難易度で絞り込み
  if (appState.settings.difficulty !== 'all') {
    const diff = Number(appState.settings.difficulty);
    filtered = filtered.filter(w => w.difficulty === diff || w.difficulty === appState.settings.difficulty);
  }
  
  // 2. カテゴリで絞り込み
  if (appState.selectedCategory && appState.selectedCategory !== 'all') {
    const cat = appState.selectedCategory;
    filtered = filtered.filter(w => 
      w.category1 === cat || 
      w.category2 === cat || 
      w.category3 === cat
    );
  }

  // 該当なしの安全策
  if (filtered.length === 0) {
    console.warn("条件に一致する単語が見つからなかったため、全単語を使用します。");
    filtered = wordsData;
  }

  // 3. シャッフル
  appState.currentGameWords = [...filtered];
  for (let i = appState.currentGameWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [appState.currentGameWords[i], appState.currentGameWords[j]] = [appState.currentGameWords[j], appState.currentGameWords[i]];
  }
  appState.currentWordIndex = 0;
}

function getNextWordText() {
  if (appState.currentWordIndex >= appState.currentGameWords.length) {
    return null;
  }
  const wordObj = appState.currentGameWords[appState.currentWordIndex];
  appState.currentWordIndex++;
  return wordObj.text;
}

// ===================================================
// 単語フィルタ ＆ シャッフル処理
// ===================================================
function prepareWords() {
  let filtered = masterWords;
  
  // 1. 難易度で絞り込み
  if (appState.settings.difficulty !== 'all') {
    const diff = Number(appState.settings.difficulty);
    filtered = filtered.filter(w => w.difficulty === diff || w.difficulty === appState.settings.difficulty);
  }
  
  // 2. カテゴリで絞り込み
  if (appState.selectedCategory && appState.selectedCategory !== 'all') {
    const cat = appState.selectedCategory;
    filtered = filtered.filter(w => 
      w.category1 === cat || 
      w.category2 === cat || 
      w.category3 === cat
    );
  }

  // 該当なしの安全策
  if (filtered.length === 0) {
    console.warn("条件に一致する単語が見つからなかったため、全単語を使用します。");
    filtered = masterWords;
  }

  // 3. シャッフル
  appState.currentGameWords = [...filtered];
  for (let i = appState.currentGameWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [appState.currentGameWords[i], appState.currentGameWords[j]] = [appState.currentGameWords[j], appState.currentGameWords[i]];
  }
  appState.currentWordIndex = 0;
}

function getNextWordText() {
  if (appState.currentWordIndex >= appState.currentGameWords.length) {
    return null;
  }
  const wordObj = appState.currentGameWords[appState.currentWordIndex];
  appState.currentWordIndex++;
  return wordObj.text;
}

// ===================================================
// タイマー制御
// ===================================================
function startTimerBar(barElement, onTimeUp) {
  clearInterval(appState.timerInterval);

  const totalSec = appState.settings.timeLimitSec;
  let remainingMs = totalSec * 1000;

  barElement.style.width = '100%';
  barElement.classList.remove('warning', 'danger');

  appState.timerInterval = setInterval(() => {
    if (appState.isPaused) return;

    remainingMs -= 50;
    appState.timeLeftSec = Math.ceil(remainingMs / 1000);

    const progress = (remainingMs / (totalSec * 1000)) * 100;
    barElement.style.width = `${Math.max(0, progress)}%`;

    if (progress <= 20) {
      barElement.classList.add('danger');
      barElement.classList.remove('warning');
    } else if (progress <= 50) {
      barElement.classList.add('warning');
    }

    if (remainingMs <= 0) {
      clearInterval(appState.timerInterval);
      barElement.style.width = '0%';
      onTimeUp();
    }
  }, 50);
}

function stopCommonGame() {
  clearInterval(appState.timerInterval);
  appState.isPaused = false;
  stopGyroGame();
}

// ===================================================
// 加速度センサー制御（スマホを振る動きで判定）
// ===================================================
let isMotionCoolTime = false;

async function startGyroGame(onAction) {
  stopGyroGame(); // 既存のイベントがあれば解除

  // iOS 13+ のパーミッション要求対応（加速度も同じ許可が必要です）
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      if (perm === 'granted') {
        window._currentMotionHandler = (event) => handleCommonMotion(event, onAction);
        window.addEventListener('devicemotion', window._currentMotionHandler);
      }
    } catch (e) {
      console.error("モーション取得スキップ:", e);
    }
  } else if (window.DeviceMotionEvent) {
    // Android や対応ブラウザ
    window._currentMotionHandler = (event) => handleCommonMotion(event, onAction);
    window.addEventListener('devicemotion', window._currentMotionHandler);
  }

  return true;
}

// センサー停止処理（名前は既存のままで中身をモーション用に変更）
function stopGyroGame() {
  if (window._currentMotionHandler) {
    window.removeEventListener('devicemotion', window._currentMotionHandler);
    window._currentMotionHandler = null;
  }
  isMotionCoolTime = false;
}

// 振る動きを判定するメイン関数
function handleCommonMotion(event, onAction) {
  if (isMotionCoolTime || appState.isPaused || appState.timeLeftSec <= 0) return;

  // 重力加速度を除いた純粋な動きの加速を取得
  const accel = event.acceleration;
  if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

  // 1. 画面を前に向けた状態からの「地面向き・空向き」の振りは、すべてZ軸（画面の裏表方向）に現れます
  let zAcceleration = accel.z;

  // 2. 【横振りガード】画面の向きを変えずに、右や左に並行に振った時のブレ（X軸・Y軸）を計測
  const xAcceleration = accel.x;
  const yAcceleration = accel.y;

  // 左右や上下の並行なブレが強い（ここでは加速度 5 以上）時は、横振りとみなして一切反応させない
  const maxHorizontalTolerance = 5; 
  if (Math.abs(xAcceleration) > maxHorizontalTolerance || Math.abs(yAcceleration) > maxHorizontalTolerance) {
    return; // 横振りを検知したら、この瞬間の処理を完全にカット
  }

  // 💡 あなたが設定したそれぞれの感度（閾値）
  const thresholdCorrect = 6; // 正解：しっかり画面を地面に向けて振る
  const thresholdPass = 6;    // パス：しっかり画面を空に向けて振る

  // 画面が地面を向くように振る ➔ 正解（どちらのゲームでも共通）
  if (zAcceleration < -thresholdCorrect) {
    triggerMotionAction('correct', onAction);
  } 
  // 画面が空を向くように振る ➔ パス（どちらのゲームでも共通）
  else if (zAcceleration > thresholdPass) {
    triggerMotionAction('pass', onAction);
  }
}

// アクションを実行し、連続反応を防ぐクールダウンを挟む
function triggerMotionAction(action, onAction) {
  isMotionCoolTime = true;

  if (navigator.vibrate) {
    navigator.vibrate(200); // 振った瞬間にブルッとバイブ
  }

  if (typeof onAction === 'function') {
    onAction(action);
  }

  // 1回振った後、連続で誤反応しないように入力を受け付けない（400ms）
  setTimeout(() => {
    isMotionCoolTime = false;
  }, 400);
}

// ===================================================
// UI イベント（カテゴリカード & モーダル制御）
// ===================================================
document.querySelectorAll('.category-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    appState.selectedCategory = card.getAttribute('data-category');
  });
});

// モーダル一括制御 (環境設定)
document.querySelectorAll('.btn-open-settings').forEach(btn => {
  btn.addEventListener('click', () => {
    appState.isPaused = true;
    
    // 現在の難易度設定をセレクトボックスに反映
    const difficultySelect = document.getElementById('setting-difficulty');
    if (difficultySelect) {
      difficultySelect.value = appState.settings.difficulty;
    }

    settingsModal.classList.add('active');
    setTimeout(() => setPickerValues(appState.settings.timeLimitSec), 50);
  });
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  appState.settings.timeLimitSec = getPickerValueSeconds();
  
  // 選択された難易度を設定に保存
  const difficultySelect = document.getElementById('setting-difficulty');
  if (difficultySelect) {
    appState.settings.difficulty = difficultySelect.value;
  }
  
  settingsModal.classList.remove('active');
  appState.isPaused = false;
});

// モーダル一括制御 (ルール説明)
document.querySelectorAll('.btn-open-rule').forEach(btn => {
  btn.addEventListener('click', () => {
    appState.isPaused = true;
    const titleElem = document.getElementById('rule-modal-title');
    const bodyElem = document.getElementById('rule-modal-body');

    if (appState.activeGame === 'gesture') {
      titleElem.textContent = "📖 Heads Up! ルール";
      bodyElem.innerHTML = `
        <ol>
          <li>スマホを横向きにして<strong>おでこに当てて</strong>画面を回答者に見せます。</li>
          <li>周りの人は画面に映ったお題をジェスチャーや言葉でヒントを出します。</li>
          <li>正解したらスマホ画面を<strong>「下（おじぎ）」</strong>に倒します。</li>
          <li>パスしたい時はスマホ画面を<strong>「上（天井）」</strong>に向けます。</li>
        </ol>
      `;
    } else {
      titleElem.textContent = "📖 カタカナーシ ルール";
      bodyElem.innerHTML = `
        <ol>
          <li>説明者は画面に表示されたお題を確認します。</li>
          <li><strong>カタカナ語（外来語・和製英語）を一切使わずに</strong>お題を説明してください。</li>
          <li>正解したらスマホ画面を<strong>「下（おじぎ）」</strong>に倒します。</li>
          <li>パスしたい時はスマホ画面を<strong>「上（天井）」</strong>に向けます。</li>
          <li>うっかりカタカナ語を言ってしまうとペナルティ！</li>
        </ol>
      `;
    }
    ruleModal.classList.add('active');
  });
});

document.getElementById('btn-close-rule').addEventListener('click', () => {
  ruleModal.classList.remove('active');
  appState.isPaused = false;
});

// ===================================================
// ピッカー初期化
// ===================================================
function initPickers() {
  if (!wheelMin || !wheelSec) return;
  wheelMin.innerHTML = '';
  wheelSec.innerHTML = '';
  for (let i = 0; i <= 59; i++) {
    const val = String(i).padStart(2, '0');
    
    const m = document.createElement('div');
    m.className = 'picker-item'; m.textContent = val;
    wheelMin.appendChild(m);

    const s = document.createElement('div');
    s.className = 'picker-item'; s.textContent = val;
    wheelSec.appendChild(s);
  }
}

function setPickerValues(totalSec) {
  if (!pickerMin || !pickerSec) return;
  pickerMin.scrollTop = Math.floor(totalSec / 60) * ITEM_HEIGHT;
  pickerSec.scrollTop = (totalSec % 60) * ITEM_HEIGHT;
}

function getPickerValueSeconds() {
  if (!pickerMin || !pickerSec) return 60;
  const m = Math.round(pickerMin.scrollTop / ITEM_HEIGHT);
  const s = Math.round(pickerSec.scrollTop / ITEM_HEIGHT);
  const total = (m * 60) + s;
  return total === 0 ? 1 : total;
}

// ==================================================
// 共通リザルト（結果履歴）管理
// ==================================================

// そのラウンドの履歴を保持する配列
let gameHistory = [];

/**
 * ゲーム開始時に履歴をリセットする関数
 */
function resetGameHistory() {
  gameHistory = [];
}

/**
 * 解答結果（正解／パス）を履歴に追加する関数
 * @param {string} word - 出題された単語
 * @param {string} result - 'correct' または 'pass'
 */
function recordGameResult(word, result) {
  if (!word) return;
  gameHistory.push({ word: word, result: result });
}

/**
 * タイムアップ時にリザルトモーダルを生成して表示する関数
 */
function showResultModal() {
  const resultModal = document.getElementById('result-modal');
  const resultListEl = document.getElementById('result-list');
  const resultSummaryEl = document.getElementById('result-summary');

  if (!resultModal || !resultListEl || !resultSummaryEl) return;

  // 正解数とパス数を集計
  const correctCount = gameHistory.filter(item => item.result === 'correct').length;
  const passCount = gameHistory.filter(item => item.result === 'pass').length;

  // 集計結果のテキスト
  resultSummaryEl.innerHTML = `正解: <span style="color:#2ecc71;">${correctCount}</span> / パス: <span style="color:#e74c3c;">${passCount}</span>`;

  // 一覧リストの生成（単語 ｜ 正解・パス の形式）
  if (gameHistory.length === 0) {
    resultListEl.innerHTML = `<div style="text-align:center; padding: 10px; opacity:0.7;">回答データがありません</div>`;
  } else {
    resultListEl.innerHTML = gameHistory.map(item => `
      <div class="result-item">
        <span class="word-name">${item.word}</span>
        <span class="result-divider">｜</span>
        <span class="result-badge ${item.result}">
          ${item.result === 'correct' ? '正解' : 'パス'}
        </span>
      </div>
    `).join('');
  }

  // モーダルを表示
  resultModal.classList.add('active');
}

// リザルトモーダルのボタンイベント設定
document.addEventListener('DOMContentLoaded', () => {
  initPickers();

  const resultModal = document.getElementById('result-modal');

  // モーダル非表示用共通処理
  const hideResultModal = () => {
    if (resultModal) {
      resultModal.classList.remove('active');
    }
  };

  // 1. 同じお題でもう一度プレイ
  const btnRetry = document.getElementById('btn-result-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      hideResultModal();

      // 現在のアクティブゲーム判定に合わせて各スタートボタンをトリガー
      if (appState.activeGame === 'gesture' || document.body.classList.contains('theme-gesture')) {
        document.getElementById('btn-gesture-start')?.click();
      } else if (appState.activeGame === 'taboo' || document.body.classList.contains('theme-taboo')) {
        document.getElementById('btn-taboo-start')?.click();
      }
    });
  }

  // 2. お題を変更する（カテゴリ選択画面に戻る）
  const btnChangeSetup = document.getElementById('btn-result-change-setup');
  if (btnChangeSetup) {
    btnChangeSetup.addEventListener('click', () => {
      hideResultModal();

      if (appState.activeGame === 'gesture' || document.body.classList.contains('theme-gesture')) {
        showScreen(gestureSetupScreen);
      } else if (appState.activeGame === 'taboo' || document.body.classList.contains('theme-taboo')) {
        showScreen(tabooSetupScreen);
      } else {
        showScreen(menuScreen);
      }
    });
  }

  // 3. タイトルに戻る
  const btnToTitle = document.getElementById('btn-result-to-title');
  if (btnToTitle) {
    btnToTitle.addEventListener('click', () => {
      hideResultModal();

      // テーマ用クラスを除去してメニューへ
      document.body.classList.remove('theme-gesture', 'theme-taboo');
      appState.activeGame = null;
      showScreen(menuScreen);
    });
  }
});

// ===================================================
// 【追加】タッチ操作制御（ダブルタップで正解 / 上フリックでパス）
// ===================================================
/**
 * 画面へのタッチ操作（ダブルタップ・上フリック）を監視・制御する関数
 * @param {HTMLElement} screenElement - 監視対象の画面要素 (gestureScreen や tabooScreen)
 * @param {function} onAction - アクション実行時のコールバック関数
 */
function startTouchGame(screenElement, onAction) {
  if (!screenElement || typeof onAction !== 'function') return;

  // 既存のリスナーと重複しないよう、一度クリアするための参照保持
  stopTouchGame(screenElement);

  let lastTapTime = 0;
  let touchStartY = 0;

  // タッチ開始時の座標を記録
  screenElement._touchStartHandler = (e) => {
    if (appState.isPaused || appState.timeLeftSec <= 0) return;
    touchStartY = e.touches[0].clientY;
  };

  // タッチ終了時にダブルタップとフリックを判定
  screenElement._touchEndHandler = (e) => {
    if (appState.isPaused || appState.timeLeftSec <= 0) return;

    const currentTime = new Date().getTime();
    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchStartY - touchEndY; // 上方向への移動量

    // 1. 【上フリック判定】
    // 上方向に50px以上素早く動かされたら「パス」とみなす
    if (diffY > 50) {
      if (navigator.vibrate) navigator.vibrate(100);
      onAction('pass');
      return; // フリックが成立したらダブルタップ判定はスキップ
    }

    // 2. 【ダブルタップ判定】
    // 300ミリ秒以内に再度タップされたら「正解」とみなす
    if ((currentTime - lastTapTime) < 300) {
      if (navigator.vibrate) navigator.vibrate(200);
      onAction('correct');
      lastTapTime = 0; // 連続発火防止のためにリセット
    } else {
      lastTapTime = currentTime;
    }
  };

  screenElement.addEventListener('touchstart', screenElement._touchStartHandler, { passive: true });
  screenElement.addEventListener('touchend', screenElement._touchEndHandler, { passive: true });
}

/**
 * タッチ操作の監視を解除する関数
 */
function stopTouchGame(screenElement) {
  if (!screenElement) return;
  if (screenElement._touchStartHandler) {
    screenElement.removeEventListener('touchstart', screenElement._touchStartHandler);
    screenElement._touchStartHandler = null;
  }
  if (screenElement._touchEndHandler) {
    screenElement.removeEventListener('touchend', screenElement._touchEndHandler);
    screenElement._touchEndHandler = null;
  }
}

// 既存の stopCommonGame にタッチ停止処理を組み込む
const originalStopCommonGame = stopCommonGame;
stopCommonGame = function() {
  originalStopCommonGame();
  stopTouchGame(gestureScreen);
  stopTouchGame(tabooScreen);
};
