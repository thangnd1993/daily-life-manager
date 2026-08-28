import { Injectable } from '@nestjs/common';

export interface PasswordResetMessage {
  email: string;
  displayName: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetDeliveryService {
  async send(message: PasswordResetMessage): Promise<void> {
    // Delivery provider integration is intentionally deferred. The token is never logged or returned by the API.
    void message;
  }
}
