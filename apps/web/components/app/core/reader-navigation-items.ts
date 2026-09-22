import {
  ReaderLayoutIcon,
  FontControlsIcon,
  ReaderNotesIcon,
  ReaderFavoritesIcon,
  SparkIcon,
  ReaderBookmarksIcon,
  ReaderSearchIcon,
  ReaderListeningIcon,
  ReaderTranslationIcon,
  ReaderSaveIcon,
  ReaderShareIcon,
  ReaderDownloadIcon,
} from "@/components/app/shared/app-icons";

export const readerNavItems = [
  { href: "", icon: ReaderLayoutIcon, id: "contents", panel: "contents" },
  { href: "", icon: FontControlsIcon, id: "preferences", panel: "preferences" },
  { href: "", icon: ReaderNotesIcon, id: "aiChats", panel: "ai-chats" },
  {
    href: "",
    icon: ReaderFavoritesIcon,
    id: "highlights",
    panel: "highlights",
  },
  { href: "", icon: SparkIcon, id: "aiComments", panel: "ai-comments" },
  { href: "", icon: ReaderBookmarksIcon, id: "bookmarks" },
  { href: "", icon: ReaderSearchIcon, id: "search" },
  { href: "", icon: ReaderListeningIcon, id: "listenToBook" },
  {
    href: "",
    icon: ReaderTranslationIcon,
    id: "bilingualMode",
  },
] as const;

export const readerUtilityItems = [
  { icon: ReaderSaveIcon, id: "savePage" },
  { icon: ReaderShareIcon, id: "shareBook" },
  { icon: ReaderDownloadIcon, id: "downloadBook" },
] as const;
