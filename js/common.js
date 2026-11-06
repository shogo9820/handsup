// ===================================================
// 💡 PWA・スマホでの横画面（ランドスケープ）強制ロック
// ===================================================
function lockLandscape() {
  if (screen.orientation && typeof screen.orientation.lock === 'function') {
    screen.orientation.lock('landscape').catch((err) => {
      console.log("画面ロックは拒否されました（PCブラウザなど）:", err);
    });
  }
}

// ページ読み込み時、およびアプリがバックグラウンドから復帰した時に横画面を強制
window.addEventListener('DOMContentLoaded', lockLandscape);
window.addEventListener('focus', lockLandscape);
// 画面のどこかを初めてタップした瞬間に、確実に横にロックさせる（ブラウザ制限の突破用）
window.addEventListener('click', lockLandscape, { once: true });

// ===================================================
// グローバルアプリ状態（機能拡張）
// ===================================================
const appState = {
  settings: {
    timeLimitSec: 60,
    difficulties: ["1", "2", "3", "4"], // 4. 複数保持に対応
    isShakeEnabled: false,              // 2. デフォルトは無効
    passLimit: "infinite"               // 5. デフォルトは無限
  },
  selectedCategory: "all",
  currentGameWords: [],
  currentWordIndex: 0,
  timerInterval: null,
  timeLeftSec: 0,
  isPaused: false,
  activeGame: null,
  maxPassLimit: Infinity,
  remainingPasses: Infinity,            // 5. 現在の残りパス数
  lastActiveWord: ''                    // 1. 最後に出題されていたお題
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
// 4. 単語フィルタ ＆ シャッフル処理（複数難易度対応）
// ===================================================
function prepareWords() {
  const wordsData = window.masterWords || (typeof masterWords !== 'undefined' ? masterWords : null);

  if (!wordsData) {
    console.error("お題データ（masterWords）がまだ読み込まれていないか、定義されていません。");
    appState.currentGameWords = [{ text: "データ読み込みエラー", difficulty: 1, category1: "all" }];
    appState.currentWordIndex = 0;
    return;
  }

  let filtered = wordsData;
  
  // 4. チェックされた複数の難易度（配列に含まれるか）で絞り込み
  if (appState.settings.difficulties.length > 0) {
    filtered = filtered.filter(w => appState.settings.difficulties.includes(String(w.difficulty)));
  }
  
  // カテゴリで絞り込み
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
  appState.lastActiveWord = ''; // リセット
}

function getNextWordText() {
  if (appState.currentWordIndex >= appState.currentGameWords.length) {
    return null;
  }
  const wordObj = appState.currentGameWords[appState.currentWordIndex];
  appState.currentWordIndex++;
  
  // 1. 現在アクティブなお題として保持
  appState.lastActiveWord = wordObj.text; 
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
  // 💡 ゲーム開始時にbodyの演出クラスも綺麗にリセット
  document.body.classList.remove('warning', 'danger');

  appState.timerInterval = setInterval(() => {
    if (appState.isPaused) return;

    remainingMs -= 50;
    appState.timeLeftSec = Math.ceil(remainingMs / 1000);

    const progress = (remainingMs / (totalSec * 1000)) * 100;
    barElement.style.width = `${Math.max(0, progress)}%`;

    // 💡 残り20%以下（段階3：危機）
    if (progress <= 20) {
      barElement.classList.add('danger');
      barElement.classList.remove('warning');
      
      document.body.classList.add('danger');    /* body外周を赤くパルス発光 */
      document.body.classList.remove('warning');
      
    // 💡 残り50%以下（段階2：警告）
    } else if (progress <= 50) {
      barElement.classList.add('warning');
      
      document.body.classList.add('warning');   /* body外周を黄色くゆっくり発光 */
    }

    if (remainingMs <= 0) {
      clearInterval(appState.timerInterval);
      barElement.style.width = '0%';
      // 💡 タイムアップしたら演出クラスを即座に除去
      document.body.classList.remove('warning', 'danger');
      onTimeUp();
    }
  }, 50);
}

function stopCommonGame() {
  clearInterval(appState.timerInterval);
  appState.isPaused = false;
  // 💡 ゲーム中断・終了時にも画面外周のパルス演出クラスを完全に消去
  document.body.classList.remove('warning', 'danger');
  stopGyroGame();
}

// ===================================================
// 2. 加速度センサー制御（有り無し設定の適用）
// ===================================================
let isMotionCoolTime = false;

// モーション判定用ステート管理（戻し動作での誤反応を防止するニュートラル復帰方式）
const motionState = {
  phase: 'WAIT_NEUTRAL', // 'WAIT_NEUTRAL': ニュートラル復帰待ち / 'NEUTRAL': 入力受付可能
  initialized: false,
  hasReturnedToNeutral: false, // クールタイム中にニュートラルへ戻ったかどうかのフラグ
  smoothGx: 0,
  smoothGy: 0,
  smoothGz: 0,
  baselineAngle: 15,     // ユーザーの基準保持角度（おでこ=0°付近、手持ち=20〜45°付近）
  prevTiltAngle: 0,
  prevTimestamp: 0,
  angularVel: 0,         // 傾き角速度 (deg/s)
  neutralStableSince: 0, // ニュートラル圏内で静止し始めた時刻
  returnCheckAfter: 0,   // アクション直後、ニュートラル復帰チェックを開始する時刻
  cooldownUntil: 0,      // アクション後の最低待機完了時刻（お題切り替え演出800msに合わせる）
  lastDownMotionTime: 0, // 下方向への傾きを検知した最終時刻（戻し動作の逆反応防止用）
  lastUpMotionTime: 0,   // 上方向への傾きを検知した最終時刻（戻し動作の逆反応防止用）
  lastCallback: null
};

function resetMotionState(initialDelayMs = 350) {
  const now = performance.now();
  motionState.phase = 'WAIT_NEUTRAL';
  motionState.initialized = false;
  motionState.hasReturnedToNeutral = false;
  motionState.angularVel = 0;
  motionState.neutralStableSince = 0;
  motionState.returnCheckAfter = now + 100;
  motionState.cooldownUntil = now + initialDelayMs;
  motionState.lastDownMotionTime = 0;
  motionState.lastUpMotionTime = 0;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function');
}

async function startGyroGame(onAction) {
  if (typeof onAction === 'function') {
    motionState.lastCallback = onAction;
  }
  stopGyroGame();

  // 2. 設定で「振る制御」がOFFならセンサーイベントを登録しない
  if (!appState.settings.isShakeEnabled) return false;

  resetMotionState(500);

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
    window._currentMotionHandler = (event) => handleCommonMotion(event, onAction);
    window.addEventListener('devicemotion', window._currentMotionHandler);
  }

  return true;
}

