import { TransactionStatus, TransactionType } from '@/constants/enums';

/** A single transaction entry in the customer's recent transaction history. */
export interface ITransaction {
  transaction_id: string;
  timestamp: string; // ISO 8601
  type: TransactionType;
  amount: number;
  counterparty: string;
  status: TransactionStatus;
}