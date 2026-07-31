export type NotificationType =
  | 'ORDER_CONFIRMED'
  | 'ORDER_RECEIVED'
  | 'ORDER_CANCELLED'
  | 'ORDER_EXPIRED'
  | 'ORDER_PICKUP_REMINDER'
  | 'PAYMENT_SUCCESSFUL'
  | 'PAYMENT_FAILED'
  | 'BANK_TRANSFER_INITIATED'
  | 'BANK_TRANSFER_CONFIRMED'
  | 'BANKING_MODEL_CHANGED'
  | 'SYSTEM_ALERT';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ' | 'SKIPPED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string | null;
  message: string | null;
  status: NotificationStatus;
  data?: Record<string, string>;
  isRead: boolean;
  deleted: boolean;
  createdAt: string;
  sentAt: string | null;
}

export interface NotificationPreferences {
  id?: number;
  userId?: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  enabledTypes: NotificationType[];
  createdAt?: string;
  updatedAt?: string;
}
