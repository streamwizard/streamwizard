"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { IconCheck } from "@tabler/icons-react";

const MINECRAFT_MOBS = [
  // --- PASSIVE MOBS (Never attack) ---
  { name: "Allay", category: "Passive", path: "/img/mobs/Passive mobs/allay.gif" },
  { name: "Armadillo", category: "Passive", path: "/img/mobs/Passive mobs/armadillo.png" },
  { name: "Axolotl", category: "Passive", path: "/img/mobs/Passive mobs/axolotl.gif" },
  { name: "Bat", category: "Passive", path: "/img/mobs/Passive mobs/bat.gif" },
  { name: "Camel", category: "Passive", path: "/img/mobs/Passive mobs/camel.gif" },
  { name: "Cat", category: "Passive", path: "/img/mobs/Passive mobs/tuxedo_cat.png" },
  { name: "Chicken", category: "Passive", path: "/img/mobs/Passive mobs/chicken.png" },
  { name: "Cod", category: "Passive", path: "/img/mobs/Passive mobs/cod.gif" },
  { name: "Cow", category: "Passive", path: "/img/mobs/Passive mobs/cow.png" },
  { name: "Donkey", category: "Passive", path: "/img/mobs/Passive mobs/donkey.png" },
  { name: "Frog", category: "Passive", path: "/img/mobs/Passive mobs/frog.gif" },
  { name: "Glow Squid", category: "Passive", path: "/img/mobs/Passive mobs/glow_squid.gif" },
  { name: "Horse", category: "Passive", path: "/img/mobs/Passive mobs/horse.png" },
  { name: "Mooshroom", category: "Passive", path: "/img/mobs/Passive mobs/red_mooshroom.png" },
  { name: "Mule", category: "Passive", path: "/img/mobs/Passive mobs/mule.png" },
  { name: "Ocelot", category: "Passive", path: "/img/mobs/Passive mobs/ocelot.png" },
  { name: "Parrot", category: "Passive", path: "/img/mobs/Passive mobs/red_parrot.png" },
  { name: "Pig", category: "Passive", path: "/img/mobs/Passive mobs/pig.png" },
  { name: "Pufferfish", category: "Passive", path: "/img/mobs/Passive mobs/pufferfish.gif" },
  { name: "Rabbit", category: "Passive", path: "/img/mobs/Passive mobs/brown_rabbit.png" },
  { name: "Salmon", category: "Passive", path: "/img/mobs/Passive mobs/salmon.gif" },
  { name: "Sheep", category: "Passive", path: "/img/mobs/Passive mobs/sheep.png" },
  { name: "Sniffer", category: "Passive", path: "/img/mobs/Passive mobs/sniffer.gif" },
  { name: "Squid", category: "Passive", path: "/img/mobs/Passive mobs/squid.gif" },
  { name: "Strider", category: "Passive", path: "/img/mobs/Passive mobs/strider.gif" },
  { name: "Tadpole", category: "Passive", path: "/img/mobs/Passive mobs/tadpole.gif" },
  { name: "Tropical Fish", category: "Passive", path: "/img/mobs/Passive mobs/clownfish.png" },
  { name: "Turtle", category: "Passive", path: "/img/mobs/Passive mobs/turtle.png" },
  { name: "Villager", category: "Passive", path: "/img/mobs/Passive mobs/plains_villager_base.png" },
  { name: "Wandering Trader", category: "Passive", path: "/img/mobs/Passive mobs/trader.png" },

  // --- HOSTILE-ADJACENT (Utility / Player Created) ---
  { name: "Snow Golem", category: "Hostile-adjacent", path: "/img/mobs/Passive mobs/snow_golem.png" },
  { name: "Iron Golem", category: "Hostile-adjacent", path: "/img/mobs/nuteral/iron_golem.png" },

  // --- NEUTRAL MOBS (Only attack if provoked) ---
  { name: "Bee", category: "Neutral", path: "/img/mobs/nuteral/bee.gif" },
  { name: "Dolphin", category: "Neutral", path: "/img/mobs/nuteral/dolphin.gif" },
  { name: "Enderman", category: "Neutral", path: "/img/mobs/nuteral/enderman.png" },
  { name: "Goat", category: "Neutral", path: "/img/mobs/nuteral/goat.png" },
  { name: "Llama", category: "Neutral", path: "/img/mobs/nuteral/brown_llama.png" },
  { name: "Panda", category: "Neutral", path: "/img/mobs/nuteral/panda.png" },
  { name: "Piglin", category: "Neutral", path: "/img/mobs/nuteral/piglin.png" },
  { name: "Polar Bear", category: "Neutral", path: "/img/mobs/nuteral/polar_bear.png" },
  { name: "Spider", category: "Neutral", path: "/img/mobs/nuteral/cave_spider.png" },
  { name: "Wolf", category: "Neutral", path: "/img/mobs/nuteral/wolf.png" },
  { name: "Zombified Piglin", category: "Neutral", path: "/img/mobs/nuteral/zombified_piglin.png" },

  // --- HOSTILE MOBS (Attack on sight) ---
  { name: "Blaze", category: "Hostile", path: "/img/mobs/Hostile mobs/blaze.gif" },
  { name: "Bogged", category: "Hostile", path: "/img/mobs/Hostile mobs/bogged.png" },
  { name: "Breeze", category: "Hostile", path: "/img/mobs/Hostile mobs/breeze.webp" },
  { name: "Creaking", category: "Hostile", path: "/img/mobs/Hostile mobs/creaking.png" },
  { name: "Creeper", category: "Hostile", path: "/img/mobs/Hostile mobs/creeper.png" },
  { name: "Drowned", category: "Hostile", path: "/img/mobs/nuteral/drowned.png" },
  { name: "Elder Guardian", category: "Hostile", path: "/img/mobs/Hostile mobs/elder_guardian.gif" },
  { name: "Endermite", category: "Hostile", path: "/img/mobs/Hostile mobs/endermite.gif" },
  { name: "Evoker", category: "Hostile", path: "/img/mobs/Hostile mobs/evoker.png" },
  { name: "Ghast", category: "Hostile", path: "/img/mobs/Hostile mobs/ghast.gif" },
  { name: "Guardian", category: "Hostile", path: "/img/mobs/Hostile mobs/guardian.gif" },
  { name: "Hoglin", category: "Hostile", path: "/img/mobs/Hostile mobs/hoglin.png" },
  { name: "Husk", category: "Hostile", path: "/img/mobs/Hostile mobs/husk.png" },
  { name: "Magma Cube", category: "Hostile", path: "/img/mobs/Hostile mobs/magma_cube.png" },
  { name: "Parched", category: "Hostile", path: "/img/mobs/Hostile mobs/parched.png" },
  { name: "Phantom", category: "Hostile", path: "/img/mobs/Hostile mobs/phantom.gif" },
  { name: "Piglin Brute", category: "Hostile", path: "/img/mobs/Hostile mobs/piglin_brute.png" },
  { name: "Pillager", category: "Hostile", path: "/img/mobs/Hostile mobs/pillager.png" },
  { name: "Ravager", category: "Hostile", path: "/img/mobs/Hostile mobs/ravager.png" },
  { name: "Shulker", category: "Hostile", path: "/img/mobs/Hostile mobs/shulker.png" },
  { name: "Silverfish", category: "Hostile", path: "/img/mobs/Hostile mobs/silverfish.gif" },
  { name: "Skeleton", category: "Hostile", path: "/img/mobs/Hostile mobs/skeleton.png" },
  { name: "Slime", category: "Hostile", path: "/img/mobs/Hostile mobs/slime.png" },
  { name: "Stray", category: "Hostile", path: "/img/mobs/Hostile mobs/stray.png" },
  { name: "Vex", category: "Hostile", path: "/img/mobs/Hostile mobs/vex.gif" },
  { name: "Vindicator", category: "Hostile", path: "/img/mobs/Hostile mobs/vindicator.png" },
  { name: "Warden", category: "Hostile", path: "/img/mobs/Hostile mobs/warden.png" },
  { name: "Witch", category: "Hostile", path: "/img/mobs/Hostile mobs/witch.png" },
  { name: "Wither Skeleton", category: "Hostile", path: "/img/mobs/Hostile mobs/wither_skeleton.png" },
  { name: "Zoglin", category: "Hostile", path: "/img/mobs/Hostile mobs/zoglin.png" },
  { name: "Zombie", category: "Hostile", path: "/img/mobs/Hostile mobs/zombie.png" },
  { name: "Zombie Villager", category: "Hostile", path: "/img/mobs/Hostile mobs/plains_zombie_villager_base.png" },

  // --- BOSS MOBS ---
  { name: "Ender Dragon", category: "Boss", path: "/img/mobs/boss/ender_dragon.gif" },
  { name: "Wither", category: "Boss", path: "/img/mobs/boss/wither.png" },
];

