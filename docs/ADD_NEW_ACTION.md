# How to Add New Actions (Category/Event System)

This guide explains how to add new action categories and events to the scalable action system.

## System Overview

The action system uses a two-level hierarchy:
1. **Category** - Top-level grouping (e.g., Jumpscares, Sounds, Messages)
2. **Event** - Specific action within a category (e.g., "Welcome Home", "Play Audio")

Each event has its own metadata schema that defines what configuration fields it needs.

## File Structure

```
src/
├── lib/actions/
│   └── action-registry.ts         # Define categories, events, and metadata schemas
└── components/forms/
    └── event-metadata-fields.tsx  # Define UI fields for each category's events
```

## Adding a New Event to an Existing Category

### Step 1: Define the Event in `action-registry.ts`

Find the const for your category (e.g., `JUMPSCARE_EVENTS`) and add your new event:

```typescript
const JUMPSCARE_EVENTS: Record<string, ActionEvent> = {
  // ... existing events
  YOUR_NEW_EVENT: {
    id: "your_new_event",
    label: "Your New Event",
    description: "Description of what this event does",
    metadataSchema: z.object({
      // Define your metadata fields with validation
      fieldName: z.string().min(1, "Field is required"),
      optionalField: z.number().optional(),
      // ... add more fields as needed
    }),
    defaultMetadata: {
      // Default values for all fields
      fieldName: "",
      optionalField: 0,
    },
  },
};
```

### Step 2: Add UI Fields in `event-metadata-fields.tsx`

Find the function for your category (e.g., `JumpscareFields`) and add conditions to handle your new event:

```typescript
function JumpscareFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  // Add condition for your event
  if (eventId === "your_new_event") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.fieldName"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-fieldName">Field Name *</FieldLabel>
              <Input {...field} id="metadata-fieldName" placeholder="Enter value" />
              <FieldDescription>Description of this field</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {/* Add more fields as needed */}
      </FieldGroup>
    );
  }
  
  // ... existing event handlers
}
```

## Adding a New Category

### Step 1: Add Category Constant

In `action-registry.ts`, add to `ACTION_CATEGORIES`:

```typescript
export const ACTION_CATEGORIES = {
  // ... existing categories
  YOUR_CATEGORY: "your_category",
} as const;
```

### Step 2: Add Category Info

Add display information in `CATEGORY_INFO`:

```typescript
export const CATEGORY_INFO: Record<ActionCategory, { label: string; description: string; icon?: string }> = {
  // ... existing categories
  [ACTION_CATEGORIES.YOUR_CATEGORY]: {
    label: "Your Category",
    description: "Description of this category",
    icon: "🎯", // Optional emoji icon
  },
};
```

### Step 3: Define Events for Your Category

Create a const for your category's events:

```typescript
const YOUR_CATEGORY_EVENTS: Record<string, ActionEvent> = {
  EVENT_ONE: {
    id: "event_one",
    label: "Event One",
    description: "First event in your category",
    metadataSchema: z.object({
      field1: z.string().min(1, "Required"),
      field2: z.number().optional(),
    }),
    defaultMetadata: {
      field1: "",
      field2: 0,
    },
  },
  EVENT_TWO: {
    id: "event_two",
    label: "Event Two",
    description: "Second event in your category",
    metadataSchema: z.object({
      // ... your fields
    }),
    defaultMetadata: {
      // ... defaults
    },
  },
};
```

### Step 4: Register Your Category in Events Registry

Add your category to `EVENTS_REGISTRY`:

```typescript
export const EVENTS_REGISTRY: Record<ActionCategory, Record<string, ActionEvent>> = {
  // ... existing categories
  [ACTION_CATEGORIES.YOUR_CATEGORY]: YOUR_CATEGORY_EVENTS,
};
```

### Step 5: Create UI Component for Your Category

In `event-metadata-fields.tsx`, add your category to the switch statement:

```typescript
export function EventMetadataFields({ category, eventId, control }: EventMetadataFieldsProps) {
  // ...
  switch (category) {
    // ... existing cases
    case ACTION_CATEGORIES.YOUR_CATEGORY:
      return <YourCategoryFields eventId={eventId} control={control} />;
    default:
      return null;
  }
}
```

### Step 6: Implement Your Category Fields Component

Add at the bottom of `event-metadata-fields.tsx`:

```typescript
function YourCategoryFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  // Handle different events
  if (eventId === "event_one") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.field1"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-field1">Field 1 *</FieldLabel>
              <Input {...field} id="metadata-field1" placeholder="Enter value" />
              <FieldDescription>Description</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    );
  }
  
  if (eventId === "event_two") {
    return (
      <FieldGroup>
        {/* Fields for event two */}
      </FieldGroup>
    );
  }
  
  // Default fields if events share common configuration
  return (
    <FieldGroup>
      {/* Shared fields */}
    </FieldGroup>
  );
}
```

## Complete Example: Adding "Overlays" Category with "Show Image" Event

### In `action-registry.ts`:

