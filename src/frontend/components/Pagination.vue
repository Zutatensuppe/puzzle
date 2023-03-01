<template>
  <div
    v-if="totalPages > 1"
    class="pagination d-flex"
  >
    <v-btn
      size="small"
      :disabled="currentPage <= 1 ? true : undefined"
      @click="onPageClick(currentPage - 1)"
    >
      <v-icon icon="mdi-chevron-left" />
    </v-btn>
    <v-btn
      v-for="(page, idx) in paginationItems"
      :key="idx"
      size="small"
      :disabled="page === currentPage ? true : undefined"
      @click="onPageClick(page)"
    >
      {{ page }}
    </v-btn>
    <v-btn
      size="small"
      :disabled="currentPage === totalPages ? true : undefined"
      @click="onPageClick(currentPage + 1)"
    >
      <v-icon icon="mdi-chevron-right" />
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Pagination } from '../../common/Types'

// TODO: limit the number of page links that are generated

const props = defineProps<{
  pagination: Pagination
}>()

const emit = defineEmits<{
  (e: 'click', val: { limit: number, offset: number }): void
}>()

const totalPages = computed(() => {
  return Math.floor(props.pagination.total / props.pagination.limit)
    + (props.pagination.total % props.pagination.limit === 0 ? 0 : 1)
})

const OFFSET = 4
const paginationItems = computed(() => {
  let start = currentPage.value - OFFSET
  const endOffsetAdd = start < 1 ? -start + 1 : 0
  if (start < 1) {
    start = 1
  }
  let end = currentPage.value + OFFSET + endOffsetAdd
  const startOffsetAdd = end > totalPages.value ? (totalPages.value - end) : 0
  if (end > totalPages.value) {
    end = totalPages.value
  }
  start += startOffsetAdd
  if (start < 1) {
    start = 1
  }

  const items: number[] = []
  for (let i = start; i <= end; i++) {
    items.push(i)
  }
  return items
})

const currentPage = computed(() => {
  // should not be required to floor this.
  return Math.floor(props.pagination.offset / props.pagination.limit) + 1
})

const onPageClick = (page: number) => {
  emit('click', {
    limit: props.pagination.limit,
    offset: (page - 1) * props.pagination.limit,
  })
}
</script>
