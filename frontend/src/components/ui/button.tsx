import { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';
export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={twMerge(
        'inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-[#0f5c7e] disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
