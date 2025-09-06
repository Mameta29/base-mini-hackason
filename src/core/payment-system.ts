import dotenv from 'dotenv';
import { InvoiceParser } from '../ai/invoice-parser.js';
import { PaymentPlanner } from '../ai/payment-planner.js';
import { ZKPProver } from '../zkp/prover.js';
import { ZKPVerifier } from '../zkp/verifier.js';
import { USDCPaymentExecutor } from '../blockchain/usdc-payment.js';
import { RuleCommitmentManager } from '../blockchain/rule-commitment.js';
import { OnChainZKPVerifier } from '../blockchain/onchain-zkp-verifier.js';
import { DatabaseManager } from '../database/db-manager.js';
import type { 
  UserRules, 
  PaymentInput, 
  ProcessResult, 
  SystemStatus, 
  DemoResult,
  InvoiceData,
  PaymentPlan,
  ZKPProof
} from '../types/index.js';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

export class PaymentSystem {
    public initialized: boolean = false;
    private invoiceParser!: InvoiceParser;
    private paymentPlanner!: PaymentPlanner;
    private zkpProver!: ZKPProver;
    private zkpVerifier!: ZKPVerifier;
    private onChainZKPVerifier!: OnChainZKPVerifier;
    private paymentExecutor!: USDCPaymentExecutor;
    private ruleManager!: RuleCommitmentManager;
    public db!: DatabaseManager;
    private logCallback?: (processId: string, phase: string, status: 'active' | 'completed' | 'failed', message: string, details?: any) => void;

    constructor() {
        this.initializeComponents();
    }

    /**
     * ログコールバック関数を設定
     */
    setLogCallback(callback: (processId: string, phase: string, status: 'active' | 'completed' | 'failed', message: string, details?: any) => void) {
        this.logCallback = callback;
    }

    /**
     * リアルタイムログを送信
     */
    private sendLog(processId: string, phase: string, status: 'active' | 'completed' | 'failed', message: string, details?: any) {
        console.log(`[${phase}] ${status}: ${message}`);
        if (this.logCallback) {
            this.logCallback(processId, phase, status, message, details);
        }
    }

