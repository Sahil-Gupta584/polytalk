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

export function useCreateTranslation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      sourceLanguage: string;
      targetLanguage: string;
      sourceText: string;
      translatedText: string;
    }) => {
      const parsed = insertTranslationSchema.parse(data);
      const res = await fetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      
      if (!res.ok) throw new Error("Failed to save translation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translation'] });
    }
  });
}