// Convert mob name to Minecraft entity ID format (uppercase with underscores)
function mobNameToId(name: string): string {
  return name.toUpperCase().replace(/\s+/g, "_");
}

// Convert Minecraft entity ID to display name
function idToMobName(id: string): string {
  return id
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


interface MobSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MobSelector({ value, onChange }: MobSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Convert value (array of IDs like ["ZOMBIE", "SKELETON"]) to mob names for display
  const selectedMobNames = value.map((id) => idToMobName(id));

  // Filter mobs by search and category
  const filteredMobs = MINECRAFT_MOBS.filter((mob) => {
    const matchesSearch = mob.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || mob.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group mobs by category
  const mobsByCategory = filteredMobs.reduce(
    (acc, mob) => {
      if (!acc[mob.category]) {
        acc[mob.category] = [];
      }
      acc[mob.category].push(mob);
      return acc;
    },
    {} as Record<string, typeof MINECRAFT_MOBS>
  );

  const categories = Object.keys(mobsByCategory).sort();

  const toggleMob = (mobName: string) => {
    const mobId = mobNameToId(mobName);
    const newValue = value.includes(mobId) ? value.filter((id) => id !== mobId) : [...value, mobId];
    onChange(newValue);
  };

  const clearSelection = () => {
    onChange([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start">
          {selectedMobNames.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedMobNames.slice(0, 3).map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
              {selectedMobNames.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedMobNames.length - 3} more
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Select mobs...</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl px-2">
        <SheetHeader>
          <SheetTitle>Select Mobs</SheetTitle>
          <SheetDescription>Choose which mobs to spawn. Selected mobs will be saved in uppercase format.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search and filters */}
          <div className="space-y-2">
            <Input
              placeholder="Search mobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {["Passive", "Neutral", "Hostile", "Hostile-adjacent", "Boss"].map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Selected mobs count and clear */}
          {value.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{value.length} mob(s) selected</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                Clear all
              </Button>
            </div>
          )}

          {/* Mob list */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-6 pr-4">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{category}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {mobsByCategory[category].map((mob) => {
                      const mobId = mobNameToId(mob.name);
                      const isSelected = value.includes(mobId);
                      return (
                        <button
                          key={mob.name}
                          type="button"
                          onClick={() => toggleMob(mob.name)}
                          className={`relative flex flex-col items-center p-3 rounded-lg border-2 transition-all hover:bg-accent ${
                            isSelected ? "border-primary bg-primary/10" : "border-border"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                              <IconCheck className="h-3 w-3" />
                            </div>
                          )}
                          <div className="relative w-16 h-16 mb-2">
                            <Image
                              src={mob.path}
                              alt={mob.name}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <span className="text-xs text-center font-medium">{mob.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer with selected count */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {value.length > 0 ? (
                  <>
                    {value.length} mob{value.length !== 1 ? "s" : ""} selected
                  </>
                ) : (
                  "No mobs selected"
                )}
              </span>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

