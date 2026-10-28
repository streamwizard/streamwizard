import { mock } from "bun:test";

// `server-only` throws on import unless Next's bundler swaps it out. Bun's
// test runner doesn't, so a client module that reaches a server action (and
// through it a `server-only` lib) fails before a single test runs.
mock.module("server-only", () => ({}));
