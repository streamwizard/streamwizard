"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconBraces, IconCopy, IconCheck } from "@tabler/icons-react";
import { getVariablesForTrigger, formatVariable, type TriggerVariable } from "@/lib/trigger-variables";
import { toast } from "sonner";

interface TriggerVariablesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEventType?: string;
  onInsertVariable?: (variable: string) => void;
}

export function TriggerVariablesModal({
  open,
  onOpenChange,
  triggerEventType,
  onInsertVariable,
}: TriggerVariablesModalProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const triggerVars = triggerEventType ? getVariablesForTrigger(triggerEventType) : null;

  const handleCopyVariable = async (variableName: string) => {
    const formatted = formatVariable(variableName);
    await navigator.clipboard.writeText(formatted);
    setCopiedVariable(variableName);
    toast.success(`Copied ${formatted} to clipboard`);
    
    setTimeout(() => {
      setCopiedVariable(null);
    }, 2000);
  };

  const handleInsertVariable = (variableName: string) => {
    if (onInsertVariable) {
      const formatted = formatVariable(variableName);
      onInsertVariable(formatted);
      toast.success(`Inserted ${formatted}`);
      onOpenChange(false);
    } else {
      handleCopyVariable(variableName);
    }
  };

  const getTypeColor = (type: TriggerVariable["type"]) => {
    switch (type) {
      case "string":
        return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950";
      case "number":
        return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
      case "boolean":
        return "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950";
      case "date":
        return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950";
      default:
        return "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBraces className="h-5 w-5" />
            Available Template Variables
          </DialogTitle>
          <DialogDescription>
            {triggerVars
              ? `Variables for ${triggerVars.label} events. Click a variable to ${onInsertVariable ? "insert" : "copy"} it.`
              : "Select a trigger event type to see available variables."}
          </DialogDescription>
        </DialogHeader>

        {!triggerEventType && (
          <div className="text-center py-8">
            <IconBraces className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Add a trigger to your action to see available variables
            </p>
          </div>
        )}

        {triggerVars && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Usage</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Use variables in your text fields with the syntax:{" "}
                <code className="px-2 py-1 bg-background rounded text-foreground">
                  {formatVariable("variable_name")}
                </code>
              </p>
              <p className="text-sm text-muted-foreground">
                Example: "Thank you for the follow, {formatVariable("user_name")}!"
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Available Variables</h3>
              <div className="grid gap-2">
                {triggerVars.variables.map((variable) => (
                  <button
                    key={variable.name}
                    onClick={() => handleInsertVariable(variable.name)}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-mono text-sm font-semibold">
                          {formatVariable(variable.name)}
                        </code>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getTypeColor(variable.type)}`}
                        >
                          {variable.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {variable.description}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Example: {variable.example}
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      {copiedVariable === variable.name ? (
                        <IconCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <IconCopy className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
