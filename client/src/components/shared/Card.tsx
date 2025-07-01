import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'normal' | 'large';
  center?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = "", 
  padding = 'normal',
  center = false 
}) => {
  const paddingClass = padding === 'large' ? 'p-8' : 'p-6';
  const centerClass = center ? 'text-center' : '';
  
  return (
    <div className={`bg-white rounded-xl shadow-xl ${paddingClass} ${centerClass} ${className}`}>
      {children}
    </div>
  );
};
