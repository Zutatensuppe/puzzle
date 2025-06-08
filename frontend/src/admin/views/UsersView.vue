<template>
  <v-container>
    <Nav />
    <h1>Users</h1>

    <Pagination
      v-if="users"
      :pagination="users.pagination"
      @click="onPagination"
    />
    <v-table
      v-if="users"
      density="compact"
    >
      <thead>
        <tr>
          <th>Id</th>
          <th>Created</th>
          <th>Client Id</th>
          <th>Name</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in users.items"
          :key="item.id"
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
    <Pagination
      v-if="users"
      :pagination="users.pagination"
      @click="onPagination"
    />

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
import Pagination from '../../components/Pagination.vue'
import type { ClientId, MergeClientIdsIntoUserResult, Pagination as PaginationType, UserId, UserRow } from '../../../../common/src/Types'

const perPage = 50
const users = ref<{ items: UserRow[], pagination: PaginationType } | null>(null)

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
const userId = ref<UserId>(0 as UserId)
const clientIds = ref<string>('')
const mergeClientIdsIntoUser = async () => {
  if (busy.value) {
    return
  }
  mergeResult.value = null
  busy.value = true
  const clientIdValues: ClientId[] = clientIds.value.split('\n').map((x: string) => x.trim()) as ClientId[]
  mergeResult.value = await api.admin.mergeClientIdsIntoUser(userId.value, clientIdValues, dry.value)
  busy.value = false
}

const loadUsers = async (data: { limit: number, offset: number }) => {
  const responseData = await api.admin.getUsers(data)
  if ('error' in responseData) {
    console.error('Error loading users:', responseData.error)
    return null
  }
  return responseData
}

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!users.value) {
    return
  }
  users.value = await loadUsers(q)
}

onMounted(async () => {
  if (user.getMe()) {
    users.value = await loadUsers({ limit: perPage, offset: 0 })
  }
  user.eventBus.on('login', async () => {
    users.value = await loadUsers({ limit: perPage, offset: 0 })
  })
  user.eventBus.on('logout', () => {
    users.value = null
  })
})
</script>