function stopGyroGame() {
  if (window._currentMotionHandler) {
    window.removeEventListener('devicemotion', window._currentMotionHandler);
    window._currentMotionHandler = null;
  }
  isMotionCoolTime = false;
  resetMotionState(0);
}

function handleCommonMotion(event, onAction) {
  if (appState.isPaused || appState.timeLeftSec <= 0) {
    // 一時停止中はニュートラル待ち状態へ戻し、再開直後の誤反応を防ぐ
    motionState.phase = 'WAIT_NEUTRAL';
    motionState.hasReturnedToNeutral = false;
    motionState.neutralStableSince = 0;
    return;
  }

  const now = performance.now();
  const sign = isIOSDevice() ? -1 : 1; // iOSとAndroidのZ軸等の符号差を正規化（画面上向き＝＋、下向き＝－）

  const ag = event.accelerationIncludingGravity;
  const accel = event.acceleration;
  const hasLinearAccel = Boolean(accel && accel.z !== null && accel.z !== undefined);
  const linX = hasLinearAccel ? (accel.x || 0) * sign : 0;
  const linY = hasLinearAccel ? (accel.y || 0) * sign : 0;
  const linZ = hasLinearAccel ? (accel.z || 0) * sign : 0;

  // 重力加速度センサーが利用可能な場合（実機スマホ・標準環境）
  if (ag && ag.z !== null && ag.z !== undefined) {
    // 振る際の並進加速度・遠心力成分（event.acceleration）を差し引いて純粋な重力ベクトルを抽出
    const gx = (ag.x || 0) * sign - linX * 0.8;
    const gy = (ag.y || 0) * sign - linY * 0.8;
    const gz = (ag.z || 0) * sign - linZ * 0.8;

    if (!motionState.initialized) {
      motionState.smoothGx = gx;
      motionState.smoothGy = gy;
      motionState.smoothGz = gz;
      const initHoriz = Math.sqrt(gx * gx + gy * gy);
      const initAngle = Math.atan2(gz, Math.max(0.1, initHoriz)) * (180 / Math.PI);
      motionState.prevTiltAngle = initAngle;
      motionState.baselineAngle = Math.max(-15, Math.min(50, initAngle));
      motionState.prevTimestamp = now;
      motionState.initialized = true;
      return;
    }

    const dt = Math.min(0.1, Math.max(0.005, (now - motionState.prevTimestamp) / 1000));
    motionState.prevTimestamp = now;

    // ローパスフィルタで手ブレを除去しつつ傾きへ素早く追従
    const filterAlpha = 0.45;
    motionState.smoothGx += filterAlpha * (gx - motionState.smoothGx);
    motionState.smoothGy += filterAlpha * (gy - motionState.smoothGy);
    motionState.smoothGz += filterAlpha * (gz - motionState.smoothGz);

    const horizG = Math.sqrt(
      motionState.smoothGx * motionState.smoothGx +
      motionState.smoothGy * motionState.smoothGy
    );
    // 画面の傾き角度 (-90°: 床向き/おじぎ, 0°: 垂直/おでこ, +90°: 天井向き)
    const tiltAngle = Math.atan2(motionState.smoothGz, Math.max(0.1, horizG)) * (180 / Math.PI);

    // 傾きの変化速度 (deg/s)
    const rawVel = (tiltAngle - motionState.prevTiltAngle) / dt;
    motionState.angularVel = motionState.angularVel * 0.55 + rawVel * 0.45;
    motionState.prevTiltAngle = tiltAngle;

    const deltaAngle = tiltAngle - motionState.baselineAngle;

    // 下方向へ傾いたことを記録（直後の「上に戻す動作」でパスが誤発火するのを防ぐ）
    if (deltaAngle <= -12) {
      motionState.lastDownMotionTime = now;
    }
    // 上方向へ傾いたことを記録（直後の「下に戻す動作」で正解が誤発火するのを防ぐ）
    if (deltaAngle >= 12) {
      motionState.lastUpMotionTime = now;
    }

    const isNearNeutralAngle = (tiltAngle >= -20 && tiltAngle <= 55) && Math.abs(deltaAngle) <= 18;
    const isCalm = Math.abs(motionState.angularVel) < 55 && Math.abs(linZ) < 4.0;

    // 1. ニュートラル復帰待ちフェーズ
    // ※「正解！／パス！」表示中（800ms）の間にも裏でニュートラル復帰を検知しておくことで、
    //   次のお題が表示された瞬間に空振りせず即座に傾き判定できるようにする
    if (motionState.phase === 'WAIT_NEUTRAL') {
      if (now >= motionState.returnCheckAfter && !motionState.hasReturnedToNeutral) {
        if (isNearNeutralAngle && isCalm) {
          if (motionState.neutralStableSince === 0) {
            motionState.neutralStableSince = now;
          } else if (now - motionState.neutralStableSince >= 110) {
            motionState.hasReturnedToNeutral = true;
            motionState.baselineAngle = Math.max(-15, Math.min(50,
              motionState.baselineAngle * 0.4 + tiltAngle * 0.6
            ));
          }
        } else {
          motionState.neutralStableSince = 0;
          // 構え直して角度が変わった場合も、自然な範囲で静止していれば基準角度を寄せる
          if (tiltAngle >= -15 && tiltAngle <= 52 && isCalm) {
            motionState.baselineAngle += 0.08 * (tiltAngle - motionState.baselineAngle);
            motionState.baselineAngle = Math.max(-15, Math.min(50, motionState.baselineAngle));
          }
        }
      }

      // お題切り替え演出中（cooldownUntil）はまだ発火させないが、
      // 演出終了時点で既にニュートラルへ戻っていれば即座に NEUTRAL へ移行する
      if (now >= motionState.cooldownUntil && motionState.hasReturnedToNeutral) {
        motionState.phase = 'NEUTRAL';
        motionState.lastDownMotionTime = 0;
        motionState.lastUpMotionTime = 0;
      } else {
        return;
      }
    }

    // 2. ニュートラル待機中：ほぼ完全に静止している時のみ基準角度を微調整（ゆっくり傾けた時に基準角度が逃げるのを防ぐ）
    if (Math.abs(deltaAngle) < 8 && Math.abs(motionState.angularVel) < 15 && Math.abs(linZ) < 1.5) {
      motionState.baselineAngle += 0.02 * (tiltAngle - motionState.baselineAngle);
      motionState.baselineAngle = Math.max(-15, Math.min(50, motionState.baselineAngle));
    }

    // ニュートラル付近で落ち着いた場合は反動ガードを解除し、連続操作のレスポンスを高める
    if (Math.abs(deltaAngle) <= 8 && Math.abs(motionState.angularVel) < 35) {
      motionState.lastDownMotionTime = 0;
      motionState.lastUpMotionTime = 0;
    }

    const REBOUND_GUARD_MS = 450;

    // 下に振る / おじぎ（正解）の判定
    // ※上方向へ傾けた直後の戻し動作中や、上向きに動いている最中は発火させない
    const canTriggerCorrect =
      (now - motionState.lastUpMotionTime >= REBOUND_GUARD_MS) &&
      motionState.angularVel <= 15;
    const isDownTilt = (deltaAngle <= -23);
    const isDownSwing = (deltaAngle <= -16 && (motionState.angularVel <= -65 || linZ <= -3.8));

    if (canTriggerCorrect && (isDownTilt || isDownSwing)) {
      triggerMotionAction('correct', onAction);
      return;
    }

    // 上に振る / 天井に向ける（パス）の判定
    // ※下方向へ傾けた直後の「上に戻す動作」中や、下向きに動いている最中は発火させない
    const canTriggerPass =
      (now - motionState.lastDownMotionTime >= REBOUND_GUARD_MS) &&
      motionState.angularVel >= -15;
    const isUpTilt = (deltaAngle >= 23);
    const isUpSwing = (deltaAngle >= 16 && (motionState.angularVel >= 65 || linZ >= 3.8));

    if (canTriggerPass && (isUpTilt || isUpSwing)) {
      triggerMotionAction('pass', onAction);
      return;
    }
    return;
  }

  // フォールバック：重力センサー値が取得できず線形加速度のみの場合
  if (!accel || accel.z === null) return;
  if (isMotionCoolTime || now < motionState.cooldownUntil) return;

  const REBOUND_GUARD_MS = 600;
  const threshold = 5.5;

  if (linZ < -threshold) {
    motionState.lastDownMotionTime = now;
    if (now - motionState.lastUpMotionTime >= REBOUND_GUARD_MS) {
      triggerMotionAction('correct', onAction);
    }
  } else if (linZ > threshold) {
    motionState.lastUpMotionTime = now;
    if (now - motionState.lastDownMotionTime >= REBOUND_GUARD_MS) {
      triggerMotionAction('pass', onAction);
    }
  }
}

