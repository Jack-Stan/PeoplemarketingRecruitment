<script setup lang="ts">
interface Props {
  modelValue: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number';
  label?: string;
  placeholder?: string;
  required?: boolean;
  autocomplete?: string;
  /** Password managers (Chrome's included) key off `name` alongside `autocomplete` — without it, save-password prompts can silently fail to trigger. */
  name?: string;
  error?: string;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
});

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputId = props.id ?? `field-${Math.random().toString(36).slice(2, 9)}`;
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-neutral-ink">
      {{ label }}<span v-if="required" class="text-semantic-danger">*</span>
    </label>
    <input
      :id="inputId"
      :type="type"
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :autocomplete="autocomplete"
      class="block w-full rounded-md border border-neutral-line bg-neutral-white px-3 py-2 text-neutral-ink placeholder-neutral-mute focus:border-primary-pink focus:outline-none focus:ring-1 focus:ring-primary-pink"
      :class="{ 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger': !!error }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="text-sm text-semantic-danger">{{ error }}</span>
  </div>
</template>