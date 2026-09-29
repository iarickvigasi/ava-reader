"use client";
import { useState } from "react";

export function useImportChoice(upload: (file: File) => void) {
  const [pdf, setPdf] = useState<File | null>(null);
  return {
    pdf,
    choose: (file: File) => {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name))
        setPdf(file);
      else upload(file);
    },
    dismiss: () => setPdf(null),
    confirm: () => {
      if (pdf) upload(pdf);
      setPdf(null);
    },
  };
}
