import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertTranslationSchema } from "#/db/schema";

export function useTranslations() {
  return useQuery({
    queryKey: ['/api/translation'],
    queryFn: async () => {
      const res = await fetch('/api/translation');
      if (!res.ok) throw new Error("Failed to fetch translations");
      const data = await res.json();
      return data;
    }
  });
}
