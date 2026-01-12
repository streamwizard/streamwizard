"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { getTriggersByActionId } from "@/actions/smp";

// Trigger event types
export const TRIGGER_EVENT_TYPES = {
  CHANNEL_FOLLOW: "channel.follow",
  CHANNEL_SUBSCRIBE: "channel.subscribe",
  CHANNEL_SUBSCRIPTION_GIFT: "channel.subscription.gift",
  CHANNEL_SUBSCRIPTION_MESSAGE: "channel.subscription.message",
  CHANNEL_RAID: "channel.raid",
  CHANNEL_CHEER: "channel.cheer",
  CHANNEL_POINTS_REDEMPTION: "channel.channel_points_custom_reward_redemption.add",
} as const;

export type TriggerEventType = (typeof TRIGGER_EVENT_TYPES)[keyof typeof TRIGGER_EVENT_TYPES];

export const TRIGGER_EVENT_INFO: Record<
  TriggerEventType,
  {
    label: string;
    description: string;
    conditions: { field: string; label: string; type: "number" | "string" | "enum"; options?: string[] }[];
  }
> = {
  [TRIGGER_EVENT_TYPES.CHANNEL_FOLLOW]: {
    label: "Channel Follow",
    description: "Trigger when someone follows the channel",
    conditions: [],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIBE]: {
    label: "Channel Subscribe",
    description: "Trigger when someone subscribes",
    conditions: [
      { field: "tier", label: "Subscription Tier", type: "enum", options: ["1000", "2000", "3000", "prime"] },
      { field: "is_gift", label: "Is Gift", type: "enum", options: ["true", "false"] },
    ],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIPTION_GIFT]: {
    label: "Subscription Gift",
    description: "Trigger when someone gifts subscriptions",
    conditions: [
      { field: "total", label: "Total Gifts", type: "number" },
      { field: "tier", label: "Subscription Tier", type: "enum", options: ["1000", "2000", "3000"] },
    ],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIPTION_MESSAGE]: {
    label: "Subscription Message",
    description: "Trigger when a subscriber sends a message",
    conditions: [
      { field: "tier", label: "Subscription Tier", type: "enum", options: ["1000", "2000", "3000", "prime"] },
      { field: "cumulative_months", label: "Cumulative Months", type: "number" },
    ],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_RAID]: {
    label: "Channel Raid",
    description: "Trigger when someone raids the channel",
    conditions: [{ field: "viewers", label: "Viewers Count", type: "number" }],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_CHEER]: {
    label: "Channel Cheer",
    description: "Trigger when someone cheers (bits)",
    conditions: [{ field: "bits", label: "Bits Amount", type: "number" }],
  },
  [TRIGGER_EVENT_TYPES.CHANNEL_POINTS_REDEMPTION]: {
    label: "Channel Points Redemption",
    description: "Trigger when channel points are redeemed",
    conditions: [],
  },
};

export type Trigger = {
  id?: string;
  event_type: TriggerEventType;
  conditions: Record<string, { operator: string; value: string | number }>;
};

interface TriggerConfigProps {
  actionId?: string;
  onTriggersChange: (triggers: Trigger[]) => void;
}

