import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class FcmSendError extends Error {
  constructor(
    public readonly code: string,
    public readonly permanent: boolean,
  ) {
    super('Push provider delivery failed');
  }
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

@Injectable()
export class FcmService {
  private messaging?: { send(message: unknown): Promise<string> };
  constructor(private readonly config: ConfigService) {}

  async send(message: PushMessage): Promise<string> {
    const messaging = await this.getMessaging();
    if (!messaging) throw new FcmSendError('provider-not-configured', false);
    try {
      return await messaging.send({
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });
    } catch (error) {
      const code = this.errorCode(error);
      const permanent =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument';
      throw new FcmSendError(code, permanent);
    }
  }

  private async getMessaging() {
    if (this.messaging) return this.messaging;
    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!json) return undefined;
    const imported = await import('firebase-admin');
    const admin = imported.default;
    const app =
      admin.apps[0] ??
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(json)),
      });
    this.messaging = admin.messaging(app);
    return this.messaging;
  }
  private errorCode(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'provider-unavailable';
  }
}
