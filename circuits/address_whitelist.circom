pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";

template AddressWhitelistCheck() {
    signal input targetAddress;
    signal input allowedAddress1;
    signal input allowedAddress2;
    signal input allowedAddress3;
    
    signal output isValid;
    
    // 各許可アドレスとの一致をチェック
    component eq1 = IsEqual();
    eq1.in[0] <== targetAddress;
    eq1.in[1] <== allowedAddress1;
    
    component eq2 = IsEqual();
    eq2.in[0] <== targetAddress;
    eq2.in[1] <== allowedAddress2;
    
    component eq3 = IsEqual();
    eq3.in[0] <== targetAddress;
    eq3.in[1] <== allowedAddress3;
    
    // いずれかのアドレスと一致すればOK
    component or1 = OR();
    or1.a <== eq1.out;
    or1.b <== eq2.out;
    
    component or2 = OR();
    or2.a <== or1.out;
    or2.b <== eq3.out;
    
    isValid <== or2.out;
} 