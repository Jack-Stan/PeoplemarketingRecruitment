<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
});

const classes = computed(() => {
  const base = [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-md',
    'font-medium',
    'transition-colors',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-semantic-focus',
    'focus:ring-offset-2',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
  ];

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
  };

  const variants: Record<string, string> = {
    primary: 'bg-primary-pink text-semantic-accent-text hover:bg-primary-pink-alt',
    secondary: 'bg-neutral-black text-neutral-white hover:bg-neutral-ink',
    ghost: 'bg-transparent text-neutral-ink hover:bg-neutral-surface border border-neutral-line',
    danger: 'bg-semantic-danger text-neutral-white hover:opacity-90',
  };

  return [
    ...base,
    sizes[props.size],
    variants[props.variant],
    props.block ? 'w-full' : '',
  ].join(' ');
});
</script>

<template>
  <button :type="type" :disabled="disabled || loading" :class="classes">
    <span v-if="loading" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>