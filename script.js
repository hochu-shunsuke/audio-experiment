class AudioVisualizer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isRunning = false;
        this.bars = [];
        
        this.init();
    }

    init() {
        this.setupUI();
        this.createBars();
    }

    setupUI() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.status = document.getElementById('status');
        this.visualizer = document.getElementById('visualizer');

        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
    }

    createBars() {
        const barCount = 64; // イコライザのバー数
        const visualizer = document.getElementById('visualizer');
        const barWidth = visualizer.offsetWidth / barCount;

        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.left = `${i * barWidth}px`;
            bar.style.width = `${barWidth - 2}px`;
            bar.style.height = '0px';
            visualizer.appendChild(bar);
            this.bars.push(bar);
        }
    }

    async start() {
        try {
            this.status.textContent = 'マイクへのアクセスを要求中...';
            
            // マイクのアクセス許可を要求
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // AudioContextを作成
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // アナライザーの設定
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            // マイクをアナライザーに接続
            this.microphone.connect(this.analyser);
            
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.status.textContent = '音声を検知中... 音を出してみてください！';
            
            this.animate();
            
        } catch (error) {
            console.error('マイクへのアクセスエラー:', error);
            this.status.textContent = 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。';
        }
    }

    stop() {
        this.isRunning = false;
        
        if (this.microphone) {
            this.microphone.disconnect();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        // バーの高さをリセット
        this.bars.forEach(bar => {
            bar.style.height = '0px';
        });
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.status.textContent = '停止しました。再度開始するには「開始」ボタンを押してください。';
    }

    animate() {
        if (!this.isRunning) return;

        // 周波数データを取得
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // バーの高さを更新
        const visualizerHeight = this.visualizer.offsetHeight;
        const barCount = Math.min(this.bars.length, this.dataArray.length);
        
        for (let i = 0; i < barCount; i++) {
            // 周波数データを0-1の範囲に正規化
            const value = this.dataArray[i] / 255.0;
            
            // バーの高さを計算（最低高さを2pxに設定）
            const barHeight = Math.max(2, value * visualizerHeight);
            
            // バーの色を音量に応じて変更
            const hue = (value * 120); // 緑から赤へ
            const saturation = 70 + (value * 30); // 70-100%
            const lightness = 50 + (value * 20); // 50-70%
            
            this.bars[i].style.height = `${barHeight}px`;
            this.bars[i].style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        
        // 次のフレームをリクエスト
        requestAnimationFrame(() => this.animate());
    }
}

// ページが読み込まれたらビジュアライザーを初期化
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
