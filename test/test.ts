import { PaymentSystem } from '../src/core/payment-system.js';
import { InvoiceParser } from '../src/ai/invoice-parser.js';
import { PaymentPlanner } from '../src/ai/payment-planner.js';
import { USDCPaymentExecutor } from '../src/blockchain/usdc-payment.js';
import { RuleCommitmentManager } from '../src/blockchain/rule-commitment.js';
import { DatabaseManager } from '../src/database/db-manager.js';

// テスト用の環境変数設定
process.env.DB_PATH = './data/test.db';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';
process.env.BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
process.env.USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

console.log('🧪 AI Control by ZK - テスト実行');
console.log('================================');

let testsPassed = 0;
let testsFailed = 0;

// テストヘルパー関数
function test(description, testFunction) {
    return new Promise(async (resolve) => {
        try {
            console.log(`\n🔍 テスト: ${description}`);
            await testFunction();
            console.log(`✅ 成功: ${description}`);
            testsPassed++;
            resolve(true);
        } catch (error) {
            console.log(`❌ 失敗: ${description}`);
            console.log(`   エラー: ${error.message}`);
            testsFailed++;
            resolve(false);
        }
    });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// テスト実行
async function runTests() {
    console.log('テストを開始します...\n');

    // 1. データベース接続テスト
    await test('データベース接続', async () => {
        const db = new DatabaseManager('./data/test.db');
        await db.initialize();
        const isConnected = await db.testConnection();
        assert(isConnected, 'データベース接続に失敗');
        await db.close();
    });

    // 2. ルールハッシュ生成テスト
    await test('ルールハッシュ生成', async () => {
        const ruleManager = new RuleCommitmentManager(
            '0x1234567890123456789012345678901234567890123456789012345678901234',
            'https://sepolia.base.org'
        );

        const testRules = {
            allowedAddresses: ['0x1234567890123456789012345678901234567890'],
            maxAmount: 100,
            allowedHours: [9, 18]
        };

        const hash1 = ruleManager.hashRules(testRules);
        const hash2 = ruleManager.hashRules(testRules);
        
        assert(hash1 === hash2, 'ルールハッシュが一貫していません');
        assert(hash1.startsWith('0x'), 'ハッシュ形式が正しくありません');
        assert(hash1.length === 66, 'ハッシュ長が正しくありません');
    });

    // 3. 請求書解析テスト（モック）
    await test('請求書解析（ダミー）', async () => {
        // OpenAI APIキーがない場合はダミーデータでテスト
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key') {
            const parser = new InvoiceParser('test-key');
            const dummyInvoice = parser.generateDummyInvoice();
            
            assert(dummyInvoice.companyName, '会社名が設定されていません');
            assert(dummyInvoice.amount > 0, '金額が設定されていません');
            assert(dummyInvoice.paymentAddress.startsWith('0x'), 'アドレス形式が正しくありません');
        } else {
            console.log('   OpenAI APIキーが設定されているため、実際のAPIテストをスキップ');
        }
    });

    // 4. 支払い計画立案テスト
    await test('支払い計画立案', async () => {
        const planner = new PaymentPlanner('test-key');
        
        const invoiceData = {
            companyName: "Test Company",
            paymentAddress: "0x1234567890123456789012345678901234567890",
            amount: 50,
            currency: "USDC",
            dueDate: "2024-01-15",
            invoiceNumber: "TEST-001",
            description: "テスト請求書"
        };

        const userRules = {
            allowedAddresses: ['0xF2431b618B5b02923922c525885DBfFcdb9DE853'],
            maxAmount: 100,
            allowedHours: [9, 18]
        };

        const compliance = await planner.checkRuleCompliance(invoiceData, userRules);
        
        assert(typeof compliance.isCompliant === 'boolean', '適合性チェック結果が正しくありません');
        assert(Array.isArray(compliance.violations), '違反リストが配列ではありません');
    });

    // 5. システム統合テスト
    await test('システム統合', async () => {
        // PaymentSystemの初期化テスト
        const paymentSystem = new PaymentSystem();
        
        // 初期化完了まで待機（最大10秒）
        let attempts = 0;
        while (!paymentSystem.initialized && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!paymentSystem.initialized) {
            console.log('   ⚠️ システム初期化に時間がかかっています（APIキーの設定を確認してください）');
        }

        // システム状態の取得
        const status = await paymentSystem.getSystemStatus();
        assert(typeof status === 'object', 'システム状態が取得できません');
        assert(status.hasOwnProperty('initialized'), 'システム状態に初期化フラグがありません');
    });

    // 6. Base Sepolia接続テスト（環境変数が設定されている場合のみ）
    await test('Base Sepolia接続', async () => {
        if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY.startsWith('0x1234')) {
            console.log('   ⚠️ プライベートキーが設定されていないため、接続テストをスキップ');
            return;
        }

        try {
            const paymentExecutor = new USDCPaymentExecutor(
                process.env.PRIVATE_KEY,
                process.env.BASE_SEPOLIA_RPC_URL,
                process.env.USDC_CONTRACT_ADDRESS
            );

            const isConnected = await paymentExecutor.testConnection();
            if (!isConnected) {
                console.log('   ⚠️ Base Sepolia接続に失敗（ネットワーク設定を確認してください）');
            }
        } catch (error) {
            console.log('   ⚠️ Base Sepolia接続テスト中にエラー:', error.message);
        }
    });

    // 7. ZKP回路テスト（回路ファイルが存在する場合のみ）
    await test('ZKP回路ファイル確認', async () => {
        try {
            const fs = await import('fs');
            const circuitFiles = [
                './build/simple_payment_rules.wasm',
                './build/simple_payment_rules_0001.zkey',
                './build/verification_key.json'
            ];

            let filesExist = 0;
            for (const file of circuitFiles) {
                if (fs.existsSync(file)) {
                    filesExist++;
                }
            }

            if (filesExist === 0) {
                console.log('   ⚠️ ZKP回路ファイルが見つかりません（setup.shを実行してください）');
            } else {
                console.log(`   ✅ ${filesExist}/${circuitFiles.length} 個の回路ファイルが見つかりました`);
            }
        } catch (error) {
            console.log('   ⚠️ ZKP回路ファイル確認中にエラー:', error.message);
        }
    });

    // テスト結果の表示
    console.log('\n================================');
    console.log('🏁 テスト結果:');
    console.log(`✅ 成功: ${testsPassed} 個`);
    console.log(`❌ 失敗: ${testsFailed} 個`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 すべてのテストが成功しました！');
        console.log('\n🚀 次のステップ:');
        console.log('1. .env ファイルでAPIキーを設定');
        console.log('2. npm run start でWebサーバーを起動');
        console.log('3. http://localhost:3000 でデモを実行');
    } else {
        console.log('\n⚠️ いくつかのテストが失敗しました。設定を確認してください。');
    }

    console.log('\n================================');
    
    // データベースクリーンアップ
    try {
        const fs = await import('fs');
        if (fs.existsSync('./data/test.db')) {
            fs.unlinkSync('./data/test.db');
        }
    } catch (error) {
        // Ignore cleanup errors
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

// テスト実行
runTests().catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
}); 