```typescript
// 1. Add category constant
export const ACTION_CATEGORIES = {
  // ... existing
  OVERLAYS: "overlays",
} as const;

// 2. Add category info
export const CATEGORY_INFO: Record<ActionCategory, { label: string; description: string; icon?: string }> = {
  // ... existing
  [ACTION_CATEGORIES.OVERLAYS]: {
    label: "Overlays",
    description: "Display overlays on stream",
    icon: "🖼️",
  },
};

// 3. Define events
const OVERLAY_EVENTS: Record<string, ActionEvent> = {
  SHOW_IMAGE: {
    id: "show_image",
    label: "Show Image",
    description: "Display an image overlay on stream",
    metadataSchema: z.object({
      imageUrl: z.string().url("Must be a valid URL"),
      duration: z.number().int().min(100).max(60000).default(5000),
      position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).default("center"),
      opacity: z.number().min(0).max(100).default(100),
    }),
    defaultMetadata: {
      imageUrl: "",
      duration: 5000,
      position: "center",
      opacity: 100,
    },
  },
};

// 4. Register in registry
export const EVENTS_REGISTRY: Record<ActionCategory, Record<string, ActionEvent>> = {
  // ... existing
  [ACTION_CATEGORIES.OVERLAYS]: OVERLAY_EVENTS,
};
```

### In `event-metadata-fields.tsx`:

```typescript
// Add to switch statement
export function EventMetadataFields({ category, eventId, control }: EventMetadataFieldsProps) {
  // ...
  switch (category) {
    // ... existing cases
    case ACTION_CATEGORIES.OVERLAYS:
      return <OverlayFields eventId={eventId} control={control} />;
    default:
      return null;
  }
}

// Add component at bottom of file
function OverlayFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  if (eventId === "show_image") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.imageUrl"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-imageUrl">Image URL *</FieldLabel>
              <Input {...field} id="metadata-imageUrl" type="url" placeholder="https://example.com/image.png" />
              <FieldDescription>URL to the overlay image</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.duration"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-duration">Duration (ms)</FieldLabel>
              <Input
                {...field}
                id="metadata-duration"
                type="number"
                min={100}
                max={60000}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              <FieldDescription>How long to show the overlay (100-60000 ms)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.position"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-position">Position</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Where to position the overlay</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.opacity"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-opacity">Opacity (0-100)</FieldLabel>
              <Input
                {...field}
                id="metadata-opacity"
                type="number"
                min={0}
                max={100}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              <FieldDescription>Overlay opacity level</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    );
  }
  
  return null;
}
```

## Field Types Reference

### Text Input
```typescript
<Controller
  name="metadata.fieldName"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="metadata-fieldName">Field Name *</FieldLabel>
      <Input {...field} id="metadata-fieldName" placeholder="Enter text" />
      <FieldDescription>Description</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

### Number Input
```typescript
<Controller
  name="metadata.numberField"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="metadata-numberField">Number Field</FieldLabel>
      <Input
        {...field}
        id="metadata-numberField"
        type="number"
        min={0}
        max={100}
        onChange={(e) => field.onChange(e.target.valueAsNumber)}
      />
      <FieldDescription>Description</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

### Textarea
```typescript
<Controller
  name="metadata.textArea"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="metadata-textArea">Text Area</FieldLabel>
      <Textarea {...field} id="metadata-textArea" className="resize-none" rows={3} />
      <FieldDescription>Description</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

### Select Dropdown
```typescript
<Controller
  name="metadata.selectField"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="metadata-selectField">Select Field</FieldLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger id="metadata-selectField">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
      <FieldDescription>Description</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

### Switch (Boolean)
```typescript
<Controller
  name="metadata.switchField"
  control={control}
  render={({ field, fieldState }) => (
    <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
      <div>
        <FieldLabel htmlFor="metadata-switchField">Switch Field</FieldLabel>
        <FieldDescription>Description</FieldDescription>
      </div>
      <Switch id="metadata-switchField" checked={field.value} onCheckedChange={field.onChange} />
    </Field>
  )}
/>
```

## Best Practices

1. **Naming**: Use SCREAMING_SNAKE_CASE for constants, snake_case for IDs, camelCase for field names
2. **Validation**: Always add appropriate Zod validation for metadata fields
3. **Required Fields**: Mark required fields with an asterisk (*) in the label
4. **Descriptions**: Provide clear, helpful field descriptions
5. **Default Values**: Always provide sensible defaults in `defaultMetadata`
6. **IDs**: Keep event IDs simple and descriptive (e.g., "welcome_home", "play_audio")
7. **Icons**: Use emojis for category icons to make the UI more visual

## Testing Your New Action

1. Start the dev server
2. Go to `/dashboard/smp/admin/actions/new`
3. Select your category from the dropdown
4. Select your event from the dropdown
5. Verify metadata fields appear correctly
6. Test form validation
7. Test creating and updating actions

## Troubleshooting

- **Fields not showing**: Check the switch statement in `EventMetadataFields`
- **Validation errors**: Verify metadata schema matches field names exactly
- **Default values not working**: Check `defaultMetadata` in event definition
- **Category not appearing**: Ensure category is added to `EVENTS_REGISTRY`

## Data Storage

Actions are stored in the database with:
- `action` field: Stores as `"category:event"` (e.g., `"jumpscares:welcome_home"`)
- `metadata` field: JSON object with event-specific configuration

The system automatically handles parsing and formatting of the action string.