function triggerMotionAction(action, onAction) {
  const now = performance.now();
  // アクション発生後は必ず「ニュートラル復帰待ち」へ移行し、戻す動作での誤反応を遮断
  motionState.phase = 'WAIT_NEUTRAL';
  motionState.hasReturnedToNeutral = false;
  motionState.neutralStableSince = 0;
  motionState.returnCheckAfter = now + 220;

  // パス上限到達時はパスを実行せず、戻し動作の誤判定防止のみ設定
  if (action === 'pass' && appState.settings.passLimit !== "infinite" && appState.remainingPasses <= 0) {
    motionState.cooldownUntil = now + 350;
    return;
  }

  isMotionCoolTime = true;
  motionState.cooldownUntil = now + 820; // お題切り替え演出（800ms）に合わせる

  if (navigator.vibrate) {
    navigator.vibrate(200); 
  }

  if (typeof onAction === 'function') {
    onAction(action);
  }

  setTimeout(() => {
    isMotionCoolTime = false;
  }, 820);
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

// 環境設定を開いたとき
document.querySelectorAll('.btn-open-settings').forEach(btn => {
  btn.addEventListener('click', () => {
    appState.isPaused = true;
    
    // 4. 難易度のチェック状態反映
    document.querySelectorAll('input[name="difficulty-chk"]').forEach(chk => {
      chk.checked = appState.settings.difficulties.includes(chk.value);
    });

    // 2. 振る制御のラジオボタン反映
    const shakeRadio = document.querySelector(`input[name="shake-gyro"][value="${appState.settings.isShakeEnabled}"]`);
    if (shakeRadio) shakeRadio.checked = true;

    // 5. パス制限の反映
    const passInfiniteChk = document.getElementById('setting-pass-infinite');
    const passLimitInput = document.getElementById('setting-pass-limit');
    if (appState.settings.passLimit === "infinite") {
      passInfiniteChk.checked = true;
      passLimitInput.disabled = true;
      passLimitInput.value = 5;
    } else {
      passInfiniteChk.checked = false;
      passLimitInput.disabled = false;
      passLimitInput.value = appState.settings.passLimit;
    }

    settingsModal.classList.add('active');
    setTimeout(() => setPickerValues(appState.settings.timeLimitSec), 50);
  });
});

// パス設定変更時の即時UI連動（無制限チェックで数値入力を無効化）
document.getElementById('setting-pass-infinite')?.addEventListener('change', (e) => {
  document.getElementById('setting-pass-limit').disabled = e.target.checked;
});

// 環境設定を閉じるとき（保存処理）
document.getElementById('btn-close-settings').addEventListener('click', () => {
  appState.settings.timeLimitSec = getPickerValueSeconds();
  
  // 4. 難易度の保存
  const selectedDiffs = [];
  document.querySelectorAll('input[name="difficulty-chk"]:checked').forEach(chk => {
    selectedDiffs.push(chk.value);
  });
  appState.settings.difficulties = selectedDiffs.length > 0 ? selectedDiffs : ["1", "2", "3", "4"]; // 空なら全選択

  // 2. 振る制御の保存
  const shakeVal = document.querySelector('input[name="shake-gyro"]:checked')?.value;
  appState.settings.isShakeEnabled = (shakeVal === "true");

  // プレイ画面中に設定変更された場合、即座にセンサーの有効・無効を反映
  const isPlaying = gestureScreen.classList.contains('active') || tabooScreen.classList.contains('active');
  if (isPlaying) {
    if (appState.settings.isShakeEnabled && motionState.lastCallback) {
      startGyroGame(motionState.lastCallback);
    } else if (!appState.settings.isShakeEnabled) {
      stopGyroGame();
    }
  }

  // 5. パス制限の保存
  const isInfinite = document.getElementById('setting-pass-infinite').checked;
  if (isInfinite) {
    appState.settings.passLimit = "infinite";
  } else {
    const val = parseInt(document.getElementById('setting-pass-limit').value, 10);
    appState.settings.passLimit = isNaN(val) || val < 0 ? 0 : val;
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
          <li>スマホを横向きにして<strong>おでこに当てて</strong>画面を説明者に見せます。</li>
          <li>周りの人は画面に映ったお題をジェスチャーや言葉でヒントを出します。</li>
          <li>正解したらスマホ画面を<strong>「下（おじぎ）」</strong>に倒す。</li>
          <li>もしくは、スマホ画面を<strong>「ダブルタップ」</strong>するか<strong>「下にフリック」</strong>します。</li>
          <li>パスしたい時はスマホ画面を<strong>「上（天井）」</strong>に向ける。</li>
          <li>もしくは、スマホ画面の単語を<strong>「上にフリック」</strong>します。</li>
        </ol>
      `;
    } else {
      titleElem.textContent = "📖 カタカナーシ ルール";
      bodyElem.innerHTML = `
        <ol>
          <li>説明者は画面に表示されたお題を確認します。</li>
          <li><strong>カタカナ語（外来語・和製英語）を一切使わずに</strong>お題を説明してください。</li>
          <li>正解したらスマホ画面を<strong>「下（おじぎ）」</strong>に倒す。</li>
          <li>もしくは、スマホ画面を<strong>「ダブルタップ」</strong>するか<strong>「下にフリック」</strong>します。</li>
          <li>パスしたい時はスマホ画面を<strong>「上（天井）」</strong>に向ける。</li>
          <li>もしくは、スマホ画面の単語を<strong>「上にフリック」</strong>します。</li>
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
// 1. 共通リザルト管理（未解答/最後のお題の表示対応）
// ==================================================
let gameHistory = [];

function resetGameHistory() {
  gameHistory = [];
}

function recordGameResult(word, result) {
  if (!word) return;
  gameHistory.push({ word: word, result: result });
}

function showResultModal() {
  const resultModal = document.getElementById('result-modal');
  const resultListEl = document.getElementById('result-list');
  const resultSummaryEl = document.getElementById('result-summary');

  if (!resultModal || !resultListEl || !resultSummaryEl) return;

  const correctCount = gameHistory.filter(item => item.result === 'correct').length;
  const passCount = gameHistory.filter(item => item.result === 'pass').length;

  resultSummaryEl.innerHTML = `正解: <span style="color:#2ecc71;">${correctCount}</span> / パス: <span style="color:#e74c3c;">${passCount}</span>`;

  // 1. 履歴配列に存在する単語のテキストリストを作成
  const answeredWords = gameHistory.map(item => item.word);

  // 1. 最後に出題されていたお題がまだ解答履歴にない場合、履歴末尾に「時間切れ」として追加
  if (appState.lastActiveWord && !answeredWords.includes(appState.lastActiveWord)) {
    gameHistory.push({ word: appState.lastActiveWord, result: 'unanswered' });
  }

  if (gameHistory.length === 0) {
    resultListEl.innerHTML = `<div style="text-align:center; padding: 10px; opacity:0.7;">回答データがありません</div>`;
  } else {
    resultListEl.innerHTML = gameHistory.map(item => {
      let badgeText = '正解';
      let badgeClass = 'correct';
      if (item.result === 'pass') {
        badgeText = 'パス';
        badgeClass = 'pass';
      } else if (item.result === 'unanswered') {
        badgeText = '時間切れ';
        badgeClass = 'unanswered';
      }

      return `
        <div class="result-item" style="${item.result === 'unanswered' ? 'opacity: 0.65; background: rgba(255,255,255,0.05);' : ''}">
          <span class="word-name">${item.word}</span>
          <span class="result-divider">｜</span>
          <span class="result-badge ${badgeClass}">
            ${badgeText}
          </span>
        </div>
      `;
    }).join('');
  }

  resultModal.classList.add('active');
}

// リザルトモーダルのボタンイベント設定
document.addEventListener('DOMContentLoaded', () => {
  initPickers();

  const resultModal = document.getElementById('result-modal');
  const hideResultModal = () => {
    if (resultModal) {
      resultModal.classList.remove('active');
    }
  };

  const btnRetry = document.getElementById('btn-result-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      hideResultModal();
      if (appState.activeGame === 'gesture' || document.body.classList.contains('theme-gesture')) {
        document.getElementById('btn-gesture-start')?.click();
      } else if (appState.activeGame === 'taboo' || document.body.classList.contains('theme-taboo')) {
        document.getElementById('btn-taboo-start')?.click();
      }
    });
  }

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

  const btnToTitle = document.getElementById('btn-result-to-title');
  if (btnToTitle) {
    btnToTitle.addEventListener('click', () => {
      hideResultModal();
      document.body.classList.remove('theme-gesture', 'theme-taboo');
      appState.activeGame = null;
      showScreen(menuScreen);
    });
  }
});

// ===================================================
// 3. タッチ操作制御（ダブルタップ正解 / 上フリックパス / 下フリック正解）
// ===================================================
function startTouchGame(screenElement, onAction) {
  if (!screenElement || typeof onAction !== 'function') return;

  stopTouchGame(screenElement);

  let lastTapTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;

  screenElement._touchStartHandler = (e) => {
    if (appState.isPaused || appState.timeLeftSec <= 0) return;
    // 💡 最初のタッチ位置の座標を確実に取得
    if (e.touches && e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };

  screenElement._touchEndHandler = (e) => {
    if (appState.isPaused || appState.timeLeftSec <= 0) return;

    const currentTime = new Date().getTime();
    let touchEndX = touchStartX;
    let touchEndY = touchStartY;

    // 💡 指が離れた瞬間の座標を確実に取得
    if (e.changedTouches && e.changedTouches.length > 0) {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
    }
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY; 

    // フリックの誤判定を防ぐため、横方向のブレが少ないときだけ縦フリックを検出
    if (Math.abs(diffX) < 40) {
      // 上フリック (元々の仕様：パス)
      if (diffY > 50) {
        // 5. パス制限チェック（残数が0ならフリックを受け付けない）
        if (appState.settings.passLimit !== "infinite" && appState.remainingPasses <= 0) {
          return; 
        }
        if (navigator.vibrate) navigator.vibrate(100);
        onAction('pass');
        return;
      }
      // 3. 下フリックの追加 (仕様追加：正解)
      if (diffY < -50) {
        if (navigator.vibrate) navigator.vibrate(200);
        onAction('correct');
        return;
      }
    }

    // ダブルタップ (正解)
    if ((currentTime - lastTapTime) < 300) {
      if (navigator.vibrate) navigator.vibrate(200);
      onAction('correct');
      lastTapTime = 0;
    } else {
      lastTapTime = currentTime;
    }
  };

  screenElement.addEventListener('touchstart', screenElement._touchStartHandler, { passive: true });
  screenElement.addEventListener('touchend', screenElement._touchEndHandler, { passive: true });
}

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

// stopCommonGame の拡張
const originalStopCommonGame = stopCommonGame;
stopCommonGame = function() {
  originalStopCommonGame();
  stopTouchGame(gestureScreen);
  stopTouchGame(tabooScreen);
};

// ===================================================
// PWA・スマホでの横画面強制 ＆ 回転時のズレ完全リセット
// ===================================================
function resetLayoutOnResize() {
  if (window.innerWidth > window.innerHeight) {
    document.body.style.height = '100dvh';
    window.scrollTo(0, 0);
    
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
      activeScreen.style.display = 'none';
      setTimeout(() => {
        activeScreen.style.display = 'flex';
      }, 10);
    }
  }
}

window.addEventListener('resize', resetLayoutOnResize);
window.addEventListener('orientationchange', () => {
  setTimeout(resetLayoutOnResize, 200); 
});

// ===================================================
// 効果音（SE）生成・再生システム（Web Audio API方式）
// ===================================================
let audioCtx = null;

// スマホブラウザの音声制限を解除する関数（ゲーム開始時に実行）
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 効果音再生メイン関数
function playSE(type) {
  if (!audioCtx) return;
  
  // オーディオコンテキストが停止していたら復活させる安全策
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  if (type === 'correct') {
    // 🔔 正解音：「ピコーン！」（滑らかに跳ね上がる2ステップ電子音）
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine'; // 透き通ったサイン波
    
    // 音程の動き：523Hz(ド)から一瞬で1046Hz(高いド)へジャンプ
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(1046, now + 0.08);
    
    // 音量の動き：パッと鳴って、0.25秒で綺麗に消える
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.25);

  } else if (type === 'pass') {
    // 💨 パス音：「シュッ！」（空気を切り裂いて投げ飛ばす風切り音）
    // ホワイトノイズ（砂嵐）のバッファを生成して、リアルな摩擦音を作ります
    const bufferSize = audioCtx.sampleRate * 0.15; // 0.15秒の長さ
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    // フィルターをかけて「サーー」という高音を「シュッ」という風切り音に変換
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.15); // 投げる軌道に合わせて低音へ変化

    const gain = audioCtx.createGain();
    // 鋭く立ち上がって、お題が画面から消えるスピード感でフェードアウト
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.03); // パッと風を切る瞬間
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noiseNode.start(now);
    noiseNode.stop(now + 0.15);
  }
}
