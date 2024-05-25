import ModalButton from "@/components/buttons/modal-button";
import ChannelpointForm from "@/components/forms/channelpoint-form";
import { ChannelPointsColumns } from "@/components/tabels/channelpoints/channelpoints-columns";
import { ChannelPointsTable } from "@/components/tabels/channelpoints/channelpoints-table";
import React from "react";

export default function page() {
  return (
    <div className="hidden h-full  flex-1 flex-col  md:flex">
      <div className="flex items-center justify-between space-y-2 border rounded p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ChannelPoints</h2>
        </div>
        <div className="flex items-center space-x-2">
          <ModalButton buttonText="Add ChannelPoint" ModalComponent={ChannelpointForm} />
        </div>
      </div>
      <div className="flex items-center justify-between space-y-2 border rounded p-4 mt-4">
        <ChannelPointsTable columns={ChannelPointsColumns} />
      </div>
    </div>
  );
}
