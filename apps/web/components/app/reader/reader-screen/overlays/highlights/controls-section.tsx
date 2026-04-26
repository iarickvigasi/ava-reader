import { useState } from "react";
import { SearchField } from "./highlights-fields";

export function ControlsSection() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section>
      <SearchField onChange={setSearchQuery} value={searchQuery} />
    </section>
  );
}
