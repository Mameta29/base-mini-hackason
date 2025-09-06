import { createWalletClient, createPublicClient, http, keccak256, toHex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// シンプルなルールコミット用のスマートコントラクト ABI
const RULE_COMMITMENT_ABI = [
    {
        "inputs": [
            {"name": "ruleHash", "type": "bytes32"},
            {"name": "description", "type": "string"}
        ],
        "name": "commitRules",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "getUserRuleHash",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "getRuleCommitment",
        "outputs": [
            {"name": "ruleHash", "type": "bytes32"},
            {"name": "timestamp", "type": "uint256"},
            {"name": "description", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export class RuleCommitmentManager {
    private account: any;
    private contractAddress: string | null;
    private publicClient: any;
    private walletClient: any;

    constructor(privateKey: string, rpcUrl: string, contractAddress: string | null = null) {
        this.account = privateKeyToAccount(privateKey as `0x${string}`);
        this.contractAddress = contractAddress;
        
        // Public client (読み取り用)
        this.publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(rpcUrl)
        });
        
        // Wallet client (書き込み用)
        this.walletClient = createWalletClient({
            account: this.account,
            chain: baseSepolia,
            transport: http(rpcUrl)
        });
        
        console.log('RuleCommitmentManager初期化完了');
        console.log('アカウント:', this.account.address);
    }

    /**
     * ユーザールールをハッシュ化
     * @param {Object} userRules - ユーザー設定のルール
     * @returns {string} ルールハッシュ
     */
    hashRules(userRules: any): `0x${string}` {
        // ルールを正規化して文字列化
        const normalizedRules = {
            allowedAddresses: userRules.allowedAddresses.sort(), // アドレスをソート
            maxAmount: userRules.maxAmount,
            allowedHours: userRules.allowedHours,
            version: "1.0" // ルールバージョン
        };

        const rulesString = JSON.stringify(normalizedRules);
        const rulesBytes = toHex(rulesString);
        const hash = keccak256(rulesBytes);

        console.log('ルールハッシュ生成:', {
            rules: normalizedRules,
            hash: hash
        });

        return hash;
    }

    /**
     * ルールをオンチェーンにコミット
     * @param {Object} userRules - ユーザー設定のルール
     * @param {string} description - ルールの説明
     * @returns {Object} コミット結果
     */
    async commitRules(userRules: any, description: string = "Payment Rules Commitment") {
        try {
            console.log('ルールコミットを開始:', userRules);

            // ルールハッシュを生成
            const ruleHash = this.hashRules(userRules);

            // オンチェーンコミット（実際のコントラクトがある場合）
            if (this.contractAddress) {
                const { request } = await this.publicClient.simulateContract({
                    address: this.contractAddress,
                    abi: RULE_COMMITMENT_ABI,
                    functionName: 'commitRules',
                    args: [ruleHash, description],
                    account: this.account
                });

                const txHash = await this.walletClient.writeContract(request);
                
                const receipt = await this.publicClient.waitForTransactionReceipt({
                    hash: txHash
                });

                console.log('ルールコミット完了:', {
                    txHash: txHash,
                    blockNumber: receipt.blockNumber,
                    ruleHash: ruleHash
                });

                return {
                    success: true,
                    txHash: txHash,
                    blockNumber: receipt.blockNumber,
                    ruleHash: ruleHash,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            } else {
                // コントラクトがない場合はローカルでハッシュのみ生成
                console.log('コントラクトアドレスが未設定のため、ローカルハッシュのみ生成');
                
                return {
                    success: true,
                    ruleHash: ruleHash,
                    timestamp: Math.floor(Date.now() / 1000),
                    local: true // ローカル生成であることを示す
                };
            }

        } catch (error) {
            console.error('ルールコミットエラー:', error);
            
            return {
                success: false,
                error: error.message,
                ruleHash: null
            };
        }
    }

    /**
     * コミットされたルールを取得
     * @param {string} userAddress - ユーザーアドレス（省略時は自分のアドレス）
     * @returns {Object} コミットされたルール情報
     */
    async getRuleCommitment(userAddress: string | null = null) {
        try {
            const targetAddress = userAddress || this.account.address;

            if (!this.contractAddress) {
                console.log('コントラクトアドレスが未設定のため、ルール取得不可');
                return null;
            }

            const commitment = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: RULE_COMMITMENT_ABI,
                functionName: 'getRuleCommitment',
                args: [targetAddress]
            });

            return {
                ruleHash: commitment[0],
                timestamp: commitment[1],
                description: commitment[2],
                userAddress: targetAddress
            };

        } catch (error) {
            console.error('ルール取得エラー:', error);
            return null;
        }
    }

    /**
     * ルール変更の検証
     * @param {Object} newRules - 新しいルール
     * @param {string} committedRuleHash - コミット済みルールハッシュ
     * @returns {boolean} ルールが変更されているかどうか
     */
    verifyRuleChange(newRules: any, committedRuleHash: string): boolean {
        const newRuleHash = this.hashRules(newRules);
        const hasChanged = newRuleHash !== committedRuleHash;

        console.log('ルール変更検証:', {
            newHash: newRuleHash,
            committedHash: committedRuleHash,
            hasChanged: hasChanged
        });

        return hasChanged;
    }

    /**
     * 証明検証用のルールハッシュ取得
     * @param {Object} userRules - 検証対象のルール
     * @returns {string} 検証用ハッシュ
     */
    getVerificationHash(userRules: any): `0x${string}` {
        return this.hashRules(userRules);
    }

    /**
     * デモ用のルールコミット履歴生成
     * @returns {Array} コミット履歴
     */
    generateDummyCommitHistory() {
        const dummyRules = {
            allowedAddresses: [
                "0x1234567890123456789012345678901234567890",
                "0x2345678901234567890123456789012345678901",
                "0x3456789012345678901234567890123456789012"
            ],
            maxAmount: 100,
            allowedHours: [9, 18]
        };

        return [
            {
                ruleHash: this.hashRules(dummyRules),
                timestamp: Math.floor(Date.now() / 1000) - 86400, // 1日前
                description: "Initial payment rules setup",
                blockNumber: 12345
            }
        ];
    }
} 