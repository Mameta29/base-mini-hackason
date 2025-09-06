// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {RuleCommitment} from "../src/RuleCommitment.sol";
import {ZKPVerifier} from "../src/ZKPVerifier.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with the account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy RuleCommitment contract
        RuleCommitment ruleCommitment = new RuleCommitment();
        console.log("RuleCommitment deployed to:", address(ruleCommitment));

        // Deploy ZKPVerifier contract
        ZKPVerifier zkpVerifier = new ZKPVerifier();
        console.log("ZKPVerifier deployed to:", address(zkpVerifier));

        vm.stopBroadcast();

        // Output for environment variables
        console.log("\n=== Environment Variables ===");
        console.log("Add these to your .env.local file:");
        console.log("RULE_COMMITMENT_CONTRACT=%s", address(ruleCommitment));
        console.log("ZKP_VERIFIER_CONTRACT=%s", address(zkpVerifier));
        
        // Save deployment addresses to file
        string memory deploymentInfo = string(abi.encodePacked(
            "RULE_COMMITMENT_CONTRACT=", vm.toString(address(ruleCommitment)), "\n",
            "ZKP_VERIFIER_CONTRACT=", vm.toString(address(zkpVerifier)), "\n"
        ));
        
        vm.writeFile("deployment.env", deploymentInfo);
        console.log("\nDeployment addresses saved to deployment.env");
    }
} 