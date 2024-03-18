<template>
  <v-container>
    <Nav />
    <h1>Users</h1>

    <v-table density="compact">
      <thead>
        <tr>
          <th>Id</th>
          <th>Created</th>
          <th>Client Id</th>
          <th>Id</th>
          <th>Created</th>
          <th>Client ID</th>
          <th>Name</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in users"
          :key="idx"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.created }}</td>
          <td>{{ item.client_id }}</td>
          <td>
            <template v-if="item.name">
              {{ item.name }}
            </template><template v-else>
              -
            </template>
          </td>
          <td>
            <template v-if="item.email">
              {{ item.email }}
            </template><template v-else>
              -
            </template>
          </td>
        </tr>
      </tbody>
    </v-table>

    <h2>MERGE CLIENT IDS</h2>

    <div class="mb-4">
      <div><strong>Query to find client ids / users that could be merged:</strong></div>
      <pre><code>{{ query }}</code></pre>
    </div>

    <div class="mb-4">
      <div><strong>Merge Settings:</strong></div>
      <v-text-field
        v-model="userId"
        label="User Id"
      />


      <v-textarea
        v-model="clientIds"
        label="Client Ids (one per line)"
      />

      <v-checkbox
        v-model="dry"
        label="Dry Run"
      />
      <v-btn
        :disabled="!userId || !clientIds || busy"
        block
        @click="mergeClientIdsIntoUser"
      >
        Merge
      </v-btn>
    </div>

    <div
      v-if="mergeResult"
      class="mb-4"
    >
      <div><strong>Result:</strong></div>
      <pre><code>{{ mergeResult }}</code></pre>
    </div>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import { MergeClientIdsIntoUserResult } from '~common/Types'

const users = ref<any[]>([])

const dry = ref<boolean>(true)
const mergeResult = ref<MergeClientIdsIntoUserResult | null>(null)
const query = `
with users_with_accounts as (
  select u.* from users u
    inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
    inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
  union
  select u.* from users u
    inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
)
,    player_x_game as (select json_array_elements((data::json)->'players')::json as player, id as game_id from games)
,    analyze_row as (select player->>4 as playername, player->>0 as client_id, game_id from player_x_game)
,    joined_analyze_row as (select ar.game_id, ar.playername, ar.client_id, uwa.id as user_id, uwa.client_id as user_client_id from analyze_row ar left join users_with_accounts uwa on uwa.client_id = ar.client_id)
select playername, client_id, user_id, user_client_id, count(game_id), string_agg(game_id, ',')
from joined_analyze_row
where playername ilike '%someone%'
group by playername, client_id, user_id, user_client_id
`

const busy = ref<boolean>(false)
const userId = ref<number>(0)
const clientIds = ref<string>('')
const mergeClientIdsIntoUser = async () => {
  if (busy.value) {
    return
  }
  mergeResult.value = null
  busy.value = true
  const clientIdValues = clientIds.value.split('\n').map((x: string) => x.trim())
  mergeResult.value = await api.admin.mergeClientIdsIntoUser(userId.value, clientIdValues, dry.value)
  busy.value = false
}

onMounted(async () => {
  if (user.getMe()) {
    users.value = await api.admin.getUsers()
  }
  user.eventBus.on('login', async () => {
    users.value = await api.admin.getUsers()
  })
  user.eventBus.on('logout', () => {
    users.value = []
  })
})
</script>
