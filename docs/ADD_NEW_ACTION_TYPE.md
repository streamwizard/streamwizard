# How to Add a New Action Type

This guide explains how to add a new action type to the system in a scalable way.

## Overview

The action system is designed to be easily extensible. To add a new action type, you need to update three files:

1. **Action Types Definition** - Define the action type and its metadata schema
2. **Metadata Fields Component** - Add UI fields for the action's metadata
3. **Action Type Info** - Add display information for the action

## Step-by-Step Guide

### Step 1: Define the Action Type

Open `/src/lib/actions/action-types.ts`

#### 1.1 Add the Action Type Constant

```typescript
export const ACTION_TYPES = {
  // ... existing types
  YOUR_NEW_ACTION: "your_new_action", // Add your new action here
} as const;
```

#### 1.2 Define the Metadata Schema

```typescript
// Your New Action Metadata Schema
const yourNewActionMetadataSchema = z.object({
  // Define your metadata fields with validation
  fieldName: z.string().min(1, "Field is required"),
  optionalField: z.number().optional(),
  // ... add more fields as needed
});
```

#### 1.3 Add to Metadata Schemas Map

```typescript
export const METADATA_SCHEMAS: Record<ActionType, z.ZodSchema> = {
  // ... existing schemas
  [ACTION_TYPES.YOUR_NEW_ACTION]: yourNewActionMetadataSchema,
};
```

#### 1.4 Export TypeScript Type

```typescript
export type YourNewActionMetadata = z.infer<typeof yourNewActionMetadataSchema>;

export type ActionMetadata =
  | SendMessageMetadata
  // ... other types
  | YourNewActionMetadata; // Add your type here
```

#### 1.5 Add Action Type Info

```typescript
export const ACTION_TYPE_INFO: Record<ActionType, { label: string; description: string }> = {
  // ... existing info
  [ACTION_TYPES.YOUR_NEW_ACTION]: {
    label: "Your New Action",
    description: "A brief description of what this action does",
  },
};
```

#### 1.6 Add Default Metadata

```typescript
export function getDefaultMetadata(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    // ... existing cases
    case ACTION_TYPES.YOUR_NEW_ACTION:
      return { fieldName: "", optionalField: 0 }; // Add default values
    default:
      return {};
  }
}
```

### Step 2: Create Metadata Fields Component

Open `/src/components/forms/metadata-fields.tsx`

#### 2.1 Add to Switch Statement

```typescript
export function MetadataFields({ actionType, control }: MetadataFieldsProps) {
  // ... existing code
  switch (actionType) {
    // ... existing cases
    case ACTION_TYPES.YOUR_NEW_ACTION:
      return <YourNewActionFields control={control} />;
    default:
      return null;
  }
}
```

#### 2.2 Create Fields Component

```typescript
// Your New Action Fields
function YourNewActionFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.fieldName"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-fieldName">Field Name *</FieldLabel>
            <Input
              {...field}
              id="metadata-fieldName"
              placeholder="Enter field value"
            />
            <FieldDescription>Description of what this field does</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      
      {/* Add more fields as needed */}
    </FieldGroup>
  );
}
```

### Step 3: Test Your New Action Type

1. Start your development server
2. Navigate to `/dashboard/smp/admin/actions/new`
3. Select your new action type from the dropdown
4. Verify that the metadata fields appear correctly
5. Test form validation
6. Test creating and updating actions with your new type

## Example: Adding a "Send Email" Action

Here's a complete example of adding a "Send Email" action:

### In `action-types.ts`:

```typescript
// 1. Add constant
export const ACTION_TYPES = {
  // ... existing
  SEND_EMAIL: "send_email",
} as const;

// 2. Define schema
const sendEmailMetadataSchema = z.object({
  recipient: z.string().email("Must be a valid email"),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Body is required"),
  attachments: z.string().optional(),
});

// 3. Add to schemas map
export const METADATA_SCHEMAS: Record<ActionType, z.ZodSchema> = {
  // ... existing
  [ACTION_TYPES.SEND_EMAIL]: sendEmailMetadataSchema,
};

// 4. Export type
export type SendEmailMetadata = z.infer<typeof sendEmailMetadataSchema>;

export type ActionMetadata =
  | SendMessageMetadata
  // ... other types
  | SendEmailMetadata;

// 5. Add info
export const ACTION_TYPE_INFO: Record<ActionType, { label: string; description: string }> = {
  // ... existing
  [ACTION_TYPES.SEND_EMAIL]: {
    label: "Send Email",
    description: "Send an email to a specified recipient",
  },
};

// 6. Add default metadata
export function getDefaultMetadata(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    // ... existing cases
    case ACTION_TYPES.SEND_EMAIL:
      return { recipient: "", subject: "", body: "", attachments: "" };
    default:
      return {};
  }
}
```

### In `metadata-fields.tsx`:

```typescript
// Add to switch
export function MetadataFields({ actionType, control }: MetadataFieldsProps) {
  switch (actionType) {
    // ... existing cases
    case ACTION_TYPES.SEND_EMAIL:
      return <SendEmailFields control={control} />;
    default:
      return null;
  }
}

// Create component
function SendEmailFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.recipient"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-recipient">Recipient Email *</FieldLabel>
            <Input
              {...field}
              id="metadata-recipient"
              type="email"
              placeholder="user@example.com"
            />
            <FieldDescription>Email address of the recipient</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      
      <Controller
        name="metadata.subject"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-subject">Subject *</FieldLabel>
            <Input
              {...field}
              id="metadata-subject"
              placeholder="Email subject"
            />
            <FieldDescription>Subject line of the email</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      
      <Controller
        name="metadata.body"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-body">Body *</FieldLabel>
            <Textarea
              {...field}
              id="metadata-body"
              placeholder="Email body content"
              className="resize-none"
              rows={6}
            />
            <FieldDescription>Content of the email</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      
      <Controller
        name="metadata.attachments"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-attachments">Attachments (Optional)</FieldLabel>
            <Input
              {...field}
              id="metadata-attachments"
              placeholder="Comma-separated file URLs"
            />
            <FieldDescription>URLs to files to attach (optional)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}
```

## Best Practices

1. **Naming Conventions**: Use SCREAMING_SNAKE_CASE for constants, camelCase for field names
2. **Validation**: Always add appropriate Zod validation for metadata fields
3. **Required Fields**: Mark required fields with an asterisk (*) in the label
4. **Descriptions**: Provide clear field descriptions for better UX
5. **Default Values**: Always provide sensible default values in `getDefaultMetadata()`
6. **Type Safety**: Export TypeScript types for all metadata schemas

## Common Field Types

Here are examples of common field patterns:

```typescript
// Text input
fieldName: z.string().min(1, "Required").max(100),

// Number input
numberField: z.number().int().min(0).max(100),

// Optional field
optionalField: z.string().optional(),

// URL field
urlField: z.string().url("Must be a valid URL"),

// Email field
emailField: z.string().email("Must be a valid email"),

// Enum/Select field
selectField: z.enum(["option1", "option2", "option3"]),

// Boolean field
booleanField: z.boolean().default(false),
```

## Troubleshooting

- **Fields not showing**: Make sure you added the case to the switch statement in MetadataFields
- **Validation errors**: Check that your metadata schema matches your field names (must have `metadata.` prefix in Controller name)
- **Type errors**: Ensure you added your new metadata type to the ActionMetadata union type
- **Default values not working**: Verify you added your action type to the getDefaultMetadata() function

## Need Help?

If you encounter issues or need clarification, refer to the existing action types as examples.




