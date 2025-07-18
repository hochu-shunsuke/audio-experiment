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
        
        // 録音環境テンプレート
        this.environmentTemplates = {
            studio: {
                name: "Studio (Quiet Room)",
                noiseGate: -50,
                lowCut: 60,
                highCut: 18000,
                compressor: 2.5,
                gain: 1.2,
                description: "Minimal processing for clean studio environment"
            },
            office_ac: {
                name: "Office with AC",
                noiseGate: -35,
                lowCut: 120,
                highCut: 12000,
                compressor: 6,
                gain: 1.5,
                description: "Aggressive low-cut to remove AC hum, moderate compression"
            },
            outdoor_cicada: {
                name: "Outdoor (Cicadas)",
                noiseGate: -25,
                lowCut: 200,
                highCut: 8000,
                compressor: 8,
                gain: 2.0,
                description: "Heavy filtering for high-frequency insect noise"
            },
            cafe: {
                name: "Cafe/Restaurant",
                noiseGate: -30,
                lowCut: 150,
                highCut: 10000,
                compressor: 5,
                gain: 1.8,
                description: "Mid-range focus, background chatter suppression"
            },
            car: {
                name: "Car Interior",
                noiseGate: -28,
                lowCut: 180,
                highCut: 9000,
                compressor: 7,
                gain: 2.2,
                description: "Road noise and engine rumble removal"
            },
            windy: {
                name: "Windy Outdoor",
                noiseGate: -20,
                lowCut: 300,
                highCut: 12000,
                compressor: 10,
                gain: 2.5,
                description: "Extreme low-cut for wind noise, heavy compression"
            },
            echo_room: {
                name: "Echo Room/Hall",
                noiseGate: -45,
                lowCut: 100,
                highCut: 15000,
                compressor: 3,
                gain: 1.3,
                description: "Moderate settings preserving natural reverb"
            },
            phone_call: {
                name: "Phone Call Quality",
                noiseGate: -35,
                lowCut: 300,
                highCut: 3400,
                compressor: 12,
                gain: 2.8,
                description: "Narrow bandwidth for clear speech transmission"
            }
        };
        
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
        
        // テンプレート関連
        this.setupTemplateControls();
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
            
            // 分析ボタンを有効化
            document.getElementById('analyzeBtn').disabled = false;
            document.getElementById('autoTemplateBtn').disabled = false;
            
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
        document.getElementById('analyzeBtn').disabled = true;
        document.getElementById('autoTemplateBtn').disabled = true;
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

    setupTemplateControls() {
        const templateSelect = document.getElementById('environmentTemplate');
        const applyBtn = document.getElementById('applyTemplate');
        const resetBtn = document.getElementById('resetTemplate');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const autoTemplateBtn = document.getElementById('autoTemplateBtn');
        
        applyBtn.addEventListener('click', () => {
            const selectedTemplate = templateSelect.value;
            if (selectedTemplate !== 'custom') {
                this.applyTemplate(selectedTemplate);
            }
        });
        
        resetBtn.addEventListener('click', () => {
            this.resetToDefault();
        });
        
        analyzeBtn.addEventListener('click', () => {
            this.analyzeEnvironment();
        });
        
        autoTemplateBtn.addEventListener('click', () => {
            this.autoSelectTemplate();
        });
        
        templateSelect.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                const template = this.environmentTemplates[e.target.value];
                if (template) {
                    this.updateStatus(`Template: ${template.description}`);
                }
            }
        });
    }

    applyTemplate(templateKey) {
        const template = this.environmentTemplates[templateKey];
        if (!template) return;
        
        // テンプレートの値を各コントロールに適用
        this.setControlValue('noiseGate', template.noiseGate);
        this.setControlValue('lowCut', template.lowCut);
        this.setControlValue('highCut', template.highCut);
        this.setControlValue('compressor', template.compressor);
        this.setControlValue('gain', template.gain);
        
        // 音響処理ノードに値を反映
        this.updateAudioProcessing();
        
        this.updateStatus(`Applied template: ${template.name} - ${template.description}`);
    }

    resetToDefault() {
        this.setControlValue('noiseGate', -40);
        this.setControlValue('lowCut', 80);
        this.setControlValue('highCut', 15000);
        this.setControlValue('compressor', 4);
        this.setControlValue('gain', 1);
        
        document.getElementById('environmentTemplate').value = 'custom';
        this.updateAudioProcessing();
        this.updateStatus('Reset to default settings');
    }

    setControlValue(controlId, value) {
        const control = document.getElementById(controlId);
        const valueDisplay = document.getElementById(controlId + 'Value');
        
        if (control && valueDisplay) {
            control.value = value;
            
            // 表示形式を更新
            let displayValue;
            switch(controlId) {
                case 'noiseGate':
                    displayValue = value + 'dB';
                    break;
                case 'lowCut':
                case 'highCut':
                    displayValue = value + 'Hz';
                    break;
                case 'compressor':
                    displayValue = value + ':1';
                    break;
                case 'gain':
                    displayValue = value + 'x';
                    break;
                default:
                    displayValue = value;
            }
            valueDisplay.textContent = displayValue;
        }
    }

    updateAudioProcessing() {
        if (!this.audioContext || !this.isRunning) return;
        
        // 各ノードのパラメータを更新
        if (this.compressorNode) {
            this.compressorNode.threshold.value = parseFloat(document.getElementById('noiseGate').value);
            this.compressorNode.ratio.value = parseFloat(document.getElementById('compressor').value);
        }
        
        if (this.highPassFilter) {
            this.highPassFilter.frequency.value = parseFloat(document.getElementById('lowCut').value);
        }
        
        if (this.lowPassFilter) {
            this.lowPassFilter.frequency.value = parseFloat(document.getElementById('highCut').value);
        }
        
        if (this.gainNode) {
            this.gainNode.gain.value = parseFloat(document.getElementById('gain').value);
        }
    }

    updateStatus(message) {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
        }
    }

    analyzeEnvironment() {
        if (!this.analyser || !this.isRunning) return;
        
        // UI要素を取得
        const analyzeBtn = document.getElementById('analyzeBtn');
        const progressDiv = document.getElementById('analysisProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const resultDiv = document.getElementById('analysisResult');
        
        // 分析開始
        analyzeBtn.disabled = true;
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        
        this.updateStatus('Starting environment analysis...');
        
        // 3秒間の分析
        const samples = [];
        const totalDuration = 3000; // 3秒
        const sampleInterval = 100; // 100ms間隔
        const totalSamples = totalDuration / sampleInterval;
        let currentSample = 0;
        
        const analyzeInterval = setInterval(() => {
            this.analyser.getByteFrequencyData(this.dataArray);
            samples.push(new Uint8Array(this.dataArray));
            currentSample++;
            
            // プログレスバーを更新
            const progress = (currentSample / totalSamples) * 100;
            progressBar.style.width = progress + '%';
            progressText.textContent = `Analyzing... ${currentSample}/${totalSamples} samples (${Math.round(progress)}%)`;
            
            this.updateStatus(`Analyzing environment... ${Math.round(progress)}% complete`);
        }, sampleInterval);
        
        setTimeout(() => {
            clearInterval(analyzeInterval);
            progressText.textContent = 'Processing results...';
            this.updateStatus('Processing analysis results...');
            
            // 少し遅延を入れて結果処理感を演出
            setTimeout(() => {
                this.processEnvironmentAnalysis(samples);
                progressDiv.style.display = 'none';
                analyzeBtn.disabled = false;
            }, 500);
        }, totalDuration);
    }

    processEnvironmentAnalysis(samples) {
        if (samples.length === 0) return;
        
        // 周波数帯域別の平均レベルを計算
        const lowFreq = this.calculateBandAverage(samples, 0, 8);      // ~100Hz
        const midLowFreq = this.calculateBandAverage(samples, 8, 24);  // 100-300Hz
        const midFreq = this.calculateBandAverage(samples, 24, 64);    // 300-800Hz
        const midHighFreq = this.calculateBandAverage(samples, 64, 96); // 800-1200Hz
        const highFreq = this.calculateBandAverage(samples, 96, 128);   // 1200Hz+
        
        // ノイズレベルと周波数特性を分析
        const avgLevel = (lowFreq + midLowFreq + midFreq + midHighFreq + highFreq) / 5;
        const dynamicRange = this.calculateDynamicRange(samples);
        
        // 推奨テンプレートを計算
        const recommendedTemplate = this.recommendTemplate(samples);
        const templateInfo = this.environmentTemplates[recommendedTemplate];
        
        // 分析結果を表示
        const result = `Environment Analysis Results:
────────────────────────────────
Frequency Band Analysis:
Low Freq (0-100Hz):     ${lowFreq.toFixed(1)} dB  ${this.getBarChart(lowFreq, -60, 0)}
Mid-Low (100-300Hz):    ${midLowFreq.toFixed(1)} dB  ${this.getBarChart(midLowFreq, -60, 0)}
Mid Freq (300-800Hz):   ${midFreq.toFixed(1)} dB  ${this.getBarChart(midFreq, -60, 0)}
Mid-High (800-1200Hz):  ${midHighFreq.toFixed(1)} dB  ${this.getBarChart(midHighFreq, -60, 0)}
High Freq (1200Hz+):    ${highFreq.toFixed(1)} dB  ${this.getBarChart(highFreq, -60, 0)}

Overall Metrics:
Average Level:          ${avgLevel.toFixed(1)} dB
Dynamic Range:          ${dynamicRange.toFixed(1)} dB
Environment Quality:    ${this.getEnvironmentQuality(avgLevel, dynamicRange)}

Detected Issues:
${this.diagnoseEnvironment(lowFreq, midLowFreq, midFreq, midHighFreq, highFreq, avgLevel, dynamicRange)}`;
        
        const resultDiv = document.getElementById('analysisResult');
        const recommendationDiv = document.getElementById('recommendationResult');
        const recommendedTemplateSpan = document.getElementById('recommendedTemplate');
        const recommendationReasonSpan = document.getElementById('recommendationReason');
        
        resultDiv.textContent = result;
        resultDiv.style.display = 'block';
        
        // 推奨テンプレートを表示
        recommendedTemplateSpan.textContent = templateInfo.name;
        recommendationReasonSpan.textContent = `Based on analysis: ${templateInfo.description}`;
        recommendationDiv.style.display = 'block';
        
        this.updateStatus(`Analysis complete! Recommended template: ${templateInfo.name}`);
    }

    calculateBandAverage(samples, startBin, endBin) {
        let total = 0;
        let count = 0;
        
        samples.forEach(sample => {
            for (let i = startBin; i < endBin && i < sample.length; i++) {
                total += sample[i];
                count++;
            }
        });
        
        const average = count > 0 ? total / count : 0;
        return 20 * Math.log10(average / 255); // Convert to dB
    }

    calculateDynamicRange(samples) {
        let maxLevel = 0;
        let minLevel = 255;
        
        samples.forEach(sample => {
            const avg = sample.reduce((sum, val) => sum + val, 0) / sample.length;
            maxLevel = Math.max(maxLevel, avg);
            minLevel = Math.min(minLevel, avg);
        });
        
        return 20 * Math.log10(maxLevel / Math.max(minLevel, 1));
    }

    diagnoseEnvironment(low, midLow, mid, midHigh, high, avg, range) {
        let diagnosis = [];
        
        if (low > -20) diagnosis.push("• Heavy low-frequency noise (AC, traffic, rumble)");
        if (midLow > -15) diagnosis.push("• Mid-low noise (voices, machinery)");
        if (high > -10) diagnosis.push("• High-frequency noise (insects, electronics)");
        if (range < 20) diagnosis.push("• Low dynamic range (compressed/noisy)");
        if (avg > -10) diagnosis.push("• High ambient noise level");
        if (avg < -40) diagnosis.push("• Very quiet environment");
        
        return diagnosis.length > 0 ? diagnosis.join('\n') : "• Relatively clean environment";
    }

    getBarChart(value, min, max) {
        const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
        const barLength = 20;
        const filledLength = Math.round(normalizedValue * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        return bar;
    }

    getEnvironmentQuality(avgLevel, dynamicRange) {
        if (avgLevel < -35 && dynamicRange > 30) return "Excellent (Studio quality)";
        if (avgLevel < -25 && dynamicRange > 25) return "Good (Clean recording)";
        if (avgLevel < -15 && dynamicRange > 20) return "Fair (Some processing needed)";
        if (avgLevel < -10) return "Poor (Heavy processing required)";
        return "Very Poor (Consider different location)";
    }

    autoSelectTemplate() {
        if (!this.analyser || !this.isRunning) return;
        
        const autoBtn = document.getElementById('autoTemplateBtn');
        const progressDiv = document.getElementById('analysisProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        autoBtn.disabled = true;
        progressDiv.style.display = 'block';
        
        this.updateStatus('Auto-analyzing environment...');
        
        // 1.5秒間の簡易分析
        const samples = [];
        const totalDuration = 1500;
        const sampleInterval = 50;
        const totalSamples = totalDuration / sampleInterval;
        let currentSample = 0;
        
        const analyzeInterval = setInterval(() => {
            this.analyser.getByteFrequencyData(this.dataArray);
            samples.push(new Uint8Array(this.dataArray));
            currentSample++;
            
            const progress = (currentSample / totalSamples) * 100;
            progressBar.style.width = progress + '%';
            progressText.textContent = `Auto-analyzing... ${Math.round(progress)}%`;
        }, sampleInterval);
        
        setTimeout(() => {
            clearInterval(analyzeInterval);
            progressText.textContent = 'Applying template...';
            
            setTimeout(() => {
                const recommendedTemplate = this.recommendTemplate(samples);
                const templateInfo = this.environmentTemplates[recommendedTemplate];
                
                this.applyTemplate(recommendedTemplate);
                document.getElementById('environmentTemplate').value = recommendedTemplate;
                
                // 推奨結果を表示
                const recommendationDiv = document.getElementById('recommendationResult');
                const recommendedTemplateSpan = document.getElementById('recommendedTemplate');
                const recommendationReasonSpan = document.getElementById('recommendationReason');
                
                recommendedTemplateSpan.textContent = templateInfo.name;
                recommendationReasonSpan.textContent = `Auto-applied: ${templateInfo.description}`;
                recommendationDiv.style.display = 'block';
                
                progressDiv.style.display = 'none';
                autoBtn.disabled = false;
                
                this.updateStatus(`Auto-applied template: ${templateInfo.name} - Settings optimized!`);
            }, 300);
        }, totalDuration);
    }

    recommendTemplate(samples) {
        const lowFreq = this.calculateBandAverage(samples, 0, 8);
        const midFreq = this.calculateBandAverage(samples, 24, 64);
        const highFreq = this.calculateBandAverage(samples, 96, 128);
        const avgLevel = (lowFreq + midFreq + highFreq) / 3;
        
        // ルールベースの推奨システム
        if (lowFreq > -15) {
            if (midFreq > -10) return 'car';
            return 'office_ac';
        }
        
        if (highFreq > -5) return 'outdoor_cicada';
        
        if (avgLevel > -15) {
            return 'cafe';
        }
        
        if (avgLevel < -35) {
            return 'studio';
        }
        
        return 'office_ac'; // デフォルト
    }
}

// ページが読み込まれたらビジュアライザーを初期化
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
