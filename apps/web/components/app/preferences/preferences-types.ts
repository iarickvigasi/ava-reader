// Mirror of the API's PreferencesPayload. All fields are nullable: `null`
// from the server means "the user has not set this preference" — clients
// should fall back to their local default rather than treating null as a
// valid choice.

export type PreferencesPayload = {
  translateTargetLang: string | null;
  interfaceLang: string | null;
  theme: string | null;
  fontScale: number | null;
  readingGoalMinutes: number | null;
};

export type PreferenceField = keyof PreferencesPayload;
