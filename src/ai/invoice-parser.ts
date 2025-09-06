import OpenAI from 'openai';
import fs from 'fs';
// import * as pdfParse from 'pdf-parse';
import type { InvoiceData } from '../types/index.ts';

export class InvoiceParser {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    /**
     * PDFファイルから請求書データを解析
     */
    async parseInvoicePDF(pdfPath: string): Promise<InvoiceData> {
        try {
            console.log('請求書PDF解析を開始:', pdfPath);

            // PDFからテキストを抽出（実際の実装）
            const pdfBuffer = fs.readFileSync(pdfPath);
            // 簡易的にPDFバッファを文字列として扱う（実際の実装では適切なPDFライブラリを使用）
            const extractedText = pdfBuffer.toString('utf8');

            console.log('抽出されたテキスト:', extractedText.substring(0, 500) + '...');

            // OpenAI APIで請求書データを構造化
            const completion = await this.openai.chat.completions.create({
                model: "gpt-5-nano",
                messages: [
                    {
                        role: "system",
                        content: `あなたは請求書解析の専門家です。提供されたテキストから以下の情報を抽出してJSONで返してください：
                        
                        {
                            "companyName": "請求元会社名",
                            "paymentAddress": "支払い先のEthereumアドレス（もしあれば）",
                            "amount": "請求金額（数値のみ）",
                            "currency": "通貨（USD、JPYなど）",
                            "dueDate": "支払期限（YYYY-MM-DD形式）",
                            "invoiceNumber": "請求書番号",
                            "description": "請求内容の説明"
                        }
                        
                        金額は数値のみで返してください。`
                    },
                    {
                        role: "user",
                        content: `以下の請求書テキストを解析してください：\n\n${extractedText}`
                    }
                ],
                temperature: 1
            });

            const parsedData = JSON.parse(completion.choices[0].message.content);
            
            console.log('解析結果:', parsedData);
            
            return parsedData;

        } catch (error) {
            console.error('請求書解析エラー:', error);
            throw error;
        }
    }

    /**
     * テキストから請求書データを解析（メール本文など）
     */
    async parseInvoiceText(text: string): Promise<InvoiceData> {
        try {
            console.log('テキストベース請求書解析を開始');

            const completion = await this.openai.chat.completions.create({
                model: "gpt-5-nano",
                messages: [
                    {
                        role: "system",
                        content: `あなたは請求書・支払い通知の解析専門家です。提供されたテキストから支払い情報を抽出してJSONで返してください：
                        
                        {
                            "companyName": "請求元会社名",
                            "paymentAddress": "支払い先のEthereumアドレス（推測でも可）",
                            "amount": "請求金額（数値のみ）",
                            "currency": "通貨（USD、JPYなど）",
                            "dueDate": "支払期限（YYYY-MM-DD形式）",
                            "invoiceNumber": "請求書番号",
                            "description": "請求内容の説明",
                            "confidence": "解析の信頼度（0-1の数値）"
                        }
                        
                        支払い情報が見つからない場合は、confidence: 0 を返してください。`
                    },
                    {
                        role: "user",
                        content: `以下のテキストを解析してください：\n\n${text}`
                    }
                ],
                temperature: 1
            });

            const parsedData = JSON.parse(completion.choices[0].message.content);
            
            console.log('テキスト解析結果:', parsedData);
            
            return parsedData;

        } catch (error) {
            console.error('テキスト解析エラー:', error);
            throw error;
        }
    }

    // /**
    //  * 会社名からEthereumアドレスを推測生成（デモ用）
    //  */
    // generateMockAddress(companyName: string): string {
    //     // 会社名のハッシュから決定論的にアドレスを生成（デモ用）
    //     const hash = this.simpleHash(companyName);
    //     return `0x${hash.substring(0, 40)}`;
    // }

    // /**
    //  * 簡易ハッシュ関数（デモ用）
    //  */
    // private simpleHash(str: string): string {
    //     let hash = 0;
    //     for (let i = 0; i < str.length; i++) {
    //         const char = str.charCodeAt(i);
    //         hash = ((hash << 5) - hash) + char;
    //         hash = hash & hash; // 32bit整数に変換
    //     }
    //     return Math.abs(hash).toString(16).padStart(40, '0');
    // }

    /**
     * テスト用のダミー請求書データ生成
     */
    generateDummyInvoice(): InvoiceData {
        return {
            companyName: "Tokyo Electric Power Company",
            paymentAddress: "0x1234567890123456789012345678901234567890",
            amount: 75,
            currency: "USDC",
            dueDate: "2024-01-15",
            invoiceNumber: "INV-2024-001",
            description: "電力料金 - 2023年12月分",
            confidence: 1.0
        };
    }
} 