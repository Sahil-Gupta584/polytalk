import { createFileRoute } from '@tanstack/react-router'
import { storage } from '#/db/storage';

export const Route = createFileRoute('/api/translation/')({
  server:{
    handlers:{
      GET:async () => {
           const results = await storage.getTranslations();
    return new Response(JSON.stringify(results));
      }
    }
  }
})

