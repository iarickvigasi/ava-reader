export type AiChat = {
  id: string;
  title: string;
};

export type AiChatGroup = {
  id: string;
  label: string;
  chats: AiChat[];
};

// Sample content used while the panel is UI-only. Replace with real data when
// the chat backend is wired in.
export const SAMPLE_AI_CHAT_GROUPS: AiChatGroup[] = [
  {
    id: "today",
    label: "Today",
    chats: [
      { id: "today-chat-3", title: "Chat #3" },
      { id: "today-chat-5", title: "Chat #5" },
    ],
  },
  {
    id: "2026-04-03",
    label: "3 Apr 2026",
    chats: [
      { id: "apr-3-chat-5", title: "Chat #5" },
      { id: "apr-3-chat-6", title: "Chat #6" },
    ],
  },
];
