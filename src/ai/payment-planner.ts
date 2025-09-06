import OpenAI from 'openai';
import type { InvoiceData, PaymentPlan, UserRules, RuleCompliance, AlternativePlan, RiskAssessment } from '../types/index.js';

export class PaymentPlanner {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    /**
     * 請求書データから支払い計画を立案
     * @param {Object} invoiceData - 解析された請求書データ
     * @param {Object} userRules - ユーザー設定のルール
     * @returns {Object} 支払い計画
     */
    async createPaymentPlan(invoiceData: InvoiceData, userRules: UserRules): Promise<PaymentPlan> {
        try {
            console.log('支払い計画立案を開始');
            console.log('請求書データ:', invoiceData);
            console.log('ユーザールール:', userRules);

            // 基本的な支払い計画を生成
            const basePlan = {
                toAddress: invoiceData.paymentAddress,
                amount: invoiceData.amount,
                timestamp: Math.floor(Date.now() / 1000),
                invoiceNumber: invoiceData.invoiceNumber,
                description: invoiceData.description,
                companyName: invoiceData.companyName
            };

            // AI事前チェックをスキップ - ZKPが唯一の検証手段

            // 支払いタイミングの最適化
            const optimizedTiming = await this.optimizePaymentTiming(basePlan, userRules);

            const finalPlan = {
                ...basePlan,
                timestamp: optimizedTiming.recommendedTimestamp,
                confidence: 1.0, // ZKPで検証されるため固定
                riskAssessment: await this.assessPaymentRisk(basePlan, userRules),
                recommendedAction: 'execute' as const
            };

            console.log('最終支払い計画:', finalPlan);
            
            return finalPlan;

        } catch (error) {
            console.error('支払い計画立案エラー:', error);
            throw error;
        }
    }

    /**
     * ルール適合性をチェック
     * @param {Object} paymentPlan - 支払い計画
     * @param {Object} userRules - ユーザールール
     * @returns {Object} 適合性チェック結果
     */
    async checkRuleCompliance(paymentPlan: any, userRules: UserRules): Promise<RuleCompliance> {
        const violations = [];
        let confidence = 1.0;

        // アドレスホワイトリストチェック
        if (!userRules.allowedAddresses.includes(paymentPlan.toAddress)) {
            violations.push({
                type: 'address_not_whitelisted',
                message: `支払い先アドレス ${paymentPlan.toAddress} はホワイトリストに登録されていません`,
                severity: 'high'
            });
            confidence -= 0.4;
        }

        // 金額上限チェック
        if (paymentPlan.amount > userRules.maxAmount) {
            violations.push({
                type: 'amount_exceeds_limit',
                message: `支払い金額 ${paymentPlan.amount} が上限 ${userRules.maxAmount} を超えています`,
                severity: 'high'
            });
            confidence -= 0.4;
        }

        // 時間制約チェック（ローカル時間を使用）
        const paymentHour = new Date(paymentPlan.timestamp * 1000).getHours();
        if (paymentHour < userRules.allowedHours[0] || paymentHour > userRules.allowedHours[1]) {
            violations.push({
                type: 'time_constraint_violation',
                message: `支払い時刻 ${paymentHour}時 は許可時間帯 ${userRules.allowedHours[0]}-${userRules.allowedHours[1]}時 外です`,
                severity: 'medium'
            });
            confidence -= 0.2;
        }

        return {
            isCompliant: violations.length === 0,
            violations: violations,
            confidence: Math.max(confidence, 0)
        };
    }

    /**
     * 代替案を提案
     * @param {Object} originalPlan - 元の支払い計画
     * @param {Object} userRules - ユーザールール
     * @param {Array} violations - ルール違反リスト
     * @returns {Array} 代替案リスト
     */
    async suggestAlternatives(originalPlan: any, userRules: UserRules, violations: any[]): Promise<AlternativePlan[]> {
        const alternatives = [];

        for (const violation of violations) {
            switch (violation.type) {
                case 'address_not_whitelisted':
                    // 最も近いホワイトリストアドレスを提案
                    alternatives.push({
                        type: 'address_substitution',
                        suggestion: `代替支払い先: ${userRules.allowedAddresses[0]}`,
                        modifiedPlan: {
                            ...originalPlan,
                            toAddress: userRules.allowedAddresses[0]
                        }
                    });
                    break;

                case 'amount_exceeds_limit':
                    // 分割支払いを提案
                    const splitAmount = userRules.maxAmount;
                    alternatives.push({
                        type: 'split_payment',
                        suggestion: `分割支払い: ${splitAmount} USDC ずつに分割`,
                        modifiedPlan: {
                            ...originalPlan,
                            amount: splitAmount,
                            splitInfo: {
                                totalAmount: originalPlan.amount,
                                installments: Math.ceil(originalPlan.amount / splitAmount)
                            }
                        }
                    });
                    break;

                case 'time_constraint_violation':
                    // 次の許可時間を提案
                    const nextAllowedTime = this.getNextAllowedTime(userRules.allowedHours);
                    alternatives.push({
                        type: 'delayed_payment',
                        suggestion: `遅延実行: ${new Date(nextAllowedTime * 1000).toLocaleString()}`,
                        modifiedPlan: {
                            ...originalPlan,
                            timestamp: nextAllowedTime
                        }
                    });
                    break;
            }
        }

        return alternatives;
    }

