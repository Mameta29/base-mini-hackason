# 🚀 AI Control by ZK - デプロイメントガイド

## 📋 事前準備

### 1. 必要なアカウント・API キー
- **OpenAI API キー**: GPT-5-nano 使用権限付き
- **Base Sepolia テストネット用ウォレット**: USDC と ETH が必要
- **ホスティングプラットフォームアカウント**: Railway/Render/Vercel

### 2. 現在のコントラクトアドレス
```
RULE_COMMITMENT_CONTRACT=0x1234567890123456789012345678901234567890
ZKP_VERIFIER_CONTRACT=0x1234567890123456789012345678901234567890
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## 🌐 Railway でのデプロイ（推奨）

### Step 1: Railway アカウント作成
1. [Railway.app](https://railway.app) にアクセス
2. GitHub アカウントでサインアップ
3. 新しいプロジェクトを作成

### Step 2: GitHub リポジトリ連携
1. このプロジェクトを GitHub にプッシュ
2. Railway で「Deploy from GitHub repo」を選択
3. リポジトリを選択して連携

### Step 3: 環境変数設定
Railway のダッシュボードで以下を設定:

```bash
# 必須設定
PORT=3000
NODE_ENV=production
OPENAI_API_KEY=sk-your-openai-api-key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0xyour-private-key
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
RULE_COMMITMENT_CONTRACT=0xyour-rule-contract
ZKP_VERIFIER_CONTRACT=0xyour-zkp-contract

# オプション設定
DATABASE_PATH=./data/payment_system.db
CORS_ORIGIN=*
LOG_LEVEL=info
```

### Step 4: デプロイ実行
1. 「Deploy」ボタンをクリック
2. ビルドログを確認
3. デプロイ完了後、生成された URL にアクセス

## 🎯 Render でのデプロイ

### Step 1: Render アカウント作成
1. [Render.com](https://render.com) にアクセス
2. GitHub アカウントでサインアップ

### Step 2: Web Service 作成
1. 「New Web Service」を選択
2. GitHub リポジトリを選択
3. 以下の設定を入力:

```yaml
Name: ai-control-by-zk
Environment: Node
Region: Oregon (US West)
Branch: main
Build Command: npm install && npm run build:prod
Start Command: npm run start
```

### Step 3: 環境変数設定
Render のダッシュボードで環境変数を追加

## ⚡ Vercel でのデプロイ

### Step 1: Vercel CLI インストール
```bash
npm i -g vercel
```

### Step 2: デプロイ実行
```bash
vercel --prod
```

### Step 3: 環境変数設定
```bash
vercel env add OPENAI_API_KEY
vercel env add PRIVATE_KEY
vercel env add BASE_SEPOLIA_RPC_URL
# ... 他の環境変数も同様に追加
```

## 🔧 本番環境の最適化

### 1. セキュリティ強化
- 専用ウォレットの作成
- CORS 設定の厳格化
- レート制限の実装

### 2. パフォーマンス最適化
- ZKP 回路のプリコンパイル
- データベースの永続化
- ログレベルの調整

### 3. 監視・アラート
- ヘルスチェックエンドポイント: `/api/status`
- エラーログの監視
- USDC 残高の監視

## 🎪 ハッカソン審査員向け

### デモ URL
```
本番 URL: https://your-app.railway.app
ステータス: https://your-app.railway.app/api/status
```

### テスト手順
1. ブラウザで本番 URL にアクセス
2. 「デモ実行」タブを選択
3. サンプルルールとサンプル請求書を確認
4. 「🚀 デモ実行」ボタンをクリック
5. リアルタイムログでZKP検証を確認
6. Base Sepolia での取引を Basescan で確認

### 期待される結果
- ✅ 請求書解析: AI による自動解析
- ❌ ZKP 検証: ルール違反検出 `[0,0,0,0]`
- 🔗 Base Sepolia: 取引ハッシュ表示
- 📊 技術的詳細: 公開シグナルの表示

## 🚨 トラブルシューティング

### ビルドエラー
```bash
# ローカルでテスト
npm run build:prod
npm run start
```

### 環境変数エラー
- すべての必須環境変数が設定されているか確認
- API キーの有効性を確認

### ZKP 回路エラー
- `build/` フォルダが正しく生成されているか確認
- circom のバージョン互換性を確認

## 📞 サポート

デプロイで問題が発生した場合:
1. ビルドログを確認
2. 環境変数を再確認
3. ローカル環境での動作を確認 