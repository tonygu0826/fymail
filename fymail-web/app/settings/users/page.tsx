"use client";

import { useState } from "react";
import { Plus, Trash2, Shield, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

// Static user list for MVP — wire to Supabase Auth admin API in Phase 2
const DEMO_USERS = [
  { id: "1", name: "Tony G", email: "tony@fywarehouse.com", role: "admin", createdAt: "2024-01-15" },
  { id: "2", name: "Sarah K", email: "sarah@fywarehouse.com", role: "member", createdAt: "2024-02-01" },
  { id: "3", name: "Mike L", email: "mike@fywarehouse.com", role: "member", createdAt: "2024-03-10" },
];

export default function UsersPage() {
  const [users, setUsers] = useState(DEMO_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const handleInvite = () => {
    if (!inviteEmail) return;
    setUsers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: inviteEmail.split("@")[0],
        email: inviteEmail,
        role: inviteRole,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setInviteEmail("");
    setShowInvite(false);
  };

  const inputCls =
    "px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Users"
        description={`${users.length} team member${users.length !== 1 ? "s" : ""}`}
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Invite user
          </button>
        }
      />

      {/* Invite form */}
      {showInvite && (
        <div className="border border-border rounded-xl p-4 bg-card mb-5 max-w-md">
          <h3 className="text-sm font-semibold mb-3">Invite new user</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@fywarehouse.com"
                className={cn(inputCls, "w-full")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className={cn(inputCls, "w-full")}
              >
                <option value="member">Member — can view and operate campaigns</option>
                <option value="admin">Admin — full access including approvals</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInvite(false)}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Send invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="border border-border rounded-xl overflow-hidden max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Joined
              </th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {user.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {user.role === "admin" ? (
                      <>
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="text-xs font-medium text-primary">Admin</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Member</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {user.createdAt}
                </td>
                <td className="px-4 py-3">
                  {user.role !== "admin" && (
                    <button
                      onClick={() =>
                        setUsers((prev) => prev.filter((u) => u.id !== user.id))
                      }
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        User authentication is managed via Supabase Auth. Invite links are sent via email.
      </p>
    </>
  );
}
