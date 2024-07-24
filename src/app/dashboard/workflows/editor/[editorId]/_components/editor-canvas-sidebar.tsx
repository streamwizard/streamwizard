"use client";
import { useNodeConnections } from "@/providers/connections-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import React, { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { CONNECTIONS, EditorCanvasDefaultCard } from "@/lib/constant";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { onConnections, onDragStart } from "@/lib/editor-utils";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import RenderConnectionAccordion from "./render-connection-accordion";
import RenderOutputAccordion from "./render-output-accordian";
import { useEditor } from "@/providers/workflow-editor-provider";
import { EditorCanvasTypes, EditorNodeType } from "@/types/workflow";
import { useFuzzieStore } from "@/store";

type Props = {
  nodes: any;
};

const EditorCanvasSidebar = ({ nodes }: Props) => {
  const { state } = useEditor();
  const { nodeConnection } = useNodeConnections();

  return (
    <aside>
      <Tabs defaultValue="actions" className="h-screen overflow-scroll pb-24">
        <TabsList className="bg-transparent">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <Separator />
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
                      <EditorCanvasIconHelper type={action.type as EditorCanvasTypes} />
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
        <TabsContent value="settings" className="-mt-6">
          {/* <div className="px-2 py-4 text-center text-xl font-bold">{state.editor.selectedNode.data.title}</div> */}

          <Accordion type="multiple">
            <AccordionItem value="Options" className="border-y-[1px] px-2">
              <AccordionTrigger className="!no-underline">Account</AccordionTrigger>
              <AccordionContent>
                {CONNECTIONS.map((connection) => (
                  <RenderConnectionAccordion key={connection.title} state={state} connection={connection} />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="Expected Output" className="px-2">
              <AccordionTrigger className="!no-underline">Action</AccordionTrigger>
              <RenderOutputAccordion state={state} nodeConnection={nodeConnection} />
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </aside>
  );
};

export default EditorCanvasSidebar;
