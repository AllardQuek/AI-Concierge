import React from 'react';

interface IconCircleProps {
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  color?: 'gray' | 'green' | 'blue' | 'red';
  animate?: boolean;
  className?: string;
}

export const IconCircle: React.FC<IconCircleProps> = ({
  children,
  size = 'large',
  color = 'gray',
  animate = false,
  className = ""
}) => {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-16 h-16', 
    large: 'w-20 h-20'
  };

  const colorClasses = {
    gray: 'bg-gray-100',
    green: 'bg-green-100',
    blue: 'bg-blue-100',
    red: 'bg-red-100'
  };

  const animateClass = animate ? 'animate-pulse' : '';

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full flex items-center justify-center mx-auto mb-6 ${animateClass} ${className}`}>
      {children}
    </div>
  );
};
