import { ImageSearchSort, ImageState, IMAGE_STATES_VISIBLE, IMAGE_STATES_PENDING, IMAGE_STATES_TRUSTED } from '@common/Types'
import type { CurationEventRow, ImageId, ImageRow, ImageRowWithCount, Pagination, TagId, TagRow, TagRowWithCount, UploaderInfo, UserId } from '@common/Types'
import type Db from '../lib/Db'
import type { OrderBy, WhereRaw } from '../lib/Db'
import DbData from '../app/DbData'

export class ImagesRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async get(where: WhereRaw): Promise<ImageRow | null> {
    return await this.db.get(DbData.Tables.Images, where)
  }

  async getMany(where: WhereRaw): Promise<ImageRow[]> {
    return await this.db.getMany(DbData.Tables.Images, where)
  }

  async getManyByIds(ids: ImageId[]): Promise<ImageRow[]> {
    if (ids.length === 0) {
      return []
    }
    return await this.db.getMany(DbData.Tables.Images, { id: { '$in': ids } })
  }

  async count(): Promise<number> {
    return await this.db.count(DbData.Tables.Images)
  }

  async countPublicByUser(userId: UserId): Promise<number> {
    return await this.db.count(DbData.Tables.Images, {
      uploader_user_id: userId,
      private: 0,
    })
  }

  async getWithGameCount(args: {
    offset: number
    limit: number
    filter: {
      ids: ImageId[]
      tags: string[]
      uploaderUserId?: UserId
    }
  }): Promise<ImageRowWithCount[]> {
    const { offset, limit, filter } = args

    const rawWhere: WhereRaw = {}
    let joins = ''
    if (filter.tags.length > 0) {
      rawWhere['t.slug'] = { '$in': filter.tags }
      joins = `
        INNER JOIN ${DbData.Tables.ImageXTag} ixt ON ixt.image_id = i.id
        INNER JOIN ${DbData.Tables.Tags} t ON t.id = ixt.category_id
      `
    }

    if (filter.ids.length > 0) {
      rawWhere['i.id'] = { '$in': filter.ids }
    }

    if (filter.uploaderUserId) {
      rawWhere['i.uploader_user_id'] = filter.uploaderUserId
    }

    const where = this.db._buildWhere(rawWhere)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          ${DbData.Tables.Games}
        GROUP BY image_id
      )
      SELECT
        i.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(u.name, '') AS uploader_user_name
      FROM ${DbData.Tables.Images} i
        LEFT JOIN counts ON counts.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
        ${joins}
      ${where.sql}
      ORDER BY i.id DESC
      ${this.db._buildLimit({ offset, limit })};
    `, where.values)
  }

  async delete(imageId: ImageId): Promise<void> {
    await this.db.delete(DbData.Tables.Images, { id: imageId })
  }

  async getPendingApprovals(offset: number, limit: number): Promise<{ items: ImageRowWithCount[], total: number }> {
    const where = this.db._buildWhere({ state: { '$in': IMAGE_STATES_PENDING }, private: 0 })
    const countRow = await this.db._get<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM ${DbData.Tables.Images}
      ${where.sql}
    `, where.values)
    const total = countRow?.count ?? 0

    const whereI = this.db._buildWhere({ 'i.state': { '$in': IMAGE_STATES_PENDING }, 'i.private': 0 })
    const items = await this.db._getMany<ImageRowWithCount>(`
      WITH counts AS (
        SELECT COUNT(*)::int AS count, image_id
        FROM ${DbData.Tables.Games}
        GROUP BY image_id
      )
      SELECT
        i.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(u.name, '') AS uploader_user_name
      FROM ${DbData.Tables.Images} i
        LEFT JOIN counts ON counts.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
      ${whereI.sql}
      ORDER BY i.created ASC
      ${this.db._buildLimit({ offset, limit })}
    `, whereI.values)

    return { items, total }
  }

  async getNextForCuration(topic: string, maxPasses: number): Promise<{
    image: (ImageRowWithCount & { tags: TagRow[], topic_value: string | number | boolean | null }) | null,
    progress: { reviewed: number, total: number },
  }> {
    // Count total non-private images and how many have been reviewed (> maxPasses events for this topic)
    const statsRow = await this.db._get<{ reviewed: number, total: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE ce_counts.cnt > $1)::int AS reviewed,
        COUNT(*)::int AS total
      FROM ${DbData.Tables.Images} i
      LEFT JOIN (
        SELECT image_id, COUNT(*)::int AS cnt
        FROM ${DbData.Tables.CurationEvents}
        WHERE topic = $2
        GROUP BY image_id
      ) ce_counts ON ce_counts.image_id = i.id
      WHERE i.private = 0
    `, [maxPasses, topic])
    const progress = { reviewed: statsRow?.reviewed ?? 0, total: statsRow?.total ?? 0 }

    // Get next image with <= maxPasses events for this topic
    const image = await this.db._get<ImageRowWithCount>(`
      WITH counts AS (
        SELECT COUNT(*)::int AS count, image_id
        FROM ${DbData.Tables.Games}
        GROUP BY image_id
      )
      SELECT
        i.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(u.name, '') AS uploader_user_name
      FROM ${DbData.Tables.Images} i
        LEFT JOIN counts ON counts.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
        LEFT JOIN (
          SELECT image_id, COUNT(*)::int AS cnt
          FROM ${DbData.Tables.CurationEvents}
          WHERE topic = $1
          GROUP BY image_id
        ) ce_counts ON ce_counts.image_id = i.id
      WHERE i.private = 0 AND COALESCE(ce_counts.cnt, 0) <= $2
      ORDER BY i.created ASC
      LIMIT 1
    `, [topic, maxPasses])

    if (!image) {
      return { image: null, progress }
    }

    // Get tags for this image
    const tags = await this.getTagsByImageIds([image.id])
    const imageTags = tags[image.id] ?? []

    // Compute the current topic value
    const topicValue = await this.getTopicValue(image, topic)

    return {
      image: { ...image, tags: imageTags, topic_value: topicValue },
      progress,
    }
  }

  private async getTopicValue(
    image: ImageRow,
    topic: string,
  ): Promise<string | number | boolean | null> {
    if (topic === 'state') return image.state
    if (topic === 'ai_generated') return image.ai_generated
    if (topic === 'nsfw') return image.nsfw
    if (topic.startsWith('tag:')) {
      const slug = topic.slice(4)
      const row = await this.db._get<{ confirmed: boolean }>(`
        SELECT ixc.confirmed
        FROM ${DbData.Tables.ImageXTag} ixc
        INNER JOIN ${DbData.Tables.Tags} t ON t.id = ixc.category_id
        WHERE ixc.image_id = $1 AND t.slug = $2
      `, [image.id, slug])
      return row ? true : false
    }
    return null
  }

  async insert(image: Omit<ImageRow, 'id'>): Promise<ImageId> {
    return await this.db.insert(DbData.Tables.Images, image, 'id') as ImageId
  }

  async update(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.db.update(DbData.Tables.Images, image, where)
  }

  async insertCurationEvent(event: Omit<CurationEventRow, 'id' | 'created_at'>): Promise<void> {
    await this.db.insert(DbData.Tables.CurationEvents, event)
  }

  async deleteTagRelations(imageId: ImageId, adminMode = false): Promise<void> {
    if (adminMode) {
      await this.db.delete(DbData.Tables.ImageXTag, { image_id: imageId })
    } else {
      await this.db.run(
        `DELETE FROM ${DbData.Tables.ImageXTag} WHERE image_id = $1 AND confirmed = false`,
        [imageId],
      )
    }
  }

  async upsertConfirmedTag(imageId: ImageId, tagSlug: string): Promise<void> {
    const tag = await this.upsertTag({ slug: tagSlug, title: tagSlug })
    if (!tag) return
    // upsert: insert or update confirmed = true
    await this.db.run(`
      INSERT INTO ${DbData.Tables.ImageXTag} (image_id, category_id, confirmed)
      VALUES ($1, $2, true)
      ON CONFLICT (image_id, category_id) DO UPDATE SET confirmed = true
    `, [imageId, tag])
  }

  async removeTag(imageId: ImageId, tagSlug: string): Promise<void> {
    const tags = await this.getTagsBySlugs([tagSlug])
    if (!tags.length) return
    await this.db.run(
      `DELETE FROM ${DbData.Tables.ImageXTag} WHERE image_id = $1 AND category_id = $2`,
      [imageId, tags[0].id],
    )
  }

  async insertTagRelationIfNotExists(imageId: ImageId, tagId: TagId): Promise<void> {
    await this.db.run(`
      INSERT INTO ${DbData.Tables.ImageXTag} (image_id, category_id, confirmed)
      VALUES ($1, $2, false)
      ON CONFLICT (image_id, category_id) DO NOTHING
    `, [imageId, tagId])
  }

  async upsertTag(tag: Omit<TagRow, 'id'>): Promise<TagId> {
    return await this.db.upsert(DbData.Tables.Tags, tag, ['slug'], 'id')
  }

  async getTagsBySlugs(slugs: string[]): Promise<TagRow[]> {
    return await this.db.getMany(DbData.Tables.Tags, {slug: {'$in': slugs}})
  }

  async getTagsBySearch(search: string): Promise<TagRow[]> {
    return await this.db.getMany(DbData.Tables.Tags, {slug: {'$ilike': search + '%'}})
  }

  async getImageIdsByTags(tags: TagRow[]): Promise<ImageId[]> {
    if (!tags.length) {
      return []
    }

    const where = this.db._buildWhere({
      'category_id': {'$in': tags.map(x => x.id)},
    })
    const rows = await this.db._getMany<{ id: ImageId }>(`
      select i.id
      from ${DbData.Tables.ImageXTag} ixc
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      ${where.sql};
    `, where.values)

    return rows.map(img => img.id)
  }

  async getTagsByImageIds(imageIds: ImageId[]): Promise<Record<ImageId, TagRow[]>> {
    const where = this.db._buildWhere({'i.id': { '$in': imageIds }})
    const query = `
      select i.id as image_id, json_agg(t.*) as tags
      from ${DbData.Tables.Tags} t
      inner join ${DbData.Tables.ImageXTag} ixc on t.id = ixc.category_id
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      ${where.sql}
      group by i.id
    `
    const rows = await this.db._getMany<{
      image_id: ImageId,
      tags: TagRow[]
    }>(query, where.values)
    const tags: Record<ImageId, TagRow[]> = {}
    for (const row of rows) {
      tags[row.image_id] = row.tags
    }
    return tags
  }

  async searchImagesWithCount(
    search: string,
    orderBy: string,
    offset: number,
    limit: number,
    currentUserId: UserId | null,
    limitToUserId: UserId | null,
    showNsfw: boolean,
    hideAiImages: boolean,
  ): Promise<ImageRowWithCount[]> {
    const orderByMap = {
      [ImageSearchSort.ALPHA_ASC]: [{ title: 1 }, { created: -1 }],
      [ImageSearchSort.ALPHA_DESC]: [{ title: -1 }, { created: -1 }],
      [ImageSearchSort.DATE_ASC]: [{ created: 1 }],
      [ImageSearchSort.DATE_DESC]: [{ created: -1 }],
      [ImageSearchSort.GAME_COUNT_ASC]: [{ games_count: 1 }, { created: -1 }],
      [ImageSearchSort.GAME_COUNT_DESC]: [{ games_count: -1 }, { created: -1 }],
    } as Record<string, OrderBy>
    if (!orderByMap[orderBy]) {
      return []
    }

    const imageIds: ImageId[] = []
    // search in tags:
    const searchClean = search.trim()
    const searches = searchClean ? searchClean.split(/\s+/) : []

    if (searches.length > 0) {
      for (search of searches) {
        const tags = await this.getTagsBySearch(search)
        const imageIdsByTags = await this.getImageIdsByTags(tags)
        imageIds.push(...imageIdsByTags)
      }
    }

    let i = 1
    let idxCurrentUserId = 0
    const params: (string|number)[] = []
    if (currentUserId) {
      params.push(currentUserId)
      idxCurrentUserId = i
      i++
    }
    let idxLimitToUserId = 0
    if (limitToUserId) {
      params.push(limitToUserId)
      idxLimitToUserId = i
      i++
    }
    const ors: string[] = []
    if (imageIds.length > 0) {
      ors.push(`i.id IN (${imageIds.join(',')})`)
    }
    if (searches.length) {
      for (search of searches) {
        ors.push(`u.name ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`i.title ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`i.copyright_name ilike $${i++}`)
        params.push(`%${search}%`)
      }
    }
    params.push(...IMAGE_STATES_VISIBLE)

    return await this.db._getMany<ImageRowWithCount>(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          g.image_id
        FROM
          ${DbData.Tables.Games} g
        WHERE
          g.private = 0
        GROUP BY g.image_id
      )
      SELECT
        i.*,
        COALESCE(c.count, 0) AS games_count,
        COALESCE(u.name, '') as uploader_user_name
      FROM
        ${DbData.Tables.Images} i
        LEFT JOIN counts c ON c.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
      WHERE
        (
          (i.private = 0 AND i.state IN (${IMAGE_STATES_VISIBLE.map(() => `$${i++}`).join(', ')}))
          ${currentUserId ? `OR i.uploader_user_id = $${idxCurrentUserId}` : ''}
        )
        ${!showNsfw ? (idxCurrentUserId ? ` AND (i.nsfw = 0 OR i.uploader_user_id = $${idxCurrentUserId || 0})` : ' AND i.nsfw = 0') : '' }
        ${hideAiImages ? (idxCurrentUserId ? ` AND (i.ai_generated = 0 OR i.uploader_user_id = $${idxCurrentUserId || 0})` : ' AND i.ai_generated = 0') : '' }
        ${limitToUserId ? ` AND i.uploader_user_id = $${idxLimitToUserId}` : ''}
        ${ors.length > 0 ? ` AND (${ors.join(' OR ')})` : ''}
      ${this.db._buildOrderBy(orderByMap[orderBy])}
      ${this.db._buildLimit({ offset, limit })}
    `, params)
  }

  async getGameCount(imageId: ImageId): Promise<number> {
    const rows = await this.getImagesWithCountByIds([imageId])
    return rows.length > 0 ? rows[0].games_count : 0
  }

  async getImagesWithCountByIds(imageIds: ImageId[]): Promise<ImageRowWithCount[]> {
    const params: unknown[] = []
    const dbWhere = this.db._buildWhere({'i.id': { '$in': imageIds }})
    params.push(...dbWhere.values)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          g.image_id
        FROM
          ${DbData.Tables.Games} g
        WHERE
          g.private = 0
        GROUP BY g.image_id
      )
      SELECT
        i.*,
        COALESCE(c.count, 0) AS games_count,
        COALESCE(u.name, '') as uploader_user_name
      FROM
        ${DbData.Tables.Images} i
        LEFT JOIN counts c ON c.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
      ${dbWhere.sql}
    `, params)
  }

  async getAllTagsWithCount(): Promise<TagRowWithCount[]> {
    const query = `
      select t.id, t.slug, t.title, count(*)::int as images_count
      from ${DbData.Tables.Tags} t
      inner join ${DbData.Tables.ImageXTag} ixc on t.id = ixc.category_id
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      group by t.id order by images_count desc;`
    return await this.db._getMany(query)
  }

  async approveImage(imageId: ImageId): Promise<void> {
    await this.db.update(DbData.Tables.Images, {
      state: ImageState.Approved,
    }, {
      id: imageId,
      state: ImageState.PendingApproval,
    })
  }

  async reportImage(imageId: ImageId): Promise<void> {
    await this.db.run(`UPDATE ${DbData.Tables.Images} SET reported = reported + 1 WHERE id = $1`, [imageId])
  }

  async getUploadersWithStats(
    offset: number,
    limit: number,
  ): Promise<{ items: UploaderInfo[], pagination: Pagination }> {
    const countRow = await this.db._get<{ count: number }>(`
      SELECT COUNT(DISTINCT uploader_user_id)::int AS count
      FROM ${DbData.Tables.Images}
      WHERE uploader_user_id IS NOT NULL
    `)
    const total = countRow?.count ?? 0

    const items = await this.db._getMany<UploaderInfo>(`
      SELECT
        u.id,
        u.name,
        u.trusted,
        u.trust_manually_set AS "trustManuallySet",
        COUNT(*) FILTER (WHERE i.state IN (${IMAGE_STATES_TRUSTED.map((_, idx) => `$${idx + 1}`).join(', ')}))::int AS "approvedCount",
        COUNT(*) FILTER (WHERE i.state = '${ImageState.Rejected}')::int AS "rejectedCount",
        COUNT(*) FILTER (WHERE i.state IN (${IMAGE_STATES_PENDING.map((_, idx) => `$${idx + IMAGE_STATES_TRUSTED.length + 1}`).join(', ')}))::int AS "pendingCount",
        COUNT(*)::int AS "totalCount"
      FROM ${DbData.Tables.Users} u
      INNER JOIN ${DbData.Tables.Images} i ON i.uploader_user_id = u.id
      GROUP BY u.id
      ORDER BY u.id DESC
      OFFSET $${IMAGE_STATES_TRUSTED.length + IMAGE_STATES_PENDING.length + 1} LIMIT $${IMAGE_STATES_TRUSTED.length + IMAGE_STATES_PENDING.length + 2}
    `, [...IMAGE_STATES_TRUSTED, ...IMAGE_STATES_PENDING, offset, limit])

    return { items, pagination: { total, offset, limit } }
  }

  async getAllUploaderIds(): Promise<UserId[]> {
    const rows = await this.db._getMany<{ uploader_user_id: UserId }>(`
      SELECT DISTINCT uploader_user_id
      FROM ${DbData.Tables.Images}
      WHERE uploader_user_id IS NOT NULL
    `)
    return rows.map(r => r.uploader_user_id)
  }
}
