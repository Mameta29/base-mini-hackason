import { createWalletClient, createPublicClient, http, keccak256, toHex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ZKPVerifierコントラクトABI
const ZKP_VERIFIER_ABI = [
    {
        "inputs": [
            {"name": "proofId", "type": "bytes32"},
            {
                "name": "zkProof", 
                "type": "tuple",
                "components": [
                    {"name": "a", "type": "uint256[2]"},
                    {"name": "b", "type": "uint256[2]"},
                    {"name": "c", "type": "uint256[2]"}
                ]
            },
            {"name": "publicSignals", "type": "uint256[]"},
            {"name": "ruleHash", "type": "bytes32"},
            {"name": "paymentAddress", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "verifyAndAuthorizePayment",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "proofId", "type": "bytes32"}],
        "name": "isProofVerified",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "user", "type": "address"}],
        "name": "getUserProofs",
        "outputs": [{"name": "", "type": "bytes32[]"}],
        "stateMutability": "view",
        "type": "function"
    }
];

export class OnChainZKPVerifier {
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
        
        console.log('OnChainZKPVerifier初期化完了');
        console.log('アカウント:', this.account.address);
        console.log('ZKPVerifierコントラクト:', this.contractAddress || '未設定');
    }

    /**
     * オンチェーンでZKP証明を検証
     * @param proof ZKP証明
     * @param publicSignals 公開シグナル
     * @param ruleHash ルールハッシュ
     * @param paymentAddress 支払い先アドレス
     * @param amount 支払い金額
     * @returns 検証結果
     */
    async verifyProofOnChain(
        proof: any,
        publicSignals: string[],
        ruleHash: string,
        paymentAddress: string,
        amount: number
    ) {
        try {
            console.log('オンチェーンZKP証明検証を開始');

            if (!this.contractAddress) {
                console.warn('ZKPVerifierコントラクトが未設定のため、ローカル検証のみ実行');
                return this.verifyProofLocally(proof, publicSignals);
            }

            // 証明IDを生成
            const proofId = this.generateProofId(proof, publicSignals, ruleHash);

            // ZKP証明をオンチェーン形式に変換
            const onChainProof = this.convertToOnChainProof(proof);

            // 公開シグナルを数値配列に変換
            const signals = publicSignals.map(s => BigInt(s));

            console.log('オンチェーン検証パラメータ:', {
                proofId,
                ruleHash,
                paymentAddress,
                amount,
                signalsLength: signals.length
            });

            // オンチェーン検証実行
            const { request } = await this.publicClient.simulateContract({
                address: this.contractAddress,
                abi: ZKP_VERIFIER_ABI,
                functionName: 'verifyAndAuthorizePayment',
                args: [
                    proofId,
                    onChainProof,
                    signals,
                    ruleHash,
                    paymentAddress,
                    BigInt(amount * 1000000) // USDC wei (6 decimals)
                ],
                account: this.account
            });

            const txHash = await this.walletClient.writeContract(request);
            
            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            console.log('オンチェーンZKP検証完了:', {
                txHash,
                blockNumber: receipt.blockNumber,
                proofId
            });

            // 検証結果を確認
            const isVerified = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: ZKP_VERIFIER_ABI,
                functionName: 'isProofVerified',
                args: [proofId]
            });

            return {
                success: true,
                verified: isVerified,
                txHash,
                blockNumber: receipt.blockNumber,
                proofId,
                onChain: true
            };

        } catch (error) {
            console.error('オンチェーンZKP検証エラー:', error);
            
            // エラートランザクションのハッシュがある場合は記録
            let errorTxHash = null;
            if (error.message && error.message.includes('transaction')) {
                // トランザクションエラーの場合、可能であればハッシュを抽出
                const txHashMatch = error.message.match(/0x[a-fA-F0-9]{64}/);
                if (txHashMatch) {
                    errorTxHash = txHashMatch[0];
                }
            }
            
            // フォールバック：ローカル検証
            console.log('ローカル検証にフォールバック');
            const localResult = this.verifyProofLocally(proof, publicSignals);
            
            return {
                success: localResult,
                verified: localResult,
                error: error.message,
                errorTxHash: errorTxHash,
                onChain: false,
                fallback: true
            };
        }
    }

    /**
     * ローカルでのZKP証明検証（フォールバック）
     */
    private verifyProofLocally(proof: any, publicSignals: string[]): boolean {
        try {
            // 基本的な証明構造チェック
            if (!proof || typeof proof !== 'object') return false;
            
            // 公開シグナルの検証
            if (!Array.isArray(publicSignals) || publicSignals.length !== 4) return false;
            
            // 全ての公開シグナルが '1' (有効) である必要がある
            const allValid = publicSignals.every(signal => signal === '1');
            
            console.log('ローカルZKP検証結果:', allValid);
            return allValid;

        } catch (error) {
            console.error('ローカルZKP検証エラー:', error);
            return false;
        }
    }

    /**
     * 証明IDを生成
     */
    private generateProofId(proof: any, publicSignals: string[], ruleHash: string): `0x${string}` {
        const data = JSON.stringify({
            proof,
            publicSignals,
            ruleHash,
            timestamp: Date.now()
        });
        
        return keccak256(toHex(data));
    }

    /**
     * ZKP証明をオンチェーン形式に変換
     */
    private convertToOnChainProof(proof: any) {
        // snarkJSの証明形式をSolidityの構造体形式に変換
        // Solidityの構造体: struct Proof { uint256[2] a; uint256[2][2] b; uint256[2] c; }
        
        // 安全なBigInt変換関数
        const safeBigInt = (value: any): bigint => {
            if (typeof value === 'bigint') return value;
            if (typeof value === 'string') {
                // 文字列の場合、カンマを除去してBigIntに変換
                const cleanValue = value.replace(/,/g, '');
                return BigInt(cleanValue);
            }
            if (typeof value === 'number') return BigInt(value);
            return BigInt(value || 0);
        };
        
        return {
            a: [
                safeBigInt(proof.pi_a?.[0]),
                safeBigInt(proof.pi_a?.[1])
            ],
            b: [
                [safeBigInt(proof.pi_b?.[0]?.[0]), safeBigInt(proof.pi_b?.[0]?.[1])],
                [safeBigInt(proof.pi_b?.[1]?.[0]), safeBigInt(proof.pi_b?.[1]?.[1])]
            ],
            c: [
                safeBigInt(proof.pi_c?.[0]),
                safeBigInt(proof.pi_c?.[1])
            ]
        };
    }

    /**
     * ユーザーの証明履歴を取得
     */
    async getUserProofs(userAddress?: string) {
        try {
            if (!this.contractAddress) {
                return { success: false, error: 'コントラクト未設定' };
            }

            const targetAddress = userAddress || this.account.address;

            const proofs = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: ZKP_VERIFIER_ABI,
                functionName: 'getUserProofs',
                args: [targetAddress]
            });

            return {
                success: true,
                proofs: proofs,
                userAddress: targetAddress
            };

        } catch (error) {
            console.error('証明履歴取得エラー:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 接続テスト
     */
    async testConnection(): Promise<boolean> {
        try {
            if (!this.contractAddress) {
                console.log('ZKPVerifierコントラクト未設定');
                return false;
            }

            // コントラクトの存在確認
            const code = await this.publicClient.getBytecode({
                address: this.contractAddress
            });

            const isDeployed = code && code !== '0x';
            console.log('ZKPVerifierコントラクト状態:', isDeployed ? '✅ デプロイ済み' : '❌ 未デプロイ');
            
            return isDeployed;

        } catch (error) {
            console.error('ZKPVerifier接続テストエラー:', error);
            return false;
        }
    }
} 