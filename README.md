# 音声イコライザ ビジュアライザー

マイクから音を検知してイコライザ風にビジュアライズするシンプルなWebアプリケーションです。

## 機能

- リアルタイム音声検知
- 64バンドのイコライザ風ビジュアライゼーション
- 音量に応じた色の変化（緑→黄→赤）
- シンプルな白背景デザイン

## 使い方

1. Webブラウザで `index.html` を開く
2. 「開始」ボタンをクリック
3. マイクへのアクセス許可を与える
4. 音を出すとビジュアライザーが反応します
5. 「停止」ボタンで終了

## 技術仕様

- HTML5 Audio API (Web Audio API)
- MediaDevices API (getUserMedia)
- リアルタイム周波数分析 (AnalyserNode)
- 64個のバーによるイコライザ表示

## ブラウザ対応

- Chrome, Firefox, Safari, Edgeの最新版
- HTTPS環境またはlocalhostでの動作が必要（マイクアクセスのため）

## ファイル構成

- `index.html` - メインのHTMLファイル
- `script.js` - JavaScript（AudioVisualizer クラス）

## 注意事項

- マイクアクセス許可が必要です
- HTTPSまたはlocalhostでの実行が推奨されます
- ブラウザによってはセキュリティ設定でマイクアクセスが制限される場合があります
