import { useState } from "react";
import { CreateChatButton, SearchField } from "./ai-chats-fields";

export function ControlsSection() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section className="space-y-3">
      <SearchField onChange={setSearchQuery} value={searchQuery} />
      <CreateChatButton />
    </section>
  );
}
