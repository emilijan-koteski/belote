export const queryKeys = {
  rooms: {
    all: ["rooms"] as const,
    list: (status: string) => ["rooms", "list", status] as const,
    detail: (id: number) => ["rooms", "detail", id] as const,
    byCode: (code: string) => ["rooms", "byCode", code] as const,
  },
  profile: {
    detail: (userId: number) => ["profile", userId] as const,
  },
  matches: {
    byUser: (userId: number) => ["matches", "byUser", userId] as const,
  },
} as const;
