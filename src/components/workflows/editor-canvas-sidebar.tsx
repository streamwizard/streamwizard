import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { onDragStart } from "@/lib/editor-utils";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";
import RenderOutputAccordion from "./render-output-accordian";
import { EditorCanvasDefaultCard, NodeSettingsComponent } from "@/lib/workflow-const";
import { useEffect } from "react";
import { Zap } from "lucide-react";

export default function WorkflowCanvasSidebar() {
  const { state, handleSave, dispatch } = useEditor();

  const handleTabChange = (value: string) => {
    dispatch({ type: "SET_SIDEBAR", payload: { sidebar: value as "triggers" | "actions" | "settings" } });
  };

  return (
    <aside className="h-full relative">
      <Tabs defaultValue="triggers" value={state.editor.sidebar} onValueChange={handleTabChange} className="h-full bg-[#0A0A0A]">
        <div className="flex justify-between">
          <TabsList className="bg-transparent block">
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <div>
            <Button type="button" className="text-white" onClick={() => handleSave()}>
              Save
            </Button>
          </div>
        </div>
        <Separator />
        <div className="h-full overflow-scroll pb-14">
          <TabsContent value="triggers">
            {Object.entries(EditorCanvasDefaultCard).map(([provider, ProviderValues]) => (
              <Accordion key={provider} type="multiple">
                <AccordionItem value="Options" className="px-2">
                  <AccordionTrigger className="!no-underline">{provider}</AccordionTrigger>
                  <AccordionContent>
                    {ProviderValues.Triggers.map((Trigger) => (
                      <Card
                        key={Trigger.title}
                        draggable
                        onDragStart={(e) => onDragStart(e, Trigger.type, provider)}
                        className="flex flex-row items-center p-4 my-4 cursor-pointer"
                      >
                        <div>{Trigger.icon ? <Trigger.icon size={30} /> : <Zap size={30} />}</div>
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
          <TabsContent value="actions">
            {Object.entries(EditorCanvasDefaultCard).map(([provider, ProviderValues]) => (
              <Accordion key={provider} type="multiple">
                <AccordionItem value="Options" className="px-2">
                  <AccordionTrigger className="!no-underline">{provider}</AccordionTrigger>
                  <AccordionContent>
                    {ProviderValues.Actions.map((action) => (
                      <>
                        <Card
                          key={action.title}
                          draggable
                          onDragStart={(e) => onDragStart(e, action.type, provider)}
                          className="flex flex-row items-center p-4 my-4 cursor-pointer"
                        >
                          <div>{action.icon ? <action.icon size={30} /> : <Zap size={30} />}</div>
                          <CardHeader>
                            <CardTitle>{action.title}</CardTitle>
                            <CardDescription>{action.description}</CardDescription>
                          </CardHeader>
                        </Card>
                      </>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </TabsContent>
          <TabsContent value="settings">
            <div className="px-4 ">
              <RenderOutputAccordion
                SettingsComponent={
                  NodeSettingsComponent[
                    state.editor.selectedNode ? (state.editor.selectedNode.data.type as keyof typeof NodeSettingsComponent) : "default-settings"
                  ]
                }
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
