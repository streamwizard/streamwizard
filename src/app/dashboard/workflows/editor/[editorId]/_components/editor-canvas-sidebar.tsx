"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { onDragStart } from "@/lib/editor-utils";
import { useEditor } from "@/providers/workflow-editor-provider";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";
import RenderOutputAccordion from "./render-output-accordian";
import { EditorCanvasDefaultCard, NodeSettingsComponent } from "../../../_utils/const";

const EditorCanvasSidebar = () => {
  const { state } = useEditor();

  return (
    <Tabs defaultValue="triggers">
      <TabsList className="bg-transparent">
        <TabsTrigger value="triggers">Triggers</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <Separator />
      <TabsContent value="triggers" className="flex flex-col gap-4 p-4">
        {Object.entries(EditorCanvasDefaultCard).map(([provider, ProviderValues]) => (
          <Accordion key={provider} type="multiple">
            <AccordionItem value="Options" className="border-y-[1px] px-2">
              <AccordionTrigger className="!no-underline">{provider}</AccordionTrigger>
              <AccordionContent>
                {ProviderValues.Triggers.map((Trigger) => (
                  <Card
                    key={Trigger.title}
                    draggable
                    onDragStart={(e) => onDragStart(e, Trigger.type, provider)}
                    className="flex flex-row items-center gap-4 cursor-pointer"
                  >
                    <EditorCanvasIconHelper type={Trigger.type} />
                    <CardHeader>
                      <CardTitle>{Trigger.title}</CardTitle>
                      <CardDescription>{Trigger.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </TabsContent>
      <TabsContent value="actions" className="flex flex-col gap-4 p-4">
        {Object.entries(EditorCanvasDefaultCard).map(([provider, ProviderValues]) => (
          <Accordion key={provider} type="multiple">
            <AccordionItem value="Options" className="border-y-[1px] px-2">
              <AccordionTrigger className="!no-underline">{provider}</AccordionTrigger>
              <AccordionContent>
                {ProviderValues.Actions.map((action) => (
                  <Card
                    key={action.title}
                    draggable
                    onDragStart={(e) => onDragStart(e, action.type, provider)}
                    className="flex flex-row items-center gap-4 cursor-pointer"
                  >
                    <EditorCanvasIconHelper type={action.type} />
                    <CardHeader>
                      <CardTitle>{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </TabsContent>
      <TabsContent value="settings">
        <RenderOutputAccordion SettingsComponent={NodeSettingsComponent[state.editor.selectedNode.data.type as keyof typeof NodeSettingsComponent]} />
      </TabsContent>
    </Tabs>
  );
};

export default EditorCanvasSidebar;
