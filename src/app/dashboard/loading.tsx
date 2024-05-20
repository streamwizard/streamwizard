import LoadingSpinner from "@/components/global/loading";
import React from "react";

export default function loading() {
  return (
    <div className=" flex justify-center items-center">
      <span className="h-10 w-10">
        <LoadingSpinner />
      </span>
    </div>
  );
}
