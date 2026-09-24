<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useTutorial } from '@/composables/useTutorial';
import { tourForUser } from '@/content/tour';
import { ROLE_LABELS } from '@/types/user';

/**
 * Spotlight rondleiding. Step 0 is a welcome card; every later step opens the
 * stop's page, finds its `data-tour` element and cuts a lit "hole" around it
 * (a huge box-shadow dims the rest), with an explanation card beside it.
 */
const auth = useAuth();
const router = useRouter();
const tutorial = useTutorial();

const stops = computed(() => tourForUser(auth.role.value, auth.isTeamLeader.value));
/** 0 = welcome card, 1..n = stop n-1. */
const step = ref(0);
const stop = computed(() => (step.value > 0 ? stops.value[step.value - 1] : null));
const isLast = computed(() => step.value === stops.value.length);
const firstName = computed(() => (auth.displayName.value ?? '').split(' ')[0]);

const PAD = 8;
const rect = ref<DOMRect | null>(null);
const searching = ref(false);
let targetEl: HTMLElement | null = null;

// Offer the tour once per account, as soon as the profile has a role — a
// user still on /pending-approval has no shell and so never gets here.
watch(
  [() => auth.user.value?.uid, () => auth.role.value],
  ([uid, role]) => {
    if (uid && role && !tutorial.hasSeen(uid)) {
      // Mark seen on open, not only on Klaar/✕: closing the tab mid-tour
      // otherwise re-offered it every visit. Reopen via Handleiding & FAQ.
      tutorial.markSeen(uid);
      tutorial.open();
    }
  },
  { immediate: true },
);

