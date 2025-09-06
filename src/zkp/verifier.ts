import * as snarkjs from 'snarkjs';
import fs from 'fs';

export class ZKPVerifier {
    private verificationKeyPath: string;

    constructor() {
        this.verificationKeyPath = './build/verification_key.json';
    }

    /**
     * ZKP証明を検証
     * @param {Object} proof - 証明データ
     * @param {Array} publicSignals - 公開シグナル
     * @returns {boolean} 検証結果
     */
    async verifyProof(proof: any, publicSignals: any) {
        try {
            console.log('ZKP証明検証を開始...');

            // 検証キーの読み込み
            const vKey = JSON.parse(fs.readFileSync(this.verificationKeyPath, 'utf8'));

            // 証明の検証
            const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

            console.log('ZKP証明検証結果:', isValid);
            
            return isValid;

        } catch (error) {
            console.error('ZKP証明検証エラー:', error);
            return false;
        }
    }

    /**
     * 検証キーファイルの存在確認
     */
    checkVerificationKey() {
        if (!fs.existsSync(this.verificationKeyPath)) {
            console.warn(`検証キーファイルが見つかりません: ${this.verificationKeyPath} - ZKP検証は無効化されます`);
            return false;
        }

        console.log('検証キーファイルの確認完了');
        return true;
    }

    /**
     * 証明データの詳細解析
     * @param {Array} publicSignals - 公開シグナル
     * @returns {Object} 解析結果
     */
    analyzeProofResults(publicSignals: any[]) {
        return {
            isValid: publicSignals[0] === '1',
            addressValid: publicSignals[1] === '1',
            amountValid: publicSignals[2] === '1',
            timeValid: publicSignals[3] === '1'
        };
    }
} 