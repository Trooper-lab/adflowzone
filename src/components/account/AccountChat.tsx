'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, limit, Timestamp } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { sendMessageToChildAgent } from '@/app/actions/chat-agent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id?: string;
  sender: 'user' | 'assistant';
  text: string;
  createdAt: any;
};

export default function AccountChat({
  parentClientId,
  accountId,
}: {
  parentClientId: string;
  accountId: string;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Query chat messages
  const chatMessagesQuery = useMemoFirebase(() => {
    if (!firestore || !parentClientId || !accountId) return null;
    return query(
      collection(firestore, 'parentClients', parentClientId, 'childAccounts', accountId, 'chatMessages'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, parentClientId, accountId]);

  const { data: fetchedMessages, loading: messagesLoading } = useCollection(chatMessagesQuery);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (fetchedMessages) {
      const msgs = (fetchedMessages as any[]).map((doc) => {
        let createdAt = doc.createdAt;
        if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
          createdAt = (createdAt as Timestamp).toDate().toISOString();
        }
        return {
          id: doc.id,
          sender: doc.sender,
          text: doc.text,
          createdAt,
        };
      });
      setMessages(msgs);
    }
  }, [fetchedMessages]);

  // Send initial prompt when there are no messages in the database
  useEffect(() => {
    if (firestore && fetchedMessages && fetchedMessages.length === 0 && user) {
      const chatMessagesCol = collection(
        firestore,
        'parentClients',
        parentClientId,
        'childAccounts',
        accountId,
        'chatMessages'
      );
      addDoc(chatMessagesCol, {
        sender: 'assistant',
        text: "Hoi! Ik ben je OnlyForward AI-campagnepartner. Wil je de data van het dashboard van de afgelopen 7, 14 en 30 dagen met me delen zodat ik die kan analyseren? Op basis van die data gaan we campagnes maken.",
        createdAt: Timestamp.now()
      }).catch(err => console.error("Error creating initial chatbot message:", err));
    }
  }, [firestore, fetchedMessages, parentClientId, accountId, user]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !firestore || isThinking) return;

    const currentInput = textToSend;
    setInputText('');
    setIsThinking(true);

    try {
      // 1. Write user message to Firestore
      const chatMessagesCol = collection(
        firestore,
        'parentClients',
        parentClientId,
        'childAccounts',
        accountId,
        'chatMessages'
      );

      await addDoc(chatMessagesCol, {
        sender: 'user',
        text: currentInput,
        createdAt: Timestamp.now(),
      });

      // 2. Format history for Genkit
      // ChatHistory format: { role: 'user' | 'model', parts: { text: string }[] }[]
      const historyForGenkit = messages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: m.text }],
      }));

      // 3. Call server action
      const response = await sendMessageToChildAgent(
        parentClientId,
        accountId,
        currentInput,
        historyForGenkit
      );

      // 4. Write assistant response to Firestore
      if (response.success && response.text) {
        await addDoc(chatMessagesCol, {
          sender: 'assistant',
          text: response.text,
          createdAt: Timestamp.now(),
        });
      } else {
        await addDoc(chatMessagesCol, {
          sender: 'assistant',
          text: `Fout bij antwoorden: ${response.error || 'Geen reactie ontvangen.'}`,
          createdAt: Timestamp.now(),
        });
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const suggestions = [
    'Analyseer de Google Ads campagneprestaties',
    'Welke openstaande taken hebben prioriteit?',
    'Geef suggesties om de conversieratio te verhogen',
    'Bedenk een korte marketing hook voor dit account',
  ];

  return (
    <Card className="bg-secondary border border-border flex flex-col h-[650px] overflow-hidden rounded-xl shadow-2xl">
      <CardHeader className="border-b border-border bg-slate-900/40 px-6 py-4 shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2.5 text-slate-100 font-headline font-semibold text-lg">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <span>AI Sparringpartner</span>
        </CardTitle>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
          Gekoppeld aan klantdata
        </span>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 bg-slate-950/20">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 custom-scrollbar">
          {messagesLoading && messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm">Berichten laden...</p>
            </div>
          )}

          {!messagesLoading && messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-full text-primary">
                <MessageSquare className="size-10" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-lg mb-1.5">Spar met de AI over dit account</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Deze AI agent heeft directe toegang tot de doelstellingen, Google Ads campagneprestaties en openstaande taken van dit account. Stel een vraag om te beginnen!
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-4">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    className="text-left text-xs bg-slate-900/40 hover:bg-secondary border border-border hover:border-primary/20 text-slate-300 hover:text-slate-100 p-3 rounded-lg transition-all duration-200 shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id || idx}
                className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md transition-all duration-200 whitespace-pre-wrap',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-card border border-border text-slate-200 rounded-tl-none'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="flex w-full justify-start">
              <div className="bg-card border border-border text-slate-300 rounded-2xl rounded-tl-none px-4 py-3 text-sm flex items-center gap-2.5 shadow-md">
                <div className="flex space-x-1">
                  <div className="size-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="size-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="size-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-slate-400 font-medium">AI is aan het nadenken...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-border bg-slate-900/40 p-4 shrink-0 flex items-center gap-3"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Stel een vraag over dit account..."
            disabled={isThinking}
            className="flex-1 bg-slate-950/40 border-border text-slate-100 placeholder-slate-500 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary/50 h-11"
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            size="icon"
            className="h-11 w-11 bg-primary hover:bg-primary/95 text-primary-foreground shrink-0 shadow-lg"
          >
            {isThinking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
