"use client";

export default function LoadingSpinner({ size = "default" }: { size?: "default" | "lg" }) {
  return <div className={`spinner ${size === "lg" ? "spinner-lg" : ""}`} />;
}
