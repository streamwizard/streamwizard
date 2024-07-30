import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditorCanvasDefaultCard, NodeSettingsComponent } from "../../../_utils/const";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";
import { onDragStart } from "@/lib/editor-utils";
import RenderOutputAccordion from "./render-output-accordian";
import { useEditor } from "@/providers/workflow-editor-provider";
import { Separator } from "@/components/ui/separator";

export default function TabsDemo() {
  const { state } = useEditor();

  return (
    <aside className="h-full relative">
      <Tabs defaultValue="triggers" className="h-full overflow-scroll ">
        <TabsList className="bg-transparent block">
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <Separator />
        <TabsContent value="triggers">
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
        <TabsContent value="actions">
          {Object.entries(EditorCanvasDefaultCard).map(([provider, ProviderValues]) => (
            <Accordion key={provider} type="multiple">
              <AccordionItem value="Options" className="border-y-[1px] px-2">
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
                        <EditorCanvasIconHelper type={action.type} />
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
              SettingsComponent={NodeSettingsComponent[state.editor.selectedNode.data.type as keyof typeof NodeSettingsComponent]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