export function TriggerConfig({ actionId, onTriggersChange }: TriggerConfigProps) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);

  // Load triggers when editing
  useEffect(() => {
    if (actionId) {
      setLoadingTriggers(true);
      getTriggersByActionId(actionId).then((data) => {
        if (data && Array.isArray(data)) {
          const loadedTriggers = data.map((t) => ({
            id: t.id,
            event_type: t.event_type as TriggerEventType,
            conditions: (t.conditions as Record<string, { operator: string; value: string | number }>) || {},
          }));
          setTriggers(loadedTriggers);
          onTriggersChange(loadedTriggers);
        }
        setLoadingTriggers(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId]);

  const addTrigger = () => {
    const newTriggers = [...triggers, { event_type: TRIGGER_EVENT_TYPES.CHANNEL_FOLLOW, conditions: {} }];
    setTriggers(newTriggers);
    onTriggersChange(newTriggers);
  };

  const removeTrigger = (index: number) => {
    const newTriggers = triggers.filter((_, i) => i !== index);
    setTriggers(newTriggers);
    onTriggersChange(newTriggers);
  };

  const updateTriggerEventType = (index: number, eventType: TriggerEventType) => {
    const updated = [...triggers];
    updated[index] = { ...updated[index], event_type: eventType, conditions: {} };
    setTriggers(updated);
    onTriggersChange(updated);
  };

  const updateTriggerCondition = (triggerIndex: number, field: string, operator: string, value: string | number) => {
    const updated = [...triggers];
    if (!updated[triggerIndex].conditions) {
      updated[triggerIndex].conditions = {};
    }
    updated[triggerIndex].conditions[field] = { operator, value };
    setTriggers(updated);
    onTriggersChange(updated);
  };

  const removeTriggerCondition = (triggerIndex: number, field: string) => {
    const updated = [...triggers];
    if (updated[triggerIndex].conditions) {
      delete updated[triggerIndex].conditions[field];
      setTriggers(updated);
      onTriggersChange(updated);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Twitch Event Trigger</CardTitle>
            <CardDescription>Configure when this action should be triggered by a Twitch event</CardDescription>
          </div>
          {triggers.length === 0 && (
            <Button type="button" variant="outline" size="sm" onClick={addTrigger}>
              <IconPlus className="h-4 w-4 mr-2" />
              Add Trigger
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingTriggers ? (
          <p className="text-sm text-muted-foreground">Loading trigger...</p>
        ) : triggers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No trigger configured</p>
            <p className="text-xs text-muted-foreground">Add a trigger to automatically execute this action when a Twitch event occurs</p>
          </div>
        ) : (
          <div>
            {triggers.map((trigger, index) => {
              const eventInfo = TRIGGER_EVENT_INFO[trigger.event_type];
              return (
                <div key={index}>
                  <FieldGroup>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <Field>
                          <FieldLabel>Event Type</FieldLabel>
                          <Select value={trigger.event_type} onValueChange={(value) => updateTriggerEventType(index, value as TriggerEventType)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TRIGGER_EVENT_INFO).map(([key, info]) => (
                                <SelectItem key={key} value={key}>
                                  {info.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription>{eventInfo.description}</FieldDescription>
                        </Field>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTrigger(index)} className="ml-4" title="Remove trigger">
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>

                    {eventInfo.conditions.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <FieldLabel>Conditions</FieldLabel>
                        {eventInfo.conditions.map((condition) => {
                          const conditionValue = trigger.conditions[condition.field];
                          return (
                            <div key={condition.field} className="flex gap-2 items-end">
                              <div className="flex-1">
                                <FieldLabel className="text-sm">{condition.label}</FieldLabel>
                                <div className="flex gap-2">
                                  <Select
                                    value={conditionValue?.operator || "equals"}
                                    onValueChange={(op) =>
                                      updateTriggerCondition(
                                        index,
                                        condition.field,
                                        op,
                                        conditionValue?.value || (condition.type === "number" ? 0 : "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">Equals</SelectItem>
                                      <SelectItem value="greater_than">Greater Than</SelectItem>
                                      <SelectItem value="less_than">Less Than</SelectItem>
                                      <SelectItem value="greater_or_equal">≥</SelectItem>
                                      <SelectItem value="less_or_equal">≤</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {condition.type === "number" ? (
                                    <Input
                                      type="number"
                                      value={conditionValue?.value || ""}
                                      onChange={(e) =>
                                        updateTriggerCondition(
                                          index,
                                          condition.field,
                                          conditionValue?.operator || "equals",
                                          e.target.valueAsNumber || 0
                                        )
                                      }
                                      placeholder="Value"
                                      className="flex-1"
                                    />
                                  ) : condition.type === "enum" ? (
                                    <Select
                                      value={String(conditionValue?.value || "")}
                                      onValueChange={(val) =>
                                        updateTriggerCondition(index, condition.field, conditionValue?.operator || "equals", val)
                                      }
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select value" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {condition.options?.map((opt) => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt === "1000"
                                              ? "Tier 1"
                                              : opt === "2000"
                                                ? "Tier 2"
                                                : opt === "3000"
                                                  ? "Tier 3"
                                                  : opt === "prime"
                                                    ? "Prime"
                                                    : opt === "true"
                                                      ? "Yes"
                                                      : opt === "false"
                                                        ? "No"
                                                        : opt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="text"
                                      value={String(conditionValue?.value || "")}
                                      onChange={(e) =>
                                        updateTriggerCondition(
                                          index,
                                          condition.field,
                                          conditionValue?.operator || "equals",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Value"
                                      className="flex-1"
                                    />
                                  )}
                                </div>
                              </div>
                              {conditionValue && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeTriggerCondition(index, condition.field)}
                                >
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FieldGroup>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

