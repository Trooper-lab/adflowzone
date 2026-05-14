'use client';

import { useState, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus, X, Upload, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Bestand te groot',
        description: 'Upload een afbeelding van maximaal 2MB.',
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!comment.trim() || !firestore || !user) return;

    setIsSubmitting(true);
    try {
      let imageBase64: string | null = null;
      if (imageFile) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      await addDoc(collection(firestore, 'feedbacks'), {
        comment: comment.trim(),
        pageUrl: window.location.href,
        userId: user.uid,
        userEmail: user.email,
        imageBase64,
        createdAt: serverTimestamp(),
      });

      toast({ title: 'Feedback verzonden!', description: 'Bedankt voor je feedback.' });
      setComment('');
      clearImage();
      setIsOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Fout',
        description: 'Feedback kon niet worden verzonden. Probeer het opnieuw.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) setIsOpen(false);
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Feedback geven"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <MessageSquarePlus className="size-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Backdrop + Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Glassmorphic modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Platform Feedback</h3>
                <p className="mt-0.5 text-xs text-slate-400">Deel een opmerking, bug of suggestie</p>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Current page URL */}
            <div className="mb-4 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Huidige pagina</p>
              <p className="mt-0.5 truncate text-xs text-slate-300">
                {typeof window !== 'undefined' ? window.location.pathname : ''}
              </p>
            </div>

            {/* Comment textarea */}
            <Textarea
              placeholder="Beschrijf je feedback, een bug of een suggestie..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="mb-4 resize-none border-white/10 bg-white/5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary/50 disabled:opacity-60"
            />

            {/* Screenshot upload */}
            <div className="mb-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-lg border border-white/10">
                  <img
                    src={imagePreview}
                    alt="Screenshot preview"
                    className="h-32 w-full object-cover"
                  />
                  <button
                    onClick={clearImage}
                    disabled={isSubmitting}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white/80 transition-colors hover:text-white disabled:opacity-50"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-xs text-slate-400 transition-colors hover:border-white/40 hover:text-slate-300 disabled:opacity-50"
                >
                  <Upload className="size-3.5" />
                  Screenshot bijvoegen (optioneel, max 2MB)
                </button>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!comment.trim() || isSubmitting}
              className="w-full gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Verstuur feedback
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
