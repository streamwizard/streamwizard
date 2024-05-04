"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import useCommands from "@/hooks/useCommands";
import { CommandSchema } from "@/schemas/command-schema";
import { CommandsTable } from "@/types/database/command";
import { Textarea } from "../ui/textarea";
import { use, useEffect, useState } from "react";

interface Props {
  setModal: (value: boolean) => void;
  command?: CommandsTable;
}

export function CommandForm({ setModal, command }: Props) {
  const { addCommand, updateCommand } = useCommands();






  const form = useForm<z.infer<typeof CommandSchema>>({
    resolver: zodResolver(CommandSchema),
    defaultValues: {
      command: command?.command || "",
      action: command?.action || "null",
      message: command?.message || "",
      userlevel: (command?.userlevel as any) || "everyone",
      cooldown: command?.cooldown || 0,
      status: command?.status || true,
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof CommandSchema>) {
    // Update command
    if (command) {
      updateCommand({
        ...command,
        ...values,
      })
    }
    // Add command
    else {
      addCommand(values)
    }

    setModal(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex">
          <FormField
            control={form.control}
            name="command"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Command</FormLabel>
                <FormControl>
                  <Input placeholder="!song" {...field} />
                </FormControl>
                <FormDescription>This is your command trigger</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="action"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Action</FormLabel>
                <FormControl>
                  <Select onValueChange={(value) => field.onChange(value)} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Actions</SelectLabel>
                        <SelectItem value="null">None</SelectItem>
                        <SelectItem value="spotify.play">Play</SelectItem>
                        <SelectItem value="spotify.pause">Pause</SelectItem>
                        <SelectItem value="spotify.song_request">Song Request</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>This is your command action</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="userlevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Userlevel</FormLabel>
              <FormControl>
                <Select onValueChange={(value) => field.onChange(value)} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Actions</SelectLabel>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="follower">Follower</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="subscriber">Subscriber</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="super_moderator">Super Moderator</SelectItem>
                      <SelectItem value="broadcaster">Broadcaster</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>This is your command permission level</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cooldown"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cooldown</FormLabel>
              <FormControl>
                <Input type="number" placeholder="5" />
              </FormControl>
              <FormDescription>This is the global cooldown of the command</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea placeholder="the song currely playing is ${song} by ${song.artist}}" {...field} />
              </FormControl>
              <FormDescription>This is your command return message</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
