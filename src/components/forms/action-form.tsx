"use client";

import {
  createAction,
  updateAction,
  createTrigger,
  deleteTriggersByActionId,
} from "@/actions/smp";
import {
  ActionCategory,
  CATEGORY_INFO,
  formatActionString,
  getDefaultMetadata,
  getEvent,
  getEventsForCategory,
  getMetadataSchema,
  parseActionString,
} from "@/lib/actions/action-registry";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { EventMetadataFields } from "./event-metadata-fields";
import { TriggerConfig, Trigger } from "./trigger-config";
import { TestTriggerModal } from "./test-trigger-modal";

// Base action schema
const actionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  action: z.string().min(1, "Action is required"), // Stored as "category:event"
  description: z.string().max(500, "Description must be 500 characters or less").optional().or(z.literal("")),
  metadata: z.any(), // Will be validated dynamically based on action type
});

type ActionFormValues = z.infer<typeof actionSchema>;

interface ActionFormProps {
  id?: string;
  defaultValues?: {
    name?: string;
    action?: string;
    description?: string;
    metadata?: unknown;
  };
}

export function ActionForm({ id, defaultValues }: ActionFormProps) {
  const router = useRouter();

  // Parse initial category and event from action string
  const initialParsed = defaultValues?.action ? parseActionString(defaultValues.action) : null;
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory | null>(
    initialParsed?.category || null
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialParsed?.eventId || null
  );
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      action: defaultValues?.action ?? "",
      description: defaultValues?.description ?? "",
      metadata: defaultValues?.metadata ?? {},
    },
  });

  // Update category and event when defaultValues.action changes (e.g., when editing)
  // Only run when defaultValues.action actually changes, not when state changes
  useEffect(() => {
    if (defaultValues?.action) {
      const parsed = parseActionString(defaultValues.action);
      if (parsed) {
        setSelectedCategory(parsed.category);
        setSelectedEventId(parsed.eventId);
      }
    }
  }, [defaultValues?.action]);

  // Update action string when category or event changes
  useEffect(() => {
    if (selectedCategory && selectedEventId) {
      const actionString = formatActionString(selectedCategory, selectedEventId);
      const currentAction = form.getValues("action");
      const expectedAction = defaultValues?.action;

      // Only update if the action string has changed
      if (currentAction !== actionString) {
        form.setValue("action", actionString);

        // Only reset metadata if this is a user-initiated change (not matching defaultValues)
        if (actionString !== expectedAction) {
          const defaultMetadata = getDefaultMetadata(selectedCategory, selectedEventId);
          form.setValue("metadata", defaultMetadata);
        }
      }
    }
  }, [selectedCategory, selectedEventId, form, defaultValues?.action]);

  // Handle category change
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value as ActionCategory);
    setSelectedEventId(null); // Reset event when category changes
    form.setValue("action", "");
    form.setValue("metadata", {});
  };

  async function handleSubmit(values: ActionFormValues) {
    // Parse and validate
    const parsed = parseActionString(values.action);
    if (!parsed) {
      toast.error("Invalid action format");
      return;
    }

    // Validate metadata based on action type
    const metadataSchema = getMetadataSchema(parsed.category, parsed.eventId);
    const metadataValidation = metadataSchema.safeParse(values.metadata);

    if (!metadataValidation.success) {
      toast.error("Please check the configuration fields");
      console.error("Metadata validation errors:", metadataValidation.error);
      return;
    }

    // Transform form values to match database schema
    // Convert empty strings to null for nullable fields
    const dbData = {
      name: values.name,
      action: values.action,
      description: values.description && values.description !== "" ? values.description : null,
      metadata: values.metadata || null,
    };


    let actionId = id;

    if (id) {
      const res = await updateAction(id, dbData);
      if (!res) {
        toast.error("Failed to update action");
        return;
      }
      toast.success("Action updated successfully");
    } else {
      const res = await createAction(dbData);
      if (!res) {
        toast.error("Failed to create action");
        return;
      }
      actionId = res.id;
      toast.success("Action created successfully");
    }

    // Save triggers
    if (actionId) {
      // Delete existing triggers
      await deleteTriggersByActionId(actionId);

      // Create new triggers
      for (const trigger of triggers) {
        await createTrigger({
          action_id: actionId,
          event_type: trigger.event_type,
          conditions: trigger.conditions,
        });
      }
    }

    router.push("/dashboard/smp/admin/actions");
  }


  const availableEvents = selectedCategory ? getEventsForCategory(selectedCategory) : [];
  const selectedEvent = selectedCategory && selectedEventId ? getEvent(selectedCategory, selectedEventId) : null;

  return (
    <>
    <form id="action-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Trigger Configuration - At the top */}
      <TriggerConfig actionId={id} onTriggersChange={setTriggers} />

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Action Information</CardTitle>
          <CardDescription>Configure the basic details of this action</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Name */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="action-name">Name *</FieldLabel>
                  <Input {...field} id="action-name" aria-invalid={fieldState.invalid} placeholder="Enter action name" />
                  <FieldDescription>A descriptive name for this action</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Category Selection */}
            <Field>
              <FieldLabel htmlFor="action-category">Category *</FieldLabel>
              <Select value={selectedCategory || undefined} onValueChange={handleCategoryChange}>
                <SelectTrigger id="action-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key} className="flex flex-col items-start">
                      <span className="font-medium">{info.label}</span>
                      <span className="text-xs text-muted-foreground">{info.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {selectedCategory && CATEGORY_INFO[selectedCategory]
                  ? CATEGORY_INFO[selectedCategory].description
                  : "Choose the category of action"}
              </FieldDescription>
            </Field>

            {/* Event Selection - Only show when category is selected */}
            {selectedCategory && (
              <Field>
                <FieldLabel htmlFor="action-event">Event *</FieldLabel>
                <Select value={selectedEventId || undefined} onValueChange={(value) => setSelectedEventId(value)}>
                  <SelectTrigger id="action-event">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id} className="flex flex-col items-start">
                        <span className="font-medium">{event.label}</span>
                        <span className="text-xs text-muted-foreground">{event.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {selectedEvent ? selectedEvent.description : "Choose the specific event to trigger"}
                </FieldDescription>
              </Field>
            )}

            {/* Description */}
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="action-description">Description (Optional)</FieldLabel>
                  <Textarea
                    {...field}
                    id="action-description"
                    aria-invalid={fieldState.invalid}
                    placeholder="Describe what this action does"
                    className="resize-none"
                    rows={3}
                  />
                  <FieldDescription>A detailed description of this action (max 500 characters)</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Metadata Fields - Dynamic based on category and event */}
      {selectedCategory && selectedEventId && selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedEvent.label} Configuration</CardTitle>
            <CardDescription>{selectedEvent.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <EventMetadataFields 
              category={selectedCategory} 
              eventId={selectedEventId} 
              control={form.control}
              triggerEventType={triggers.length > 0 ? triggers[0].event_type : undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* Submit Buttons */}
      <Card>
        <CardFooter className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTestModalOpen(true)}
            disabled={!selectedCategory || !selectedEventId}
          >
            Test Trigger
          </Button>
          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset
            </Button>
            <Button type="submit" form="action-form" disabled={!selectedCategory || !selectedEventId}>
              {id ? "Update Action" : "Create Action"}
            </Button>
          </div>
        </CardFooter>
      </Card>

    </form>

    {/* Test Trigger Modal - Outside form to prevent nested form submission */}
    <TestTriggerModal
      open={testModalOpen}
      onOpenChange={setTestModalOpen}
      action={form.getValues("action")}
      metadata={form.getValues("metadata") || {}}
      triggers={triggers}
      selectedEvent={selectedEvent}
    />
  </>
  );
}