    /**
     * システムコンポーネントを初期化
     */
    async initializeComponents() {
        try {
            console.log('支払いシステムを初期化中...');

            // AI コンポーネント
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
                throw new Error('OPENAI_API_KEY環境変数が設定されていません');
            }
            this.invoiceParser = new InvoiceParser(openaiKey);
            this.paymentPlanner = new PaymentPlanner(openaiKey);

            // ZKP コンポーネント
            this.zkpProver = new ZKPProver();
            this.zkpVerifier = new ZKPVerifier();

            // ブロックチェーン コンポーネント
            const privateKey = process.env.PRIVATE_KEY;
            const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
            const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
            const ruleCommitmentAddress = process.env.RULE_COMMITMENT_CONTRACT;
            const zkpVerifierAddress = process.env.ZKP_VERIFIER_CONTRACT;
            
            if (!privateKey) {
                throw new Error('PRIVATE_KEY環境変数が設定されていません');
            }
            
            this.paymentExecutor = new USDCPaymentExecutor(privateKey, rpcUrl, usdcAddress);
            this.ruleManager = new RuleCommitmentManager(privateKey, rpcUrl, ruleCommitmentAddress);
            this.onChainZKPVerifier = new OnChainZKPVerifier(privateKey, rpcUrl, zkpVerifierAddress);

            // データベース
            this.db = new DatabaseManager(process.env.DB_PATH || './data/payment_system.db');
            await this.db.initialize();

            // 接続テスト
            await this.testConnections();

            this.initialized = true;
            console.log('支払いシステム初期化完了');

        } catch (error) {
            console.error('システム初期化エラー:', error);
            throw error;
        }
    }

    /**
     * 全体の支払いフローを実行
     */
    async processPayment(input: PaymentInput, userRules: UserRules, customProcessId?: string): Promise<ProcessResult> {
        try {

            const processId = customProcessId || `payment_${Date.now()}`;
            let invoiceData: InvoiceData;
            let paymentPlan: PaymentPlan;
            
            // 1. 請求書解析
            this.sendLog(processId, 'parse', 'active', '請求書解析を開始しています...');
            
            if (input.type === 'pdf' && input.path) {
                invoiceData = await this.invoiceParser.parseInvoicePDF(input.path);
            } else if (input.type === 'text' && input.content) {
                invoiceData = await this.invoiceParser.parseInvoiceText(input.content);
            } else {
                // デモ用ダミーデータ
                invoiceData = this.invoiceParser.generateDummyInvoice();
            }

            await this.db.saveProcessingLog(processId, 'invoice_parsed', invoiceData);
            this.sendLog(processId, 'parse', 'completed', `請求書解析完了 (信頼度: ${invoiceData.confidence})`, { invoiceData });

            // 2. 支払い計画立案
            this.sendLog(processId, 'plan', 'active', '支払い計画を立案中...');
            paymentPlan = await this.paymentPlanner.createPaymentPlan(invoiceData, userRules) as PaymentPlan;
            
            await this.db.saveProcessingLog(processId, 'payment_planned', paymentPlan);
            this.sendLog(processId, 'plan', 'completed', `支払い計画完了: ${paymentPlan.amount} USDC → ${paymentPlan.toAddress}`, { paymentPlan });

            // 3. ZKP証明生成（ルール違反チェックを含む）
            this.sendLog(processId, 'zkp', 'active', 'ゼロ知識証明を生成中...');
            const zkpResult = await this.zkpProver.generatePaymentProof(paymentPlan, userRules);
            
            await this.db.saveProcessingLog(processId, 'zkp_generated', { 
                isValid: zkpResult.isValid,
                proofHash: this.hashProof(zkpResult.proof)
            });

            // ZKP証明結果の詳細チェック（circom回路の出力順序に合わせて修正）
            const violationSignals = zkpResult.publicSignals;
            const isOverallValid = violationSignals[0] === '1';  // isValid
            const isAddressValid = violationSignals[1] === '1';  // addressValid
            const isAmountValid = violationSignals[2] === '1';   // amountValid
            const isTimeValid = violationSignals[3] === '1';     // timeValid

            if (!zkpResult.isValid || !isOverallValid) {
                console.log('ZKP証明によりルール違反検出');
                
                // 違反詳細を分析
                const violations = [];
                if (!isAddressValid) violations.push('アドレス未許可');
                if (!isAmountValid) violations.push('金額上限超過');
                if (!isTimeValid) violations.push('時間制約違反');
                
                this.sendLog(processId, 'zkp', 'failed', `ZKP証明: ルール違反検出 (${violations.join(', ')})`, {
                    violationSignals,
                    violations,
                    zkpResult
                });
                
                return {
                    success: false,
                    status: 'zkp_failed' as const,
                    processId: processId,
                    invoiceData: invoiceData,
                    paymentPlan: paymentPlan,
                    zkpProof: {
                        isValid: false,
                        verified: false,
                        publicSignals: violationSignals,
                        violations: violations
                    },
                    message: `ZKP証明によりルール違反が検出されました: ${violations.join(', ')}`,
                    timestamp: Math.floor(Date.now() / 1000)
                } as any;
            }

            this.sendLog(processId, 'zkp', 'completed', `ZKP証明生成完了 (公開シグナル: [${zkpResult.publicSignals.join(', ')}])`, { zkpResult });

            // 4. オンチェーンZKP証明検証
            this.sendLog(processId, 'commit', 'active', 'ルールをオンチェーンにコミット中...');
            
            // まずルールコミットを実行してハッシュを取得
            const commitResult = await this.ruleManager.commitRules(userRules);
            const ruleHash = commitResult.ruleHash;
            
            await this.db.saveProcessingLog(processId, 'rule_committed', commitResult);
            this.sendLog(processId, 'commit', 'completed', `ルールコミット完了 (ハッシュ: ${ruleHash.substring(0, 10)}...)`, { commitResult });
            
            // オンチェーンZKP検証
            this.sendLog(processId, 'verify', 'active', 'オンチェーンでZKP証明を検証中...');
            const onChainVerification = await this.onChainZKPVerifier.verifyProofOnChain(
                zkpResult.proof,
                zkpResult.publicSignals,
                ruleHash,
                paymentPlan.toAddress,
                paymentPlan.amount
            );
            
            const isVerified = typeof onChainVerification === 'boolean' ? 
                onChainVerification : 
                onChainVerification.verified;
            
            if (!isVerified) {
                console.log('オンチェーンZKP証明検証失敗');
                return {
                    success: false,
                    status: 'verification_failed' as const,
                    processId: processId,
                    message: typeof onChainVerification === 'object' && onChainVerification.onChain ? 
                        'オンチェーンZKP証明の検証に失敗しました。' : 
                        'ZKP証明の検証に失敗しました（ローカル検証）。',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            await this.db.saveProcessingLog(processId, 'zkp_verified', { 
                verified: true,
                onChain: typeof onChainVerification === 'object' ? onChainVerification.onChain : false,
                txHash: typeof onChainVerification === 'object' ? onChainVerification.txHash : null,
                proofId: typeof onChainVerification === 'object' ? onChainVerification.proofId : null
            });

            const verifyTxHash = typeof onChainVerification === 'object' ? onChainVerification.txHash : null;
            const isOnChain = typeof onChainVerification === 'object' ? onChainVerification.onChain : false;
            
            if (isOnChain && verifyTxHash) {
                this.sendLog(processId, 'verify', 'completed', 'オンチェーン検証完了', { 
                    txHash: verifyTxHash,
                    onChain: true
                });
            } else {
                // エラーの詳細を含めて送信
                const errorDetails = typeof onChainVerification === 'object' ? onChainVerification.error : '不明なエラー';
                const errorTxHash = typeof onChainVerification === 'object' ? onChainVerification.errorTxHash : null;
                
                this.sendLog(processId, 'verify', 'completed', `ローカル検証完了 (オンチェーン失敗 → 代替実行)`, { 
                    onChain: false,
                    fallback: true,
                    error: errorDetails,
                    errorTxHash: errorTxHash,
                    localVerified: true
                });
            }

            // 5. 支払い実行
            this.sendLog(processId, 'payment', 'active', `USDC支払いを実行中... (${paymentPlan.amount} USDC → ${paymentPlan.toAddress.substring(0, 10)}...)`);
            const paymentResult = await this.paymentExecutor.executePayment(paymentPlan);
            
            await this.db.saveProcessingLog(processId, 'payment_executed', paymentResult);

            if (paymentResult.success) {
                this.sendLog(processId, 'payment', 'completed', `USDC支払い完了 (${paymentPlan.amount} USDC)`, { 
                    txHash: paymentResult.txHash,
                    blockNumber: paymentResult.blockNumber
                });
            } else {
                this.sendLog(processId, 'payment', 'failed', `支払い失敗: ${paymentResult.error}`);
            }

            // 6. 結果保存
            const finalResult = {
                success: paymentResult.success,
                status: paymentResult.success ? 'completed' as const : 'payment_failed' as const,
                processId: processId,
                invoiceData: invoiceData,
                paymentPlan: paymentPlan,
                zkpProof: {
                    isValid: zkpResult.isValid,
                    verified: isVerified,
                    publicSignals: zkpResult.publicSignals,
                    proofHash: this.hashProof(zkpResult.proof),
                    onChain: typeof onChainVerification === 'object' ? onChainVerification.onChain : false,
                    txHash: typeof onChainVerification === 'object' ? onChainVerification.txHash : null,
                    proofId: typeof onChainVerification === 'object' ? onChainVerification.proofId : null
                },
                ruleCommitment: commitResult,
                onChainVerification: typeof onChainVerification === 'object' ? onChainVerification : null,
                paymentResult: paymentResult,
                timestamp: Math.floor(Date.now() / 1000)
            };

            await this.db.savePaymentRecord(finalResult);


            return finalResult;

        } catch (error) {
            console.error('支払い処理エラー:', error);
            const errorProcessId = `error_${Date.now()}`;
            
            await this.db.saveProcessingLog(errorProcessId, 'error', { 
                error: (error as Error).message,
                stack: (error as Error).stack 
            });

            return {
                success: false,
                status: 'error' as const,
                processId: errorProcessId,
                error: (error as Error).message,
                timestamp: Math.floor(Date.now() / 1000)
            };
        }
    }

    /**
     * ユーザールールをコミット
     */
    async commitUserRules(userRules: UserRules) {
        try {
            console.log('ユーザールールコミットを開始');

            const commitResult = await this.ruleManager.commitRules(userRules);
            
            if (commitResult.success) {
                await this.db.saveRuleCommitment(commitResult);
                console.log('ルールコミット完了:', commitResult.ruleHash);
            }

            return commitResult;

        } catch (error) {
            console.error('ルールコミットエラー:', error);
            throw error;
        }
    }

    /**
     * システム状態を取得
     */
    async getSystemStatus(): Promise<SystemStatus> {
        try {
            const status = {
                initialized: this.initialized,
                components: {
                    ai: !!this.invoiceParser && !!this.paymentPlanner,
                    zkp: !!this.zkpProver && !!this.zkpVerifier,
                    blockchain: false,
                    database: false
                },
                connections: {} as any,
                balance: null
            };

            if (this.paymentExecutor) {
                status.connections.blockchain = await this.paymentExecutor.testConnection();
                status.components.blockchain = status.connections.blockchain;
                
                if (status.connections.blockchain) {
                    status.balance = await this.paymentExecutor.getBalance();
                }
            }

            if (this.db) {
                status.components.database = await this.db.testConnection();
            }

            return status;

        } catch (error) {
            console.error('システム状態取得エラー:', error);
            return {
                initialized: false,
                components: { ai: false, zkp: false, blockchain: false, database: false },
                connections: {},
                error: (error as Error).message
            } as SystemStatus;
        }
    }

    /**
     * 支払い履歴を取得
     */
    async getPaymentHistory(limit: number = 10) {
        try {
            return await this.db.getPaymentHistory(limit);
        } catch (error) {
            console.error('支払い履歴取得エラー:', error);
            return [];
        }
    }

    /**
     * デモ用の完全なフロー実行
     */
    async runDemo(): Promise<DemoResult> {
        try {
            console.log('デモフロー開始');

            // デモ用のユーザールール
            const demoRules: UserRules = {
                allowedAddresses: [
                    "0xF2431b618B5b02923922c525885DBfFcdb9DE853", // 電力会社
                    "0xE2F2E032B02584e81437bA8Df18F03d6771F9d23"  // 水道局
                ],
                maxAmount: 10,
                allowedHours: [9, 18]
            };

            // デモ用の請求書入力
            const demoInput: PaymentInput = {
                type: 'demo',
                content: 'デモ請求書データ'
            };

            // ルールコミット
            const commitResult = await this.commitUserRules(demoRules);
            
            // 支払い処理実行
            const paymentResult = await this.processPayment(demoInput, demoRules);

            return {
                demo: true,
                ruleCommitment: commitResult as any,
                paymentProcess: paymentResult,
                timestamp: Math.floor(Date.now() / 1000)
            };

        } catch (error) {
            console.error('デモ実行エラー:', error);
            throw error;
        }
    }

    /**
     * 接続テスト
     */
    async testConnections() {
        console.log('接続テストを実行中...');

        // ZKP回路ファイルの確認
        try {
            const circuitFilesExist = this.zkpProver.checkCircuitFiles();
            const verificationKeyExists = this.zkpVerifier.checkVerificationKey();
            
            if (circuitFilesExist && verificationKeyExists) {
                console.log('✓ ZKP回路ファイル確認完了');
            } else {
                console.warn('⚠ ZKP回路ファイル未設定（手動検証モードで動作）');
            }
        } catch (error) {
            console.warn('⚠ ZKP回路ファイル未設定（後でセットアップが必要）:', (error as Error).message);
        }

        // ブロックチェーン接続テスト
        try {
            await this.paymentExecutor.testConnection();
            console.log('✓ Base Sepolia接続確認完了');
        } catch (error) {
            console.warn('⚠ Base Sepolia接続エラー:', error.message);
        }
    }

    /**
     * 証明のハッシュを生成（ログ用）
     */
    private hashProof(proof: any): string {
        return `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * ルール違反時の公開シグナルを生成
     */
    private generateViolationSignals(paymentPlan: any, userRules: UserRules): string[] {
        // [isValid, addressValid, amountValid, timeValid]
        const signals = ['0', '0', '0', '0']; // デフォルトは全て無効
        
        // アドレス検証
        if (userRules.allowedAddresses.includes(paymentPlan.toAddress)) {
            signals[1] = '1'; // addressValid
        }
        
        // 金額検証
        if (parseFloat(paymentPlan.amount) <= userRules.maxAmount) {
            signals[2] = '1'; // amountValid
        }
        
        // 時間検証（現在時刻で判定）
        const currentHour = new Date().getHours();
        if (currentHour >= userRules.allowedHours[0] && currentHour <= userRules.allowedHours[1]) {
            signals[3] = '1'; // timeValid
        }
        
        // 全て有効な場合のみisValidを1に
        if (signals[1] === '1' && signals[2] === '1' && signals[3] === '1') {
            signals[0] = '1'; // isValid
        }
        
        return signals;
    }
} 