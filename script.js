class AudioVisualizer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isRunning = false;
        this.bars = [];
        
        // 録音関連
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.recordedBlob = null;
        this.audioElement = null;
        
        this.init();
    }

    init() {
        this.setupUI();
        this.createBars();
    }

    setupUI() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.playBtn = document.getElementById('playBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.status = document.getElementById('status');
        this.visualizer = document.getElementById('visualizer');
        this.recordingInfo = document.getElementById('recordingInfo');
        this.recordingTime = document.getElementById('recordingTime');

        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.playBtn.addEventListener('click', () => this.playRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadRecording());
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
            this.status.textContent = 'Requesting microphone access...';
            
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
            
            // MediaRecorderを設定
            this.mediaRecorder = new MediaRecorder(stream);
            this.setupMediaRecorder();
            
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.recordBtn.disabled = false;
            this.status.textContent = 'Audio input active. FFT: 256 bins, Sample rate: ' + this.audioContext.sampleRate + 'Hz';
            
            this.animate();
            
        } catch (error) {
            console.error('マイクへのアクセスエラー:', error);
            this.status.textContent = 'ERROR: Microphone access denied. Check browser settings.';
        }
    }

    stop() {
        this.isRunning = false;
        
        // 録音中の場合は停止
        if (this.isRecording) {
            this.stopRecording();
        }
        
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
        this.recordBtn.disabled = true;
        this.stopRecordBtn.disabled = true;
        this.status.textContent = 'Audio input stopped. Click START to restart.';
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
            
            // バーの高さを計算（最低高さを1pxに設定）
            const barHeight = Math.max(1, value * visualizerHeight);
            
            // シンプルな黒色バー
            this.bars[i].style.height = `${barHeight}px`;
            this.bars[i].style.backgroundColor = '#000';
        }
        
        // 次のフレームをリクエスト
        requestAnimationFrame(() => this.animate());
    }

    setupMediaRecorder() {
        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            this.recordedBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            this.playBtn.disabled = false;
            this.downloadBtn.disabled = false;
        };
    }

    startRecording() {
        if (!this.mediaRecorder || this.isRecording) return;
        
        this.recordedChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        
        this.recordBtn.disabled = true;
        this.stopRecordBtn.disabled = false;
        this.recordingInfo.style.display = 'block';
        
        // 録音時間を更新するタイマー
        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            this.recordingTime.textContent = `TIME: ${elapsed}s`;
        }, 1000);
        
        this.status.textContent = 'Recording active. Data format: WebM';
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        this.recordBtn.disabled = false;
        this.stopRecordBtn.disabled = true;
        this.recordingInfo.style.display = 'none';
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        this.status.textContent = 'Recording stopped. Audio data ready for playback/download.';
    }

    playRecording() {
        if (!this.recordedBlob) return;
        
        // 既存のオーディオ要素があれば削除
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        
        // 新しいオーディオ要素を作成
        this.audioElement = new Audio();
        this.audioElement.src = URL.createObjectURL(this.recordedBlob);
        this.audioElement.controls = false;
        
        this.audioElement.onended = () => {
            this.status.textContent = 'Playback complete.';
        };
        
        this.audioElement.play();
        this.status.textContent = 'Playing recorded audio...';
    }

    downloadRecording() {
        if (!this.recordedBlob) return;
        
        const url = URL.createObjectURL(this.recordedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.status.textContent = 'File download initiated: ' + a.download;
    }
}

// ページが読み込まれたらビジュアライザーを初期化
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
