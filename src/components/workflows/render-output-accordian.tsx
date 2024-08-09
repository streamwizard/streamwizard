import React from "react";

type Props = {
  SettingsComponent: React.FC | null;
};

const RenderOutputAccordion = ({ SettingsComponent }: Props) => {
  return <>{SettingsComponent ? <SettingsComponent /> : <div>No settings available</div>}</>;
  // return <></>
};

export default RenderOutputAccordion;
