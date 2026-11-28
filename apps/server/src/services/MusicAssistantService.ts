import type { ConfigRepository } from "../db/ConfigRepository";
import { BadGatewayError, BadRequestError } from "../errors";

const MA_REQUEST_TIMEOUT_MS = 5000;

export class MusicAssistantService {
  constructor(private readonly repo: ConfigRepository) {}

  async getGuestUrl(): Promise<string> {
    const config = await this.repo.get();
    if (!config.maApiBaseUrl || !config.maApiToken) {
      throw new BadRequestError("Music Assistant is not configured");
    }

    try {
      const response = await fetch(`${config.maApiBaseUrl}/api`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.maApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: "party/url", args: {} }),
        signal: AbortSignal.timeout(MA_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Music Assistant returned ${response.status}`);
      }
      const url = await response.json();
      if (typeof url !== "string") {
        throw new Error("Unexpected response shape from Music Assistant");
      }
      return url;
    } catch (err) {
      throw new BadGatewayError(
        `Failed to reach Music Assistant: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async setApiToken(token: string): Promise<void> {
    await this.repo.update({ maApiToken: token });
  }

  // Lets the kiosk decide whether to show the "Show guest QR" HUD action at
  // all, without ever exposing maApiToken itself to the browser.
  async isConfigured(): Promise<boolean> {
    const config = await this.repo.get();
    return Boolean(config.maApiBaseUrl && config.maApiToken);
  }
}
