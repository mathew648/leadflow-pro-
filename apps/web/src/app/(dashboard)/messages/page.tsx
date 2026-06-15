"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Phone } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, formatRelative, initials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function MessagesPage() {
  const qc = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");

  const { data: threads } = useQuery({
    queryKey: ["message-threads"],
    queryFn: () => api.get<any[]>("/messages"),
    refetchInterval: 15000,
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation", selectedCustomerId],
    queryFn: () => api.get<any[]>(`/messages/conversation/${selectedCustomerId}`),
    enabled: !!selectedCustomerId,
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => api.post("/messages/send", {
      customerId: selectedCustomerId,
      channel,
      message: msg,
    }),
    onSuccess: () => {
      setNewMessage("");
      qc.invalidateQueries({ queryKey: ["conversation", selectedCustomerId] });
      qc.invalidateQueries({ queryKey: ["message-threads"] });
    },
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const threadList: any[] = threads ?? [];
  const messages: any[] = conversation ?? [];
  const selected = threadList.find((t) => t.customer_id === selectedCustomerId);

  return (
    <div className="flex h-full">
      <Topbar title="Messages" />

      <div className="flex flex-1 overflow-hidden mt-16 border-t">
        {/* Thread list */}
        <div className="w-72 border-r flex-shrink-0 overflow-y-auto">
          {threadList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm text-center">No messages yet. Send a message from a customer or lead profile.</p>
            </div>
          ) : (
            threadList.map((t: any) => (
              <button
                key={t.customer_id}
                onClick={() => setSelectedCustomerId(t.customer_id)}
                className={cn(
                  "w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors border-b",
                  selectedCustomerId === t.customer_id && "bg-brand-50 border-l-2 border-l-brand-500"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {initials(t.first_name, t.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{t.first_name} {t.last_name}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelative(t.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>
                  {t.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-white text-xs font-bold mt-1">
                      {t.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 flex flex-col">
          {!selectedCustomerId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b flex items-center gap-3">
                {selected && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center">
                      {initials(selected.first_name, selected.last_name)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selected.first_name} {selected.last_name}</p>
                      {selected.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{selected.phone}</p>}
                    </div>
                  </>
                )}
                {/* Channel toggle */}
                <div className="ml-auto flex border rounded-lg overflow-hidden">
                  <button onClick={() => setChannel("sms")} className={cn("px-3 py-1.5 text-xs font-medium", channel === "sms" ? "bg-primary text-white" : "hover:bg-muted")}>SMS</button>
                  <button onClick={() => setChannel("email")} className={cn("px-3 py-1.5 text-xs font-medium", channel === "email" ? "bg-primary text-white" : "hover:bg-muted")}>Email</button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => (
                  <div key={msg.id} className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm",
                      msg.direction === "outbound"
                        ? "bg-brand-500 text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}>
                      <p>{msg.body}</p>
                      <p className={cn("text-xs mt-1", msg.direction === "outbound" ? "text-brand-200" : "text-muted-foreground")}>
                        {formatRelative(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t flex gap-2">
                <Input
                  placeholder={channel === "sms" ? "Type an SMS message…" : "Type an email…"}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}}
                  className="flex-1"
                />
                <Button
                  onClick={() => { if (newMessage.trim()) sendMutation.mutate(newMessage.trim()); }}
                  disabled={!newMessage.trim() || sendMutation.isPending}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
