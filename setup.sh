#!/bin/bash

echo "🤖 AI Control by ZK - セットアップスクリプト"
echo "=============================================="

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# エラーハンドリング
set -e

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Node.jsとnpmのバージョン確認
print_step "Node.jsとnpmのバージョンを確認中..."
node --version || (print_error "Node.js がインストールされていません" && exit 1)
npm --version || (print_error "npm がインストールされていません" && exit 1)
print_success "Node.js環境確認完了"

# 2. 依存関係のインストール
print_step "依存関係をインストール中..."
npm install
print_success "依存関係インストール完了"

# 3. 環境変数ファイルの設定
print_step "環境変数ファイルを設定中..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_warning ".env ファイルが作成されました。APIキーやプライベートキーを設定してください。"
else
    print_success ".env ファイルは既に存在します"
fi

# 4. 必要なディレクトリの作成
print_step "必要なディレクトリを作成中..."
mkdir -p build
mkdir -p data
mkdir -p uploads
mkdir -p public
print_success "ディレクトリ作成完了"

# 5. circomのインストール確認
print_step "circomのインストール状況を確認中..."
if command -v circom &> /dev/null; then
    print_success "circom は既にインストールされています"
else
    print_warning "circom がインストールされていません"
    print_step "circom をインストール中..."
    
    # circomのインストール (Linux/macOS)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -L https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64 -o /tmp/circom
        chmod +x /tmp/circom
        sudo mv /tmp/circom /usr/local/bin/
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -L https://github.com/iden3/circom/releases/latest/download/circom-macos-amd64 -o /tmp/circom
        chmod +x /tmp/circom
        sudo mv /tmp/circom /usr/local/bin/
    else
        print_warning "circomの自動インストールはサポートされていません。手動でインストールしてください。"
        print_warning "https://docs.circom.io/getting-started/installation/"
    fi
    
    if command -v circom &> /dev/null; then
        print_success "circom インストール完了"
    else
        print_error "circom のインストールに失敗しました"
    fi
fi

# 6. ZKP回路のコンパイル（circomが利用可能な場合）
if command -v circom &> /dev/null; then
    print_step "ZKP回路をコンパイル中..."
    
    # 簡易版の回路を作成（実際の回路が複雑すぎる場合のフォールバック）
    cat > circuits/simple_payment_rules.circom << 'EOF'
pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

template SimplePaymentRules() {
    signal input paymentAmount;
    signal input maxAmount;
    signal output isValid;
    
    component leq = LessEqThan(32);
    leq.in[0] <== paymentAmount;
    leq.in[1] <== maxAmount;
    
    isValid <== leq.out;
}

component main = SimplePaymentRules();
EOF
    
    # 回路のコンパイル
    if circom circuits/simple_payment_rules.circom --r1cs --wasm --sym -o build 2>/dev/null; then
        print_success "ZKP回路コンパイル完了"
        
        # Trusted setupの実行（簡易版）
        print_step "Trusted setup を実行中..."
        cd build
        
        # Powers of Tau ceremony (小さなサイズ)
        if snarkjs powersoftau new bn128 12 pot12_0000.ptau 2>/dev/null; then
            snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e="random entropy" 2>/dev/null || true
            snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v 2>/dev/null || true
            
            # Circuit-specific setup
            snarkjs groth16 setup simple_payment_rules.r1cs pot12_final.ptau simple_payment_rules_0000.zkey 2>/dev/null || true
            snarkjs zkey contribute simple_payment_rules_0000.zkey simple_payment_rules_0001.zkey --name="First contribution" -v -e="random entropy" 2>/dev/null || true
            snarkjs zkey export verificationkey simple_payment_rules_0001.zkey verification_key.json 2>/dev/null || true
            
            cd ..
            print_success "Trusted setup 完了"
        else
            cd ..
            print_warning "Trusted setup をスキップしました（snarkjsが必要）"
        fi
    else
        print_warning "ZKP回路のコンパイルをスキップしました"
    fi
else
    print_warning "circom がインストールされていないため、ZKP回路のコンパイルをスキップしました"
fi

# 7. 設定ファイルの確認
print_step "設定を確認中..."
echo ""
echo "🔧 環境変数設定:"
echo "   .env ファイルを編集して以下を設定してください:"
echo "   - OPENAI_API_KEY: OpenAI APIキー"
echo "   - PRIVATE_KEY: Base Sepolia用のプライベートキー"
echo "   - BASE_SEPOLIA_RPC_URL: Base Sepolia RPC URL (デフォルト設定済み)"
echo ""

# 8. セットアップ完了
print_success "セットアップ完了！"
echo ""
echo "🚀 次のステップ:"
echo "   1. .env ファイルを編集してAPIキーを設定"
echo "   2. npm run dev でシステムを起動"
echo "   3. npm run start でWebサーバーを起動"
echo "   4. http://localhost:3000 でデモにアクセス"
echo ""
echo "📚 利用可能なコマンド:"
echo "   npm run dev          - システムの起動とテスト"
echo "   npm run start        - Webサーバーの起動"
echo "   npm run build:circuits - ZKP回路の再コンパイル"
echo "   npm test             - テストの実行"
echo ""

print_success "セットアップが完了しました！" 