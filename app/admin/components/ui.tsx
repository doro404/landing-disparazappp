"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}
export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-sm",
        variant === "default" && "bg-[#25D366] text-black hover:bg-[#1fbd5a]",
        variant === "outline" && "border border-white/10 text-white/70 hover:text-white hover:border-white/20 bg-transparent",
        variant === "ghost"   && "text-white/60 hover:text-white hover:bg-white/5 bg-transparent",
        variant === "destructive" && "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20",
        className
      )}
      {...props}
    />
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-white/8 bg-white/[0.03] p-5", className)}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-white/70 uppercase tracking-wider", className)} {...props} />;
}
export function CardValue({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-3xl font-black text-white mt-1", className)} {...props} />;
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30",
        "focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/30 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

// ─── Label ────────────────────────────────────────────────────────────────────
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs text-white/50 mb-1 block", className)} {...props} />;
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "active" | "inactive" | "revoked" | "default";
}
export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        variant === "active"   && "bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30",
        variant === "inactive" && "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
        variant === "revoked"  && "bg-red-400/15 text-red-400 border-red-400/30",
        variant === "default"  && "bg-white/10 text-white/60 border-white/10",
        className
      )}
      {...props}
    />
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ className, children, ...props }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {/* Visually hidden title satisfies Radix accessibility requirement */}
        <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-bold text-white", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-white/40 mt-1", className)} {...props} />;
}
