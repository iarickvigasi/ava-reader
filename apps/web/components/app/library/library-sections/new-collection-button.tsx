"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { LibraryCollectionPayload } from "@/lib/api-types/library";
import {
  hydrateCollection,
  revalidateLibrary,
} from "@/features/offline/buckets/library";
import { isOnline } from "@/features/offline/net/net-state";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useOfflineModal } from "@/components/app/core/offline-modal-context";
import { EditCollectionModal } from "../collection/collection-actions/edit-modal";
import { ModalShell } from "../collection/collection-actions/modal-shell";
import {
  collectionFieldErrors,
  normalizeCollectionText,
} from "../shared/collection-input";

export function NewCollectionButton({ className }: { className?: string }) {
  const t = useTranslations("library.header");
  const errors = useTranslations("library.collectionActions.errors");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const offlineModal = useOfflineModal();
  const online = useNetworkState();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  function close() {
    if (submitting.current) return;
    setOpen(false);
    setName("");
    setDescription("");
    setError(null);
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!isOnline()) {
      setError(errors("createOffline"));
      return;
    }
    const normalizedName = normalizeCollectionText(name);
    const normalizedDescription = normalizeCollectionText(description);
    setName(normalizedName);
    setDescription(normalizedDescription);
    const fields = collectionFieldErrors(normalizedName, normalizedDescription);
    if (fields.name || fields.description) {
      setError(errors(fields.name ?? fields.description!));
      return;
    }
    if (!isLoaded || !isSignedIn) {
      setError(errors("signInToCreate"));
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError(errors("noToken"));
        return;
      }
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/library/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: normalizedName,
            description: normalizedDescription || null,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        const code = payload?.code;
        setError(
          errors(
            code &&
              [
                "nameEmpty",
                "nameTooLong",
                "nameDuplicate",
                "descriptionTooLong",
              ].includes(code)
              ? code
              : "createFailed",
          ),
        );
        return;
      }
      const payload = (await response.json()) as LibraryCollectionPayload;
      // The write succeeded: a cache failure must never invite a second POST.
      await hydrateCollection(payload.collection).catch(() => {});
      setOpen(false);
      setName("");
      setDescription("");
      void revalidateLibrary(getToken).catch(() => {});
      router.refresh();
    } catch {
      setError(errors(isOnline() ? "createFailed" : "createOffline"));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={() => {
          if (!isOnline()) {
            offlineModal.open();
            return;
          }
          setOpen(true);
        }}
        className={cn(
          "min-h-10 rounded-control px-4 text-[0.72rem] uppercase tracking-[0.14em] shadow-(--shadow-nav)",
          className,
        )}
      >
        {t("newCollection")}
      </Button>
      {open ? (
        <ModalShell onClose={close}>
          <EditCollectionModal
            mode="create"
            collectionName={name}
            collectionDescription={description}
            error={error}
            isPending={pending}
            offline={!online}
            onClose={close}
            onNameChange={(value) => {
              setName(value);
              setError(null);
            }}
            onDescriptionChange={(value) => {
              setDescription(value);
              setError(null);
            }}
            onSubmit={submit}
          />
        </ModalShell>
      ) : null}
    </>
  );
}
