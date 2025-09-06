import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export class DatabaseManager {
    private dbPath: string;
    private db: any;
    private initialized: boolean;
    private run: any;
    private get: any;
    private all: any;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
        this.db = null;
        this.initialized = false;
    }

    /**
     * データベースを初期化
     */
    async initialize() {
        try {
            console.log('データベース初期化を開始:', this.dbPath);

            // ディレクトリが存在しない場合は作成
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // SQLiteデータベースを開く
            this.db = new sqlite3.Database(this.dbPath);

            // プロミス化
            this.run = promisify(this.db.run.bind(this.db));
            this.get = promisify(this.db.get.bind(this.db));
            this.all = promisify(this.db.all.bind(this.db));

            // テーブル作成
            await this.createTables();

            this.initialized = true;
            console.log('データベース初期化完了');

        } catch (error) {
            console.error('データベース初期化エラー:', error);
            throw error;
        }
    }

    /**
     * テーブルを作成
     */
    async createTables() {
        try {
            // 処理ログテーブル
            await this.run(`
                CREATE TABLE IF NOT EXISTS processing_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    process_id TEXT NOT NULL,
                    step TEXT NOT NULL,
                    data TEXT,
                    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 支払い記録テーブル
            await this.run(`
                CREATE TABLE IF NOT EXISTS payment_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    process_id TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL,
                    invoice_data TEXT,
                    payment_plan TEXT,
                    zkp_proof TEXT,
                    payment_result TEXT,
                    tx_hash TEXT,
                    amount REAL,
                    to_address TEXT,
                    timestamp INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // ルールコミット記録テーブル
            await this.run(`
                CREATE TABLE IF NOT EXISTS rule_commitments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_hash TEXT NOT NULL,
                    rules_data TEXT,
                    tx_hash TEXT,
                    block_number INTEGER,
                    description TEXT,
                    timestamp INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // ユーザー設定テーブル
            await this.run(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('テーブル作成完了');

        } catch (error) {
            console.error('テーブル作成エラー:', error);
            throw error;
        }
    }

    /**
     * 処理ログを保存
     * @param {string} processId - プロセスID
     * @param {string} step - 処理ステップ
     * @param {Object} data - ログデータ
     */
    async saveProcessingLog(processId: string, step: string, data: any) {
        try {
            // BigIntを文字列に変換してからJSON化
            const serializedData = JSON.stringify(data, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            );
            
            await this.run(`
                INSERT INTO processing_logs (process_id, step, data)
                VALUES (?, ?, ?)
            `, [processId, step, serializedData]);

            console.log(`処理ログ保存: ${processId} - ${step}`);

        } catch (error) {
            console.error('処理ログ保存エラー:', error);
            throw error;
        }
    }

    /**
     * 支払い記録を保存
     * @param {Object} paymentData - 支払いデータ
     */
    async savePaymentRecord(paymentData: any) {
        try {
            // BigIntを文字列に変換してからJSON化
            const bigIntReplacer = (key: string, value: any) =>
                typeof value === 'bigint' ? value.toString() : value;
            
            await this.run(`
                INSERT OR REPLACE INTO payment_records (
                    process_id, status, invoice_data, payment_plan, zkp_proof,
                    payment_result, tx_hash, amount, to_address, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                paymentData.processId,
                paymentData.status,
                JSON.stringify(paymentData.invoiceData, bigIntReplacer),
                JSON.stringify(paymentData.paymentPlan, bigIntReplacer),
                JSON.stringify(paymentData.zkpProof, bigIntReplacer),
                JSON.stringify(paymentData.paymentResult, bigIntReplacer),
                paymentData.paymentResult?.txHash || null,
                paymentData.paymentPlan?.amount || null,
                paymentData.paymentPlan?.toAddress || null,
                paymentData.timestamp
            ]);

            console.log(`支払い記録保存: ${paymentData.processId}`);

        } catch (error) {
            console.error('支払い記録保存エラー:', error);
            throw error;
        }
    }

    /**
     * ルールコミット記録を保存
     * @param {Object} commitData - コミットデータ
     */
    async saveRuleCommitment(commitData: any) {
        try {
            await this.run(`
                INSERT INTO rule_commitments (
                    rule_hash, tx_hash, block_number, description, timestamp
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                commitData.ruleHash,
                commitData.txHash || null,
                commitData.blockNumber || null,
                "Payment Rules Commitment",
                commitData.timestamp
            ]);

            console.log(`ルールコミット記録保存: ${commitData.ruleHash}`);

        } catch (error) {
            console.error('ルールコミット記録保存エラー:', error);
            throw error;
        }
    }

    /**
     * 支払い履歴を取得
     * @param {number} limit - 取得件数
     * @returns {Array} 支払い履歴
     */
    async getPaymentHistory(limit: number = 10) {
        try {
            const records = await this.all(`
                SELECT * FROM payment_records
                ORDER BY created_at DESC
                LIMIT ?
            `, [limit]);

            return records.map(record => ({
                ...record,
                invoice_data: JSON.parse(record.invoice_data || '{}'),
                payment_plan: JSON.parse(record.payment_plan || '{}'),
                zkp_proof: JSON.parse(record.zkp_proof || '{}'),
                payment_result: JSON.parse(record.payment_result || '{}')
            }));

        } catch (error) {
            console.error('支払い履歴取得エラー:', error);
            return [];
        }
    }

    /**
     * 処理ログを取得
     * @param {string} processId - プロセスID
     * @returns {Array} 処理ログ
     */
    async getProcessingLogs(processId: string) {
        try {
            const logs = await this.all(`
                SELECT * FROM processing_logs
                WHERE process_id = ?
                ORDER BY timestamp ASC
            `, [processId]);

            return logs.map(log => ({
                ...log,
                data: JSON.parse(log.data || '{}')
            }));

        } catch (error) {
            console.error('処理ログ取得エラー:', error);
            return [];
        }
    }

    /**
     * ルールコミット履歴を取得
     * @param {number} limit - 取得件数
     * @returns {Array} コミット履歴
     */
    async getRuleCommitmentHistory(limit: number = 10) {
        try {
            const records = await this.all(`
                SELECT * FROM rule_commitments
                ORDER BY created_at DESC
                LIMIT ?
            `, [limit]);

            return records;

        } catch (error) {
            console.error('ルールコミット履歴取得エラー:', error);
            return [];
        }
    }

    /**
     * ユーザー設定を保存
     * @param {string} key - 設定キー
     * @param {*} value - 設定値
     */
    async saveSetting(key: string, value: any) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO user_settings (key, value)
                VALUES (?, ?)
            `, [key, JSON.stringify(value)]);

            console.log(`設定保存: ${key}`);

        } catch (error) {
            console.error('設定保存エラー:', error);
            throw error;
        }
    }

    /**
     * ユーザー設定を取得
     * @param {string} key - 設定キー
     * @returns {*} 設定値
     */
    async getSetting(key: string) {
        try {
            const record = await this.get(`
                SELECT value FROM user_settings
                WHERE key = ?
            `, [key]);

            return record ? JSON.parse(record.value) : null;

        } catch (error) {
            console.error('設定取得エラー:', error);
            return null;
        }
    }

    /**
     * データベース接続テスト
     * @returns {boolean} 接続状態
     */
    async testConnection() {
        try {
            await this.get('SELECT 1');
            return true;
        } catch (error) {
            console.error('データベース接続テストエラー:', error);
            return false;
        }
    }

    /**
     * データベースを閉じる
     */
    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        console.log('データベース接続を閉じました');
                        resolve(undefined);
                    }
                });
            });
        }
    }
} 