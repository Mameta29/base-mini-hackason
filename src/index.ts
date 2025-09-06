#!/usr/bin/env node

import { PaymentSystem } from './core/payment-system.js';

async function main() {
    console.log('🤖 AI Control by ZK システムを起動中...');
    console.log('=====================================');

    try {
        // システム初期化
        const paymentSystem = new PaymentSystem();
        
        // 初期化完了まで待機
        while (!paymentSystem.initialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\n🚀 使用方法:');
        console.log('1. Webインターフェース: npm run start でサーバーを起動後、http://localhost:3000 にアクセス');
        console.log('2. デモ実行: 以下のコードを実行');
        console.log('');
        
        // 簡単なデモ実行例
        if (process.argv.includes('--demo')) {
            console.log('🎯 デモを実行中...');
            const demoResult = await paymentSystem.runDemo();
            console.log('デモ結果:', JSON.stringify(demoResult, null, 2));
        } else {
            console.log('デモを実行するには: node src/index.js --demo');
        }

        console.log('\n=====================================');
        console.log('システムの準備が完了しました！');

    } catch (error) {
        console.error('❌ システム起動エラー:', error);
        process.exit(1);
    }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
    console.log('\n👋 システムを終了しています...');
    process.exit(0);
});

// メイン関数実行
main().catch(console.error); 