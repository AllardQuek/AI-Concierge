import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = "",
  type = 'button',
  fullWidth = false
}) => {
  const baseClasses = "font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white focus:ring-blue-500",
    secondary: "bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 focus:ring-gray-500",
    danger: "bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white focus:ring-red-500",
    success: "bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white focus:ring-green-500"
  };

  const sizeClasses = {
    small: "py-2 px-4 text-sm",
    medium: "py-3 px-6 text-base",
    large: "py-4 px-8 text-lg"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
    >
      {children}
    </button>
  );
};
