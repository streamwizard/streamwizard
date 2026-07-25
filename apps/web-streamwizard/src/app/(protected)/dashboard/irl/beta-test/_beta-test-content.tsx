"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@repo/ui";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import {
  BETA_TEST_SECTIONS,
  OPEN_QUESTIONS,
  RESULT_OPTIONS,
  TESTER_INFO_FIELDS,
  TOTAL_CASES,
  type ResultValue,
} from "@/lib/obs-beta-test-plan";
import {
  saveObsBetaFeedback,
  submitObsBetaFeedback,
  type ObsBetaFeedbackRow,
} from "@/actions/supabase/obs-beta-feedback";
import type { BetaCaseAnswer, BetaFeedbackValues } from "@/schemas/obs-beta-feedback";

interface BetaTestContentProps {
  canInteract: boolean;
  initial: ObsBetaFeedbackRow | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const RESULT_BADGE_CLASSES: Record<ResultValue, string> = {
  pass: "text-green-500",
  fail: "text-red-500",
  partial: "text-amber-500",
  blocked: "text-orange-500",
  skipped: "text-muted-foreground",
};

function initialValues(initial: ObsBetaFeedbackRow | null): BetaFeedbackValues {
  return {
    tester_info: (initial?.tester_info as Record<string, string>) ?? {},
    responses: (initial?.responses as Record<string, BetaCaseAnswer>) ?? {},
    overall: (initial?.overall as Record<string, string>) ?? {},
  };
}

export function BetaTestContent({ canInteract, initial }: BetaTestContentProps) {
  const [values, setValues] = useState<BetaFeedbackValues>(() => initialValues(initial));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitted, setSubmitted] = useState(initial?.status === "submitted");
  const [submitting, setSubmitting] = useState(false);

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedFirstRender = useRef(false);

  const answeredCount = useMemo(
    () => Object.values(values.responses).filter((a) => a?.result).length,
    [values.responses],
  );

  const scheduleSave = useCallback(() => {
    if (!canInteract) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(async () => {
      const result = await saveObsBetaFeedback(valuesRef.current);
      setSaveState(result.ok ? "saved" : "error");
      if (!result.ok) toast.error(result.error ?? "Couldn't save your answers. Try again?");
    }, 1200);
  }, [canInteract]);

  useEffect(() => {
    if (!skippedFirstRender.current) {
      skippedFirstRender.current = true;
      return;
    }
    scheduleSave();
  }, [values, scheduleSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setCaseAnswer = (caseId: string, patch: Partial<BetaCaseAnswer>) => {
    setValues((prev) => ({
      ...prev,
      responses: { ...prev.responses, [caseId]: { ...prev.responses[caseId], ...patch } },
    }));
  };

  const setTesterInfo = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, tester_info: { ...prev.tester_info, [fieldId]: value } }));
  };

  const setOverall = (questionId: string, value: string) => {
    setValues((prev) => ({ ...prev, overall: { ...prev.overall, [questionId]: value } }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const result = await submitObsBetaFeedback(valuesRef.current);
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      setSaveState("saved");
      toast.success("Feedback submitted. Thanks for breaking things for us.");
    } else {
      toast.error(result.error ?? "Couldn't submit. Try again?");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 pb-24 md:p-8">
      {!canInteract && <FeatureDisabledBanner />}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cloud OBS beta test</h1>
        <p className="text-muted-foreground">
          Work through each section, mark what passed and note what broke. Your answers save automatically, so you can
          stop and come back whenever. When you're done, hit Submit at the bottom.
        </p>
        <p className="text-muted-foreground text-sm">
          Anything that isn't a clean Pass: tell us what you did, what you expected and what actually happened. Tests
          marked <Badge variant="outline">live signal</Badge> need a real stream from your encoder.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              {answeredCount} of {TOTAL_CASES} tests answered
            </CardTitle>
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Saved"}
              {saveState === "error" && "Save failed"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={(answeredCount / TOTAL_CASES) * 100} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your setup</CardTitle>
          <CardDescription>So we can reproduce what you hit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {TESTER_INFO_FIELDS.map((field) => (
            <div key={field.id} className="flex flex-col gap-2">
              <Label htmlFor={`tester-${field.id}`}>{field.label}</Label>
              <Input
                id={`tester-${field.id}`}
                value={values.tester_info[field.id] ?? ""}
                placeholder={field.placeholder}
                disabled={!canInteract}
                onChange={(e) => setTesterInfo(field.id, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={[BETA_TEST_SECTIONS[0]!.id]} className="flex flex-col gap-2">
        {BETA_TEST_SECTIONS.map((section, index) => {
          const sectionAnswered = section.cases.filter((c) => values.responses[c.id]?.result).length;
          return (
            <AccordionItem key={section.id} value={section.id} className="rounded-lg border px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-4 pr-2">
                  <span className="text-left font-medium">
                    {index + 1}. {section.title}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      sectionAnswered === section.cases.length ? "text-green-500" : "text-muted-foreground",
                    )}
                  >
                    {sectionAnswered}/{section.cases.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                {section.intro && <p className="text-muted-foreground text-sm">{section.intro}</p>}
                {section.cases.map((testCase) => {
                  const answer = values.responses[testCase.id];
                  return (
                    <div key={testCase.id} className="flex flex-col gap-3 rounded-md border p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground font-mono text-xs">{testCase.id}</span>
                          {testCase.needsLiveSignal && <Badge variant="outline">live signal</Badge>}
                          {answer?.result && (
                            <span className={cn("text-xs font-medium capitalize", RESULT_BADGE_CLASSES[answer.result])}>
                              {answer.result}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium">{testCase.action}</p>
                        <p className="text-muted-foreground text-sm">Expected: {testCase.expected}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                        <Select
                          value={answer?.result ?? ""}
                          disabled={!canInteract}
                          onValueChange={(value) => setCaseAnswer(testCase.id, { result: value as ResultValue })}
                        >
                          <SelectTrigger aria-label={`Result for test ${testCase.id}`}>
                            <SelectValue placeholder="Result" />
                          </SelectTrigger>
                          <SelectContent>
                            {RESULT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={answer?.notes ?? ""}
                          placeholder="Notes: what you saw, timings, error messages"
                          disabled={!canInteract}
                          className="min-h-[38px]"
                          onChange={(e) => setCaseAnswer(testCase.id, { notes: e.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The bigger picture</CardTitle>
          <CardDescription>The part we read twice. Be blunt.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {OPEN_QUESTIONS.map((question) => (
            <div key={question.id} className="flex flex-col gap-2">
              <Label htmlFor={`overall-${question.id}`}>{question.label}</Label>
              <Textarea
                id={`overall-${question.id}`}
                value={values.overall[question.id] ?? ""}
                placeholder={question.placeholder}
                disabled={!canInteract}
                onChange={(e) => setOverall(question.id, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {submitted
            ? "Submitted. You can keep editing, changes still save."
            : "Submit when you're done. You can keep editing after."}
        </p>
        <Button onClick={handleSubmit} disabled={!canInteract || submitting}>
          {submitting ? "Submitting…" : submitted ? "Resubmit feedback" : "Submit feedback"}
        </Button>
      </div>
    </div>
  );
}
