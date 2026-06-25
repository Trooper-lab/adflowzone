'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MessageSquare, Link2, Clock, User } from 'lucide-react';

type FeedbackDoc = {
  id: string;
  comment: string;
  pageUrl: string;
  userId: string;
  userEmail: string;
  imageBase64: string | null;
  createdAt: { seconds: number; nanoseconds: number } | null;
};

export default function PlatformFeedbackPage() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [appUser, setAppUser] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !user) return;
    const unsubscribe = onSnapshot(doc(firestore, 'users', user.uid), (d) => {
      if (d.exists()) setAppUser({ id: d.id, ...d.data() });
    });
    return () => unsubscribe();
  }, [firestore, user]);

  const isAdmin = useMemo(() => {
    const role = appUser?.role?.toLowerCase();
    return (
      role === 'admin' ||
      user?.email === 'billy@pearsonline.nl' ||
      user?.email === 'billy@trooper.es' ||
      user?.email?.toLowerCase() === 'admin@onlyforward.nl'
    );
  }, [appUser, user?.email]);

  useEffect(() => {
    if (!authLoading && appUser && !isAdmin) {
      toast({ variant: 'destructive', title: 'Toegang geweigerd' });
      router.push('/dashboard');
    }
  }, [authLoading, appUser, isAdmin, router, toast]);

  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const q = query(collection(firestore, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setFeedbacks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackDoc)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [firestore, isAdmin]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-headline text-2xl font-bold text-slate-100">Platform Feedback</h1>
        <p className="mt-1 text-sm text-slate-400">
          {feedbacks.length} reactie{feedbacks.length !== 1 ? 's' : ''} ontvangen
        </p>
      </div>

      {feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-secondary py-20 text-center">
          <MessageSquare className="mb-3 size-10 text-slate-600" />
          <p className="text-sm text-slate-400">Nog geen feedback ontvangen.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {feedbacks.map((fb) => {
            const date = fb.createdAt ? new Date(fb.createdAt.seconds * 1000) : null;
            return (
              <Card key={fb.id} className="flex flex-col border-border bg-card">
                <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                  {/* Comment */}
                  <p className="text-sm leading-relaxed text-slate-200">{fb.comment}</p>

                  {/* Screenshot thumbnail */}
                  {fb.imageBase64 && (
                    <button
                      onClick={() => setExpandedImage(fb.imageBase64)}
                      className="mt-1 overflow-hidden rounded-lg border border-border transition-colors hover:border-border"
                    >
                      <img
                        src={fb.imageBase64}
                        alt="Screenshot"
                        className="h-36 w-full object-cover"
                      />
                    </button>
                  )}

                  {/* Meta info */}
                  <div className="mt-auto space-y-1.5 border-t border-border pt-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{fb.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Link2 className="size-3 shrink-0" />
                      <span className="truncate">{fb.pageUrl}</span>
                    </div>
                    {date && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="size-3 shrink-0" />
                        <span>
                          {date.toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Screenshot"
            className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
