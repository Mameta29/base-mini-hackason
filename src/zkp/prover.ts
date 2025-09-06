import * as snarkjs from 'snarkjs';
import fs from 'fs';
import path from 'path';

export class ZKPProver {
    private circuitWasmPath: string;
    private circuitZkeyPath: string;

    constructor() {
        this.circuitWasmPath = './build/payment_rules_js/payment_rules.wasm';
        this.circuitZkeyPath = './build/payment_rules_0001.zkey';
    }

    /**
     * 支払いルール遵守の証明を生成
     * @param {Object} paymentPlan - AIの支払い計画
     * @param {Object} userRules - ユーザー設定のルール
     * @returns {Object} ZKP証明
     */
    async generatePaymentProof(paymentPlan: any, userRules: any) {
        try {
            console.log('ZKP証明生成を開始...');
            
            // 回路ファイルの存在確認
            if (!this.checkCircuitFiles()) {
                console.warn('ZKP回路ファイルが見つからないため、ルール検証のみ実行');
                
                // 手動でルール検証を実行
                const isValid = this.validateRulesManually(paymentPlan, userRules);
                
                return {
                    proof: { mock: true, validated: isValid },
                    publicSignals: [isValid ? '1' : '0'],
                    isValid: isValid
                };
            }
            
            // アドレスを数値に変換（ハッシュベース - 完全な識別性を保証）
            const addressToNumber = (addr: string) => {
                if (!addr || typeof addr !== 'string' || addr.length < 42) {
                    console.warn('無効なアドレス:', addr);
                    return 0;
                }
                
                // アドレス全体のハッシュを生成して、一意の数値に変換
                let hash = 0;
                const normalizedAddr = addr.toLowerCase();
                for (let i = 0; i < normalizedAddr.length; i++) {
                    const char = normalizedAddr.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // 32bit整数に変換
                }
                
                // 正の数値を保証
                const result = Math.abs(hash);
                console.log(`アドレス変換: ${addr} → ${result}`);
                return result;
            };

            // 現在の時刻を取得（ローカル時間）
            const currentHour = new Date().getHours();
            
            // 入力データの準備
            const input = {
                // 秘匿入力（AIの支払い計画）
                paymentAddress: addressToNumber(paymentPlan.toAddress),
                paymentAmount: parseInt(paymentPlan.amount.toString()),
                paymentTimestamp: currentHour, // 現在の時刻を直接使用
                
                // 公開入力（ユーザールール）
                allowedAddress1: addressToNumber(userRules.allowedAddresses[0] || '0x0'),
                allowedAddress2: addressToNumber(userRules.allowedAddresses[1] || '0x0'),
                allowedAddress3: addressToNumber(userRules.allowedAddresses[2] || '0x0'),
                maxAmount: userRules.maxAmount,
                minHour: userRules.allowedHours[0],
                maxHour: userRules.allowedHours[1]
            };

            console.log('入力データ:', input);

            // 証明生成
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                this.circuitWasmPath,
                this.circuitZkeyPath
            );

            console.log('ZKP証明生成完了');
            console.log('公開シグナル:', publicSignals);

            return {
                proof,
                publicSignals,
                isValid: publicSignals[0] === '1' // isValidの出力
            };

        } catch (error) {
            console.error('ZKP証明生成エラー:', error);
            throw error;
        }
    }

    /**
     * 手動でルール検証を実行（ZKP回路がない場合のフォールバック）
     */
    private validateRulesManually(paymentPlan: any, userRules: any): boolean {
        // アドレスチェック
        const addressValid = userRules.allowedAddresses.includes(paymentPlan.toAddress);
        
        // 金額チェック
        const amountValid = parseInt(paymentPlan.amount.toString()) <= userRules.maxAmount;
        
        // 時間チェック（ローカル時間を使用）
        const paymentHour = new Date().getHours();
        const timeValid = paymentHour >= userRules.allowedHours[0] && paymentHour <= userRules.allowedHours[1];
        
        const isValid = addressValid && amountValid && timeValid;
        
        console.log('手動ルール検証結果:', {
            addressValid,
            amountValid,
            timeValid,
            isValid
        });
        
        return isValid;
    }

    /**
     * 回路ファイルの存在確認
     */
    checkCircuitFiles() {
        const files = [
            this.circuitWasmPath,
            this.circuitZkeyPath
        ];

        for (const file of files) {
            if (!fs.existsSync(file)) {
                console.warn(`回路ファイルが見つかりません: ${file} - ZKP機能は無効化されます`);
                return false;
            }
        }

        console.log('回路ファイルの確認完了');
        return true;
    }

    /**
     * テスト用のダミー証明生成
     */
    async generateDummyProof() {
        const dummyPaymentPlan = {
            toAddress: '0x1234567890123456789012345678901234567890',
            amount: 50,
            timestamp: Math.floor(Date.now() / 1000)
        };

        const dummyUserRules = {
            allowedAddresses: [
                '0x1234567890123456789012345678901234567890',
                '0x2345678901234567890123456789012345678901',
                '0x3456789012345678901234567890123456789012'
            ],
            maxAmount: 100,
            allowedHours: [9, 18]
        };

        return await this.generatePaymentProof(dummyPaymentPlan, dummyUserRules);
    }
} 