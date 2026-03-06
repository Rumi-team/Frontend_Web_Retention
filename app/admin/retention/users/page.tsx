"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserRow {
  user_id: string;
  segment: string;
  decision_count: number;
  last_contact: string | null;
}

const SEGMENT_BADGES: Record<string, string> = {
  new_users: "bg-green-900 text-green-300",
  active_frequent: "bg-blue-900 text-blue-300",
  lapsed: "bg-red-900 text-red-300",
  all_users: "bg-gray-800 text-gray-300",
};

export default function RetentionUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/retention/users?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400">
          Retention Users ({total})
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={users.length < 50}
            className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading users...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs">
                <th className="text-left p-3">User ID</th>
                <th className="text-left p-3">Segment</th>
                <th className="text-left p-3">Decisions</th>
                <th className="text-left p-3">Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.user_id}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="p-3 font-mono text-xs">
                    <Link
                      href={`/admin/retention/users/${u.user_id}`}
                      className="text-yellow-400 hover:underline"
                    >
                      {u.user_id.slice(0, 16)}...
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        SEGMENT_BADGES[u.segment] || SEGMENT_BADGES.all_users
                      }`}
                    >
                      {u.segment.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-3">{u.decision_count}</td>
                  <td className="p-3 text-xs text-gray-400">
                    {u.last_contact
                      ? new Date(u.last_contact).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
