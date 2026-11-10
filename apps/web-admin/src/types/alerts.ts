/** The answer of a test send on /alerts/notifications: whether it went out and where, or why not. */
export interface TestSendResult {
  ok: boolean;
  detail: string;
}
