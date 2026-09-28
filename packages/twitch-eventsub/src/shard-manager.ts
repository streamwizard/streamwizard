import { TwitchApi } from "@repo/twitch-api";
import { TwitchEventSubReceiver } from "./index";
import type {
    EventSubLifecycleEvent,
    EventSubReceiverOptions,
    EventSubReceiverStats,
    HandlerRegistry,
} from "./types";

export interface ConduitShardManagerOptions {
    conduitId: string;
    /** Shards the conduit should have. The manager raises shard_count to this, never lowers it. */
    shardCount: number;
    /** Shards this process runs (default: every id below shardCount) */
    shardIds?: string[];
    wsUrl?: string;
    twitchApi?: TwitchApi;
    /** Gap between starting two receivers, so N binds don't hit Helix at once (default: 250ms) */
    staggerMs?: number;
    /** How often onHeartbeat fires (default: 30000ms) */
    heartbeatIntervalMs?: number;
    /** Lifecycle events from every receiver, tagged with the shard they came from */
    onLifecycleEvent?: (shardId: string, event: EventSubLifecycleEvent) => void;
    /** Called every heartbeatIntervalMs with one entry per shard this process runs */
    onHeartbeat?: (snapshot: EventSubReceiverStats[]) => void;
    /** Extra receiver options (timeouts, backoff); mainly for tests */
    receiverOptions?: Partial<Omit<EventSubReceiverOptions, "conduitId" | "shardId" | "wsUrl" | "twitchApi" | "onLifecycleEvent">>;
}

/**
 * Parses a shard id spec: "0-9", "0,2,4" or a mix ("0-3,8"). Returns ids
 * sorted and deduplicated. Throws on anything else so a typo in env fails
 * at boot instead of silently running the wrong shards.
 */
export function parseShardIds(spec: string): string[] {
    const ids = new Set<number>();
    for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
        const range = /^(\d+)-(\d+)$/.exec(part);
        if (range) {
            const from = Number(range[1]);
            const to = Number(range[2]);
            if (from > to) throw new Error(`Invalid shard range "${part}"`);
            for (let id = from; id <= to; id++) ids.add(id);
        } else if (/^\d+$/.test(part)) {
            ids.add(Number(part));
        } else {
            throw new Error(`Invalid shard id "${part}"`);
        }
    }
    if (ids.size === 0) throw new Error(`No shard ids in "${spec}"`);
    return [...ids].sort((a, b) => a - b).map(String);
}

/**
 * Runs one EventSub WebSocket receiver per conduit shard. Twitch spreads a
 * conduit's events over its enabled shards, so more shards means more
 * throughput and a smaller blast radius when one socket drops.
 */
export class ConduitShardManager {
    private readonly receivers = new Map<string, TwitchEventSubReceiver>();
    private readonly shardIds: string[];
    private readonly twitchApi: TwitchApi;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private stopped = false;

    constructor(
        private readonly handlers: HandlerRegistry,
        private readonly options: ConduitShardManagerOptions,
    ) {
        if (!Number.isInteger(options.shardCount) || options.shardCount < 1) {
            throw new Error(`shardCount must be a positive integer, got ${options.shardCount}`);
        }
        this.shardIds = options.shardIds ?? Array.from({ length: options.shardCount }, (_, i) => String(i));
        this.twitchApi = options.twitchApi ?? new TwitchApi();
    }

    /** The shard ids this process runs. */
    getShardIds(): string[] {
        return [...this.shardIds];
    }

    /**
     * Makes sure the conduit has room for every shard we run. Only ever grows
     * the conduit: shrinking drops subscriptions' delivery on the removed
     * shards, and another process may be running them. Never throws; when
     * Helix is unreachable the receivers' own bind errors report the problem.
     */
    async ensureShardCount(): Promise<{ shardCount: number | null; resized: boolean }> {
        const highestId = Math.max(...this.shardIds.map(Number));
        const wanted = Math.max(this.options.shardCount, highestId + 1);
        try {
            const { data } = await this.twitchApi.eventsub.getConduits();
            const conduit = data.find((c) => c.id === this.options.conduitId);
            if (!conduit) {
                console.error(`❌ Conduit ${this.options.conduitId} not found; receivers will keep checking`);
                return { shardCount: null, resized: false };
            }
            if (conduit.shard_count >= wanted) {
                if (conduit.shard_count > wanted) {
                    console.warn(
                        `⚠️ Conduit has ${conduit.shard_count} shards but this process runs ${this.shardIds.length}; ` +
                        `shards nobody binds stay disabled until the conduit is resized`,
                    );
                }
                return { shardCount: conduit.shard_count, resized: false };
            }
            console.log(`📈 Growing conduit ${this.options.conduitId} from ${conduit.shard_count} to ${wanted} shards`);
            await this.twitchApi.eventsub.updateConduit(this.options.conduitId, wanted);
            return { shardCount: wanted, resized: true };
        } catch (error) {
            console.error("❌ Failed to check conduit shard count:", error);
            return { shardCount: null, resized: false };
        }
    }

    /** Sizes the conduit, then starts the receivers one by one. */
    async start(): Promise<void> {
        this.stopped = false;
        await this.ensureShardCount();

        const stagger = this.options.staggerMs ?? 250;
        for (const [index, shardId] of this.shardIds.entries()) {
            if (this.stopped) return;
            if (index > 0 && stagger > 0) await new Promise((resolve) => setTimeout(resolve, stagger));
            if (this.stopped) return;
            const receiver = new TwitchEventSubReceiver(this.handlers, {
                ...this.options.receiverOptions,
                conduitId: this.options.conduitId,
                shardId,
                wsUrl: this.options.wsUrl,
                twitchApi: this.twitchApi,
                onLifecycleEvent: (event) => this.options.onLifecycleEvent?.(shardId, event),
            });
            this.receivers.set(shardId, receiver);
            await receiver.connect();
        }

        const interval = this.options.heartbeatIntervalMs ?? 30_000;
        if (this.options.onHeartbeat && !this.stopped) {
            this.heartbeatTimer = setInterval(() => this.beat(), interval);
        }
    }

    /** Stats for every running receiver, in shard order. */
    snapshot(): EventSubReceiverStats[] {
        return [...this.receivers.values()].map((receiver) => receiver.getStats());
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        await Promise.all([...this.receivers.values()].map((receiver) => receiver.disconnect()));
        this.receivers.clear();
    }

    private beat(): void {
        try {
            this.options.onHeartbeat?.(this.snapshot());
        } catch (error) {
            console.error("❌ Heartbeat handler threw:", error);
        }
    }
}
