<template>
  <v-table density="compact" class="leaderboard-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>User</th>
        <th>Games</th>
        <th>Pieces</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row) in rows">
        <td class="text-center">
          <v-icon v-if="row.rank === 1" icon="mdi-podium-gold" class="text-amber" />
          <v-icon v-else-if="row.rank === 2" icon="mdi-podium-silver" class="text-blue-grey" />
          <v-icon v-else-if="row.rank === 3" icon="mdi-podium-bronze" class="text-brown" />
          <span v-else>{{ row.rank }}</span>
        </td>
        <td>{{ row.user_name }}</td>
        <td>{{ row.games_count }}</td>
        <td>{{ row.pieces_count }}</td>
      </tr>
      <tr v-if="userRow && userRow.rank > 10" class="user-rank-row">
        <td class="text-center">
          {{ userRow.rank }}
        </td>
        <td>{{ userRow.user_name }}</td>
        <td>{{ userRow.games_count }}</td>
        <td>{{ userRow.pieces_count }}</td>
      </tr>
    </tbody>
  </v-table>
</template>
<script setup lang="ts">
import { LeaderboardRow } from '../../common/Types'

defineProps<{
  rows: LeaderboardRow[],
  userRow: LeaderboardRow | null
}>()
</script>
