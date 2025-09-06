// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RuleCommitment
 * @dev AIエージェント支払いルールのオンチェーンコミット管理
 */
contract RuleCommitment {
    struct RuleData {
        bytes32 ruleHash;
        uint256 timestamp;
        string description;
        bool isActive;
    }
    
    // ユーザーアドレス => ルールデータ
    mapping(address => RuleData) public userRules;
    
    // ルールハッシュ => 存在確認
    mapping(bytes32 => bool) public ruleExists;
    
    // イベント
    event RuleCommitted(
        address indexed user,
        bytes32 indexed ruleHash,
        string description,
        uint256 timestamp
    );
    
    event RuleRevoked(
        address indexed user,
        bytes32 indexed ruleHash,
        uint256 timestamp
    );
    
    /**
     * @dev ルールをコミット
     * @param ruleHash ルールのハッシュ値
     * @param description ルールの説明
     */
    function commitRules(bytes32 ruleHash, string calldata description) external {
        require(ruleHash != bytes32(0), "Invalid rule hash");
        require(bytes(description).length > 0, "Description required");
        
        // 既存ルールを無効化
        if (userRules[msg.sender].ruleHash != bytes32(0)) {
            ruleExists[userRules[msg.sender].ruleHash] = false;
            emit RuleRevoked(msg.sender, userRules[msg.sender].ruleHash, block.timestamp);
        }
        
        // 新しいルールを設定
        userRules[msg.sender] = RuleData({
            ruleHash: ruleHash,
            timestamp: block.timestamp,
            description: description,
            isActive: true
        });
        
        ruleExists[ruleHash] = true;
        
        emit RuleCommitted(msg.sender, ruleHash, description, block.timestamp);
    }
    
    /**
     * @dev ユーザーのルールハッシュを取得
     * @param user ユーザーアドレス
     * @return ルールハッシュ
     */
    function getUserRuleHash(address user) external view returns (bytes32) {
        return userRules[user].ruleHash;
    }
    
    /**
     * @dev ユーザーのルール情報を取得
     * @param user ユーザーアドレス
     * @return ruleHash ルールハッシュ
     * @return timestamp コミット時刻
     * @return description 説明
     */
    function getRuleCommitment(address user) external view returns (
        bytes32 ruleHash,
        uint256 timestamp,
        string memory description
    ) {
        RuleData memory rule = userRules[user];
        return (rule.ruleHash, rule.timestamp, rule.description);
    }
    
    /**
     * @dev ルールハッシュの存在確認
     * @param ruleHash 確認するルールハッシュ
     * @return 存在するかどうか
     */
    function verifyRuleHash(bytes32 ruleHash) external view returns (bool) {
        return ruleExists[ruleHash];
    }
    
    /**
     * @dev ユーザーのルールが有効かどうか確認
     * @param user ユーザーアドレス
     * @return 有効かどうか
     */
    function isRuleActive(address user) external view returns (bool) {
        return userRules[user].isActive && userRules[user].ruleHash != bytes32(0);
    }
    
    /**
     * @dev ルールを無効化
     */
    function revokeRules() external {
        require(userRules[msg.sender].isActive, "No active rules");
        
        bytes32 ruleHash = userRules[msg.sender].ruleHash;
        userRules[msg.sender].isActive = false;
        ruleExists[ruleHash] = false;
        
        emit RuleRevoked(msg.sender, ruleHash, block.timestamp);
    }
} 