import React from "react";

type Props = {
  SettingsComponent?: React.FC;
};

const RenderOutputAccordion = ({ SettingsComponent }: Props) => {
  return <>{SettingsComponent ? <SettingsComponent /> : (
    <div>
      No settings available
    </div>
  )}</>;
};

export default RenderOutputAccordion;
