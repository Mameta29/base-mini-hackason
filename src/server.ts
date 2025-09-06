import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { PaymentSystem } from './core/payment-system.js';
import type { Request, Response } from 'express';
import type { ApiResponse, UserRules } from './types/index.ts';

// リアルタイムログ管理
class LogManager {
    private clients: Map<string, Response> = new Map();
    
    addClient(processId: string, res: Response) {
        this.clients.set(processId, res);
        
        // クライアント切断時のクリーンアップ
        res.on('close', () => {
            this.clients.delete(processId);
        });
    }
    
    sendLog(processId: string, phase: string, status: 'active' | 'completed' | 'failed', message: string, details?: any) {
        const client = this.clients.get(processId);
        if (client) {
            const logData = {
                phase,
                status,
                message,
                details: this.sanitizeForJSON(details),
                timestamp: new Date().toISOString()
            };
            
            try {
                client.write(`data: ${JSON.stringify(logData)}\n\n`);
            } catch (error) {
                console.error('SSE送信エラー:', error);
                // BigInt問題の場合、detailsなしで再送信
                const fallbackData = { phase, status, message, timestamp: new Date().toISOString() };
                client.write(`data: ${JSON.stringify(fallbackData)}\n\n`);
            }
        }
    }
    
    private sanitizeForJSON(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeForJSON(item));
        }
        
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = this.sanitizeForJSON(value);
        }
        return sanitized;
    }
    
    removeClient(processId: string) {
        const client = this.clients.get(processId);
        if (client) {
            client.end();
            this.clients.delete(processId);
        }
    }
}

const logManager = new LogManager();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// BigInt対応のJSONシリアライザ
app.set('json replacer', (key: string, value: any) => 
    typeof value === 'bigint' ? value.toString() : value
);

