import React from 'react';

interface LoadingSpinnerProps {
  size?: string;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({

  // color = 'text-blue-100',
}) => {
  return (
    <div className={`animate-spin w-full h-full  text-blue-100 border-blue-100 rounded-full border border-t-transparent`}>
      <span className="visually-hidden"></span>
    </div>
  );
};

export default LoadingSpinner;
