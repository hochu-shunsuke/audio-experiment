# Audio Debug Console

音声録音・再生・ビジュアライザー + 録音環境最適化

## 機能

- マイク音声のリアルタイム可視化
- **録音環境テンプレート**
  - Studio (静かな部屋)
  - Office with AC (エアコン付きオフィス)
  - Outdoor Cicadas (蝉の声がする屋外)
  - Cafe/Restaurant (カフェ・レストラン)
  - Car Interior (車内)
  - Windy Outdoor (風の強い屋外)
  - Echo Room/Hall (残響のある部屋)
  - Phone Call Quality (電話品質)
- **環境分析機能**
  - 3秒間の音響環境分析
  - 周波数帯域別ノイズレベル計測
  - 自動テンプレート推奨
- **リアルタイム音質向上処理**
  - ノイズゲート
  - ローカット/ハイカットフィルター
  - コンプレッサー
  - ゲイン調整
- 音声録音（処理済み音声も録音可能）
- 録音データの再生・ダウンロード

## 使い方

1. `index.html` をブラウザで開く
2. STARTボタンでマイクアクセス許可
3. **Environment Analysis** で録音環境を分析
4. **Recording Environment Templates** でプリセット選択
   - または "Auto-Select Template" で自動選択
5. **Audio Enhancement** で細かい調整
6. RECボタンで録音開始/停止
7. PLAYで再生、DOWNLOADでファイル保存

## 専門的な特徴

- 周波数帯域別ノイズ分析 (0-100Hz, 100-300Hz, 300-800Hz, 800-1200Hz, 1200Hz+)
- ダイナミックレンジ計測
- ルールベース環境診断
- リアルタイム音響処理チェーン

## ファイル

- `index.html` - メイン画面
- `script.js` - 機能実装

## 注意

- マイクアクセス許可が必要