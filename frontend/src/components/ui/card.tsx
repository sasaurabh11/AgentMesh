import { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge('rounded-md border border-border bg-white p-4 shadow-sm', className)}
      {...props}
    />
  );
}
