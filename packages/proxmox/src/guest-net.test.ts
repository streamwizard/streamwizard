import { describe, expect, it } from "bun:test";
import { agentEnabledFromConfig, parseAgentFsInfo, parseAgentInterfaces, parseLxcInterfaces } from "./guest-net";

describe("parseAgentInterfaces", () => {
  it("keeps IPv4 only, without loopback and link-local, deduped and sorted", () => {
    const data = {
      result: [
        {
          name: "lo",
          "ip-addresses": [
            { "ip-address": "127.0.0.1", "ip-address-type": "ipv4", prefix: 8 },
            { "ip-address": "::1", "ip-address-type": "ipv6", prefix: 128 },
          ],
        },
        {
          name: "eth0",
          "ip-addresses": [
            { "ip-address": "10.0.0.10", "ip-address-type": "ipv4", prefix: 24 },
            { "ip-address": "fe80::1", "ip-address-type": "ipv6", prefix: 64 },
          ],
        },
        {
          name: "eth1",
          "ip-addresses": [
            { "ip-address": "169.254.3.4", "ip-address-type": "ipv4", prefix: 16 },
            { "ip-address": "10.0.0.9", "ip-address-type": "ipv4", prefix: 24 },
            { "ip-address": "10.0.0.10", "ip-address-type": "ipv4", prefix: 24 },
          ],
        },
        { name: "docker0", "ip-addresses": [{ "ip-address": "172.17.0.1", "ip-address-type": "ipv4", prefix: 16 }] },
        { name: "br-3f2a9c1d0e4b", "ip-addresses": [{ "ip-address": "172.18.0.1", "ip-address-type": "ipv4", prefix: 16 }] },
        { name: "ens19" },
      ],
    };
    expect(parseAgentInterfaces(data)).toEqual(["10.0.0.9", "10.0.0.10"]);
  });

  it("returns nothing for shapes it doesn't know", () => {
    expect(parseAgentInterfaces(null)).toEqual([]);
    expect(parseAgentInterfaces({})).toEqual([]);
    expect(parseAgentInterfaces({ result: "nope" })).toEqual([]);
  });
});

describe("parseLxcInterfaces", () => {
  it("strips the prefix length and drops loopback", () => {
    const data = [
      { name: "lo", hwaddr: "00:00:00:00:00:00", inet: "127.0.0.1/8", inet6: "::1/128" },
      { name: "eth0", hwaddr: "bc:24:11:00:00:01", inet: "192.168.1.50/24", inet6: "fe80::1/64" },
      { name: "eth1", hwaddr: "bc:24:11:00:00:02" },
    ];
    expect(parseLxcInterfaces(data)).toEqual(["192.168.1.50"]);
    expect(parseLxcInterfaces({ not: "an array" })).toEqual([]);
  });
});

describe("agentEnabledFromConfig", () => {
  it("reads both property string forms", () => {
    expect(agentEnabledFromConfig({ agent: "1" })).toBe(true);
    expect(agentEnabledFromConfig({ agent: 1 })).toBe(true);
    expect(agentEnabledFromConfig({ agent: "enabled=1,fstrim_cloned_disks=1" })).toBe(true);
    expect(agentEnabledFromConfig({ agent: "0" })).toBe(false);
    expect(agentEnabledFromConfig({ agent: "enabled=0" })).toBe(false);
    expect(agentEnabledFromConfig({})).toBe(false);
  });
});

describe("parseAgentFsInfo", () => {
  it("sums real filesystems once and skips pseudo and read-only media", () => {
    const fs = (name: string, type: string, used: number, total: number) => ({ name, mountpoint: `/${name}`, type, "used-bytes": used, "total-bytes": total });
    expect(
      parseAgentFsInfo({
        result: [
          fs("sda1", "ext4", 10, 100),
          fs("sda1", "ext4", 10, 100),
          fs("sdb1", "xfs", 5, 50),
          fs("loop0", "squashfs", 60, 60),
          fs("sr0", "iso9660", 1, 1),
          { name: "proc", type: "proc" },
        ],
      }),
    ).toEqual({ usedBytes: 15, totalBytes: 150 });
  });

  it("returns null without sizes", () => {
    expect(parseAgentFsInfo({ result: [] })).toBeNull();
    expect(parseAgentFsInfo(null)).toBeNull();
  });
});
