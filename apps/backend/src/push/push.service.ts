import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as webpush from "web-push";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { appMeta, pushSubscriptions, users } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

/** appMeta key holding the last app version we sent a "new version" push for. */
const VERSION_META_KEY = "push_announced_version";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

@Injectable()
export class PushService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.config.get<string>("VAPID_SUBJECT") ?? "mailto:admin@shaxmatchi.uz";
    if (!publicKey || !privateKey) {
      this.logger.warn(
        "VAPID keys are not set; Web Push is disabled. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.",
      );
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  /** Fire a "new version" push once per deployed version (auto on boot). */
  async onApplicationBootstrap() {
    try {
      await this.announceNewVersionIfChanged();
    } catch (err) {
      this.logger.error("Version announce failed", err as Error);
    }
  }

  getPublicKey(): string | null {
    return this.config.get<string>("VAPID_PUBLIC_KEY") ?? null;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async saveSubscription(
    userId: string,
    sub: StoredSubscription,
    userAgent?: string,
  ): Promise<void> {
    if (!this.db) return;
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent: userAgent ?? null,
        },
      });
  }

  async removeSubscription(endpoint: string): Promise<void> {
    if (!this.db) return;
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Send a notification to every subscribed teacher. Prunes expired endpoints. */
  async broadcastToTeachers(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
    if (!this.db || !this.configured) return { sent: 0, pruned: 0 };
    const rows = await this.db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .innerJoin(users, eq(users.id, pushSubscriptions.userId))
      .where(eq(users.type, "teacher"));

    const body = JSON.stringify(payload);
    let sent = 0;
    let pruned = 0;
    const results = await Promise.allSettled(
      rows.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        ),
      ),
    );

    const stale: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      const status = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      if (status === 404 || status === 410) {
        stale.push(rows[i].endpoint);
      } else {
        this.logger.warn(`Push send failed (status ${status ?? "?"})`);
      }
    });

    for (const endpoint of stale) {
      await this.removeSubscription(endpoint);
      pruned += 1;
    }
    return { sent, pruned };
  }

  /**
   * Deployed version marker. The backend `package.json` `version` is the single source of
   * truth — bump it per release to fire the "new version" push. `APP_VERSION` env is only a
   * fallback for when package.json can't be read.
   */
  private currentVersion(): string {
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
        version?: string;
      };
      if (pkg.version && pkg.version.trim().length > 0) return pkg.version.trim();
    } catch {
      /* ignore */
    }
    const fromEnv = this.config.get<string>("APP_VERSION");
    if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
    return "0.0.0";
  }

  private async announceNewVersionIfChanged(): Promise<void> {
    if (!this.db) return;
    const version = this.currentVersion();
    const [existing] = await this.db
      .select({ value: appMeta.value })
      .from(appMeta)
      .where(eq(appMeta.key, VERSION_META_KEY))
      .limit(1);

    // First boot ever: record silently so we don't spam on initial setup.
    if (!existing) {
      await this.db
        .insert(appMeta)
        .values({ key: VERSION_META_KEY, value: version })
        .onConflictDoNothing();
      this.logger.log(`Recorded initial app version ${version} (no push sent).`);
      return;
    }

    if (existing.value === version) return;

    if (this.configured) {
      const { sent, pruned } = await this.broadcastToTeachers({
        title: "Yangi versiya",
        body: "Admin ilovaning yangi versiyasi mavjud. Yangilash uchun oching.",
        url: "/",
      });
      this.logger.log(
        `New version ${existing.value} → ${version}: pushed to ${sent} subscriber(s), pruned ${pruned}.`,
      );
    } else {
      this.logger.warn(
        `New version detected (${existing.value} → ${version}) but VAPID is not configured; skipping push.`,
      );
    }

    await this.db
      .update(appMeta)
      .set({ value: version, updatedAt: new Date() })
      .where(eq(appMeta.key, VERSION_META_KEY));
  }
}
