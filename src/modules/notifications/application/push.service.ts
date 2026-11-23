import { Injectable, Logger } from "@nestjs/common";
import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

export interface PushMessage {
  title: string;
  body: string;
  /** FCM data values must all be strings. */
  data?: Record<string, string>;
  /** A newer message with the same key replaces the earlier one on the phone instead of stacking beside it. */
  collapseKey?: string;
}

/** FCM answers these for a token that will never work again, so it is dropped rather than retried. */
const DEAD_TOKEN_CODES = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
/** FCM also answers this for a bad payload, which fails every token in the batch alike, so it only counts as a dead token when others in the batch got through. */
const MALFORMED_TOKEN_CODE = "messaging/invalid-argument";
const BATCH = 500;

/**
 * The one place that talks to Firebase. Credentials come from FIREBASE_SERVICE_ACCOUNT_BASE64 (the service-account JSON,
 * base64-encoded so it survives a .env file); without them every send is a logged no-op, so the app runs fine before Firebase is set up.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  /** `undefined` until first use, `null` once we know there is nothing to send with. */
  private messaging?: Messaging | null;

  private client(): Messaging | null {
    if (this.messaging !== undefined) return this.messaging;
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    this.messaging = null;
    if (!encoded) {
      this.logger.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set: push notifications are off");
      return this.messaging;
    }
    try {
      const app = initializeApp({ credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) }, "feastox-push");
      this.messaging = getMessaging(app);
    } catch (error) {
      this.logger.error(`Firebase credentials are unusable, push is off: ${error instanceof Error ? error.message : error}`);
    }
    return this.messaging;
  }

  get enabled(): boolean {
    return this.client() !== null;
  }

  /** Sends to every token and returns the ones FCM says are dead. Never throws: a failed push must not fail the order that caused it. */
  async send(tokens: string[], message: PushMessage): Promise<string[]> {
    const messaging = this.client();
    if (!messaging || tokens.length === 0) return [];
    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      try {
        const result = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: message.title, body: message.body },
          data: message.data,
          // No android.collapseKey: FCM keeps only a few distinct ones per offline phone, so a rush of orders could lose some. The tag
          // still makes a repeat replace its notification on screen.
          android: { priority: "high", notification: { tag: message.collapseKey, channelId: "orders" } },
          apns: {
            headers: { "apns-priority": "10", ...(message.collapseKey && { "apns-collapse-id": message.collapseKey.slice(0, 64) }) },
            payload: { aps: { sound: "default" } },
          },
        });
        const someDelivered = result.responses.some(response => response.success);
        result.responses.forEach((response, index) => {
          const code = response.error?.code;
          if (!response.success && code && (DEAD_TOKEN_CODES.has(code) || (code === MALFORMED_TOKEN_CODE && someDelivered)))
            dead.push(batch[index]);
        });
      } catch (error) {
        this.logger.error(`Push batch failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    return dead;
  }
}
