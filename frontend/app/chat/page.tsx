'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import ChatScreen from '@/components/ChatScreen';

export default function ChatPage() {
  const { token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.replace('/');
  }, [token, router]);

  if (!token) return null;
  return <ChatScreen />;
}
