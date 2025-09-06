import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Base Sepolia USDC Contract ABI (主要な関数のみ)
const USDC_ABI = [
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }
];

export class USDCPaymentExecutor {
    private account: any;
    private contractAddress: string;
    private publicClient: any;
    private walletClient: any;

    constructor(privateKey: string, rpcUrl: string, contractAddress: string) {
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
        
        console.log('USDCPaymentExecutor初期化完了');
        console.log('アカウント:', this.account.address);
        console.log('USDC契約アドレス:', this.contractAddress);
    }

    /**
     * USDC支払いを実行
     * @param {Object} paymentPlan - 支払い計画
     * @returns {Object} トランザクション結果
     */
    async executePayment(paymentPlan: any) {
        try {
            console.log('USDC支払い実行を開始:', paymentPlan);

            // 残高チェック
            const balance = await this.getBalance();
            const requiredAmount = paymentPlan.amount;

            if (balance < requiredAmount) {
                throw new Error(`残高不足: 残高 ${balance} USDC, 必要額 ${requiredAmount} USDC`);
            }

            // 支払い金額をUSDCの単位に変換（通常6桁の小数点）
            const decimals = await this.getDecimals();
            const amountInWei = parseUnits(paymentPlan.amount.toString(), decimals);

            console.log(`支払い詳細:
                宛先: ${paymentPlan.toAddress}
                金額: ${paymentPlan.amount} USDC (${amountInWei} wei)
                説明: ${paymentPlan.description}
            `);

            // 最新のnonceを取得（pending状態を含む）
            const nonce = await this.publicClient.getTransactionCount({
                address: this.account.address,
                blockTag: 'latest'
            });

            console.log(`現在のnonce: ${nonce}`);

            // トランザクションの準備（nonceは指定しない）
            const { request } = await this.publicClient.simulateContract({
                address: this.contractAddress,
                abi: USDC_ABI,
                functionName: 'transfer',
                args: [paymentPlan.toAddress, amountInWei],
                account: this.account
            });

            // トランザクション実行（viemに自動nonce管理させる）
            const txHash = await this.walletClient.writeContract(request);

            console.log('トランザクション送信完了:', txHash);

            // トランザクションの確認を待機
            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            console.log('トランザクション確認完了:', receipt);

            return {
                success: true,
                txHash: txHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                status: receipt.status,
                paymentDetails: {
                    to: paymentPlan.toAddress,
                    amount: paymentPlan.amount,
                    description: paymentPlan.description,
                    timestamp: Math.floor(Date.now() / 1000)
                }
            };

        } catch (error) {
            console.error('USDC支払い実行エラー:', error);
            
            return {
                success: false,
                error: error.message,
                paymentDetails: {
                    to: paymentPlan.toAddress,
                    amount: paymentPlan.amount,
                    description: paymentPlan.description,
                    timestamp: Math.floor(Date.now() / 1000)
                }
            };
        }
    }

    /**
     * USDC残高を取得
     * @returns {number} USDC残高
     */
    async getBalance() {
        try {
            const balance = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: USDC_ABI,
                functionName: 'balanceOf',
                args: [this.account.address]
            });

            const decimals = await this.getDecimals();
            const formattedBalance = formatUnits(balance, decimals);
            
            console.log(`USDC残高: ${formattedBalance} USDC`);
            return parseFloat(formattedBalance);

        } catch (error) {
            console.error('残高取得エラー:', error);
            throw error;
        }
    }

    /**
     * USDCの小数点桁数を取得
     * @returns {number} 小数点桁数
     */
    async getDecimals() {
        try {
            const decimals = await this.publicClient.readContract({
                address: this.contractAddress,
                abi: USDC_ABI,
                functionName: 'decimals'
            });

            return decimals;

        } catch (error) {
            console.error('decimals取得エラー:', error);
            return 6; // USDCのデフォルト
        }
    }

    /**
     * トランザクション詳細を取得
     * @param {string} txHash - トランザクションハッシュ
     * @returns {Object} トランザクション詳細
     */
    async getTransactionDetails(txHash: string) {
        try {
            const tx = await this.publicClient.getTransaction({ hash: txHash });
            const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });

            return {
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                gasPrice: tx.gasPrice,
                gasUsed: receipt.gasUsed,
                status: receipt.status,
                blockNumber: receipt.blockNumber,
                confirmations: await this.publicClient.getBlockNumber() - receipt.blockNumber
            };

        } catch (error) {
            console.error('トランザクション詳細取得エラー:', error);
            throw error;
        }
    }

    /**
     * ネットワーク接続テスト
     * @returns {boolean} 接続状態
     */
    async testConnection() {
        try {
            const blockNumber = await this.publicClient.getBlockNumber();
            console.log('Base Sepolia接続成功 - 最新ブロック:', blockNumber);
            
            const balance = await this.getBalance();
            console.log('アカウント残高確認完了:', balance, 'USDC');
            
            return true;

        } catch (error) {
            console.error('Base Sepolia接続エラー:', error);
            return false;
        }
    }

    /**
     * テスト用の少額支払い実行
     * @param {string} toAddress - 宛先アドレス
     * @returns {Object} テスト結果
     */
    async executeTestPayment(toAddress: string) {
        const testPayment = {
            toAddress: toAddress,
            amount: 0.01, // 0.01 USDC
            description: 'テスト支払い',
            timestamp: Math.floor(Date.now() / 1000)
        };

        return await this.executePayment(testPayment);
    }
} 