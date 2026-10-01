"use client";

import { useRef } from "react";
import { FileTextIcon } from "lucide-react";

/**
 * Reads a key.properties file in the browser and hands its text over, so the
 * alias and passwords never have to be typed or pasted.
 */
export function KeyPropertiesButton({ onLoad }: { onLoad: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost h-7 px-2 text-[12px]"
        onClick={() => input.current?.click()}
      >
        <FileTextIcon className="size-3.5" />
        Load key.properties
      </button>
      <input
        ref={input}
        type="file"
        accept=".properties,text/plain"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onLoad((await file.text()).replace(/\r\n/g, "\n").trim());
          e.target.value = "";
        }}
      />
    </>
  );
}
