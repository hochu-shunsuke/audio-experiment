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
        
        // 音響処理関連
        this.sourceNode = null;
        this.gainNode = null;
        this.compressorNode = null;
        this.lowPassFilter = null;
        this.highPassFilter = null;
        this.destinationNode = null;
        this.processingEnabled = true;
        
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
        
        // 音響処理コントロール
        this.setupAudioControls();
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
            
            // 音響処理チェーンを構築
            this.setupAudioProcessing();
            
            // アナライザーの設定
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            // マイクを音響処理チェーンに接続
            this.connectAudioChain();
            
            // MediaRecorderを設定（処理済み音声も録音可能にする）
            if (this.processingEnabled && this.destinationNode) {
                // 処理済み音声のストリームを作成
                const processedStream = this.audioContext.createMediaStreamDestination();
                this.destinationNode.connect(processedStream);
                this.mediaRecorder = new MediaRecorder(processedStream.stream);
            } else {
                // 元の音声ストリームを使用
                this.mediaRecorder = new MediaRecorder(stream);
            }
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
        
        // 音響処理ノードの切断
        if (this.highPassFilter) this.highPassFilter.disconnect();
        if (this.lowPassFilter) this.lowPassFilter.disconnect();
        if (this.compressorNode) this.compressorNode.disconnect();
        if (this.gainNode) this.gainNode.disconnect();
        if (this.destinationNode) this.destinationNode.disconnect();
        
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

    setupAudioControls() {
        const noiseGate = document.getElementById('noiseGate');
        const lowCut = document.getElementById('lowCut');
        const highCut = document.getElementById('highCut');
        const compressor = document.getElementById('compressor');
        const gain = document.getElementById('gain');
        const enableProcessing = document.getElementById('enableProcessing');
        
        const noiseGateValue = document.getElementById('noiseGateValue');
        const lowCutValue = document.getElementById('lowCutValue');
        const highCutValue = document.getElementById('highCutValue');
        const compressorValue = document.getElementById('compressorValue');
        const gainValue = document.getElementById('gainValue');
        
        noiseGate.addEventListener('input', (e) => {
            const value = e.target.value;
            noiseGateValue.textContent = value + 'dB';
            if (this.compressorNode) {
                this.compressorNode.threshold.value = parseFloat(value);
            }
        });
        
        lowCut.addEventListener('input', (e) => {
            const value = e.target.value;
            lowCutValue.textContent = value + 'Hz';
            if (this.highPassFilter) {
                this.highPassFilter.frequency.value = parseFloat(value);
            }
        });
        
        highCut.addEventListener('input', (e) => {
            const value = e.target.value;
            highCutValue.textContent = value + 'Hz';
            if (this.lowPassFilter) {
                this.lowPassFilter.frequency.value = parseFloat(value);
            }
        });
        
        compressor.addEventListener('input', (e) => {
            const value = e.target.value;
            compressorValue.textContent = value + ':1';
            if (this.compressorNode) {
                this.compressorNode.ratio.value = parseFloat(value);
            }
        });
        
        gain.addEventListener('input', (e) => {
            const value = e.target.value;
            gainValue.textContent = value + 'x';
            if (this.gainNode) {
                this.gainNode.gain.value = parseFloat(value);
            }
        });
        
        enableProcessing.addEventListener('change', (e) => {
            this.processingEnabled = e.target.checked;
            if (this.isRunning) {
                this.reconnectAudioChain();
            }
        });
    }

    setupAudioProcessing() {
        if (!this.audioContext) return;
        
        // ゲインノード（音量調整）
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = parseFloat(document.getElementById('gain').value);
        
        // コンプレッサー（ノイズゲート効果）
        this.compressorNode = this.audioContext.createDynamicsCompressor();
        this.compressorNode.threshold.value = parseFloat(document.getElementById('noiseGate').value);
        this.compressorNode.knee.value = 30;
        this.compressorNode.ratio.value = parseFloat(document.getElementById('compressor').value);
        this.compressorNode.attack.value = 0.003;
        this.compressorNode.release.value = 0.25;
        
        // ハイパスフィルター（低音ノイズカット）
        this.highPassFilter = this.audioContext.createBiquadFilter();
        this.highPassFilter.type = 'highpass';
        this.highPassFilter.frequency.value = parseFloat(document.getElementById('lowCut').value);
        this.highPassFilter.Q.value = 1;
        
        // ローパスフィルター（高音ノイズカット）
        this.lowPassFilter = this.audioContext.createBiquadFilter();
        this.lowPassFilter.type = 'lowpass';
        this.lowPassFilter.frequency.value = parseFloat(document.getElementById('highCut').value);
        this.lowPassFilter.Q.value = 1;
        
        // 出力用のゲインノード
        this.destinationNode = this.audioContext.createGain();
    }

    connectAudioChain() {
        if (!this.microphone || !this.analyser) return;
        
        if (this.processingEnabled) {
            // 処理チェーン: マイク → ハイパス → ローパス → コンプレッサー → ゲイン → アナライザー
            this.microphone.connect(this.highPassFilter);
            this.highPassFilter.connect(this.lowPassFilter);
            this.lowPassFilter.connect(this.compressorNode);
            this.compressorNode.connect(this.gainNode);
            this.gainNode.connect(this.destinationNode);
            this.destinationNode.connect(this.analyser);
        } else {
            // 直接接続
            this.microphone.connect(this.analyser);
        }
    }

    reconnectAudioChain() {
        // 既存の接続を切断
        try {
            this.microphone.disconnect();
            if (this.highPassFilter) this.highPassFilter.disconnect();
            if (this.lowPassFilter) this.lowPassFilter.disconnect();
            if (this.compressorNode) this.compressorNode.disconnect();
            if (this.gainNode) this.gainNode.disconnect();
            if (this.destinationNode) this.destinationNode.disconnect();
        } catch (e) {
            // 接続がない場合のエラーを無視
        }
        
        // 新しい接続を作成
        this.connectAudioChain();
    }
}

// ページが読み込まれたらビジュアライザーを初期化
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
