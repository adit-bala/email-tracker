export interface EmailData {
  subject: string;
  email_id: string;
  sender: string;
  recipient: string;
  dateAtTimeOfSend: string;
  userIndex: string;
  numberOfOpens: number;
  storedAt: number;
}

export interface UserData {
  email: string;
  emailsSentThisMonth: number;
  lastReset: number;
  cached: boolean;
}
