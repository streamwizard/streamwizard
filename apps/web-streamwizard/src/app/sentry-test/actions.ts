"use server";

export async function throwServerError() {
  throw new Error("Sentry test: server action error");
}
