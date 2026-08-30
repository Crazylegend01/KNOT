import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase";

type QueueItem = {
  id: string | number;
  caption: string | null;
  scheduled_for: string;
  status: "pending" | "processing" | "completed" | "failed";
};

export default function KnotDashboardPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    async function getQueue() {
      const { data, error } = await createClient()
        .from("media_queue")
        .select("id, caption, scheduled_for, status")
        .order("scheduled_for", { ascending: true });

      if (!error && data) {
        setQueue(data as QueueItem[]);
      }
    }

    getQueue();
  }, []);

  return (
    <main>
      <h1>Your status queue</h1>
      <ul>
      {queue.map((item) => (
        <li key={item.id}>{item.caption || "Untitled status"} — {new Date(item.scheduled_for).toLocaleString()} ({item.status})</li>
      ))}
      </ul>
    </main>
  );
}
