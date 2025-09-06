# AI Control by ZK

🤖 **AIエージェントによる自動支払いをZKPで制御するPOCシステム**

このプロジェクトは、AIエージェントが請求書を解析して自動で支払いを実行する際に、ユーザーが設定したルール（支払い先、金額上限、実行時間）を**Zero-Knowledge Proof（ZKP）**で数学的に証明・検証するシステムです。

## 🎯 実装された4つの必須要件

✅ **1. ZKPの部分（本実装）**
- circom回路による支払いルール検証
- snarkJSによる証明生成・検証
- 実際のZKP証明フロー

✅ **2. AIの部分（本実装）**  
- OpenAI gpt-5-nanoによる請求書解析
- AI支払い計画立案
- ルール適合性チェック

✅ **3. Base Sepolia使用**
- 実際のBase SepoliaネットワークでのUSDC支払い
- viem.jsによるブロックチェーン連携
- トランザクション実行と確認

✅ **4. ユーザー側での動作確認**
- WebUIによる完全なデモ実行
- リアルタイム処理状況表示
- 支払い履歴とトランザクション確認

## 🚀 クイックスタート

### 1. 自動セットアップ
```bash
./setup.sh
```

### 2. 環境変数設定
`.env`ファイルを編集：
```bash
OPENAI_API_KEY=your_openai_api_key_here
PRIVATE_KEY=your_base_sepolia_private_key_here
```

### 3. システム起動
```bash
# TypeScript開発モード
npm run dev

# または本番用ビルド後起動
npm run build
npm run start:prod

# Webサーバー起動
npm run start

# ブラウザで http://localhost:3000 にアクセス
```

### 4. デモ実行
- 「🎯 デモ実行」ボタンをクリック
- 完全なフローが自動実行されます

## 📊 システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AIエージェント   │    │   ZKP証明システム  │    │  Base Sepolia    │
│                 │    │                 │    │                 │
│ ・請求書解析     │───▶│ ・ルール証明生成  │───▶│ ・USDC支払い実行  │
│ ・支払い計画立案 │    │ ・証明検証       │    │ ・トランザクション│
│ ・リスク評価     │    │ ・改ざん防止     │    │ ・残高確認       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 技術スタック

### ZKP (Zero-Knowledge Proof)
- **circom**: 回路記述言語
- **snarkJS**: 証明生成・検証ライブラリ
- **Groth16**: 証明システム

### AI (Artificial Intelligence)  
- **OpenAI gpt-5-nano**: 自然言語処理
- **PDF解析**: 請求書データ抽出
- **ルール適合性チェック**: 自動判定

### ブロックチェーン
- **Base Sepolia**: テストネットワーク
- **USDC**: 実際のステーブルコイン
- **viem.js**: Ethereum相互作用ライブラリ

### バックエンド・フロントエンド
- **TypeScript**: 型安全なコード
- **Node.js + Express**: APIサーバー
- **SQLite**: データベース
- **HTML/CSS/JavaScript**: Webインターフェース

## 📁 プロジェクト構造

```
ai-control-by-zk/
├── circuits/                 # ZKP回路ファイル
│   ├── payment_rules.circom     # メイン検証回路
│   ├── address_whitelist.circom # アドレス検証
│   └── time_constraint.circom   # 時間制約検証
├── src/
│   ├── core/                 # システム統合
│   ├── ai/                   # AI機能
│   ├── zkp/                  # ZKP証明・検証
│   ├── blockchain/           # ブロックチェーン連携
│   └── database/             # データ管理
├── public/                   # Webインターフェース
├── test/                     # テストファイル
└── build/                    # コンパイル済み回路
```

## 🎮 デモシナリオ

1. **ルール設定**: 支払い先3アドレス、上限100 USDC、9-18時のみ
2. **請求書入力**: 電力会社からの75 USDC請求書
3. **AI解析**: 請求書データの自動抽出
4. **ZKP証明**: ルール遵守の数学的証明生成
5. **証明検証**: 改ざんされていないことを確認
6. **支払い実行**: Base Sepolia上でUSDC転送
7. **結果確認**: トランザクションハッシュとブロック確認

## 🧪 テスト実行

```bash
# 全体テスト
npm test

# TypeScript型チェック
npm run type-check

# システム状態確認
npm run dev

# ZKP回路テスト
npm run build:circuits
```

## 🔒 セキュリティ機能

- **ZKP証明**: ルール違反の数学的防止
- **プライベート入力**: 支払い詳細の秘匿化
- **改ざん検証**: 証明の完全性確認
- **時間制約**: 深夜支払いの自動ブロック
- **金額上限**: 過大支払いの防止
- **アドレス制限**: 未承認先への支払い防止

## 📈 拡張可能性

このPOCは以下のような拡張が可能です：

- **複数通貨対応**: ETH、DAI等の追加
- **メール連携**: Gmail APIによる自動請求書取得  
- **LINE通知**: 支払い完了の自動通知
- **スケジュール機能**: 定期支払いの自動実行
- **マルチチェーン**: Polygon、Arbitrum等への対応

## 🤝 貢献

POC段階のため、フィードバックや改善提案を歓迎します。

## 📄 ライセンス

MIT License

---

**🎯 このPOCで証明されること:**
- ZKPによるAI行動制御の技術的実現可能性
- Base Sepolia上での実際のUSDC支払い実行  
- ユーザーフレンドリーな操作インターフェース
- 完全に動作する本実装システム（モックではない）
- **TypeScript化による型安全性とAI開発での優位性** 