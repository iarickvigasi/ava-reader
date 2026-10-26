import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchField } from "@/components/app/shared/search-field";
import { CreateChatButton } from "./ai-chats-fields";

export function ControlsSection() {
  const t = useTranslations("reader.aiChats");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section className="space-y-3">
      <SearchField
        label={t("searchAria")}
        placeholder={t("searchPlaceholder")}
        onChange={(event) => setSearchQuery(event.target.value)}
        value={searchQuery}
      />
      <CreateChatButton />
    </section>
  );
}