    /**
     * 支払いタイミングを最適化
     * @param {Object} paymentPlan - 支払い計画
     * @param {Object} userRules - ユーザールール
     * @returns {Object} 最適化されたタイミング
     */
    async optimizePaymentTiming(paymentPlan: any, userRules: UserRules): Promise<any> {
        const currentTime = Math.floor(Date.now() / 1000);
        const currentHour = new Date(currentTime * 1000).getHours();

        // 許可時間内かチェック
        if (currentHour >= userRules.allowedHours[0] && currentHour <= userRules.allowedHours[1]) {
            return {
                recommendedTimestamp: currentTime,
                reason: '現在時刻が許可時間内のため即座に実行'
            };
        }

        // 次の許可時間を計算
        const nextAllowedTime = this.getNextAllowedTime(userRules.allowedHours);
        
        return {
            recommendedTimestamp: nextAllowedTime,
            reason: `現在時刻が許可時間外のため、次の許可時間 ${new Date(nextAllowedTime * 1000).toLocaleString()} まで待機`
        };
    }

    /**
     * 支払いリスクを評価
     * @param {Object} paymentPlan - 支払い計画
     * @param {Object} userRules - ユーザールール
     * @returns {Object} リスク評価
     */
    async assessPaymentRisk(paymentPlan: any, userRules: UserRules): Promise<RiskAssessment> {
        let riskScore = 0;
        const riskFactors = [];

        // 金額リスク
        const amountRatio = paymentPlan.amount / userRules.maxAmount;
        if (amountRatio > 0.8) {
            riskScore += 0.3;
            riskFactors.push('高額支払い');
        }

        // 新規アドレスリスク（簡易版）
        if (!userRules.allowedAddresses.includes(paymentPlan.toAddress)) {
            riskScore += 0.5;
            riskFactors.push('未認証アドレス');
        }

        // 時間外リスク（ローカル時間を使用）
        const paymentHour = new Date(paymentPlan.timestamp * 1000).getHours();
        if (paymentHour < userRules.allowedHours[0] || paymentHour > userRules.allowedHours[1]) {
            riskScore += 0.2;
            riskFactors.push('時間外実行');
        }

        return {
            riskScore: Math.min(riskScore, 1.0),
            riskLevel: riskScore < 0.3 ? 'low' : riskScore < 0.7 ? 'medium' : 'high',
            riskFactors: riskFactors
        };
    }

    /**
     * 次の許可時間を取得
     * @param {Array} allowedHours - 許可時間帯 [開始時, 終了時]
     * @returns {number} 次の許可時間のタイムスタンプ
     */
    getNextAllowedTime(allowedHours: number[]): number {
        const now = new Date();
        const currentHour = now.getHours();
        
        // 今日の許可時間開始時刻
        const todayStart = new Date(now);
        todayStart.setHours(allowedHours[0] || 0, 0, 0, 0);

        // 現在時刻が許可時間前の場合
        if (currentHour < (allowedHours[0] || 0)) {
            return Math.floor(todayStart.getTime() / 1000);
        }
        
        // 明日の許可時間開始時刻
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        
        return Math.floor(tomorrowStart.getTime() / 1000);
    }

    /**
     * テスト用のダミー支払い計画生成
     */
    generateDummyPaymentPlan() {
        return {
            toAddress: "0x1234567890123456789012345678901234567890",
            amount: 75,
            timestamp: Math.floor(Date.now() / 1000),
            invoiceNumber: "INV-2024-001",
            description: "電力料金 - 2023年12月分",
            companyName: "Tokyo Electric Power Company",
            confidence: 0.95,
            recommendedAction: 'execute'
        };
    }
} 