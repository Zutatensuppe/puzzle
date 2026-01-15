<template>
  <v-table
    density="compact"
    class="leaderboard-table"
  >
    <thead>
      <tr>
        <th>Rank</th>
        <th>User</th>
        <th>Pieces</th>
        <th>Games</th>
      </tr>
    </thead>
    <tbody v-if="lb.entries.length > 0 || lb.userEntry">
      <tr
        v-for="(row, idx) in lb.entries"
        :key="idx"
        :class="{'user-rank-row': row.user_id === lb.userEntry?.user_id}"
      >
        <td class="text-center">
          <RankIcon
            :rank="row.rank"
            :unranked-fallback="'<no rank>'"
          />
        </td>
        <td>
          <router-link
            :to="{ name: 'user', params: { id: row.user_id } }"
            target="_blank"
            class="d-flex align-center"
          >
            <UserAvatarIcon
              :size="24"
              :avatar-url="row.avatar_url"
              class="mr-1"
            />
            {{ row.user_name }}
          </router-link>
        </td>
        <td>
          {{ row.pieces_count }}
        </td>
        <td>
          {{ row.games_count }}
        </td>
      </tr>
      <tr
        v-if="lb.userEntry && (!lb.userEntry.rank || lb.userEntry.rank > lb.entries.length)"
        class="user-rank-row with-border"
      >
        <td class="text-center">
          {{ lb.userEntry.rank || '-' }}
        </td>
        <td>{{ lb.userEntry.user_name }}</td>
        <td>{{ lb.userEntry.pieces_count }}</td>
        <td>{{ lb.userEntry.games_count }}</td>
      </tr>
    </tbody>
    <tbody v-else>
      <tr>
        <td
          colspan="4"
          class="text-disabled"
        >
          No entries yet.
        </td>
      </tr>
    </tbody>
  </v-table>
</template>
<script setup lang="ts">
import type { Leaderboard } from '@common/Types'
import RankIcon from './RankIcon.vue'
import UserAvatarIcon from './UserAvatarIcon.vue'

defineProps<{
  lb: Leaderboard
}>()
</script>
