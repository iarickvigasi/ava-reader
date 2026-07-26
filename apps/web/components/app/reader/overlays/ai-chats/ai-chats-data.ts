export type AiChat = {
  id: string;
  title: string;
};

export type AiChatGroup = {
  id: string;
  // Optional fallback. The renderer derives the label from `id` when it
  // matches a known key ("today"/"yesterday") or an ISO date — only set
  // `label` for arbitrary, server-supplied group names.
  label?: string;
  chats: AiChat[];
};

// Sample content used while the panel is UI-only. Replace with real data when
// the chat backend is wired in.
export const SAMPLE_AI_CHAT_GROUPS: AiChatGroup[] = [
  {
    id: "today",
    chats: [
      { id: "today-chat-3", title: "Chat #3" },
      { id: "today-chat-5", title: "Chat #5" },
    ],
  },
  {
    id: "2026-04-03",
    chats: [
      { id: "apr-3-chat-5", title: "Chat #5" },
      { id: "apr-3-chat-6", title: "Chat #6" },
    ],
  },
];
