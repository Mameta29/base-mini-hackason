pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";
include "./address_whitelist.circom";
include "./time_constraint.circom";

template PaymentRules() {
    // 秘匿入力（AIの支払い計画）
    signal input paymentAddress;
    signal input paymentAmount;
    signal input paymentTimestamp;
    
    // 公開入力（ユーザー設定のルール）
    signal input allowedAddress1;
    signal input allowedAddress2;
    signal input allowedAddress3;
    signal input maxAmount;
    signal input minHour;
    signal input maxHour;
    
    // 出力（証明結果）
    signal output isValid;
    
    // 制約1: アドレスがホワイトリストに含まれているか
    component addressCheck = AddressWhitelistCheck();
    addressCheck.targetAddress <== paymentAddress;
    addressCheck.allowedAddress1 <== allowedAddress1;
    addressCheck.allowedAddress2 <== allowedAddress2;
    addressCheck.allowedAddress3 <== allowedAddress3;
    
    // 制約2: 支払い金額が上限以下か
    component amountCheck = LessEqThan(64);
    amountCheck.in[0] <== paymentAmount;
    amountCheck.in[1] <== maxAmount;
    
    // 制約3: 支払い時刻が許可された時間範囲内か
    component timeCheck = TimeConstraintCheck();
    timeCheck.timestamp <== paymentTimestamp;
    timeCheck.minHour <== minHour;
    timeCheck.maxHour <== maxHour;
    
    // 全ての制約が満たされた場合のみ1を出力
    component andGate = AND();
    andGate.a <== addressCheck.isValid;
    andGate.b <== amountCheck.out;
    
    component finalAnd = AND();
    finalAnd.a <== andGate.out;
    finalAnd.b <== timeCheck.isValid;
    
    isValid <== finalAnd.out;
    
    // デバッグ用の中間出力
    signal output addressValid;
    signal output amountValid;
    signal output timeValid;
    
    addressValid <== addressCheck.isValid;
    amountValid <== amountCheck.out;
    timeValid <== timeCheck.isValid;
}

component main = PaymentRules(); 