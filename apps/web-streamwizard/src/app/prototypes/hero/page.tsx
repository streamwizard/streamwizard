import type { Metadata } from "next";
import { PrototypeHarness } from "./harness";
import "./proto.css";

/*
 * Temporary design-exploration surface: four homepage hero variants behind a
 * picker. Not registered in PUBLIC_ROUTES, noindexed, and deleted once a
 * variant is promoted.
 */

export const metadata: Metadata = {
  title: "Hero prototypes",
  robots: { index: false, follow: false },
};

export default function HeroPrototypesPage() {
  return <PrototypeHarness />;
}
