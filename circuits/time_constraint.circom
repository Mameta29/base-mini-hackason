pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";

template TimeConstraintCheck() {
    signal input timestamp; // 直接時間値（0-23）
    signal input minHour;
    signal input maxHour;
    
    signal output isValid;
    
    // 時間が許可範囲内かチェック
    component geq = GreaterEqThan(8);
    geq.in[0] <== timestamp;
    geq.in[1] <== minHour;
    
    component leq = LessEqThan(8);
    leq.in[0] <== timestamp;
    leq.in[1] <== maxHour;
    
    // 両方の条件を満たす必要がある
    component and = AND();
    and.a <== geq.out;
    and.b <== leq.out;
    
    isValid <== and.out;
}

// 整数除算のヘルパーテンプレート
template IntegerDivision(n) {
    signal input dividend;
    signal input divisor;
    signal output quotient;
    signal output remainder;
    
    quotient <-- dividend \ divisor;
    remainder <-- dividend % divisor;
    
    // 制約: dividend = quotient * divisor + remainder
    dividend === quotient * divisor + remainder;
    
    // 制約: 0 <= remainder < divisor
    component lt = LessThan(n);
    lt.in[0] <== remainder;
    lt.in[1] <== divisor;
    lt.out === 1;
    
    component geq = GreaterEqThan(n);
    geq.in[0] <== remainder;
    geq.in[1] <== 0;
    geq.out === 1;
}

// モジュロ演算のヘルパーテンプレート
template Mod(n) {
    signal input dividend;
    signal input divisor;
    signal output remainder;
    
    signal quotient;
    quotient <-- dividend \ divisor;
    remainder <-- dividend % divisor;
    
    // 制約: dividend = quotient * divisor + remainder
    dividend === quotient * divisor + remainder;
    
    // 制約: 0 <= remainder < divisor
    component lt = LessThan(n);
    lt.in[0] <== remainder;
    lt.in[1] <== divisor;
    lt.out === 1;
    
    component geq = GreaterEqThan(n);
    geq.in[0] <== remainder;
    geq.in[1] <== 0;
    geq.out === 1;
} 