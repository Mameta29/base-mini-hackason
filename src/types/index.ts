// ===============================
// Core Types
// ===============================

export interface UserRules {
  allowedAddresses: string[];
  maxAmount: number;
  allowedHours: [number, number]; // [start, end]
  version?: string;
}

export interface InvoiceData {
  companyName: string;
  paymentAddress: string;
  amount: number;
  currency: string;
  dueDate: string;
  invoiceNumber: string;
  description: string;
  confidence?: number;
}

export interface PaymentPlan {
  toAddress: string;
  amount: number;
  timestamp: number;
  invoiceNumber?: string;
  description?: string;
  companyName?: string;
  confidence?: number;
  riskAssessment?: RiskAssessment;
  recommendedAction: 'execute' | 'review_required' | 'reject';
  alternatives?: AlternativePlan[];
}

export interface AlternativePlan {
  type: 'address_substitution' | 'split_payment' | 'delayed_payment';
  suggestion: string;
  modifiedPlan: Partial<PaymentPlan>;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

export interface RuleCompliance {
  isCompliant: boolean;
  violations: RuleViolation[];
  confidence: number;
}

export interface RuleViolation {
  type: 'address_not_whitelisted' | 'amount_exceeds_limit' | 'time_constraint_violation';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// ===============================
// ZKP Types
// ===============================

export interface ZKPProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
  isValid: boolean;
}

export interface ZKPInput {
  // Private inputs
  paymentAddress: number;
  paymentAmount: number;
  paymentTimestamp: number;
  
  // Public inputs (rules)
  allowedAddress1: number;
  allowedAddress2: number;
  allowedAddress3: number;
  maxAmount: number;
  minHour: number;
  maxHour: number;
}

export interface ProofAnalysis {
  isValid: boolean;
  addressValid: boolean;
  amountValid: boolean;
  timeValid: boolean;
}

// ===============================
// Blockchain Types
// ===============================

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  blockNumber?: bigint;
  gasUsed?: bigint;
  status?: 'success' | 'reverted';
  error?: string;
  paymentDetails: {
    to: string;
    amount: number;
    description: string;
    timestamp: number;
  };
}

export interface RuleCommitmentResult {
  success: boolean;
  ruleHash: string;
  txHash?: string;
  blockNumber?: bigint;
  timestamp: number;
  local?: boolean;
  error?: string;
}

export interface TransactionDetails {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasPrice?: bigint;
  gasUsed: bigint;
  status: 'success' | 'reverted';
  blockNumber: bigint;
  confirmations: bigint;
}

// ===============================
// Database Types
// ===============================

export interface ProcessingLog {
  id?: number;
  process_id: string;
  step: string;
  data: string;
  timestamp: number;
  created_at?: string;
}

export interface PaymentRecord {
  id?: number;
  process_id: string;
  status: PaymentStatus;
  invoice_data: string;
  payment_plan: string;
  zkp_proof: string;
  payment_result: string;
  tx_hash?: string;
  amount?: number;
  to_address?: string;
  timestamp: number;
  created_at?: string;
}

export interface RuleCommitment {
  id?: number;
  rule_hash: string;
  rules_data?: string;
  tx_hash?: string;
  block_number?: number;
  description?: string;
  timestamp: number;
  created_at?: string;
}

export type PaymentStatus = 
  | 'completed' 
  | 'payment_failed' 
  | 'zkp_failed' 
  | 'verification_failed' 
  | 'review_required' 
  | 'error';

// ===============================
// System Types
// ===============================

export interface SystemStatus {
  initialized: boolean;
  components: {
    ai: boolean;
    zkp: boolean;
    blockchain: boolean;
    database: boolean;
  };
  connections: {
    blockchain?: boolean;
  };
  balance?: number;
  error?: string;
}

export interface ProcessResult {
  success: boolean;
  status: PaymentStatus;
  processId: string;
  invoiceData?: InvoiceData;
  paymentPlan?: PaymentPlan;
  zkpProof?: {
    isValid: boolean;
    verified: boolean;
    proofHash: string;
  };
  paymentResult?: PaymentResult;
  message?: string;
  timestamp: number;
  error?: string;
}

export interface DemoResult {
  demo: true;
  ruleCommitment: RuleCommitmentResult;
  paymentProcess: ProcessResult;
  timestamp: number;
}

// ===============================
// Input Types
// ===============================

export interface PaymentInput {
  type: 'pdf' | 'text' | 'demo';
  content?: string;
  path?: string;
}

// ===============================
// API Response Types
// ===============================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===============================
// Configuration Types
// ===============================

export interface Config {
  openaiApiKey: string;
  privateKey: string;
  baseSepoliaRpcUrl: string;
  usdcContractAddress: string;
  port: number;
  nodeEnv: string;
  dbPath: string;
}

// ===============================
// Utility Types
// ===============================

export type Awaitable<T> = T | Promise<T>;

export interface LogLevel {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
} 