watch(tutorial.isOpen, (open) => {
  if (open) step.value = 0;
  else clearTarget();
});

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** The page is lazy-loaded and its data streams in, so poll briefly. */
async function findTarget(name: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour~="${name}"]`)].find(
      isVisible,
    );
    if (el) return el;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

function measure(): void {
  rect.value = targetEl && targetEl.isConnected ? targetEl.getBoundingClientRect() : null;
}

function clearTarget(): void {
  targetEl = null;
  rect.value = null;
}

let showToken = 0;
async function showStep(): Promise<void> {
  const token = ++showToken;
  clearTarget();
  const s = stop.value;
  if (!s) return;
  if (router.currentRoute.value.path !== s.route) await router.push(s.route);
  await nextTick();
  searching.value = true;
  const el = s.target ? await findTarget(s.target) : null;
  if (token !== showToken) return; // user already clicked on
  searching.value = false;
  targetEl = el;
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Measure after the smooth scroll settles; scroll/resize listeners keep it in sync after.
    setTimeout(measure, 350);
  }
  measure();
}

watch(step, () => void showStep());

window.addEventListener('resize', measure);
window.addEventListener('scroll', measure, true);
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  window.removeEventListener('scroll', measure, true);
});

const holeStyle = computed(() => {
  const r = rect.value;
  if (!r) return null;
  return {
    top: `${r.top - PAD}px`,
    left: `${r.left - PAD}px`,
    width: `${r.width + PAD * 2}px`,
    height: `${r.height + PAD * 2}px`,
  };
});

/**
 * Card placement, first fit wins: below, above, right, left of the target.
 * A tall target (sidebar, a long table) has no room above or below — the old
 * below/else-above rule then pushed the card off the top of the screen. When
 * nothing fits, returning null drops to the template's bottom-centred slot.
 */
const CARD_W = 360;
const CARD_H = 260;
const GAP = PAD + 12;
const cardStyle = computed(() => {
  const r = rect.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!r || vw < 640) return null;
  const clampLeft = (x: number) => Math.min(Math.max(16, x), vw - CARD_W - 16);
  const clampTop = (y: number) => Math.min(Math.max(16, y), vh - CARD_H - 16);
  const width = `${CARD_W}px`;
  if (vh - r.bottom - GAP > CARD_H) {
    return { top: `${r.bottom + GAP}px`, left: `${clampLeft(r.left)}px`, width };
  }
  if (r.top - GAP > CARD_H) {
    return { bottom: `${vh - r.top + GAP}px`, left: `${clampLeft(r.left)}px`, width };
  }
  if (vw - r.right - GAP > CARD_W + 16) {
    return { top: `${clampTop(r.top)}px`, left: `${r.right + GAP}px`, width };
  }
  if (r.left - GAP > CARD_W + 16) {
    return { top: `${clampTop(r.top)}px`, left: `${r.left - GAP - CARD_W}px`, width };
  }
  return null;
});

function finish(): void {
  const uid = auth.user.value?.uid;
  if (uid) tutorial.markSeen(uid);
  tutorial.close();
}
</script>

<template>
  <div
    v-if="tutorial.isOpen.value"
    class="fixed inset-0 z-40"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tutorial-title"
  >
    <!-- Click-blocker; dims the page itself only when there is no hole to do it. -->
    <div class="absolute inset-0" :class="holeStyle ? '' : 'bg-black/50'" />
    <div
      v-if="holeStyle"
      data-testid="tour-hole"
      class="tour-hole pointer-events-none absolute rounded-md text-primary-pink ring-4 ring-primary-pink transition-all duration-300"
      :style="holeStyle"
    />

    <div
      class="absolute flex max-h-[85vh] flex-col border border-black/10 bg-white shadow-2xl"
      :class="
        cardStyle
          ? ''
          : holeStyle
            ? 'inset-x-3 bottom-3 sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2'
            : 'inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2'
      "
      :style="cardStyle ?? undefined"
    >
      <button
        class="absolute right-2 top-2 px-2 text-neutral-mute hover:text-neutral-ink"
        aria-label="Rondleiding sluiten"
        @click="finish"
      >
        ✕
      </button>
      <div class="overflow-y-auto p-5">
        <template v-if="!stop">
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-pink">Welkom</p>
          <h3 id="tutorial-title" class="mt-1 text-xl font-bold">
            Hallo{{ firstName ? ` ${firstName}` : '' }}, eerste keer hier?
          </h3>
          <p class="mt-3 text-sm text-neutral-mute">
            We lopen samen door de app en tonen je waar de knoppen zitten die jij als
            <strong>{{ auth.role.value ? ROLE_LABELS[auth.role.value] : 'gebruiker' }}</strong>
            nodig hebt. Dat duurt een paar minuten.
          </p>
          <p class="mt-3 text-sm text-neutral-mute">
            Je vindt alles later terug onder <strong>Instellingen → Handleiding &amp; FAQ</strong>.
          </p>
        </template>

        <template v-else>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-mute">
            {{ step }} / {{ stops.length }}
          </p>
          <h3 id="tutorial-title" class="mt-1 pr-6 text-lg font-bold">{{ stop.title }}</h3>
          <p class="mt-2 text-sm">{{ stop.body }}</p>
          <p v-if="stop.target && !holeStyle && !searching" class="mt-2 text-xs text-neutral-mute">
            (Dit onderdeel verschijnt zodra er gegevens zijn.)
          </p>
        </template>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-3">
        <template v-if="step === 0">
          <button class="px-3 py-2 text-sm font-semibold text-neutral-mute" @click="finish">
            Nee, bedankt
          </button>
          <button class="bg-primary-pink px-4 py-2 text-sm font-bold text-white" @click="step++">
            Start rondleiding
          </button>
        </template>
        <template v-else>
          <button class="px-3 py-2 text-sm font-semibold text-neutral-mute" @click="step--">
            Vorige
          </button>
          <button
            class="bg-primary-pink px-4 py-2 text-sm font-bold text-white"
            @click="isLast ? finish() : step++"
          >
            {{ isLast ? 'Klaar' : 'Volgende' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The giant shadow is what dims everything outside the lit target. */
.tour-hole {
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.55);
  animation: tour-pulse 1.6s ease-in-out infinite;
}
@keyframes tour-pulse {
  50% {
    outline: 6px solid color-mix(in srgb, currentColor 35%, transparent);
    outline-offset: 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tour-hole {
    animation: none;
    transition: none;
  }
}
</style>
