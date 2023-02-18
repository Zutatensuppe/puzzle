<template>
  <v-table density="compact" class="leaderboard-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>User</th>
        <th>Pieces</th>
        <th>Games</th>
      </tr>
    </thead>
    <tbody v-if="lb.entries.length > 0 || lb.userEntry">
      <tr v-for="row in lb.entries" :class="{'user-rank-row': row.user_id === lb.userEntry?.user_id}">
        <td class="text-center">
          <v-icon v-if="row.rank === 1" icon="mdi-podium-gold" class="text-amber" />
          <v-icon v-else-if="row.rank === 2" icon="mdi-podium-silver" class="text-blue-grey" />
          <v-icon v-else-if="row.rank === 3" icon="mdi-podium-bronze" class="text-brown" />
          <span v-else>{{ row.rank }}</span>
        </td>
        <td>{{ row.user_name }}</td>
        <td>{{ row.pieces_count }}</td>
        <td>{{ row.games_count }}</td>
      </tr>
      <tr v-if="lb.userEntry && (!lb.userEntry.rank || lb.userEntry.rank > lb.entries.length)" class="user-rank-row with-border">
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
        <td colspan="4" class="text-disabled">No entries yet.</td>
      </tr>
    </tbody>
  </v-table>
</template>
<script setup lang="ts">
import { Leaderboard } from '../../common/Types'

defineProps<{
  lb: Leaderboard
}>()
</script>
