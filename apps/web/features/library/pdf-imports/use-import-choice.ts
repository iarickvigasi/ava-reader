"use client";
import { useState } from "react";

export function useImportChoice(
  upload: (file: File) => void,
  ownerId?: string,
) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [choiceOwnerId, setChoiceOwnerId] = useState(ownerId);
  if (choiceOwnerId !== ownerId) {
    setChoiceOwnerId(ownerId);
    setPdf(null);
  }

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
