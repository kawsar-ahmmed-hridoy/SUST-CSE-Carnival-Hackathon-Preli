import { Channel, Language, UserType } from '@/constants/enums';
import { ITransaction } from './ITransaction';

export interface ITicketRequest {
  ticket_id: string;
  complaint: string;
  language?: Language;
  channel?: Channel;
  user_type?: UserType;
  campaign_context?: string;
  transaction_history?: ITransaction[];
  metadata?: Record<string, unknown>;
}