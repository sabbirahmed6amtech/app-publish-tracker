"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveProductListing } from "@/lib/actions";
import { PLAY_CATEGORIES, PLAY_LIMITS } from "@/lib/constants";
import type { Product } from "@/lib/types";

/** One Play app's listing and App Review login — what the publisher fills in. */
export function ListingDialog({
  product,
  trigger,
  className = "btn btn-ghost h-7 px-2",
}: {
  product: Product;
  trigger: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [short, setShort] = useState(product.short_description ?? "");
  const [long, setLong] = useState(product.long_description ?? "");
  const [showPassword, setShowPassword] = useState(false);

  function show() {
    setError(null);
    setShort(product.short_description ?? "");
    setLong(product.long_description ?? "");
    setShowPassword(false);
    setOpen(true);
  }

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await saveProductListing(fd);
      if (!res.ok) return setError(res.error);
      toast.success("Listing saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className={className} onClick={show}>
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${product.app_name || product.project_name} · Play listing`}
        subtitle="What the publisher fills into Play Console for this app."
        width="max-w-2xl"
      >
        <form action={submit}>
          <input type="hidden" name="id" value={product.id} />
          <datalist id="play-categories">
            {PLAY_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div className="space-y-5 px-5 py-4">
            <section className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ls-package">
                  Package name
                </label>
                <input
                  id="ls-package"
                  name="package_name"
                  defaultValue={product.package_name ?? ""}
                  placeholder="com.client.app"
                  className="field font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 flex items-start gap-1 text-[11px] text-warn">
                  <AlertTriangleIcon className="mt-px size-3 shrink-0" />
                  Must match applicationId in build.gradle — it can never change after publishing.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="ls-category">
                  Store category
                </label>
                <input
                  id="ls-category"
                  name="play_category"
                  list="play-categories"
                  defaultValue={product.play_category ?? ""}
                  placeholder="Food & Drink"
                  className="field"
                />
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label className="label mb-0" htmlFor="ls-short">
                    Short description
                  </label>
                  <Counter value={short.length} max={PLAY_LIMITS.shortDescription} />
                </div>
                <input
                  id="ls-short"
                  name="short_description"
                  value={short}
                  onChange={(e) => setShort(e.target.value)}
                  placeholder="One line that sells the app."
                  className="field"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label className="label mb-0" htmlFor="ls-long">
                    Full description
                  </label>
                  <Counter value={long.length} max={PLAY_LIMITS.longDescription} />
                </div>
                <textarea
                  id="ls-long"
                  name="long_description"
                  value={long}
                  onChange={(e) => setLong(e.target.value)}
                  rows={6}
                  className="field resize-y"
                />
              </div>
            </section>

            <section className="rounded-xl border bg-muted/30 p-3.5">
              <h3 className="text-[13px] font-semibold">App Review access</h3>
              <p className="mb-3 text-[11px] text-muted-foreground">
                A working login Google&apos;s reviewers can use. Team-only — never shown on the
                public tracker.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="ls-instr">
                    Instruction name
                  </label>
                  <input
                    id="ls-instr"
                    name="demo_instructions"
                    defaultValue={product.demo_instructions ?? ""}
                    placeholder="Delivery account"
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ls-login">
                    Login (email / phone / username)
                  </label>
                  <input
                    id="ls-login"
                    name="demo_login"
                    defaultValue={product.demo_login ?? ""}
                    autoComplete="off"
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ls-pass">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="ls-pass"
                      name="demo_password"
                      type={showPassword ? "text" : "password"}
                      defaultValue={product.demo_password ?? ""}
                      autoComplete="new-password"
                      className="field pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="ls-details">
                    Extra details for reviewers
                  </label>
                  <textarea
                    id="ls-details"
                    name="demo_details"
                    rows={2}
                    defaultValue={product.demo_details ?? ""}
                    placeholder="e.g. tap Set From Map, search 'Mirpur DOHS', then Pick Location."
                    className="field resize-y"
                  />
                </div>
              </div>
            </section>

            {error && (
              <p className="rounded-md bg-bad-soft px-2.5 py-2 text-[12px] text-bad">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? <Spinner /> : null} Save listing
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={`text-[11px] tabular-nums ${
        value > max ? "font-semibold text-bad" : "text-muted-foreground"
      }`}
    >
      {value}/{max}
    </span>
  );
}
