export interface EmailData {
  subject: string;
  email_id: string;
  sender: string;
  recipient: string;
  dateAtTimeOfSend: string;
  numberOfOpens?: number;
  storedAt?: number;
}
