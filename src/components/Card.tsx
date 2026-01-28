interface CardProps {
  variant?: 'default' | 'blue' | 'green' | 'brown';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-background-card',
  blue: 'bg-background-card-blue',
  green: 'bg-background-card-green',
  brown: 'bg-background-card-brown',
};

export function Card({ variant = 'default', children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl p-6 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
