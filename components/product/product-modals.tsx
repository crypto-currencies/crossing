"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { useToastStore } from "@/store/toast";
import { authService } from "@/lib/services/auth.service";
import { clearAllUserState } from "@/store/clear-user-state";

function modalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useProductActions() {
  const router = useRouter();
  const { isAuthenticated, user, signOut: storeSignOut } = useAuthStore();
  const { openModal, closeModal } = useUIStore();
  const { success: toastSuccess } = useToastStore();

  const openLoginRequired = useCallback((reason = "Log in to continue.", returnTo?: string) => {
    const id = modalId("auth-required");
    const loginHref = returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : "/login";
    openModal({
      id,
      component: (
        <Modal
          open
          onClose={() => closeModal(id)}
          title="Login required"
          description={reason}
          size="sm"
        >
          <div className="flex items-center justify-end gap-[calc(var(--small-padding) / 1.75)]">
            <Button variant="ghost" size="md" onClick={() => closeModal(id)}>
              Keep browsing
            </Button>
            <Button variant="primary" size="md" asChild>
              <Link href={loginHref} onClick={() => closeModal(id)}>
                Log in
              </Link>
            </Button>
          </div>
        </Modal>
      ),
    });
  }, [closeModal, openModal]);

  const openComingSoon = useCallback((feature: string) => {
    const id = modalId("coming-soon");
    openModal({
      id,
      component: (
        <Modal
          open
          onClose={() => closeModal(id)}
          title={`${feature} is coming soon`}
          description="This feature is still being built. Check back soon."
          size="sm"
        >
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={() => closeModal(id)}>
              Got it
            </Button>
          </div>
        </Modal>
      ),
    });
  }, [closeModal, openModal]);

  const openSignOutConfirm = useCallback(() => {
    const id = modalId("sign-out");
    openModal({
      id,
      component: (
        <ConfirmModal
          open
          onClose={() => closeModal(id)}
          onConfirm={() => {
            const token = useAuthStore.getState().session?.token;
            // Clear all user-specific stores first, then clear auth
            clearAllUserState();
            storeSignOut();
            closeModal(id);
            router.push("/");
            // Invalidate server session (fire-and-forget)
            authService.signOut(token).catch(() => {});
            toastSuccess("Signed out");
          }}
          title="Sign out?"
          description="You'll need to log back in to access your account and settings."
          confirmLabel="Sign out"
          cancelLabel="Stay"
        />
      ),
    });
  }, [closeModal, openModal, router, storeSignOut, toastSuccess]);

  const guarded = useCallback((reason: string, action: () => void, returnTo?: string) => {
    if (!isAuthenticated) {
      openLoginRequired(reason, returnTo);
      return;
    }
    action();
  }, [isAuthenticated, openLoginRequired]);

  return {
    isAuthenticated,
    user,
    guarded,
    openLoginRequired,
    openComingSoon,
    openSignOutConfirm,
    navigate: router.push,
  };
}