// ファイルアップロード設定
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('PDFファイルのみアップロード可能です'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// システム初期化
let paymentSystem: PaymentSystem;

try {
    paymentSystem = new PaymentSystem();
    
    // ログコールバックを設定
    paymentSystem.setLogCallback((processId, phase, status, message, details) => {
        logManager.sendLog(processId, phase, status, message, details);
    });
    
    console.log('✅ PaymentSystem初期化完了');
} catch (error) {
    console.error('❌ PaymentSystem初期化エラー:', error);
    console.log('⚠️ 環境変数が設定されていない可能性があります');
    
    // ダミーのPaymentSystemを作成（最低限の機能）
    paymentSystem = {
        getSystemStatus: async () => ({
            status: 'error',
            message: '環境変数が設定されていません',
            components: {
                ai: { status: 'error', message: 'OPENAI_API_KEY が必要です' },
                zkp: { status: 'error', message: 'ZKP回路の初期化に失敗しました' },
                blockchain: { status: 'error', message: 'PRIVATE_KEY が必要です' },
                database: { status: 'error', message: 'データベース初期化に失敗しました' }
            }
        }),
        setLogCallback: () => {},
        runDemo: async () => ({ success: false, error: '環境変数が設定されていません' }),
        processPayment: async () => ({ success: false, error: '環境変数が設定されていません' }),
        commitUserRules: async () => ({ success: false, error: '環境変数が設定されていません' }),
        getPaymentHistory: async () => [],
        db: null
    } as any;
}

// SSEエンドポイント - リアルタイムログストリーム
app.get('/api/logs/:processId', (req: Request, res: Response) => {
    const processId = req.params.processId;
    
    // SSEヘッダー設定
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // クライアント登録
    logManager.addClient(processId, res);
    
    // 初期メッセージ
    res.write(`data: ${JSON.stringify({
        phase: 'init',
        status: 'active',
        message: 'ログストリーム接続完了',
        timestamp: new Date().toISOString()
    })}\n\n`);
});

// ルート: システム状態確認
app.get('/api/status', async (req: Request, res: Response) => {
    try {
        const status = await paymentSystem.getSystemStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: デモ実行
app.post('/api/demo', async (req: Request, res: Response) => {
    try {
        console.log('デモ実行リクエストを受信');
        
        const result = await paymentSystem.runDemo();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('デモ実行エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: プロセスID生成
app.post('/api/generate-process-id', async (req: Request, res: Response) => {
    const processId = `payment_${Date.now()}`;
    res.json({ processId });
});

// ルート: カスタムデモ実行（ユーザー入力使用）
app.post('/api/demo/custom', async (req: Request, res: Response) => {
    try {
        const { userRules, invoiceText, processId }: { userRules: UserRules; invoiceText: string; processId?: string } = req.body;
        
        if (!userRules || !invoiceText) {
            return res.status(400).json({
                success: false,
                error: 'ユーザールールと請求書テキストが必要です'
            });
        }

        console.log('カスタムデモ実行リクエストを受信');
        
        const input = {
            type: 'text' as const,
            content: invoiceText
        };

        // プロセスIDを指定してPaymentSystemに渡す
        const result = await paymentSystem.processPayment(input, userRules, processId);
        
        res.json({
            success: true,
            data: result,
            processId: result.processId // プロセスIDを明示的に返す
        });
    } catch (error) {
        console.error('カスタムデモ実行エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: ルールコミット
app.post('/api/rules/commit', async (req: Request, res: Response) => {
    try {
        const { userRules }: { userRules: UserRules } = req.body;
        
        if (!userRules) {
            return res.status(400).json({
                success: false,
                error: 'ユーザールールが必要です'
            });
        }

        const result = await paymentSystem.commitUserRules(userRules);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('ルールコミットエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: テキスト支払い処理
app.post('/api/payment/text', async (req: Request, res: Response) => {
    try {
        const { text, userRules }: { text: string; userRules: UserRules } = req.body;
        
        if (!text || !userRules) {
            return res.status(400).json({
                success: false,
                error: 'テキストとユーザールールが必要です'
            });
        }

        const input = {
            type: 'text' as const,
            content: text
        };

        const result = await paymentSystem.processPayment(input, userRules);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('テキスト支払い処理エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: PDF支払い処理
app.post('/api/payment/pdf', upload.single('invoice'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'PDFファイルが必要です'
            });
        }

        const userRules: UserRules = JSON.parse(req.body.userRules || '{}');
        
        if (!userRules.allowedAddresses) {
            return res.status(400).json({
                success: false,
                error: 'ユーザールールが必要です'
            });
        }

        const input = {
            type: 'pdf' as const,
            path: req.file.path
        };

        const result = await paymentSystem.processPayment(input, userRules);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('PDF支払い処理エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: 支払い履歴取得
app.get('/api/payment/history', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const history = await paymentSystem.getPaymentHistory(limit);
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('支払い履歴取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: 処理ログ取得
app.get('/api/logs/:processId', async (req: Request, res: Response) => {
    try {
        const { processId } = req.params;
        const logs = await paymentSystem.db.getProcessingLogs(processId);
        
        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('処理ログ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ルート: サンプルルール取得
app.get('/api/sample-rules', (req: Request, res: Response) => {
    const sampleRules = {
        allowedAddresses: [
            "0xF2431b618B5b02923922c525885DBfFcdb9DE853", // 電力会社
            "0xE2F2E032B02584e81437bA8Df18F03d6771F9d23"  // 水道局
        ],
        maxAmount: 10,
        allowedHours: [9, 18],
        description: "デモ用の支払いルール設定"
    };

    res.json({
        success: true,
        data: sampleRules
    });
});

// ルート: サンプル請求書テキスト取得
app.get('/api/sample-invoice', (req: Request, res: Response) => {
    const sampleInvoice = `
請求書

東京電力株式会社
〒100-0004 東京都千代田区大手町1-3-2

お客様番号: 123456789
請求書番号: INV-2024-001

ご請求内容:
電力料金（2025年8月分）
使用量: 280kWh
基本料金: $2.00
電力量料金: $3.00
消費税: $1.00

合計金額: $6.00（6 USDC）
お支払い期限: 2025年9月15日

お支払い先アドレス: 0xF2431b618B5b02923922c525885DBfFcdb9DE853

ありがとうございました。
    `.trim();

    res.json({
        success: true,
        data: {
            text: sampleInvoice,
            description: "電力料金の請求書サンプル"
        }
    });
});

// エラーハンドリング
app.use((error: Error, req: Request, res: Response, next: any) => {
    console.error('サーバーエラー:', error);
    res.status(500).json({
        success: false,
        error: error.message
    });
});

// サーバー起動
app.listen(port, () => {
    console.log(`🚀 AIコントロールサーバーが起動しました`);
    console.log(`📍 http://localhost:${port}`);
    console.log(`📊 システム状態: http://localhost:${port}/api/status`);
    console.log(`🎯 デモ実行: POST http://localhost:${port}/api/demo`);
});

// グレースフルシャットダウン
process.on('SIGINT', async () => {
    console.log('サーバーをシャットダウン中...');
    if (paymentSystem.db) {
        await paymentSystem.db.close();
    }
    process.exit(0);
}); 